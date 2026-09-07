package solana

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// stubRPC serves one canned getTransaction result.
func stubRPC(t *testing.T, result any) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "result": result})
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	t.Cleanup(srv.Close)
	return New(srv.URL, "devnet")
}

func txResult(keys []string, pre, post []int64, txErr any) map[string]any {
	return map[string]any{
		"slot": 12345,
		"meta": map[string]any{
			"err": txErr, "fee": 5000,
			"preBalances": pre, "postBalances": post,
		},
		"transaction": map[string]any{
			"message": map[string]any{"accountKeys": keys},
		},
	}
}

func TestVerifyTransferAcceptsAMatchingTransfer(t *testing.T) {
	c := stubRPC(t, txResult(
		[]string{"payer", "creator"},
		[]int64{2_000_000_000, 0},
		[]int64{995_000_000, 1_000_000_000},
		nil))

	got, err := c.VerifyTransfer(context.Background(), TransferCheck{
		Signature: "sig", From: "payer", To: "creator", MinLamports: 1_000_000_000,
	})
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if got.Lamports != 1_000_000_000 || got.Slot != 12345 {
		t.Fatalf("unexpected result: %+v", got)
	}
}

func TestVerifyTransferRejectsBadTransactions(t *testing.T) {
	cases := []struct {
		name   string
		result map[string]any
		want   error
	}{
		{
			name: "amount below what was claimed",
			result: txResult([]string{"payer", "creator"},
				[]int64{2_000_000_000, 0}, []int64{1_999_000_000, 1_000}, nil),
			want: ErrMismatch,
		},
		{
			name: "recipient is not in the transaction",
			result: txResult([]string{"payer", "someone-else"},
				[]int64{2_000_000_000, 0}, []int64{1_000_000_000, 1_000_000_000}, nil),
			want: ErrMismatch,
		},
		{
			name: "transaction failed on chain",
			result: txResult([]string{"payer", "creator"},
				[]int64{2_000_000_000, 0}, []int64{1_000_000_000, 1_000_000_000},
				map[string]any{"InstructionError": []any{0, "Custom"}}),
			want: ErrFailed,
		},
		{
			name: "payer balance did not fall",
			result: txResult([]string{"payer", "creator"},
				[]int64{2_000_000_000, 0}, []int64{2_000_000_000, 1_000_000_000}, nil),
			want: ErrMismatch,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := stubRPC(t, tc.result)
			_, err := c.VerifyTransfer(context.Background(), TransferCheck{
				Signature: "sig", From: "payer", To: "creator", MinLamports: 1_000_000_000,
			})
			if !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
}
