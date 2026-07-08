"use client";

import { useEffect, useRef, useState } from "react";

import type { FixturePreview } from "@/lib/fixtures";

type Odds = FixturePreview["odds"];
type Direction = "up" | "down" | null;

function LiveOddsChip({
  label,
  value,
  direction,
}: {
  label: string;
  value: number;
  direction: Direction;
}) {
  const flash =
    direction === "up"
      ? "text-win"
      : direction === "down"
        ? "text-loss"
        : "text-accent-light";

  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-line bg-bg px-3 py-2.5">
      <span className="text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <span
        className={`text-lg font-bold tabular-nums transition-colors duration-700 ${flash}`}
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
}

export function LiveOdds({ fixture }: { fixture: FixturePreview }) {
  const [odds, setOdds] = useState<Odds>(fixture.odds);
  const [directions, setDirections] = useState<Record<keyof Odds, Direction>>({
    home: null,
    draw: null,
    away: null,
  });
  const previous = useRef<Odds>(fixture.odds);

  useEffect(() => {
    // On Vercel the stream ends at the function execution limit;
    // EventSource reconnects automatically, so no manual retry needed.
    const source = new EventSource(`/api/live/${fixture.id}`);

    source.addEventListener("odds", (event) => {
      const next = JSON.parse((event as MessageEvent).data) as Odds;
      const prev = previous.current;
      setDirections({
        home: next.home === prev.home ? null : next.home > prev.home ? "up" : "down",
        draw: next.draw === prev.draw ? null : next.draw > prev.draw ? "up" : "down",
        away: next.away === prev.away ? null : next.away > prev.away ? "up" : "down",
      });
      previous.current = next;
      setOdds(next);
    });

    return () => source.close();
  }, [fixture.id]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-win opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-win" />
        </span>
        Live odds
      </div>
      <div className="flex gap-3">
        <LiveOddsChip
          label={fixture.home}
          value={odds.home}
          direction={directions.home}
        />
        <LiveOddsChip label="Draw" value={odds.draw} direction={directions.draw} />
        <LiveOddsChip
          label={fixture.away}
          value={odds.away}
          direction={directions.away}
        />
      </div>
    </div>
  );
}
