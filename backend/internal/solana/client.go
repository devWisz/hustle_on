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
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
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
	http    *http.Client
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
	} `json:"meta"`
	Transaction struct {
		Message struct {
			AccountKeys []string `json:"accountKeys"`
		} `json:"message"`
	} `json:"transaction"`
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

// VerifiedTransfer is the outcome of a successful check.
type VerifiedTransfer struct {
	Slot      int64
	Fee       int64
	Lamports  int64
	Raw       []byte
	Finalized bool
}

// VerifyTransfer confirms that a signature really moved at least the expected
// lamports from one account to another.
//
// The balance delta is read from the transaction meta rather than trusting any
// instruction decoding, because the delta is what actually happened: it cannot
// be faked by a transaction that emits convincing logs but transfers nothing.
func (c *Client) VerifyTransfer(ctx context.Context, check TransferCheck) (*VerifiedTransfer, error) {
	tx, err := c.GetTransaction(ctx, check.Signature)
	if err != nil {
		return nil, err
	}
	if len(tx.Meta.Err) > 0 && string(tx.Meta.Err) != "null" {
		return nil, ErrFailed
	}

	keys := tx.Transaction.Message.AccountKeys
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

// LamportsPerSOL is the conversion factor used across the platform.
const LamportsPerSOL = 1_000_000_000
