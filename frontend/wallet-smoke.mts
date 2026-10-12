// Scratch harness: stubs enough of a browser to exercise Wallet Standard discovery.
// Deleted after the run; it is not part of the app.
import assert from "node:assert/strict";

type StandardWallet = {
  name: string;
  icon: string;
  chains: string[];
  features: Record<string, unknown>;
};

const listeners = new Map<string, ((event: Event) => void)[]>();
const win = {
  addEventListener(type: string, listener: (event: Event) => void) {
    listeners.set(type, [...(listeners.get(type) ?? []), listener]);
  },
  dispatchEvent(event: Event) {
    for (const listener of listeners.get(event.type) ?? []) listener(event);
    return true;
  },
} as unknown as Window & typeof globalThis;

const g = globalThis as unknown as { window: unknown };
g.window = win;

const { detectWallets, installableWallets, selectWallet, WalletError } = await import(
  "./src/lib/wallet.ts"
);

let onAppReady: ((event: Event) => void) | undefined;

const connectFeature = () => ({
  connect: async () => ({
    accounts: [
      {
        address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        publicKey: new Uint8Array(32),
        chains: ["solana:mainnet"],
        features: ["solana:signMessage"],
      },
    ],
  }),
});

const wallet = (name: string, chains: string[], features: Record<string, unknown>) =>
  ({ name, icon: "data:image/svg+xml;base64,PHN2Zy8+", chains, features }) as unknown as StandardWallet;

// A wallet that answers the app-ready callback form, and registers twice, as some do.
const metaMask = wallet("MetaMask", ["solana:mainnet", "solana:devnet"], {
  "standard:connect": connectFeature(),
  "solana:signMessage": { signMessage: async () => [] },
});
// A wallet that answers by emitting register-wallet, and re-announces itself.
const coinbase = wallet("Coinbase Wallet", ["solana:mainnet"], {
  "standard:connect": connectFeature(),
  "solana:signMessage": { signMessage: async () => [] },
});
// Solana but cannot sign a message: no button should be rendered for it.
const noSigner = wallet("NoSigner", ["solana:mainnet"], { "standard:connect": connectFeature() });
// Not a Solana wallet at all.
const bitcoinOnly = wallet("Bitcoin Only", ["bip122:000000000019d6689c085ae165831e93"], {
  "standard:connect": connectFeature(),
  "solana:signMessage": { signMessage: async () => [] },
});

win.addEventListener("wallet-standard:app-ready", (event) => {
  onAppReady = event as unknown as (event: Event) => void;
});

const first = detectWallets();
assert.ok(onAppReady, "app-ready should have been dispatched with a listener in place");

// Callback form, and the same wallet announcing twice.
onAppReady(new CustomEvent("wallet-standard:app-ready", {
  detail: {
    register: (...wallets: StandardWallet[]) => {
      void wallets;
    },
  },
}));

// Nothing registered yet, and no legacy globals either.
assert.deepEqual(first, []);
assert.deepEqual(
  installableWallets().map((w) => w.name),
  [
    "MetaMask",
    "Phantom",
    "Solflare",
    "Coinbase Wallet",
    "Trust Wallet",
    "Backpack",
    "Ledger",
    "Magic Eden",
    "Nightly",
  ],
);

type RegisterDetail = { register: (...wallets: StandardWallet[]) => void };
const callbackWallets: StandardWallet[] = [];

// A fresh pass: one wallet uses the callback, one emits the event, twice each.
const second = new CustomEvent("wallet-standard:app-ready", {}) as CustomEvent<RegisterDetail>;
Object.defineProperty(second, "type", { value: "wallet-standard:app-ready" });
(second as unknown as { detail: RegisterDetail }).detail = {
  register: (...wallets: StandardWallet[]) => callbackWallets.push(...wallets),
};
win.addEventListener("wallet-standard:app-ready", (event) => {
  const event_ = event as unknown as CustomEvent<RegisterDetail>;
  event_.detail.register(metaMask, metaMask, noSigner, bitcoinOnly);
});
win.addEventListener("wallet-standard:register-wallet", () => undefined);
win.dispatchEvent(
  new CustomEvent("wallet-standard:register-wallet", {
    detail: { wallets: [coinbase, coinbase] },
  }),
);

g.window = {
  ...win,
  solana: { signMessage: async () => ({ signature: new Uint8Array(64) }) },
  phantom: { solana: { signMessage: async () => ({ signature: new Uint8Array(64) }) } },
};

const found = detectWallets();
console.log(
  found.map((w) => ({ id: w.id, name: w.name, icon: w.icon?.slice(0, 22) })),
);

assert.deepEqual(
  found.map((w) => w.name),
  ["MetaMask", "Coinbase Wallet", "Phantom", "Browser wallet"],
  "only usable Solana wallets, deduplicated by name, with legacy injected ones after them",
);
assert.equal(found[0]!.id, "standard:metamask");
assert.ok(found[0]!.icon?.startsWith("data:image/svg+xml"), "the wallet's own icon is kept");
assert.ok(!found.some((w) => w.name === "NoSigner"), "a wallet that cannot sign is skipped");
assert.ok(!found.some((w) => w.name === "Bitcoin Only"), "a non-Solana wallet is skipped");
assert.ok(!found.some((w) => w.name === "Phantom" && w.id === "solana"), "no generic Phantom");

// Selection and the session it hands back.
assert.equal(selectWallet("standard:metamask"), true);
assert.equal(selectWallet("nope"), false);

const { connectWallet, signOwnershipProof } = await import("./src/lib/wallet.ts");
assert.equal(await connectWallet(), "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");

// signMessage is stubbed to return no signatures: the failure must be a WalletError.
await assert.rejects(signOwnershipProof("hello"), WalletError);

console.log("smoke: all assertions passed");
