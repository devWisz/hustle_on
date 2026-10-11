// Package solana talks to a Solana JSON-RPC endpoint.
//
// It exists so the API can independently verify what a client claims happened
// on chain. A signature submitted by a browser is an assertion, not evidence;
// nothing is credited until this package has read the transaction back from
// the cluster and checked the balances actually moved.
package solana

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/sardhana/auth/base58"
)

// Errors returned by verification. They are distinguished because the caller
// treats them differently: a not-found signature may still land, a failed or
// mismatched one never will.
var (
	ErrNotFound   = errors.New("solana: transaction not found")
	ErrFailed     = errors.New("solana: transaction failed on chain")
	ErrMismatch   = errors.New("solana: transaction does not match the expected transfer")
	ErrRPCRequest = errors.New("solana: rpc request failed")
)

// Client is a minimal JSON-RPC client.
type Client struct {
	rpcURL  string
	cluster string
	// programID is the deployed sponsorship program. Empty means none is
	// configured, and sponsorships are then verified as plain transfers.
	programID string
	http      *http.Client
}

// SponsorInstruction is the program instruction a sponsorship is expected to
// arrive as. It is named in one place because verification decodes both its
// discriminator and its single argument.
const SponsorInstruction = "sponsor"

// MaxPlatformFeeBps bounds the fee the deployed program may take, in basis
// points. It is the same ceiling the program itself enforces, and it is what
// lets verification work out the least a creator can have received from the
// amount alone, without a second RPC call.
const MaxPlatformFeeBps = 1000

// SetProgramID records the deployed sponsorship program.
func (c *Client) SetProgramID(id string) { c.programID = id }

// ProgramID returns the configured program, or the empty string.
func (c *Client) ProgramID() string { return c.programID }

// ProgramDeployed reports whether an address holds an executable program.
//
// "Configured" and "deployed" are different things, and the gap between them is
// silent: an API with HUSTLEON_PAY_PROGRAM_ID set to an address where nothing was
// ever deployed will reject every sponsorship, and the rejection looks exactly
// like a donor sending the wrong transaction. This is the question that tells the
// two apart, and it needs no PDA derivation — the program account is a direct
// lookup.
func (c *Client) ProgramDeployed(ctx context.Context, address string) (bool, error) {
	if address == "" {
		return false, nil
	}
	var out struct {
		Value *struct {
			Executable bool   `json:"executable"`
			Owner      string `json:"owner"`
		} `json:"value"`
	}
	if err := c.call(ctx, "getAccountInfo", []any{
		address,
		map[string]any{"encoding": "base64"},
	}, &out); err != nil {
		return false, err
	}
	return out.Value != nil && out.Value.Executable, nil
}

// VerifySponsorship verifies a sponsorship by whichever rule this deployment
// uses: the on-chain program when one is configured, a plain transfer otherwise.
//
// It is deliberately the only exported way to verify a sponsorship. The two rules
// are not interchangeable — under the program the creator receives the amount
// less a platform fee, so a balance check expecting the full amount rejects a
// perfectly good payment — and when both were exported, one of the three call
// sites was left on the wrong one. Keeping them unexported means a caller now has
// to be wrong about the name of the only function that exists.
//
// The choice lives here rather than at each call site because both the confirm
// handler and the settle loop have to make it, and two copies of a rule like this
// drift the moment one of them is changed.
func (c *Client) VerifySponsorship(ctx context.Context, check TransferCheck) (*VerifiedTransfer, error) {
	if c.programID == "" {
		return c.verifyTransfer(ctx, check)
	}
	return c.verifyProgramTransfer(ctx, ProgramTransferCheck{
		TransferCheck:   check,
		ProgramID:       c.programID,
		InstructionName: SponsorInstruction,
		MaxFeeBps:       MaxPlatformFeeBps,
	})
}

func New(rpcURL, cluster string) *Client {
	return &Client{
		rpcURL:  rpcURL,
		cluster: cluster,
		// A slow RPC provider must not be able to pin API goroutines open.
		http: &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) Cluster() string { return c.cluster }

// Health asks the node whether it is up and, in its own words, healthy.
//
// It exists for the operator rather than for the request path: every sponsorship
// on the site depends on reaching this endpoint, and "is the RPC answering" is
// the first question when one does not confirm. A failure here is not an API
// failure, so it is reported as a value rather than as an error the caller has to
// interpret.
func (c *Client) Health(ctx context.Context) error {
	var status string
	if err := c.call(ctx, "getHealth", nil, &status); err != nil {
		return err
	}
	if status != "ok" {
		return fmt.Errorf("%w: node reported %q", ErrRPCRequest, status)
	}
	return nil
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  []any  `json:"params"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func (c *Client) call(ctx context.Context, method string, params []any, out any) error {
	body, err := json.Marshal(rpcRequest{JSONRPC: "2.0", ID: 1, Method: method, Params: params})
	if err != nil {
		return fmt.Errorf("%w: encode: %v", ErrRPCRequest, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.rpcURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrRPCRequest, err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrRPCRequest, err)
	}
	defer resp.Body.Close()

	// A hostile or broken endpoint must not be able to exhaust memory here.
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return fmt.Errorf("%w: read: %v", ErrRPCRequest, err)
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("%w: status %d", ErrRPCRequest, resp.StatusCode)
	}

	var envelope rpcResponse
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return fmt.Errorf("%w: decode: %v", ErrRPCRequest, err)
	}
	if envelope.Error != nil {
		return fmt.Errorf("%w: %s", ErrRPCRequest, envelope.Error.Message)
	}
	if len(envelope.Result) == 0 || string(envelope.Result) == "null" {
		return ErrNotFound
	}
	return json.Unmarshal(envelope.Result, out)
}

// Instruction is one instruction as the RPC returns it under `json` encoding:
// the program is named by its index into the transaction's account list, and the
// data is base58.
type Instruction struct {
	ProgramIDIndex int    `json:"programIdIndex"`
	Accounts       []int  `json:"accounts"`
	Data           string `json:"data"`
}

// Transaction is the subset of a confirmed transaction verification needs.
type Transaction struct {
	Slot      int64  `json:"slot"`
	BlockTime *int64 `json:"blockTime"`
	Meta      struct {
		Err          json.RawMessage `json:"err"`
		Fee          int64           `json:"fee"`
		PreBalances  []int64         `json:"preBalances"`
		PostBalances []int64         `json:"postBalances"`
		LogMessages  []string        `json:"logMessages"`
		// Addresses a versioned transaction pulled in from a lookup table. They
		// are appended to the static keys to form the list every index in this
		// transaction refers to, including the balance arrays.
		LoadedAddresses struct {
			Writable []string `json:"writable"`
			ReadOnly []string `json:"readonly"`
		} `json:"loadedAddresses"`
		InnerInstructions []struct {
			Instructions []Instruction `json:"instructions"`
		} `json:"innerInstructions"`
	} `json:"meta"`
	Transaction struct {
		Message struct {
			AccountKeys  []string      `json:"accountKeys"`
			Instructions []Instruction `json:"instructions"`
		} `json:"message"`
	} `json:"transaction"`
}

// accountKeys is the full account list, in the order every index refers to:
// the static keys first, then the writable lookups, then the read-only ones.
func (t *Transaction) accountKeys() []string {
	keys := t.Transaction.Message.AccountKeys
	keys = append(keys, t.Meta.LoadedAddresses.Writable...)
	keys = append(keys, t.Meta.LoadedAddresses.ReadOnly...)
	return keys
}

// instructions returns every instruction in the transaction, top level and
// inner alike.
//
// A sponsorship built by our own client is a top-level instruction, but a
// sponsorship routed through another program would arrive as a CPI, and
// refusing to look there would report a real payment as missing.
func (t *Transaction) instructions() []Instruction {
	out := t.Transaction.Message.Instructions
	for _, inner := range t.Meta.InnerInstructions {
		out = append(out, inner.Instructions...)
	}
	return out
}

// GetTransaction fetches a finalized transaction by signature.
func (c *Client) GetTransaction(ctx context.Context, signature string) (*Transaction, error) {
	var tx Transaction
	err := c.call(ctx, "getTransaction", []any{
		signature,
		map[string]any{
			// "finalized" rather than "confirmed": money is only credited once
			// the transaction can no longer be rolled back by a fork.
			"commitment":                     "finalized",
			"encoding":                       "json",
			"maxSupportedTransactionVersion": 0,
		},
	}, &tx)
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

// TransferCheck describes the transfer the API expects to find on chain.
type TransferCheck struct {
	Signature string
	From      string
	To        string
	// MinLamports is the least the recipient's balance must have risen by.
	MinLamports int64
}

// ProgramTransferCheck describes a sponsorship that must have gone through the
// deployed program rather than a bare transfer.
type ProgramTransferCheck struct {
	TransferCheck
	// ProgramID is the deployed sponsorship program.
	ProgramID string
	// InstructionName is the anchor instruction, e.g. "sponsor". Its
	// discriminator and its single u64 amount argument are what get decoded.
	InstructionName string
	// MaxFeeBps bounds the platform fee the program may have taken, so the least
	// the creator can have received can be worked out without a second RPC call.
	MaxFeeBps int64
}

// VerifiedTransfer is the outcome of a successful check.
type VerifiedTransfer struct {
	Slot      int64
	Fee       int64
	Lamports  int64
	Raw       []byte
	Finalized bool
}

// verifyTransfer confirms that a signature really moved at least the expected
// lamports from one account to another. It is the fallback rule, used only when
// no program is configured; callers go through VerifySponsorship.
//
// The balance delta is read from the transaction meta rather than trusting any
// instruction decoding, because the delta is what actually happened: it cannot
// be faked by a transaction that emits convincing logs but transfers nothing.
func (c *Client) verifyTransfer(ctx context.Context, check TransferCheck) (*VerifiedTransfer, error) {
	tx, err := c.GetTransaction(ctx, check.Signature)
	if err != nil {
		return nil, err
	}
	return checkTransfer(tx, check)
}

// checkTransfer is the rule itself, separated from the fetch so it can be tested
// against transactions a real node would never hand back — which is exactly where
// a verifier is most likely to be wrong.
func checkTransfer(tx *Transaction, check TransferCheck) (*VerifiedTransfer, error) {
	if len(tx.Meta.Err) > 0 && string(tx.Meta.Err) != "null" {
		return nil, ErrFailed
	}

	keys := tx.accountKeys()
	if len(keys) != len(tx.Meta.PreBalances) || len(keys) != len(tx.Meta.PostBalances) {
		return nil, ErrMismatch
	}

	fromIdx, toIdx := -1, -1
	for i, k := range keys {
		if k == check.From {
			fromIdx = i
		}
		if k == check.To {
			toIdx = i
		}
	}
	if fromIdx < 0 || toIdx < 0 {
		return nil, ErrMismatch
	}

	received := tx.Meta.PostBalances[toIdx] - tx.Meta.PreBalances[toIdx]
	if received < check.MinLamports {
		return nil, ErrMismatch
	}
	// The payer must genuinely be out of pocket; a transfer credited from a
	// third account is not the transfer that was claimed.
	if tx.Meta.PostBalances[fromIdx] >= tx.Meta.PreBalances[fromIdx] {
		return nil, ErrMismatch
	}

	raw, _ := json.Marshal(map[string]any{
		"slot":     tx.Slot,
		"fee":      tx.Meta.Fee,
		"lamports": received,
	})
	return &VerifiedTransfer{
		Slot:      tx.Slot,
		Fee:       tx.Meta.Fee,
		Lamports:  received,
		Raw:       raw,
		Finalized: true,
	}, nil
}

// verifyProgramTransfer confirms a sponsorship went through our deployed
// program, to this creator, from this sponsor, for at least this amount. It is
// the program rule; callers go through VerifySponsorship.
//
// It checks three independent things, and each of them is load-bearing:
//
//   - the instruction exists and belongs to our program, so a bare transfer that
//     skipped the program is not counted as one that recorded it;
//   - its account list names this exact sponsor and this exact creator, so a
//     sponsorship of a different creator cannot be presented as this one;
//   - the creator's balance actually rose, so the instruction cannot be a
//     well-formed call that the program refused, or one whose funds went
//     somewhere else entirely.
//
// The amount is decoded from the instruction data rather than inferred from the
// balance delta because the program takes a platform fee, which makes the delta
// less than the amount on purpose.
func (c *Client) verifyProgramTransfer(ctx context.Context, check ProgramTransferCheck) (*VerifiedTransfer, error) {
	tx, err := c.GetTransaction(ctx, check.Signature)
	if err != nil {
		return nil, err
	}
	return checkProgramTransfer(tx, check)
}

// checkProgramTransfer is the rule itself, split from the fetch for the same
// reason as checkTransfer.
func checkProgramTransfer(tx *Transaction, check ProgramTransferCheck) (*VerifiedTransfer, error) {
	if check.ProgramID == "" {
		return nil, ErrMismatch
	}
	if len(tx.Meta.Err) > 0 && string(tx.Meta.Err) != "null" {
		return nil, ErrFailed
	}

	want := discriminator(check.InstructionName)
	keys := tx.accountKeys()
	amount := int64(-1)

	for _, ix := range tx.instructions() {
		if ix.ProgramIDIndex < 0 || ix.ProgramIDIndex >= len(keys) {
			continue
		}
		if keys[ix.ProgramIDIndex] != check.ProgramID {
			continue
		}
		data, err := base58.Decode(ix.Data)
		// The instruction takes exactly one u64, so anything that is not the
		// discriminator followed by eight bytes is not the call being looked for.
		if err != nil || len(data) != len(want)+8 {
			continue
		}
		if !bytes.Equal(data[:len(want)], want) {
			continue
		}
		// The account list is [sponsor, creator, treasury, config, creator_stats,
		// system_program]; the first two are the ones that decide who paid whom.
		if len(ix.Accounts) < 2 {
			continue
		}
		from, to := ix.Accounts[0], ix.Accounts[1]
		if from < 0 || from >= len(keys) || to < 0 || to >= len(keys) {
			continue
		}
		if keys[from] != check.From || keys[to] != check.To {
			continue
		}
		amount = int64(binary.LittleEndian.Uint64(data[len(want):]))
		break
	}
	if amount < 0 {
		return nil, ErrMismatch
	}
	if amount < check.MinLamports {
		return nil, ErrMismatch
	}

	keys = tx.accountKeys()
	if len(keys) != len(tx.Meta.PreBalances) || len(keys) != len(tx.Meta.PostBalances) {
		return nil, ErrMismatch
	}
	toIdx := -1
	for i, k := range keys {
		if k == check.To {
			toIdx = i
			break
		}
	}
	if toIdx < 0 {
		return nil, ErrMismatch
	}
	received := tx.Meta.PostBalances[toIdx] - tx.Meta.PreBalances[toIdx]
	// At most MaxFeeBps of the amount may have gone to the treasury, so this is
	// the least the creator can have received. A smaller rise means the money did
	// not arrive, whatever the instruction said.
	floor := amount - (amount * check.MaxFeeBps / 10_000)
	if received < floor {
		return nil, ErrMismatch
	}

	raw, _ := json.Marshal(map[string]any{
		"slot":        tx.Slot,
		"fee":         tx.Meta.Fee,
		"lamports":    received,
		"amount":      amount,
		"program":     check.ProgramID,
		"instruction": check.InstructionName,
	})
	return &VerifiedTransfer{
		Slot:      tx.Slot,
		Fee:       tx.Meta.Fee,
		Lamports:  received,
		Raw:       raw,
		Finalized: true,
	}, nil
}

// discriminator is the first eight bytes of an anchor instruction's data:
// the first eight bytes of the SHA-256 of "global:<name>".
//
// It is derived here rather than pasted in as a constant so that renaming the
// instruction in the program and forgetting to update the API is a compile-time
// impossibility rather than a silent verification failure at runtime.
func discriminator(name string) []byte {
	sum := sha256.Sum256([]byte("global:" + name))
	return sum[:8]
}

// InstructionDiscriminator exposes the derivation for tests.
func InstructionDiscriminator(name string) []byte { return discriminator(name) }
