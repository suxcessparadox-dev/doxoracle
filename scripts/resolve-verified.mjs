// Ops tool: resolve a market via resolve_verified (validate_stat CPI) using a
// TxLINE stat-validation payload. Usage:
//   node scripts/resolve-verified.mjs <fixtureId> <outcome 0|1|2> [payload.json]
// Without a payload file the proof is fetched live from TxLINE.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";

const { AnchorProvider, BN, Program, Wallet } = anchor;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const TXORACLE = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const ESCROW = new PublicKey("5yPoMKGhrfgiU7iJLE1e4VgQHTvJU94QZFCVqszwFLar");

function env(name) {
  const line = fs
    .readFileSync(path.join(root, ".env.local"), "utf8")
    .split("\n")
    .find((l) => l.startsWith(name + "="));
  return line ? line.slice(name.length + 1).trim() : "";
}

async function fetchValidation(fixtureId) {
  const res = await fetch(
    `https://txline-dev.txodds.com/api/scores/stat-validation?fixtureId=${fixtureId}&seq=1&statKey=1002`,
    {
      headers: {
        Authorization: `Bearer ${env("TXLINE_JWT")}`,
        "X-Api-Token": env("TXLINE_API_TOKEN"),
      },
    },
  );
  if (!res.ok) throw new Error(`stat-validation: ${res.status}`);
  return res.json();
}

async function main() {
  const [fixtureId, outcomeArg, payloadPath] = process.argv.slice(2);
  if (!fixtureId || outcomeArg === undefined) {
    console.error("usage: node scripts/resolve-verified.mjs <fixtureId> <outcome> [payload.json]");
    process.exit(1);
  }
  const outcome = Number(outcomeArg);

  const v = payloadPath
    ? JSON.parse(fs.readFileSync(payloadPath, "utf8"))
    : await fetchValidation(fixtureId);
  const tsOverride = process.env.TS_FIELD; // e.g. "min" to use minTimestamp
  if (tsOverride === "min") v.ts = v.summary.updateStats.minTimestamp;
  if (tsOverride === "max") v.ts = v.summary.updateStats.maxTimestamp;
  console.log("proof ts:", v.ts, "stat:", JSON.stringify(v.statToProve));

  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync(path.join(root, "scripts/.txline-keypair.json"), "utf8")),
    ),
  );
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const idl = JSON.parse(
    fs.readFileSync(path.join(root, "src/idl/doxoracle_escrow.json"), "utf8"),
  );
  const program = new Program(idl, new AnchorProvider(connection, new Wallet(keypair), { commitment: "confirmed" }));

  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(fixtureId)],
    ESCROW,
  );
  const epochDay = Math.floor(v.ts / 86_400_000);
  const epochBuf = Buffer.alloc(2);
  epochBuf.writeUInt16LE(epochDay & 0xffff);
  const [dailyScores] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), epochBuf],
    TXORACLE,
  );
  console.log("market:", market.toBase58());
  console.log("daily_scores_roots (epochDay " + epochDay + "):", dailyScores.toBase58());

  const sig = await program.methods
    .resolveVerified(
      outcome,
      new BN(v.ts),
      {
        fixtureId: new BN(v.summary.fixtureId),
        updateStats: {
          updateCount: v.summary.updateStats.updateCount,
          minTimestamp: new BN(v.summary.updateStats.minTimestamp),
          maxTimestamp: new BN(v.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: v.summary.eventStatsSubTreeRoot,
      },
      v.subTreeProof,
      v.mainTreeProof,
      { threshold: v.statToProve.value, comparison: { equalTo: {} } },
      {
        statToProve: {
          key: v.statToProve.key,
          value: v.statToProve.value,
          period: v.statToProve.period ?? 0,
        },
        eventStatRoot: v.eventStatRoot,
        statProof: v.statProof,
      },
      null,
      null,
    )
    .accountsPartial({
      market,
      dailyScoresMerkleRoots: dailyScores,
      txoracleProgram: TXORACLE,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
    .rpc();

  console.log("RESOLVED (verified) ✅  tx:", sig);
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch((err) => {
  console.error("failed:", err.message ?? err);
  if (err.logs) console.error(err.logs.slice(-12).join("\n"));
  process.exit(1);
});
