#!/usr/bin/env node
/*
 * Set up the program's Config account: the admin, the treasury and the fee.
 *
 * `sponsor` reads the platform fee from Config and refuses to run without it, so
 * a freshly deployed program cannot take a single sponsorship until this has run
 * once. It is a separate step from the deploy because it is a decision rather
 * than plumbing — it fixes where the money goes.
 *
 * Two instructions are involved, and the distinction matters:
 *
 *   initialize_config(fee_bps)  creates Config. It takes only the admin account,
 *                               so it necessarily sets the treasury to that same
 *                               wallet. There is no other account for it to read.
 *   update_config(fee, treasury) changes either, and only the recorded admin may
 *                               call it.
 *
 * So pointing the fee at a different wallet takes the second instruction. This
 * script does that for you when --treasury names one, rather than printing a
 * treasury it never set — which is the worst possible behaviour for a flag whose
 * whole job is routing money.
 *
 * The transactions are built by hand — discriminator, then a u16, then a pubkey —
 * because the API derives the same discriminator, and this keeps the two
 * definitions side by side instead of hidden behind a generated client.
 *
 * Usage:
 *   NODE_PATH=../frontend/node_modules node scripts/initialize-config.cjs \
 *     [--keypair <path>] [--fee-bps 500] [--treasury <address>]
 *
 * Idempotent: it reads Config first and only does what is missing, so it is safe
 * to leave in a deploy script and safe to re-run.
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
// Config is: 8-byte discriminator, admin, treasury, fee_bps (u16), bump (u8).
const CONFIG_LEN = 75;

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

/** Sends one instruction and waits for it to finalize, returning its signature. */
async function send(connection, instruction, signer) {
  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = signer.publicKey;
  transaction.sign(signer);

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

function decodeConfig(data) {
  if (data.length < CONFIG_LEN) return null;
  return {
    admin: new PublicKey(data.subarray(8, 40)).toBase58(),
    treasury: new PublicKey(data.subarray(40, 72)).toBase58(),
    feeBps: data.readUInt16LE(72),
  };
}

async function main() {
  const feeBps = Number(arg("fee-bps", "500"));
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > MAX_FEE_BPS) {
    throw new Error(`--fee-bps must be a whole number between 0 and ${MAX_FEE_BPS}`);
  }

  const { keypair, file } = loadKeypair();
  const program = new PublicKey(PROGRAM_ID);
  const treasury = new PublicKey(arg("treasury", keypair.publicKey.toBase58()));
  const [config, bump] = PublicKey.findProgramAddressSync([Buffer.from("config")], program);

  console.log(`rpc:       ${RPC}`);
  console.log(`program:   ${PROGRAM_ID}`);
  console.log(`wallet:    ${keypair.publicKey.toBase58()}  (${file})`);
  console.log(`treasury:  ${treasury.toBase58()}`);
  console.log(`fee:       ${feeBps} bps (${(feeBps / 100).toFixed(2)}%)`);
  console.log(`config:    ${config.toBase58()}  (bump ${bump})`);

  const connection = new Connection(RPC, "confirmed");

  const programInfo = await connection.getAccountInfo(program, "confirmed");
  if (!programInfo) {
    throw new Error(
      `no program at ${PROGRAM_ID} on this cluster. Deploy it first:\n  scripts/deploy-program.sh`,
    );
  }

  const existing = await connection.getAccountInfo(config, "confirmed");
  const current = existing ? decodeConfig(existing.data) : null;

  if (!current) {
    const data = Buffer.alloc(10);
    discriminator("initialize_config").copy(data, 0);
    data.writeUInt16LE(feeBps, 8);

    console.log("\ninitializing…");
    const signature = await send(
      connection,
      new TransactionInstruction({
        programId: program,
        keys: [
          { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: config, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      }),
      keypair,
    );
    console.log(`initialized: ${signature}`);

    // initialize_config sets the treasury to the admin, because that is the only
    // account it has. Anything else needs the update below.
    if (treasury.equals(keypair.publicKey)) {
      console.log("treasury is the initializing wallet, so there is nothing more to set.");
      return;
    }
  } else {
    console.log(
      `\nConfig already exists — admin ${current.admin}, treasury ${current.treasury}, fee ${current.feeBps} bps.`,
    );
    if (current.admin !== keypair.publicKey.toBase58()) {
      return console.log(
        `Nothing can be changed from this wallet: only ${current.admin} may call update_config.\n` +
          "Re-run with --keypair pointing at that wallet if the treasury or fee needs changing.",
      );
    }
    if (current.treasury === treasury.toBase58() && current.feeBps === feeBps) {
      return console.log("It already matches what was asked for, so there is nothing to do.");
    }
    console.log("It differs from what was asked for, so it will be updated.");
  }

  // update_config(fee_bps: u16, treasury: Pubkey) — accounts are the admin (which
  // the program checks against the recorded one) and the Config PDA.
  const updateData = Buffer.alloc(42);
  discriminator("update_config").copy(updateData, 0);
  updateData.writeUInt16LE(feeBps, 8);
  treasury.toBuffer().copy(updateData, 10);

  console.log(`\nsetting the treasury to ${treasury.toBase58()}…`);
  const updateSignature = await send(
    connection,
    new TransactionInstruction({
      programId: program,
      keys: [
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: config, isSigner: false, isWritable: true },
      ],
      data: updateData,
    }),
    keypair,
  );
  console.log(`treasury set: ${updateSignature}`);
}

main().catch((err) => {
  console.error(`\nerror: ${err.message}`);
  process.exit(1);
});
