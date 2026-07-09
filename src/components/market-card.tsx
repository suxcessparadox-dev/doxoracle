import Link from "next/link";
import { Clock } from "lucide-react";

import type { FixturePreview } from "@/lib/fixtures";

// UTC keeps server + client render identical (no hydration drift)
const kickoffFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function OddsChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-lg bg-bg px-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-sm font-semibold text-accent-light">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function kickoffChip(kickoff: string): { label: string; live: boolean } {
  const start = Date.parse(kickoff);
  const now = Date.now();
  if (now >= start && now < start + 2.5 * 60 * 60 * 1000) {
    return { label: "LIVE", live: true };
  }
  const days = Math.floor((start - now) / 86_400_000);
  if (now >= start) return { label: "Ended", live: false };
  if (days === 0) return { label: "Today", live: false };
  if (days === 1) return { label: "Tomorrow", live: false };
  return { label: `In ${days}d`, live: false };
}

export function MarketCard({
  fixture,
  className = "",
}: {
  fixture: FixturePreview;
  className?: string;
}) {
  const chip = kickoffChip(fixture.kickoff);
  return (
    <Link
      href={`/markets/${fixture.id}`}
      className={`group flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg hover:shadow-accent/5 ${className}`}
    >
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-2">
          {fixture.stage}
          {chip.live ? (
            <span className="flex items-center gap-1 rounded-full bg-win/10 px-2 py-0.5 text-[10px] font-bold text-win">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-win" />
              LIVE
            </span>
          ) : (
            <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium">
              {chip.label}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {kickoffFormat.format(new Date(fixture.kickoff))} UTC
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {fixture.homeFlag} {fixture.home}
          </span>
          <span className="text-sm font-medium">
            {fixture.awayFlag} {fixture.away}
          </span>
        </div>
        <span className="text-xs text-muted transition-colors group-hover:text-accent-light">
          Stake →
        </span>
      </div>

      <div className="flex gap-2">
        <OddsChip label="1" value={fixture.odds.home} />
        <OddsChip label="X" value={fixture.odds.draw} />
        <OddsChip label="2" value={fixture.odds.away} />
      </div>
    </Link>
  );
}
