import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, TrendingUp, Wallet } from "lucide-react";

import { HeroCta } from "@/components/hero-cta";

export const metadata: Metadata = {
  title: "How It Works — DoxOracle",
  description:
    "Connect your wallet, stake USDC on a World Cup match, and get paid out trustlessly via TxLINE Merkle proofs on Solana.",
};

const steps = [
  {
    icon: Wallet,
    step: "01",
    title: "Connect your wallet",
    body: "Your Solana wallet is your account — no email, no password. Connect Phantom (or any wallet-standard wallet) and you're ready. We never take custody of your keys.",
  },
  {
    icon: TrendingUp,
    step: "02",
    title: "Stake USDC on a match",
    body: "Pick a World Cup 2026 fixture, check the live odds streamed from TxLINE, and stake USDC on home, draw, or away. Your stake goes into a per-market escrow account (PDA) on Solana — not to us.",
  },
  {
    icon: ShieldCheck,
    step: "03",
    title: "Trustless payout",
    body: "When the match ends, the official result comes with a Merkle proof from TxLINE that is verified on-chain. Winners are paid out from the escrow automatically, and you keep the proof receipt.",
  },
];

export default function HowItWorks() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-4 pb-24 pt-16 sm:px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          How DoxOracle works
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Three steps from wallet to payout. No accounts, no middlemen, no
          trust required.
        </p>
      </div>

      <ol className="flex flex-col gap-6">
        {steps.map((item) => (
          <li
            key={item.step}
            className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 sm:flex-row sm:items-start sm:gap-6 sm:p-8"
          >
            <div className="flex items-center gap-4 sm:flex-col sm:items-center">
              <span className="font-mono text-sm text-accent-light">
                {item.step}
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
                <item.icon className="h-6 w-6 text-accent-light" />
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="leading-relaxed text-muted">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-col items-center gap-4 rounded-3xl border border-accent/30 bg-gradient-to-b from-card to-bg px-6 py-10 text-center">
        <h2 className="text-2xl font-bold">Ready to make your first call?</h2>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <HeroCta />
          <Link
            href="/markets"
            className="flex h-11 items-center rounded-xl border border-line px-6 font-medium text-muted transition-colors hover:border-accent hover:text-primary"
          >
            Browse markets
          </Link>
        </div>
      </div>
    </main>
  );
}
