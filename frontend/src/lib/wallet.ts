"use client";

import { Buffer } from "buffer";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

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
  connection ??= new Connection(RPC_URL, "confirmed");
  return connection;
}

export async function signOwnershipProof(message: string): Promise<string> {
  const wallet = getWallet();
  const encoded = new TextEncoder().encode(message);
  const { signature } = await wallet.signMessage(encoded, "utf8");
  const { default: bs58 } = await import("./base58");
  return bs58.encode(signature);
}

export interface SentTransfer {
  signature: string;

  payer: string;
}

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
function configPda(program: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("config")], program)[0];
}

/** A creator's on-chain tally, seeds `[b"creator", creator]`. */
function creatorStatsPda(program: PublicKey, creator: PublicKey): PublicKey {
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
  const program = new PublicKey(programID);
  const info = await getConnection().getAccountInfo(configPda(program), "confirmed");
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
  const wallet = getWallet();
  const from = wallet.publicKey?.toString() ?? (await connectWallet());

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
      { pubkey: configPda(program), isSigner: false, isWritable: false },
      { pubkey: creatorStatsPda(program, creatorKey), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  const transaction = new Transaction().add(instruction);
  const conn = getConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = new PublicKey(from);

  const { signature } = await wallet.signAndSendTransaction(transaction);
  return { signature, payer: from };
}
