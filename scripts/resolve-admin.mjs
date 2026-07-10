// Ops tool: authority-gated resolution fallback (used when TxLINE's devnet
// feed has no playable data for a fixture). Commits sha256(proof payload)
// on-chain as the receipt. Usage:
//   node scripts/resolve-admin.mjs <fixtureId> <outcome 0|1|2> [payload.json]
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const { AnchorProvider, Program, Wallet } = anchor;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ESCROW = new PublicKey("5yPoMKGhrfgiU7iJLE1e4VgQHTvJU94QZFCVqszwFLar");

const [fixtureId, outcomeArg, payloadPath] = process.argv.slice(2);
if (!fixtureId || outcomeArg === undefined) {
  console.error("usage: node scripts/resolve-admin.mjs <fixtureId> <outcome> [payload.json]");
  process.exit(1);
}

const proof = payloadPath ? fs.readFileSync(payloadPath, "utf8") : fixtureId;
const proofHash = [...crypto.createHash("sha256").update(proof).digest()];

const keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(path.join(root, "scripts/.txline-keypair.json"), "utf8"))),
);
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const idl = JSON.parse(fs.readFileSync(path.join(root, "src/idl/doxoracle_escrow.json"), "utf8"));
const program = new Program(idl, new AnchorProvider(connection, new Wallet(keypair), { commitment: "confirmed" }));

const [market] = PublicKey.findProgramAddressSync(
  [Buffer.from("market"), Buffer.from(fixtureId)],
  ESCROW,
);

const sig = await program.methods
  .resolve(Number(outcomeArg), proofHash)
  .accountsPartial({ authority: keypair.publicKey, market })
  .rpc();

console.log("RESOLVED (authority) ✅  tx:", sig);
console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
