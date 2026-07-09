import { AnchorProvider, BN, Program, type Wallet } from "@coral-xyz/anchor";
import type { Connection } from "@solana/web3.js";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import idl from "@/idl/doxoracle_escrow.json";
import type { DoxoracleEscrow } from "@/idl/doxoracle_escrow";
import { ESCROW_PROGRAM_ID, USDC_MINT, deriveMarketEscrow } from "./solana";

export type EscrowProgram = Program<DoxoracleEscrow>;

export interface MarketAccount {
  authority: PublicKey;
  fixtureId: string;
  kickoffTs: BN;
  resolved: boolean;
  outcome: number;
  totals: BN[];
  proofHash: number[];
  bump: number;
}

/** Minimal wallet shape AnchorProvider needs (useAnchorWallet provides it). */
export type AnchorCompatibleWallet = Pick<
  Wallet,
  "publicKey" | "signTransaction" | "signAllTransactions"
>;

export function getEscrowProgram(
  connection: Connection,
  wallet: AnchorCompatibleWallet,
): EscrowProgram {
  const provider = new AnchorProvider(connection, wallet as Wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as unknown as DoxoracleEscrow, provider);
}

export function derivePosition(
  market: PublicKey,
  owner: PublicKey,
): PublicKey {
  const [position] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("position"), market.toBytes(), owner.toBytes()],
    ESCROW_PROGRAM_ID,
  );
  return position;
}

export async function fetchMarket(
  program: EscrowProgram,
  fixtureId: string,
): Promise<MarketAccount | null> {
  const address = deriveMarketEscrow(fixtureId);
  return (await program.account.market.fetchNullable(
    address,
  )) as MarketAccount | null;
}

/**
 * Stake `amountUnits` USDC (base units) on `outcome` for a fixture.
 * Creates the market on the fly if this is its first stake.
 */
export async function buildStakeTransaction(
  program: EscrowProgram,
  params: {
    fixtureId: string;
    kickoffTs: number; // unix seconds
    outcome: number; // 0 home, 1 draw, 2 away
    amountUnits: bigint;
    staker: PublicKey;
  },
): Promise<Transaction> {
  const { fixtureId, kickoffTs, outcome, amountUnits, staker } = params;
  const market = deriveMarketEscrow(fixtureId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, market, true);
  const stakerToken = getAssociatedTokenAddressSync(USDC_MINT, staker);

  const tx = new Transaction();

  const existing = await program.account.market.fetchNullable(market);
  if (!existing) {
    tx.add(
      await program.methods
        .createMarket(fixtureId, new BN(kickoffTs))
        .accountsPartial({
          authority: staker,
          market,
          usdcMint: USDC_MINT,
          vault,
        })
        .instruction(),
    );
  }

  tx.add(
    await program.methods
      .stake(outcome, new BN(amountUnits.toString()))
      .accountsPartial({
        staker,
        market,
        position: derivePosition(market, staker),
        stakerToken,
        vault,
      })
      .instruction(),
  );

  return tx;
}

export interface ChainPosition {
  fixtureId: string;
  outcomeIndex: number;
  amountUsdc: number;
  claimed: boolean;
  resolved: boolean;
  marketOutcome: number;
}

/**
 * All of a wallet's positions, read straight from the chain — the durable
 * source of truth for bet history (works from any device/browser).
 * Position layout: 8-byte discriminator, then `owner` Pubkey at offset 8.
 */
export async function fetchWalletPositions(
  program: EscrowProgram,
  owner: PublicKey,
): Promise<ChainPosition[]> {
  const positions = await program.account.position.all([
    { memcmp: { offset: 8, bytes: owner.toBase58() } },
  ]);
  if (positions.length === 0) return [];

  const markets = await program.account.market.fetchMultiple(
    positions.map((p) => p.account.market),
  );

  const result: ChainPosition[] = [];
  for (let i = 0; i < positions.length; i++) {
    const market = markets[i];
    if (!market) continue;
    result.push({
      fixtureId: market.fixtureId,
      outcomeIndex: positions[i].account.outcome,
      amountUsdc: Number(positions[i].account.amount) / 1e6,
      claimed: positions[i].account.claimed,
      resolved: market.resolved,
      marketOutcome: market.outcome,
    });
  }
  return result;
}

/** Claim a payout (or refund) for a resolved market. */
export async function buildClaimTransaction(
  program: EscrowProgram,
  params: { fixtureId: string; claimer: PublicKey },
): Promise<Transaction> {
  const { fixtureId, claimer } = params;
  const market = deriveMarketEscrow(fixtureId);
  const vault = getAssociatedTokenAddressSync(USDC_MINT, market, true);
  const claimerToken = getAssociatedTokenAddressSync(USDC_MINT, claimer);

  return new Transaction().add(
    await program.methods
      .claim()
      .accountsPartial({
        claimer,
        market,
        position: derivePosition(market, claimer),
        vault,
        claimerToken,
      })
      .instruction(),
  );
}
