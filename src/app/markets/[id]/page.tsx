import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ShieldCheck } from "lucide-react";

import { LiveOdds } from "@/components/live-odds";
import { StakePanel } from "@/components/stake-panel";
import { getFixtures } from "@/lib/txline";

const kickoffFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function MarketDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { fixtures, source } = await getFixtures();
  const fixture = fixtures.find((f) => f.id === id);

  if (!fixture) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pb-24 pt-10 sm:px-6">
      <Link
        href="/markets"
        className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        All markets
      </Link>

      {/* Match header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 sm:p-8">
        <div className="flex items-center justify-between text-sm text-muted">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent-light">
            {fixture.stage}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {kickoffFormat.format(new Date(fixture.kickoff))} UTC
          </span>
        </div>

        <div className="flex items-center justify-center gap-6 py-4 sm:gap-12">
          <div className="flex flex-1 flex-col items-center gap-2 text-center">
            <span className="text-5xl">{fixture.homeFlag}</span>
            <span className="text-xl font-bold">{fixture.home}</span>
            <span className="text-sm text-muted">
              {fixture.odds.home.toFixed(2)}
            </span>
          </div>
          <span className="text-2xl font-bold text-muted">vs</span>
          <div className="flex flex-1 flex-col items-center gap-2 text-center">
            <span className="text-5xl">{fixture.awayFlag}</span>
            <span className="text-xl font-bold">{fixture.away}</span>
            <span className="text-sm text-muted">
              {fixture.odds.away.toFixed(2)}
            </span>
          </div>
        </div>

        <LiveOdds fixture={fixture} />
        <p className="text-center text-xs text-muted">
          Odds {source === "txline" ? "streamed live from TxLINE" : "simulated until TxLINE activation — same stream contract"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Resolution explainer */}
        <div className="flex h-fit flex-col gap-4 rounded-2xl border border-line bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 text-win" />
            How this market resolves
          </h2>
          <ol className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <li>
              <span className="font-medium text-primary">1. Match ends.</span>{" "}
              The final score arrives on TxLINE&apos;s official World Cup data
              stream.
            </li>
            <li>
              <span className="font-medium text-primary">
                2. Proof fetched.
              </span>{" "}
              The result comes with a Merkle proof signed into TxLINE&apos;s
              on-chain commitment.
            </li>
            <li>
              <span className="font-medium text-primary">
                3. Verified on Solana.
              </span>{" "}
              The proof is validated on-chain — no oracle multisig, no manual
              judgment call.
            </li>
            <li>
              <span className="font-medium text-primary">4. Paid out.</span>{" "}
              The escrow distributes USDC to winning stakes automatically. Your
              proof receipt appears in{" "}
              <Link href="/bets" className="text-accent-light hover:underline">
                My Bets
              </Link>
              .
            </li>
          </ol>
        </div>

        {/* Stake panel */}
        <StakePanel fixture={fixture} />
      </div>
    </main>
  );
}
