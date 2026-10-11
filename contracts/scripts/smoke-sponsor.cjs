#!/usr/bin/env node
/*
 * Send one real sponsorship through the deployed program.
 *
 * This is the same instruction the browser builds — same seeds, same
 * discriminator, same account order, same little-endian u64 — written out by hand
 * so it can be run without a wallet extension. That is the point: the encoding in
 * `frontend/src/lib/wallet.ts` is the one thing about this feature that no unit
 * test can check, because it is a claim about what another program expects. If
 * the two ever disagree, the transaction fails on chain, and this is how you find
 * that out without a browser.
 *
 * It prints the transaction signature on the last line, so a caller can capture
 * it and hand it to the API's confirm endpoint.
 *
 * Usage:
 *   NODE_PATH=../frontend/node_modules node scripts/smoke-sponsor.cjs \
 *     --keypair ~/.config/solana/id.json \
 *     --creator <address> \
 *     --amount-lamports 100000000 \
 *     [--program <id>] [--rpc <url>]
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} = require("@solana/web3.js");

const PROGRAM_ID = process.env.HUSTLEON_PAY_PROGRAM_ID || "6vK2BUb6UoAqTxWVU2zXTLDje8NDuVA8CaEuTwJZDkFk";
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Anchor's discriminator: the first eight bytes of sha256("global:<name>"). */
function discriminator(name) {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function loadKeypair() {
  const file = arg("keypair", process.env.ANCHOR_WALLET) ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  const secret = JSON.parse(fs.readFileSync(file, "utf8"));
  return { keypair: Keypair.fromSecretKey(Uint8Array.from(secret)), file };
}

/** Reads the program's Config account, which is where the treasury lives. */
async function readConfig(connection, program) {
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], program);
  const info = await connection.getAccountInfo(config, "confirmed");
  if (!info) throw new Error("the program's Config account does not exist; initialize it first");
  if (info.data.length < 75) throw new Error("the Config account is too short to be valid");
  return {
    config,
    treasury: new PublicKey(info.data.subarray(40, 72)),
    feeBps: info.data.readUInt16LE(72),
  };
}

async function main() {
  const amount = Number(arg("amount-lamports", "0"));
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("--amount-lamports must be a positive whole number");
  }
  const creatorArg = arg("creator");
  if (!creatorArg) throw new Error("--creator is required (the address the sponsorship is for)");

  const program = new PublicKey(arg("program", PROGRAM_ID));
  const creator = new PublicKey(creatorArg);
  const { keypair: sponsor, file } = loadKeypair();
  const connection = new Connection(RPC, "confirmed");

  const { config, treasury, feeBps } = await readConfig(connection, program);
  const [creatorStats] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator"), creator.toBuffer()],
    program,
  );

  const fee = Math.floor((amount * feeBps) / 10_000);
  console.log(`rpc:        ${RPC}`);
  console.log(`program:    ${program.toBase58()}`);
  console.log(`sponsor:    ${sponsor.publicKey.toBase58()}  (${file})`);
  console.log(`creator:    ${creator.toBase58()}`);
  console.log(`treasury:   ${treasury.toBase58()}  (fee ${feeBps} bps = ${fee} lamports)`);
  console.log(`amount:     ${amount} lamports (creator receives ${amount - fee})`);
  console.log(`config:     ${config.toBase58()}`);
  console.log(`stats:      ${creatorStats.toBase58()}`);

  const data = Buffer.alloc(16);
  discriminator("sponsor").copy(data, 0);
  // One u64, little-endian, straight after the discriminator. Written by hand so
  // the byte order is visible at the call site rather than implied by a helper.
  let remaining = BigInt(amount);
  for (let i = 8; i < 16; i++) {
    data[i] = Number(remaining & BigInt(0xff));
    remaining >>= BigInt(8);
  }

  const instruction = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: sponsor.publicKey, isSigner: true, isWritable: true },
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: creatorStats, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = sponsor.publicKey;

  const signature = await connection.sendTransaction(transaction, [sponsor], {
    skipPreflight: false,
  });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

  const creatorBefore = await connection.getBalance(creator, "confirmed");
  console.log(`\nsignature:  ${signature}`);
  console.log(`creator balance now ${creatorBefore}`);
  // Last line, so a caller can just read the tail.
  console.log(signature);
}

main().catch((err) => {
  console.error(`\nerror: ${err.message}`);
  process.exit(1);
});
