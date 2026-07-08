import { PublicKey } from "@solana/web3.js";

// Circle's official devnet USDC mint (faucet.circle.com)
export const USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
export const USDC_DECIMALS = 6;

// TODO(program): replace with the deployed Anchor escrow program ID.
// Until then the PDA derivation below is a stand-in so the client flow
// (derive escrow -> create ATA -> transfer USDC) is already the real shape.
export const ESCROW_PROGRAM_ID = new PublicKey(
  "11111111111111111111111111111111",
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
