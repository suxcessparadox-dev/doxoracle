"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";

import { USDC_MINT } from "@/lib/solana";

/** Live USDC balance chip, visible as soon as a wallet connects. */
export function NavBalance() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const { data: usdc } = useQuery({
    queryKey: ["nav-usdc", publicKey?.toBase58()],
    enabled: Boolean(publicKey),
    refetchInterval: 20_000,
    queryFn: async () => {
      try {
        const ata = getAssociatedTokenAddressSync(USDC_MINT, publicKey!);
        const account = await connection.getTokenAccountBalance(ata);
        return account.value.uiAmount ?? 0;
      } catch {
        return 0; // no USDC account yet
      }
    },
  });

  if (!connected) return null;

  return (
    <span
      title="USDC balance (devnet)"
      className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-card px-3 text-sm font-semibold tabular-nums"
    >
      <Coins className="h-3.5 w-3.5 text-accent-light" />
      {usdc === undefined ? "…" : usdc.toFixed(2)}
      <span className="hidden text-xs font-medium text-muted sm:inline">
        USDC
      </span>
    </span>
  );
}
