import type { Metadata } from "next";
import { Radio } from "lucide-react";

import { MarketCard } from "@/components/market-card";
import { getFixtures } from "@/lib/txline";
import type { FixturePreview } from "@/lib/fixtures";

export const metadata: Metadata = {
  title: "Markets — DoxOracle",
  description:
    "World Cup 2026 prediction markets with live TxLINE odds. Stake USDC on Solana.",
};

function groupByStage(fixtures: FixturePreview[]) {
  const groups = new Map<string, FixturePreview[]>();
  for (const fixture of fixtures) {
    const list = groups.get(fixture.stage);
    if (list) {
      list.push(fixture);
    } else {
      groups.set(fixture.stage, [fixture]);
    }
  }
  return groups;
}

export default async function Markets() {
  const { fixtures, source } = await getFixtures();
  const stages = groupByStage(fixtures);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pb-24 pt-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              source === "txline"
                ? "bg-win/10 text-win"
                : "bg-accent/10 text-accent-light"
            }`}
          >
            <Radio className="h-3 w-3" />
            {source === "txline" ? "Live TxLINE data" : "Demo data"}
          </span>
        </div>
        <p className="text-muted">
          World Cup 2026 fixtures. Pick a match to stake USDC on the outcome.
        </p>
      </div>

      {[...stages.entries()].map(([stage, stageFixtures]) => (
        <section key={stage} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-primary">{stage}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stageFixtures.map((fixture) => (
              <MarketCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
