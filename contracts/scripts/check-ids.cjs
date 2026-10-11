#!/usr/bin/env node
/*
 * Check that the program id agrees with itself everywhere.
 *
 * The id appears in four places that must match, and nothing in the toolchain
 * enforces it:
 *
 *   programs/hustleon_pay/src/lib.rs   declare_id! — what the program believes it is
 *   Anchor.toml                        which address a deploy targets
 *   target/deploy/*-keypair.json       the keypair that actually fixes the address
 *   target/idl/hustleon_pay.json       what clients are generated from
 *
 * It has already gone wrong once here: `declare_id!` was changed to a different
 * address while the keypair stayed put. Nothing failed to build, nothing warned,
 * and the program would have deployed "successfully" — then failed every
 * instruction, because a PDA is derived from the declared id, so a mismatch means
 * the Config account the program looks for is not the one the client created. That
 * is the worst shape a bug can have: silent until it is expensive.
 *
 * This runs before a deploy, needs no cluster, and exits non-zero on any
 * disagreement.
 *
 * Usage:
 *   NODE_PATH=../frontend/node_modules node scripts/check-ids.cjs
 */
const fs = require("fs");
const path = require("path");

const { Keypair } = require("@solana/web3.js");

const ROOT = path.resolve(__dirname, "..");
const PROGRAM = "hustleon_pay";

function readDeclaredId() {
  const file = path.join(ROOT, "programs", PROGRAM, "src", "lib.rs");
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(/declare_id!\("([1-9A-HJ-NP-Za-km-z]{32,44})"\)/);
  if (!match) throw new Error(`no declare_id! found in ${file}`);
  return match[1];
}

function readAnchorTomlId() {
  const file = path.join(ROOT, "Anchor.toml");
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(new RegExp(`^${PROGRAM}\\s*=\\s*"([1-9A-HJ-NP-Za-km-z]{32,44})"`, "m"));
  if (!match) throw new Error(`no [programs.*] entry for ${PROGRAM} in Anchor.toml`);
  return match[1];
}

function readKeypairId() {
  // The backup under .keys/ is the one that survives `anchor clean`, so prefer it
  // when both exist; they are supposed to be the same file.
  const candidates = [
    path.join(ROOT, ".keys", `${PROGRAM}-keypair.json`),
    path.join(ROOT, "target", "deploy", `${PROGRAM}-keypair.json`),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const secret = JSON.parse(fs.readFileSync(file, "utf8"));
    return { id: Keypair.fromSecretKey(Uint8Array.from(secret)).publicKey.toBase58(), file };
  }
  return null;
}

function readIdlId() {
  const file = path.join(ROOT, "target", "idl", `${PROGRAM}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return { id: JSON.parse(fs.readFileSync(file, "utf8")).address, file };
  } catch {
    return null;
  }
}

function main() {
  const declared = readDeclaredId();
  const anchorToml = readAnchorTomlId();
  const keypair = readKeypairId();
  const idl = readIdlId();

  const rows = [
    ["declare_id! (lib.rs)", declared, "programs/hustleon_pay/src/lib.rs"],
    ["Anchor.toml", anchorToml, "Anchor.toml"],
    ["program keypair", keypair ? keypair.id : "missing", keypair ? keypair.file : "run `anchor build` to create it"],
    ["generated IDL", idl ? idl.id : "not built", idl ? idl.file : "run `anchor build`"],
  ];

  console.log(`program: ${PROGRAM}\n`);
  for (const [what, id, where] of rows) {
    console.log(`  ${what.padEnd(22)} ${id}`);
    console.log(`  ${"".padEnd(22)} ${where}`);
  }

  const disagreements = rows.filter(([, id]) => id !== declared && id !== "missing" && id !== "not built");
  console.log("");
  if (disagreements.length === 0) {
    console.log(`All present declarations agree: ${declared}`);
    return;
  }

  console.log("These disagree with declare_id!:");
  for (const [what, id] of disagreements) console.log(`  - ${what} says ${id}`);
  console.log(
    "\nA program compiled with the wrong declare_id! derives different PDAs than\n" +
      "its clients, so every instruction fails its seeds constraint. Fix the id\n" +
      "rather than deploying: the keypair is what decides the real on-chain address.",
  );
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(2);
}
