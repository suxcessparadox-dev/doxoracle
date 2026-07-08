"use client";

import { useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl, type Cluster } from "@solana/web3.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => {
    const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ??
      "devnet") as Cluster;
    return clusterApiUrl(network);
  }, []);

  const [queryClient] = useState(() => new QueryClient());

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* Wallet-standard wallets (Phantom, Solflare, ...) self-register; no legacy adapters needed */}
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
