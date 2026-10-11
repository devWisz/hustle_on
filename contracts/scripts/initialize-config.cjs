#!/usr/bin/env node
/*
 * Create the program's Config account.
 *
 * `sponsor` reads the platform fee from Config and refuses to run without it, so
 * a freshly deployed program cannot take a single sponsorship until this has run
 * once. It is a separate step from the deploy because it is a decision, not
 * plumbing: it fixes the treasury and the fee, and both are hard to change your
 * mind about afterwards.
 *
 * The transaction is built by hand — discriminator, then a u16 — because the API
 * derives the same discriminator and this keeps the two definitions side by side
 * rather than hidden behind a generated client.
 *
 * Usage:
 *   NODE_PATH=../frontend/node_modules node scripts/initialize-config.cjs [--fee-bps 500] [--treasury <address>]
 *
 * Idempotent: if the Config account already exists it says so and changes
 * nothing, so it is safe to leave in a deploy script.
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
const MAX_FEE_BPS = 1000;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Anchor's discriminator: the first eight bytes of sha256("global:<name>"). */
function discriminator(name) {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function loadKeypair() {
  const explicit = arg("keypair", process.env.ANCHOR_WALLET);
  const file = explicit || path.join(os.homedir(), ".config", "solana", "id.json");
  const secret = JSON.parse(fs.readFileSync(file, "utf8"));
  return { keypair: Keypair.fromSecretKey(Uint8Array.from(secret)), file };
}

async function main() {
  const feeBps = Number(arg("fee-bps", "500"));
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > MAX_FEE_BPS) {
    throw new Error(`--fee-bps must be a whole number between 0 and ${MAX_FEE_BPS}`);
  }

  const { keypair, file } = loadKeypair();
  const program = new PublicKey(PROGRAM_ID);
  const treasury = new PublicKey(arg("treasury", keypair.publicKey.toBase58()));
  const [config, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program,
  );

  console.log(`rpc:       ${RPC}`);
  console.log(`program:   ${PROGRAM_ID}`);
  console.log(`admin:     ${keypair.publicKey.toBase58()}  (${file})`);
  console.log(`treasury:  ${treasury.toBase58()}`);
  console.log(`fee:       ${feeBps} bps (${(feeBps / 100).toFixed(2)}%)`);
  console.log(`config:    ${config.toBase58()}  (bump ${bump})`);

  const connection = new Connection(RPC, "confirmed");

  // Already set up: leave it alone. Re-initializing would fail on the existing
  // account anyway, and failing a deploy for a no-op is worse than skipping it.
  const existing = await connection.getAccountInfo(config, "confirmed");
  if (existing) {
    console.log("\nConfig already exists — nothing to do.");
    return;
  }

  const programInfo = await connection.getAccountInfo(program, "confirmed");
  if (!programInfo) {
    throw new Error(
      `no program at ${PROGRAM_ID} on this cluster. Deploy it first:\n  scripts/deploy-program.sh`,
    );
  }

  const data = Buffer.alloc(10);
  discriminator("initialize_config").copy(data, 0);
  data.writeUInt16LE(feeBps, 8);

  const instruction = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = keypair.publicKey;
  transaction.sign(keypair);

  console.log("\nsending…");
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  console.log(`initialized: ${signature}`);
}

main().catch((err) => {
  console.error(`\nerror: ${err.message}`);
  process.exit(1);
});
