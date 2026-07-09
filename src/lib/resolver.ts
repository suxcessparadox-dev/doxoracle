import "server-only";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AnchorProvider, Program, type Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
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
 * outcome: 0 home, 1 draw, 2 away. proof: raw TxLINE Merkle proof payload —
 * its sha256 is committed on-chain as the receipt.
 */
export async function resolveMarketOnChain(
  fixtureId: string,
  outcome: number,
  proof: unknown,
): Promise<string> {
  const { program, keypair } = resolverProgram();
  return program.methods
    .resolve(outcome, sha256Bytes(proof))
    .accountsPartial({
      authority: keypair.publicKey,
      market: deriveMarketEscrow(fixtureId),
    })
    .rpc();
}
