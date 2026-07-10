import "server-only";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AnchorProvider, BN, Program, type Wallet } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  type Cluster,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";

import idl from "@/idl/doxoracle_escrow.json";
import type { DoxoracleEscrow } from "@/idl/doxoracle_escrow";
import { deriveMarketEscrow } from "./solana";

/**
 * Resolution signer = the service wallet (TxLINE subscriber, program RESOLVER).
 * On Vercel set RESOLVER_KEYPAIR to the JSON secret-key array; locally the
 * activation keypair file is used.
 */
function loadResolverKeypair(): Keypair {
  const fromEnv = process.env.RESOLVER_KEYPAIR;
  const raw = fromEnv
    ? fromEnv
    : readFileSync(
        path.join(process.cwd(), "scripts", ".txline-keypair.json"),
        "utf8",
      );
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

function nodeWallet(keypair: Keypair): Wallet {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      tx: T,
    ): Promise<T> => {
      if ("partialSign" in tx) tx.partialSign(keypair);
      else tx.sign([keypair]);
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[],
    ): Promise<T[]> => {
      for (const tx of txs) {
        if ("partialSign" in tx) tx.partialSign(keypair);
        else tx.sign([keypair]);
      }
      return txs;
    },
    payer: keypair,
  } as Wallet;
}

export function sha256Bytes(data: unknown): number[] {
  return [
    ...createHash("sha256").update(JSON.stringify(data)).digest(),
  ];
}

export interface MarketState {
  resolved: boolean;
  kickoffTs: number;
}

/** On-chain market state, or null if no one has staked on this fixture. */
export async function getMarketState(
  fixtureId: string,
): Promise<MarketState | null> {
  const { program } = resolverProgram();
  const market = await program.account.market.fetchNullable(
    deriveMarketEscrow(fixtureId),
  );
  if (!market) return null;
  return {
    resolved: market.resolved as boolean,
    kickoffTs: Number(market.kickoffTs),
  };
}

function resolverProgram() {
  const keypair = loadResolverKeypair();
  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ??
    "devnet") as Cluster;
  const connection = new Connection(clusterApiUrl(network), "confirmed");
  const provider = new AnchorProvider(connection, nodeWallet(keypair), {
    commitment: "confirmed",
  });
  const program: Program<DoxoracleEscrow> = new Program(
    idl as unknown as DoxoracleEscrow,
    provider,
  );
  return { program, keypair };
}

/**
 * Send the on-chain resolve for a finished fixture.
 * Prefers `resolve_verified` (permissionless, TxLINE Merkle proof verified
 * on-chain via CPI into Txoracle validate_stat); falls back to the
 * authority-gated `resolve` with a sha256 receipt when the proof payload
 * isn't available/mappable yet.
 */
export async function resolveMarketOnChain(
  fixtureId: string,
  outcome: number,
  proof: unknown,
): Promise<string> {
  if (proof) {
    try {
      const sig = await resolveVerifiedOnChain(fixtureId, outcome, proof);
      console.log(`[resolver] ${fixtureId} resolved via validate_stat CPI`);
      return sig;
    } catch (err) {
      console.error(
        `[resolver] verified resolution failed for ${fixtureId}, falling back to authority resolve:`,
        err,
      );
    }
  }

  const { program, keypair } = resolverProgram();
  return program.methods
    .resolve(outcome, sha256Bytes(proof))
    .accountsPartial({
      authority: keypair.publicKey,
      market: deriveMarketEscrow(fixtureId),
    })
    .rpc();
}

export interface ResolvableMarket {
  fixtureId: string;
  kickoffTs: number;
}

/**
 * Unresolved on-chain markets whose match should have ended — the cron's
 * work list. The chain is the source of truth: markets never age out the way
 * fixtures drop off the TxLINE snapshot window.
 */
export async function listResolvableMarkets(): Promise<ResolvableMarket[]> {
  const { program } = resolverProgram();
  // 90' + halftime + stoppage ≈ 1h50m; list slightly early — the cron still
  // requires feed status "finished", and the console defers to the operator
  const matchMaxMs = 1.75 * 60 * 60 * 1000;
  const all = await program.account.market.all();
  return all
    .filter(
      (m) =>
        !m.account.resolved &&
        Number(m.account.kickoffTs) * 1000 + matchMaxMs < Date.now(),
    )
    .map((m) => ({
      fixtureId: m.account.fixtureId,
      kickoffTs: Number(m.account.kickoffTs),
    }));
}

const TXORACLE_PROGRAM_ID = new PublicKey(
  "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
);

/** hex / base64 / number[] -> 32-byte array */
function toBytes32(value: unknown): number[] {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === "string") {
    const buf = /^[0-9a-fA-F]{64}$/.test(value)
      ? Buffer.from(value, "hex")
      : Buffer.from(value, "base64");
    return [...buf];
  }
  throw new Error(`cannot convert to bytes32: ${typeof value}`);
}

type AnyRecord = Record<string, unknown>;

function pick(obj: AnyRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

function mapProofNodes(nodes: unknown): { hash: number[]; isRightSibling: boolean }[] {
  if (!Array.isArray(nodes)) throw new Error("proof nodes missing");
  return nodes.map((n) => {
    const node = n as AnyRecord;
    return {
      hash: toBytes32(pick(node, "hash", "Hash")),
      isRightSibling: Boolean(
        pick(node, "isRightSibling", "is_right_sibling", "IsRightSibling"),
      ),
    };
  });
}

/**
 * Map the TxLINE stat-validation API payload onto resolve_verified args and
 * send it. Field names follow the documented validateStat call shape; any
 * mismatch throws and the caller falls back to authority resolution.
 */
async function resolveVerifiedOnChain(
  fixtureId: string,
  outcome: number,
  proofPayload: unknown,
): Promise<string> {
  const { program } = resolverProgram();
  const payload = proofPayload as AnyRecord;

  // ts arrives in epoch milliseconds from the API; pass through unchanged
  const ts = Number(
    pick(payload, "ts", "targetTs", "timestamp") ??
      (() => {
        throw new Error("no ts in proof payload");
      })(),
  );

  const summarySrc = pick(
    payload,
    "summary",
    "fixtureSummary",
    "fixture_summary",
  ) as AnyRecord;
  if (!summarySrc) throw new Error("no summary in proof payload");
  const statsSrc = pick(summarySrc, "updateStats", "update_stats") as AnyRecord;
  const fixtureSummary = {
    fixtureId: new BN(String(pick(summarySrc, "fixtureId", "fixture_id"))),
    updateStats: {
      updateCount: Number(pick(statsSrc, "updateCount", "update_count")),
      minTimestamp: new BN(String(pick(statsSrc, "minTimestamp", "min_timestamp"))),
      maxTimestamp: new BN(String(pick(statsSrc, "maxTimestamp", "max_timestamp"))),
    },
    eventsSubTreeRoot: toBytes32(
      pick(
        summarySrc,
        "eventStatsSubTreeRoot",
        "eventsSubTreeRoot",
        "events_sub_tree_root",
      ),
    ),
  };

  // The confirmed payload carries the stat term at the top level
  const statToProve = pick(payload, "statToProve", "stat_to_prove") as AnyRecord;
  if (!statToProve) throw new Error("no statToProve in proof payload");
  const statA = {
    statToProve: {
      key: Number(statToProve.key),
      value: Number(statToProve.value),
      period: Number(statToProve.period ?? 0),
    },
    eventStatRoot: toBytes32(pick(payload, "eventStatRoot", "event_stat_root")),
    statProof: mapProofNodes(pick(payload, "statProof", "stat_proof")),
  };

  // No predicate in the payload: assert the proven value equals itself, so
  // the on-chain check hinges entirely on Merkle proof authenticity
  const predicate = (pick(payload, "predicate") as AnyRecord) ?? {
    threshold: statA.statToProve.value,
    comparison: { equalTo: {} },
  };

  // Txoracle keeps daily score roots in a per-epoch-day PDA (ts is in ms)
  const epochDay = Math.floor(ts / 86_400_000);
  const epochBuf = Buffer.alloc(2);
  epochBuf.writeUInt16LE(epochDay & 0xffff);
  const [dailyScoresPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), epochBuf],
    TXORACLE_PROGRAM_ID,
  );

  return (
    program.methods
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolveVerified(
        outcome,
        new BN(ts),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fixtureSummary as any,
        // subTreeProof proves the fixture summary within the day's batch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapProofNodes(
          pick(payload, "subTreeProof", "fixtureProof", "fixture_proof"),
        ) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapProofNodes(pick(payload, "mainTreeProof", "main_tree_proof")) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        predicate as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        statA as any,
        null,
        null,
      )
      .accountsPartial({
        market: deriveMarketEscrow(fixtureId),
        dailyScoresMerkleRoots: dailyScoresPda,
        txoracleProgram: TXORACLE_PROGRAM_ID,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
      ])
      .rpc()
  );
}
