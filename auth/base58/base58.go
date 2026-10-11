// Package base58 implements the Bitcoin/Solana base58 alphabet.
// It is vendored here so the auth module keeps a zero-dependency footprint.
package base58

import (
	"errors"
	"math/big"
)

const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

var index = func() map[byte]int {
	m := make(map[byte]int, len(alphabet))
	for i := 0; i < len(alphabet); i++ {
		m[alphabet[i]] = i
	}
	return m
}()

// ErrInvalid is returned for input containing characters outside the alphabet.
var ErrInvalid = errors.New("base58: invalid character")

// Encode returns the base58 representation of b.
func Encode(b []byte) string {
	var zeros int
	for zeros < len(b) && b[zeros] == 0 {
		zeros++
	}
	num := new(big.Int).SetBytes(b)
	radix := big.NewInt(58)
	mod := new(big.Int)

	out := make([]byte, 0, len(b)*137/100+1)
	for num.Sign() > 0 {
		num.DivMod(num, radix, mod)
		out = append(out, alphabet[mod.Int64()])
	}
	for i := 0; i < zeros; i++ {
		out = append(out, alphabet[0])
	}
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return string(out)
}

// Decode parses a base58 string into bytes.
func Decode(s string) ([]byte, error) {
	num := new(big.Int)
	radix := big.NewInt(58)
	for i := 0; i < len(s); i++ {
		v, ok := index[s[i]]
		if !ok {
			return nil, ErrInvalid
		}
		num.Mul(num, radix)
		num.Add(num, big.NewInt(int64(v)))
	}
	var zeros int
	for zeros < len(s) && s[zeros] == alphabet[0] {
		zeros++
	}
	decoded := num.Bytes()
	out := make([]byte, zeros+len(decoded))
	copy(out[zeros:], decoded)
	return out, nil
}
