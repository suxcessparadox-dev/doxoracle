import { PublicKey } from "@solana/web3.js";

// Circle's official devnet USDC mint (faucet.circle.com)
export const USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
export const USDC_DECIMALS = 6;

// DoxOracle escrow program (anchor keys sync), deployed to devnet
export const ESCROW_PROGRAM_ID = new PublicKey(
  "5yPoMKGhrfgiU7iJLE1e4VgQHTvJU94QZFCVqszwFLar",
);

const encoder = new TextEncoder();

/** Per-market escrow authority, derived from the fixture ID (CLAUDE.md staking spec). */
export function deriveMarketEscrow(fixtureId: string): PublicKey {
  const [escrow] = PublicKey.findProgramAddressSync(
    [encoder.encode("market"), encoder.encode(fixtureId)],
    ESCROW_PROGRAM_ID,
  );
  return escrow;
}

export function toUsdcUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}
