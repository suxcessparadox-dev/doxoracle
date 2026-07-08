import Link from "next/link";

import { MarketCard } from "@/components/market-card";
import { getFixtures } from "@/lib/txline";

export async function MarketStrip() {
  const { fixtures } = await getFixtures();

  return (
    <section className="w-full">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Live Markets</h2>
          <Link
            href="/markets"
            className="text-sm text-accent-light hover:underline"
          >
            View all →
          </Link>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 pb-2 sm:px-6">
        {fixtures.slice(0, 6).map((fixture) => (
          <MarketCard
            key={fixture.id}
            fixture={fixture}
            className="w-72 shrink-0"
          />
        ))}
      </div>
    </section>
  );
}
