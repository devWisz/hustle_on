"use client";

// Type only, so the bundler erases it: the actual client is imported at the first
// moment a connection is needed, further down this file.
import type { Connection, PublicKey as PublicKeyType, Transaction } from "@solana/web3.js";

/**
 * Every Wallet Standard wallet in this browser.
 *
 * A wallet announces itself by answering `wallet-standard:app-ready` — either by
 * emitting `wallet-standard:register-wallet` or by calling the `register` callback
 * carried in the event detail — so both have to be listened for. The announcement
 * is synchronous, which is why `detectWallets` waits a turn before reading the
 * list: a wallet that answers in a microtask or a timer is otherwise missed.
 */
type WalletStandardWallet = {
  name: string;
  icon: string;
  chains: string[];
  features: Record<string, unknown>;
};

const standardWallets: WalletStandardWallet[] = [];
const seenStandardNames = new Set<string>();

function addStandardWallet(wallet: WalletStandardWallet): void {
  if (!wallet || typeof wallet.name !== "string") return;
  // Some wallets re-register on every app-ready pass, and a few register under a
  // slightly different name than the one they first announced. The name is the
  // only identifier the protocol gives us, so it is what dedupes the list.
  const key = wallet.name.trim().toLowerCase();
  if (seenStandardNames.has(key)) return;
  seenStandardNames.add(key);
  standardWallets.push(wallet);
}

let announced = false;

function announceAppReady(): void {
  if (announced) return;
  announced = true;

  window.addEventListener("wallet-standard:register-wallet", (event) => {
    const { wallets } = (event as CustomEvent<{ wallets?: WalletStandardWallet[] }>).detail ?? {};
    if (wallets) for (const wallet of wallets) addStandardWallet(wallet);
  });

  window.dispatchEvent(
    new CustomEvent("wallet-standard:app-ready", {
      detail: { register: (...wallets: WalletStandardWallet[]) => wallets.forEach(addStandardWallet) },
    }),
  );
}

interface InjectedWallet {
  isConnected?: boolean;
  publicKey?: { toString(): string } | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction(transaction: Transaction): Promise<{ signature: string }>;
}

declare global {
  interface Window {
    solana?: InjectedWallet;
    phantom?: { solana?: InjectedWallet };
    solflare?: InjectedWallet;
    backpack?: InjectedWallet;
    glow?: InjectedWallet;
    exodus?: { solana?: InjectedWallet };
    okxwallet?: { solana?: InjectedWallet };
  }
}

/**
 * The wallets that predate Wallet Standard and still hang an object on `window`.
 *
 * MetaMask, Coinbase and the rest are reachable through Wallet Standard alone, so
 * this table is a fallback rather than the mechanism. The generic `window.solana`
 * is deliberately absent: it is every legacy wallet's shared claim, so its owner
 * is found by checking which of these more specific globals is the same object,
 * and it is offered last so a wallet is never shadowed by its own generic alias.
 */
const INJECTED_WALLETS: {
  id: string;
  name: string;
  install: string;
  get: (w: Window) => InjectedWallet | undefined;
}[] = [
  { id: "phantom", name: "Phantom", install: "https://phantom.app/download", get: (w) => w.phantom?.solana },
  { id: "solflare", name: "Solflare", install: "https://solflare.com/download", get: (w) => w.solflare },
  { id: "backpack", name: "Backpack", install: "https://backpack.app/download", get: (w) => w.backpack },
  { id: "glow", name: "Glow", install: "https://glow.app/download", get: (w) => w.glow },
  { id: "exodus", name: "Exodus", install: "https://exodus.com/download", get: (w) => w.exodus?.solana },
  { id: "okx", name: "OKX Wallet", install: "https://www.okx.com/web3", get: (w) => w.okxwallet?.solana },
];

/**
 * Major wallets worth installing, in the order a person is most likely to want them.
 *
 * This list exists for the browser that has none of them: Wallet Standard is how an
 * *installed* wallet is found, and it needs no entry to be discoverable, so these
 * links are only ever shown as suggestions.
 */
const SUGGESTED_WALLETS: { name: string; install: string }[] = [
  { name: "MetaMask", install: "https://metamask.io/download/" },
  { name: "Phantom", install: "https://phantom.app/download" },
  { name: "Solflare", install: "https://solflare.com/download" },
  { name: "Coinbase Wallet", install: "https://www.coinbase.com/wallet/downloads" },
  { name: "Trust Wallet", install: "https://trustwallet.com/download" },
  { name: "Backpack", install: "https://backpack.app/download" },
  { name: "Ledger", install: "https://www.ledger.com/ledger-live" },
  { name: "Magic Eden", install: "https://wallet.magiceden.io/" },
  { name: "Nightly", install: "https://nightly.app/" },
];

interface StandardAccount {
  address: string;
  publicKey: Uint8Array;
  chains: string[];
  features: string[];
}

interface ConnectFeature {
  connect(input?: { silent?: boolean }): Promise<{ accounts: StandardAccount[] }>;
}

interface SignMessageFeature {
  signMessage(input: { account: StandardAccount; message: Uint8Array }): Promise<
    { signature: Uint8Array; signedMessage: Uint8Array }[]
  >;
}

interface SignAndSendFeature {
  signAndSendTransaction(input: {
    account: StandardAccount;
    transaction: Uint8Array;
  }): Promise<{ signature: Uint8Array }>;
}

/**
 * A connected account, and the only thing that can sign as it.
 *
 * The account has to travel with the signature rather than be passed around
 * separately, because a wallet can hold several and `solana:signMessage` names the
 * one to sign as. Signing as a different account than the one that asked for the
 * challenge is how a valid signature gets refused.
 */
export interface WalletSession {
  address: string;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  signAndSend(transaction: Transaction): Promise<{ signature: string }>;
}

/**
 * A wallet, whichever protocol it speaks.
 *
 * The injected shape and the standard shape are kept behind one object because the
 * signing helpers below care about obtaining a signature, not about which era of
 * the ecosystem a wallet is from. `provider` is the same handle, for the callers
 * that want to recognise a wallet rather than use it.
 */
export type WalletOption = {
  id: string;
  name: string;
  install: string;
  provider: object;
} & WalletConnector;

// A wallet's icon arrives as a data URI. Anything else — a remote URL, an empty
// string, an absurd payload — is not something to put in an `img` src from a
// third-party announcement, so the callers fall back to a drawn wallet glyph.
const ICON_LIMIT = 200_000;

function usableIcon(icon: unknown): string | undefined {
  return typeof icon === "string" && icon.startsWith("data:image/") && icon.length <= ICON_LIMIT
    ? icon
    : undefined;
}

function signMessageFeature(wallet: WalletStandardWallet): SignMessageFeature | undefined {
  const connect = wallet.features["standard:connect"] as ConnectFeature | undefined;
  const signMessage = wallet.features["solana:signMessage"] as SignMessageFeature | undefined;
  // Without both of these the wallet cannot do what this site asks, and a button
  // that fails on press is worse than no button.
  return connect && typeof connect.connect === "function" && signMessage && typeof signMessage.signMessage === "function"
    ? signMessage
    : undefined;
}

function isSolanaWallet(wallet: WalletStandardWallet): boolean {
  return (
    Array.isArray(wallet.chains) &&
    wallet.chains.some((chain) => typeof chain === "string" && chain.startsWith("solana:")) &&
    signMessageFeature(wallet) !== undefined
  );
}

/** The account a multi-account wallet should be signed in as. */
function signingAccount(wallet: WalletStandardWallet, accounts: StandardAccount[]): StandardAccount {
  const supported = accounts.filter((account) => account.features?.includes("solana:signMessage"));
  return supported[0] ?? accounts[0]!;
}

interface WalletConnector {
  icon?: string;
  connect(): Promise<WalletSession>;
}

function standardSession(
  wallet: WalletStandardWallet,
  account: StandardAccount,
  signMessage: SignMessageFeature,
  signAndSend: SignAndSendFeature | undefined,
): WalletSession {
  return {
    address: account.address,
    async signMessage(message) {
      const [signed] = await signMessage.signMessage({ account, message });
      if (!signed) throw new WalletError("That wallet returned no signature.");
      return signed.signature;
    },
    async signAndSend(transaction) {
      if (!signAndSend) {
        throw new WalletError(`${wallet.name} cannot send this transaction from here.`);
      }
      const { signature } = await signAndSend.signAndSendTransaction({
        account,
        // The standard feature takes bytes, so the transaction is serialised here
        // rather than handed over as an object only some wallets understand.
        transaction: new Uint8Array(transaction.serialize({ requireAllSignatures: false })),
      });
      const { default: bs58 } = await import("./base58");
      return { signature: bs58.encode(signature) };
    },
  };
}

function standardConnector(wallet: WalletStandardWallet): WalletConnector {
  const connect = wallet.features["standard:connect"] as ConnectFeature;
  const signMessage = signMessageFeature(wallet)!;
  const signAndSend = wallet.features["solana:signAndSendTransaction"] as
    | SignAndSendFeature
    | undefined;

  // Kept for the life of the connector so a re-connect reuses the account the
  // person already agreed to rather than asking the wallet to choose again.
  let session: WalletSession | null = null;

  return {
    icon: usableIcon(wallet.icon),
    async connect() {
      if (session) return session;
      const { accounts } = await connect.connect();
      const solana = accounts.filter((candidate) =>
        candidate.chains?.some((chain) => chain.startsWith("solana:")),
      );
      if (!solana.length) {
        throw new WalletError("That wallet did not offer a Solana account.");
      }
      session = standardSession(wallet, signingAccount(wallet, solana), signMessage, signAndSend);
      return session;
    },
  };
}

function injectedConnector(provider: InjectedWallet): WalletConnector {
  return {
    async connect() {
      // Asking is how a legacy wallet adopts an existing session and fills in the
      // `publicKey` that `signAndSendTransaction` reads, so it is called even when
      // the wallet is already connected.
      const { publicKey } = await provider.connect();
      return {
        address: publicKey.toString(),
        async signMessage(message) {
          const result = await provider.signMessage(message, "utf8");
          // Legacy wallets mostly answer with `{ signature }`, but one or two hand
          // back the raw bytes.
          const signature =
            result instanceof Uint8Array
              ? result
              : (result as { signature?: Uint8Array } | undefined)?.signature;
          if (!(signature instanceof Uint8Array)) {
            throw new WalletError("That wallet returned no signature.");
          }
          return signature;
        },
        async signAndSend(transaction) {
          return provider.signAndSendTransaction(transaction);
        },
      };
    },
  };
}

/** Every wallet this browser actually has installed. */
export function detectWallets(): WalletOption[] {
  if (typeof window === "undefined") return [];
  announceAppReady();

  const found: WalletOption[] = standardWallets.filter(isSolanaWallet).map((wallet) => ({
    id: standardWalletId(wallet.name),
    name: wallet.name,
    install: "",
    ...standardConnector(wallet),
    provider: wallet,
  }));

  const named = new Set(found.map((wallet) => wallet.name.trim().toLowerCase()));

  for (const known of INJECTED_WALLETS) {
    let provider: InjectedWallet | undefined;
    try {
      provider = known.get(window);
    } catch {
      // A page can define these globals as getters that throw. A wallet that
      // cannot be read is a wallet that cannot be used, and it must not take the
      // rest of the list down with it.
      continue;
    }
    if (!provider || typeof provider.signMessage !== "function") continue;
    if (named.has(known.name.toLowerCase())) continue;
    named.add(known.name.toLowerCase());
    found.push({
      id: known.id,
      name: known.name,
      install: known.install,
      ...injectedConnector(provider),
      provider,
    });
  }

  const generic = window.solana;
  if (
    generic &&
    typeof generic.signMessage === "function" &&
    !found.some((wallet) => wallet.provider === generic)
  ) {
    found.push({
      id: "solana",
      name: "Browser wallet",
      install: "",
      ...injectedConnector(generic),
      provider: generic,
    });
  }

  return found;
}

/**
 * A stable id for a standard wallet.
 *
 * Wallet Standard identifies wallets by name, so the id is derived from it rather
 * than invented, which keeps `selectWallet(id)` meaningful across a re-detection
 * (wallets register again on some navigations) without a second lookup table.
 */
function standardWalletId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `standard:${slug || "wallet"}`;
}

/** The wallets worth offering to install, for a browser that has none. */
export function installableWallets(): { name: string; install: string }[] {
  return SUGGESTED_WALLETS;
}

/**
 * Which wallet the person picked.
 *
 * Held in a module variable rather than threaded through every call, because the
 * signing helpers are used from places that have no business knowing about wallet
 * choice — `sponsorViaProgram` should not have to take a wallet id in order to
 * sign a sponsorship. It is set by the chooser, in the browser, immediately before
 * the flow that needs it.
 */
let chosen: WalletOption | null = null;

/**
 * Bumped whenever the person picks a wallet or leaves one behind.
 *
 * A connected session belongs to one wallet and one epoch; the bump is how the
 * session helpers below notice it is stale after a switch.
 */
let epoch = 0;

/**
 * The most recent connection, so a challenge can be signed by the same account
 * that asked for it.
 *
 * `connectWallet()` and `signOwnershipProof()` are separate calls made by a page
 * that has no way to pass a session between them — the login flow in particular
 * would otherwise connect to the wallet twice and risk signing as a different
 * account than the address it just sent.
 */
let session: WalletSession | null = null;
let sessionEpoch = -1;

export function selectWallet(id: string): boolean {
  const match = detectWallets().find((wallet) => wallet.id === id);
  if (!match) return false;
  chosen = match;
  epoch += 1;
  session = null;
  // The connection is RPC state, not wallet state, but it was cached against a
  // wallet the person may have just replaced.
  connection = null;
  return true;
}

export class WalletError extends Error {}

/**
 * The selected wallet, or the only one there is.
 *
 * Re-detecting per call is deliberate: wallets register on their own schedule and
 * a page that loaded before its wallet was ready should still be able to sign in.
 */
function getWallet(): WalletOption {
  const wallet = chosen ?? detectWallets()[0] ?? null;
  if (!wallet) {
    throw new WalletError(
      "No Solana wallet found in this browser. Install one, then reload this page.",
    );
  }
  return wallet;
}

async function activeSession(): Promise<WalletSession> {
  if (session && sessionEpoch === epoch) return session;
  session = await getWallet().connect();
  sessionEpoch = epoch;
  return session;
}

export function walletAvailable(): boolean {
  return detectWallets().length > 0;
}

export async function connectWallet(): Promise<string> {
  return (await activeSession()).address;
}

export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

let connection: Connection | null = null;

export async function getConnection(): Promise<Connection> {
  if (!connection) {
    // web3.js is a couple of hundred kilobytes that neither the login page nor a
    // reader who never signs anything should have to download, so it is fetched
    // at the first moment a connection is genuinely needed.
    const { Connection } = await import("@solana/web3.js");
    connection = new Connection(RPC_URL, "confirmed");
  }
  return connection;
}

export async function signOwnershipProof(message: string): Promise<string> {
  const current = await activeSession();
  const encoded = new TextEncoder().encode(message);
  const signature = await current.signMessage(encoded);
  const { default: bs58 } = await import("./base58");
  return bs58.encode(signature);
}

export interface SentTransfer {
  signature: string;

  payer: string;
}

export async function sendSol(to: string, lamports: number): Promise<SentTransfer> {
  const current = await activeSession();
  const from = current.address;

  const { PublicKey, SystemProgram, Transaction } = await import("@solana/web3.js");

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(from),
      toPubkey: new PublicKey(to),
      lamports,
    }),
  );

  const conn = await getConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = new PublicKey(from);

  const { signature } = await current.signAndSend(transaction);
  return { signature, payer: from };
}

/* -------------------------------------------------------------------------
 * The sponsorship program
 *
 * When the API answers a donation intent with a programId, the sponsorship has
 * to go through the deployed program rather than as a bare transfer — the server
 * verifies against whichever it advertised, so sending the other one means the
 * donation is never credited.
 *
 * Every address below is derived here rather than sent by the server, and the
 * treasury is read from the program's own Config account, so the chain stays the
 * single source of truth for where the fee goes. If any of it disagrees with what
 * the program expects, the program refuses the instruction — which is the point:
 * a bug here fails loudly instead of quietly misrouting money.
 * ---------------------------------------------------------------------- */

/** The program's Config account, seeds `[b"config"]`. */
function configPda(PublicKey: typeof PublicKeyType, program: PublicKeyType): PublicKeyType {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("config")], program)[0];
}

/** A creator's on-chain tally, seeds `[b"creator", creator]`. */
function creatorStatsPda(
  PublicKey: typeof PublicKeyType,
  program: PublicKeyType,
  creator: PublicKeyType,
): PublicKeyType {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("creator"), creator.toBuffer()],
    program,
  )[0];
}

/**
 * The anchor discriminator: the first eight bytes of sha256("global:sponsor").
 *
 * Derived rather than hard-coded for the same reason the server derives it — a
 * pasted constant is one instruction rename away from being silently wrong.
 */
async function sponsorDiscriminator(): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("global:sponsor"));
  return new Uint8Array(digest).slice(0, 8);
}

/** Where the platform fee goes, as the program itself records it. */
export interface ProgramConfig {
  treasury: string;
  feeBps: number;
}

/**
 * Reads the Config account.
 *
 * Layout is the account discriminator, then `admin`, `treasury`, `fee_bps`, and
 * the bump — so the treasury is bytes 40..72 and the fee follows it.
 */
export async function readProgramConfig(programID: string): Promise<ProgramConfig> {
  const { PublicKey } = await import("@solana/web3.js");
  const program = new PublicKey(programID);
  const conn = await getConnection();
  const info = await conn.getAccountInfo(configPda(PublicKey, program), "confirmed");
  if (!info) {
    throw new WalletError(
      "The sponsorship program has not been set up on this cluster yet. Tell the site operator to run initialize_config.",
    );
  }
  const data = info.data;
  if (data.length < 75) {
    throw new WalletError("The sponsorship program's configuration could not be read.");
  }
  return {
    treasury: new PublicKey(data.subarray(40, 72)).toBase58(),
    feeBps: data.readUInt16LE(72),
  };
}

/** Sends a sponsorship through the program, returning its signature. */
export async function sponsorViaProgram(
  programID: string,
  creator: string,
  lamports: number,
): Promise<SentTransfer> {
  const current = await activeSession();
  const from = current.address;

  const { Buffer } = await import("buffer");
  const { PublicKey, SystemProgram, Transaction, TransactionInstruction } = await import(
    "@solana/web3.js"
  );

  const program = new PublicKey(programID);
  const creatorKey = new PublicKey(creator);
  const { treasury } = await readProgramConfig(programID);

  const data = new Uint8Array(16);
  data.set(await sponsorDiscriminator(), 0);
  // The program takes exactly one u64, little-endian, straight after the
  // discriminator. Written by hand rather than with a DataView so the byte order
  // is explicit at the call site.
  let remaining = BigInt(lamports);
  for (let i = 8; i < 16; i++) {
    data[i] = Number(remaining & BigInt(0xff));
    remaining >>= BigInt(8);
  }

  const instruction = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: new PublicKey(from), isSigner: true, isWritable: true },
      { pubkey: creatorKey, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(treasury), isSigner: false, isWritable: true },
      { pubkey: configPda(PublicKey, program), isSigner: false, isWritable: false },
      { pubkey: creatorStatsPda(PublicKey, program, creatorKey), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  const transaction = new Transaction().add(instruction);
  const conn = await getConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = new PublicKey(from);

  const { signature } = await current.signAndSend(transaction);
  return { signature, payer: from };
}
