#!/usr/bin/env node
/*
 * Check that the deployed program is actually usable.
 *
 * "Deployed" and "working" are different states, and the gap between them is
 * exactly one account: `sponsor` reads the platform fee from the Config account
 * and refuses to run without it, so a program can be sitting on chain, fully
 * executable, and unable to take a single sponsorship. This reads both back from
 * the cluster and says which of the two states you are in.
 *
 * Exit code is 0 only when a sponsorship would work.
 *
 * Usage:
 *   NODE_PATH=../frontend/node_modules node scripts/check-program.cjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const { Connection, Keypair, PublicKey } = require("@solana/web3.js");

const PROGRAM_ID = process.env.HUSTLEON_PAY_PROGRAM_ID || "6vK2BUb6UoAqTxWVU2zXTLDje8NDuVA8CaEuTwJZDkFk";
const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function loadWallet() {
  const file = arg("keypair", process.env.ANCHOR_WALLET) ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  try {
    const secret = JSON.parse(fs.readFileSync(file, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  } catch {
    return null;
  }
}

/** Config is: 8-byte discriminator, admin, treasury, fee_bps (u16), bump (u8). */
function decodeConfig(data) {
  if (data.length < 75) return null;
  return {
    admin: new PublicKey(data.subarray(8, 40)).toBase58(),
    treasury: new PublicKey(data.subarray(40, 72)).toBase58(),
    feeBps: data.readUInt16LE(72),
    bump: data[74],
  };
}

async function main() {
  const program = new PublicKey(PROGRAM_ID);
  const connection = new Connection(RPC, "confirmed");
  const wallet = loadWallet();

  console.log(`rpc:      ${RPC}`);
  console.log(`program:  ${PROGRAM_ID}`);
  if (wallet) console.log(`wallet:   ${wallet.publicKey.toBase58()}`);
  console.log("");

  const problems = [];

  // 1. Does the program exist, and can it actually run?
  const programInfo = await connection.getAccountInfo(program, "confirmed");
  if (!programInfo) {
    problems.push(
      "no program at this address — deploy it first:\n    scripts/deploy-program.sh",
    );
    report(problems);
    return;
  }
  if (!programInfo.executable) {
    problems.push("the account exists but is not executable, so it is not a program");
  } else {
    // The program *account* holds no code — that lives in a separate programdata
    // account — so its data length is a meaningless number to report. Saying the
    // program is executable is the whole of the useful answer.
    console.log("  ok    program is deployed and executable");
  }

  // 2. The account `sponsor` cannot run without.
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], program);
  const configInfo = await connection.getAccountInfo(config, "confirmed");
  if (!configInfo) {
    problems.push(
      `the Config account has not been created (${config.toBase58()}), so every\n` +
        "    sponsorship will fail. Run:\n" +
        "      NODE_PATH=frontend/node_modules node contracts/scripts/initialize-config.cjs",
    );
  } else {
    const decoded = decodeConfig(configInfo.data);
    if (!decoded) {
      problems.push(`the Config account is ${configInfo.data.length} bytes, which is too short to be valid`);
    } else {
      console.log(`  ok    Config exists at ${config.toBase58()}`);
      console.log(`          admin     ${decoded.admin}`);
      console.log(`          treasury  ${decoded.treasury}`);
      console.log(`          fee       ${decoded.feeBps} bps (${(decoded.feeBps / 100).toFixed(2)}%)`);
      if (decoded.feeBps > 1000) {
        problems.push(`the fee is ${decoded.feeBps} bps, above the program's own 1000 limit`);
      }
      if (wallet && decoded.admin !== wallet.publicKey.toBase58()) {
        console.log(
          `\n  note  this wallet is not the config admin, so it cannot change the fee\n` +
            "        or the treasury. That is fine for a deploy.",
        );
      }
    }
  }

  report(problems);
}

function report(problems) {
  console.log("");
  if (problems.length === 0) {
    console.log("Program is deployed and usable: sponsorships will go through it.");
    console.log(`Set HUSTLEON_PAY_PROGRAM_ID=${PROGRAM_ID} so the API verifies against it.`);
    process.exit(0);
  }
  console.log("Not usable yet:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(`\nerror: ${err.message}`);
  process.exit(1);
});
