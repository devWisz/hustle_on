package solana

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"testing"

	"github.com/sardhana/auth/base58"
)

// The discriminator the API decodes has to be the one Anchor writes. Anchor
// derives it as the first eight bytes of sha256("global:<name>"), and if that
// ever changes the API would stop recognising real sponsorships — silently, and
// only in production, where a missing credit is somebody's money.
func TestSponsorDiscriminatorMatchesAnchorsRule(t *testing.T) {
	sum := sha256.Sum256([]byte("global:sponsor"))
	if got, want := discriminator("sponsor"), sum[:8]; !bytes.Equal(got, want) {
		t.Fatalf("discriminator = %x, want %x", got, want)
	}
}

const (
	programID = "HuStLeOnPay1111111111111111111111111111111"
	sponsor   = "SponSor1111111111111111111111111111111111"
	creator   = "CreatOr111111111111111111111111111111111"
	treasury  = "TreAsurY111111111111111111111111111111111"
)

// sponsorInstruction builds the transaction a successful sponsorship produces:
// the program call as the only instruction, and balances showing the creator was
// paid.
func sponsorTransaction(t *testing.T, amount int64, opts ...func(*Transaction)) *Transaction {
	t.Helper()

	data := append(discriminator(SponsorInstruction), make([]byte, 8)...)
	binary.LittleEndian.PutUint64(data[8:], uint64(amount))
	fee := amount * MaxPlatformFeeBps / 10_000

	tx := &Transaction{Slot: 42}
	tx.Transaction.Message.AccountKeys = []string{sponsor, creator, treasury, programID}
	tx.Transaction.Message.Instructions = []Instruction{{
		ProgramIDIndex: 3,
		// [sponsor, creator] — the two accounts the rule reads.
		Accounts: []int{0, 1},
		Data:     base58.Encode(data),
	}}
	tx.Meta.Err = json.RawMessage("null")
	tx.Meta.Fee = 5000
	// The sponsor paid the amount plus the network fee; the creator received the
	// amount minus the platform fee.
	tx.Meta.PreBalances = []int64{10_000_000_000, 0, 0, 0}
	tx.Meta.PostBalances = []int64{10_000_000_000 - amount - 5000, amount - fee, 0, 0}

	for _, opt := range opts {
		opt(tx)
	}
	return tx
}

func check(amount int64) ProgramTransferCheck {
	return ProgramTransferCheck{
		TransferCheck: TransferCheck{
			Signature:   "sig",
			From:        sponsor,
			To:          creator,
			MinLamports: amount,
		},
		ProgramID:       programID,
		InstructionName: SponsorInstruction,
		MaxFeeBps:       MaxPlatformFeeBps,
	}
}

func TestAValidSponsorshipIsVerified(t *testing.T) {
	const amount = 1_000_000
	got, err := checkProgramTransfer(sponsorTransaction(t, amount), check(amount))
	if err != nil {
		t.Fatalf("a valid sponsorship was refused: %v", err)
	}
	if got.Slot != 42 {
		t.Errorf("slot = %d, want 42", got.Slot)
	}
	// The record kept against the donation has to name the amount that was
	// promised, not just the balance movement, because the fee makes the two
	// legitimately different.
	var recorded struct {
		Amount  int64  `json:"amount"`
		Program string `json:"program"`
	}
	if err := json.Unmarshal(got.Raw, &recorded); err != nil {
		t.Fatalf("the audit record does not decode: %v", err)
	}
	if recorded.Amount != amount || recorded.Program != programID {
		t.Errorf("audit record = %+v, want amount %d on %s", recorded, amount, programID)
	}
}

func TestSponsorshipMustBePaidThroughTheProgram(t *testing.T) {
	// The same transfer, with no program instruction at all: a bare SOL transfer
	// moves the money but leaves no on-chain record, so it must not count as one
	// that did.
	tx := sponsorTransaction(t, 1_000_000, func(tx *Transaction) {
		tx.Transaction.Message.Instructions = nil
	})
	if _, err := checkProgramTransfer(tx, check(1_000_000)); !errors.Is(err, ErrMismatch) {
		t.Fatalf("a bare transfer was accepted as a sponsorship: %v", err)
	}
}

func TestSponsorshipMustComeFromOurProgram(t *testing.T) {
	tx := sponsorTransaction(t, 1_000_000)
	// A different program, with byte-identical instruction data. Anyone can
	// deploy a program that emits this shape; only ours is trusted.
	other := check(1_000_000)
	other.ProgramID = "SomeOtherProgram1111111111111111111111111111"
	if _, err := checkProgramTransfer(tx, other); !errors.Is(err, ErrMismatch) {
		t.Fatalf("a foreign program's instruction was accepted: %v", err)
	}
}

func TestSponsorshipMustBeForThisCreator(t *testing.T) {
	tx := sponsorTransaction(t, 1_000_000)
	other := check(1_000_000)
	other.To = "SomeoneElse11111111111111111111111111111111"
	if _, err := checkProgramTransfer(tx, other); !errors.Is(err, ErrMismatch) {
		t.Fatalf("a sponsorship of another creator was accepted as this one: %v", err)
	}
}

func TestSponsorshipMustComeFromTheClaimedSponsor(t *testing.T) {
	// Somebody else's sponsorship, presented by a donor who did not pay.
	tx := sponsorTransaction(t, 1_000_000)
	other := check(1_000_000)
	other.From = "NotThePayer1111111111111111111111111111111"
	if _, err := checkProgramTransfer(tx, other); !errors.Is(err, ErrMismatch) {
		t.Fatalf("a sponsorship from another wallet was credited to this donor: %v", err)
	}
}

func TestAnUnderpaymentIsRefused(t *testing.T) {
	// The donor promised more than the instruction actually moved.
	tx := sponsorTransaction(t, 500_000)
	if _, err := checkProgramTransfer(tx, check(1_000_000)); !errors.Is(err, ErrMismatch) {
		t.Fatalf("an underpayment was accepted: %v", err)
	}
}

// A well-formed instruction that the creator's balance does not back is the
// attack this check exists for: the balance delta is what actually happened, and
// an instruction alone can be made to say anything.
func TestAnInstructionWithoutTheBalanceBehindItIsRefused(t *testing.T) {
	tx := sponsorTransaction(t, 1_000_000, func(tx *Transaction) {
		// The creator was paid nothing; the money went elsewhere.
		tx.Meta.PostBalances[1] = tx.Meta.PreBalances[1]
	})
	if _, err := checkProgramTransfer(tx, check(1_000_000)); !errors.Is(err, ErrMismatch) {
		t.Fatalf("an unpaid creator was credited anyway: %v", err)
	}
}

func TestAFailedTransactionIsRefused(t *testing.T) {
	tx := sponsorTransaction(t, 1_000_000, func(tx *Transaction) {
		tx.Meta.Err = json.RawMessage(`{"InstructionError":[0,{"Custom":6000}]}`)
	})
	if _, err := checkProgramTransfer(tx, check(1_000_000)); !errors.Is(err, ErrFailed) {
		t.Fatalf("a failed transaction was treated as a payment: %v", err)
	}
}

func TestATruncatedInstructionIsRefused(t *testing.T) {
	// The discriminator alone, with no amount: a caller trimming bytes off the
	// end must not be read as a zero-amount sponsorship.
	data := discriminator(SponsorInstruction)
	tx := sponsorTransaction(t, 1_000_000, func(tx *Transaction) {
		tx.Transaction.Message.Instructions[0].Data = base58.Encode(data)
	})
	if _, err := checkProgramTransfer(tx, check(1_000_000)); !errors.Is(err, ErrMismatch) {
		t.Fatalf("an instruction with no amount was accepted: %v", err)
	}
}

func TestAnOutOfRangeAccountIndexIsRefused(t *testing.T) {
	tx := sponsorTransaction(t, 1_000_000, func(tx *Transaction) {
		tx.Transaction.Message.Instructions[0].Accounts = []int{99, 1}
	})
	if _, err := checkProgramTransfer(tx, check(1_000_000)); !errors.Is(err, ErrMismatch) {
		t.Fatalf("an instruction naming no real account was accepted: %v", err)
	}
}

// An instruction can also arrive as a cross-program invocation. Our own client
// builds a top-level one, but a sponsorship routed through another program is
// still a sponsorship and must be found.
func TestASponsorshipInsideACrossProgramInvocationIsFound(t *testing.T) {
	tx := sponsorTransaction(t, 1_000_000)
	inner := tx.Transaction.Message.Instructions
	tx.Transaction.Message.Instructions = nil
	tx.Meta.InnerInstructions = []struct {
		Instructions []Instruction `json:"instructions"`
	}{{Instructions: inner}}

	if _, err := checkProgramTransfer(tx, check(1_000_000)); err != nil {
		t.Fatalf("a sponsorship sent as a CPI was not found: %v", err)
	}
}

// Versioned transactions move some keys into a lookup table, and every index
// then refers to the concatenated list. A verifier that only reads the static
// keys would reject a perfectly good sponsorship.
func TestLookupTableKeysAreResolved(t *testing.T) {
	const amount int64 = 1_000_000
	fee := amount * MaxPlatformFeeBps / 10_000
	tx := sponsorTransaction(t, amount, func(tx *Transaction) {
		// creator and treasury live in the lookup table instead, so the account
		// list becomes [sponsor, programID, creator, treasury] and every balance
		// is indexed against that concatenated list.
		tx.Transaction.Message.AccountKeys = []string{sponsor, programID}
		tx.Meta.LoadedAddresses.Writable = []string{creator, treasury}
		tx.Transaction.Message.Instructions[0].ProgramIDIndex = 1
		tx.Transaction.Message.Instructions[0].Accounts = []int{0, 2}

		tx.Meta.PreBalances = []int64{10_000_000_000, 0, 0, 0}
		tx.Meta.PostBalances = []int64{10_000_000_000 - amount - 5000, 0, amount - fee, 0}
	})
	got, err := checkProgramTransfer(tx, check(amount))
	if err != nil {
		t.Fatalf("a versioned transaction was refused: %v", err)
	}
	if got.Lamports != amount-fee {
		t.Errorf("lamports = %d, want %d", got.Lamports, amount-fee)
	}
}

// The plain-transfer rule is the fallback for a deployment with no program, and
// it must still hold. This also pins the balance-delta reading, which both rules
// share.
func TestPlainTransferStillVerifies(t *testing.T) {
	tx := sponsorTransaction(t, 1_000_000, func(tx *Transaction) {
		tx.Transaction.Message.Instructions = nil
		tx.Transaction.Message.AccountKeys = []string{sponsor, creator}
		tx.Meta.PreBalances = []int64{10_000_000_000, 0}
		tx.Meta.PostBalances = []int64{9_000_000_000, 1_000_000_000}
	})
	got, err := checkTransfer(tx, TransferCheck{
		Signature: "sig", From: sponsor, To: creator, MinLamports: 1_000_000_000,
	})
	if err != nil {
		t.Fatalf("a plain transfer was refused: %v", err)
	}
	if got.Lamports != 1_000_000_000 {
		t.Errorf("lamports = %d, want 1000000000", got.Lamports)
	}

	// A transfer that left the sender no worse off is not a payment.
	tx.Meta.PostBalances[0] = tx.Meta.PreBalances[0]
	if _, err := checkTransfer(tx, TransferCheck{
		Signature: "sig", From: sponsor, To: creator, MinLamports: 1_000_000_000,
	}); !errors.Is(err, ErrMismatch) {
		t.Fatalf("a transfer that cost the sender nothing was accepted: %v", err)
	}
}
