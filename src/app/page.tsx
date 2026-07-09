import Link from "next/link";
import { ShieldCheck, Trophy, Wallet } from "lucide-react";

import { HeroCta } from "@/components/hero-cta";
import { MarketStrip } from "@/components/market-strip";

const features = [
  {
    icon: Wallet,
    title: "Wallet Is Your Identity",
    body: "No sign-ups, no passwords. Connect Phantom and you're in — your Solana address is your account.",
  },
  {
    icon: Trophy,
    title: "Stake USDC on Matches",
    body: "Back your prediction on any World Cup 2026 fixture. Stakes are held in a per-market escrow on Solana.",
  },
  {
    icon: ShieldCheck,
    title: "Trustless Resolution",
    body: "Results come from TxLINE's official data feed and are verified on-chain with Merkle proofs before payouts.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-16 pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(45,156,219,0.14),transparent_60%)]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
          <span className="rounded-full border border-accent/40 bg-accent/10 px-4 py-1 text-xs font-medium text-accent-light">
            World Cup 2026 · Live on Solana Devnet
          </span>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Predict the World Cup.{" "}
            <span className="bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
              Win on-chain.
            </span>
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Stake USDC on World Cup 2026 matches with live odds from TxLINE.
            Every result is settled trustlessly on Solana with verifiable
            Merkle proofs.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <HeroCta />
            <Link
              href="/how-it-works"
              className="flex h-11 items-center rounded-xl border border-line px-6 font-medium text-muted transition-colors hover:border-accent hover:text-primary"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          {[
            { value: "100%", label: "Non-custodial escrow" },
            { value: "0", label: "Human sign-offs to settle" },
            { value: "On-chain", label: "Merkle proof verification" },
            { value: "10 min", label: "Max settlement delay" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1 bg-card px-4 py-6 text-center"
            >
              <span className="text-xl font-bold text-accent-light sm:text-2xl">
                {stat.value}
              </span>
              <span className="text-xs text-muted">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Live market preview strip */}
      <MarketStrip />

      {/* Feature cards */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
              <feature.icon className="h-5 w-5 text-accent-light" />
            </span>
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-muted">{feature.body}</p>
          </div>
        ))}
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 sm:px-6">
        <div className="flex w-full flex-col items-center gap-4 rounded-3xl border border-accent/30 bg-gradient-to-b from-card to-bg px-6 py-12 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            The knockout rounds are on.
          </h2>
          <p className="max-w-md text-muted">
            Connect your wallet and stake your first prediction in under a
            minute.
          </p>
          <HeroCta />
        </div>
      </section>
    </main>
  );
}
