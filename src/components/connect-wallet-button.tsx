"use client";

import dynamic from "next/dynamic";

// WalletMultiButton reads wallet state that only exists client-side;
// rendering it on the server causes hydration mismatches.
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 w-40 animate-pulse rounded-xl bg-card" />
    ),
  },
);

export function ConnectWalletButton() {
  return <WalletMultiButton />;
}
