"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowRight } from "lucide-react";

import { ConnectWalletButton } from "./connect-wallet-button";

export function HeroCta() {
  const { connected } = useWallet();

  if (connected) {
    return (
      <Link
        href="/markets"
        className="flex h-11 items-center gap-2 rounded-xl bg-accent px-6 font-medium transition-colors hover:bg-accent-light"
      >
        Explore Markets
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  return <ConnectWalletButton />;
}
