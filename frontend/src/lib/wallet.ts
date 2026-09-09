"use client";

import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

/**
 * Browser wallet access.
 *
 * The site never sees a private key and never asks for a seed phrase. It asks
 * the injected wallet to sign, and the wallet shows the user exactly what they
 * are approving. Anything that asked for more than that would be a phishing
 * pattern, not a feature.
 */

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
  }
}

export class WalletError extends Error {}

export function getWallet(): InjectedWallet {
  const injected =
    (typeof window !== "undefined" && (window.phantom?.solana ?? window.solana)) || null;
  if (!injected) {
    throw new WalletError(
      "No Solana wallet found in this browser. Install one, then reload this page.",
    );
  }
  return injected;
}

export function walletAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.phantom?.solana ?? window.solana);
}

export async function connectWallet(): Promise<string> {
  const wallet = getWallet();
  const { publicKey } = await wallet.connect();
  return publicKey.toString();
}

export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

let connection: Connection | null = null;

export function getConnection(): Connection {
  // One connection per tab; creating one per transaction would open a new
  // websocket every time a donation is sent.
  connection ??= new Connection(RPC_URL, "confirmed");
  return connection;
}

/**
 * Signs a message with the connected wallet, proving control of the address.
 * Used to attach a wallet to an account — it authorises no transfer.
 */
export async function signOwnershipProof(message: string): Promise<string> {
  const wallet = getWallet();
  const encoded = new TextEncoder().encode(message);
  const { signature } = await wallet.signMessage(encoded, "utf8");
  const { default: bs58 } = await import("./base58");
  return bs58.encode(signature);
}

export interface SentTransfer {
  signature: string;
  /** The address that actually paid, which the API needs to verify the transfer. */
  payer: string;
}

/**
 * Sends lamports to a creator.
 *
 * The signature is only a receipt to hand back to the API, which verifies the
 * transfer against the cluster itself before crediting anyone. The payer is
 * returned alongside it because verification checks that this specific account
 * is the one whose balance fell.
 */
export async function sendSol(to: string, lamports: number): Promise<SentTransfer> {
  const wallet = getWallet();
  const from = wallet.publicKey?.toString() ?? (await connectWallet());

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(from),
      toPubkey: new PublicKey(to),
      lamports,
    }),
  );

  const conn = getConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = new PublicKey(from);

  const { signature } = await wallet.signAndSendTransaction(transaction);
  return { signature, payer: from };
}

export { LAMPORTS_PER_SOL };
