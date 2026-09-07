package worker

import (
	"encoding/json"

	"github.com/sardhana/backend/internal/solana"
)

// marshalMeta stores a compact record of what the chain reported, enough to
// audit a settlement later without keeping the whole transaction.
func marshalMeta(tx *solana.Transaction) ([]byte, error) {
	return json.Marshal(map[string]any{
		"slot":      tx.Slot,
		"fee":       tx.Meta.Fee,
		"blockTime": tx.BlockTime,
	})
}
