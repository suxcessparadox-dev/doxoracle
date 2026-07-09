import type { BetRecord } from "./bets";
import type { FixturePreview } from "./fixtures";
import type { ChainPosition } from "./program";

const OUTCOME_LABELS = ["Home win", "Draw", "Away win"];

export interface DisplayBet {
  fixtureId: string;
  matchLabel: string;
  outcomeLabel: string;
  amountUsdc: number;
  status: "open" | "won" | "lost";
  claimed: boolean;
  odds?: number;
  stakeSignature?: string;
  claimSignature?: string;
  placedAt?: string;
}

/** Merge authoritative on-chain positions with local enrichment records. */
export function buildDisplayBets(
  positions: ChainPosition[],
  local: BetRecord[],
  fixtures: FixturePreview[],
): DisplayBet[] {
  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));
  const localByFixture = new Map(local.map((b) => [b.fixtureId, b]));

  return positions.map((pos) => {
    const fixture = fixtureById.get(pos.fixtureId);
    const record = localByFixture.get(pos.fixtureId);
    const outcomeLabel = fixture
      ? [fixture.home, "Draw", fixture.away][pos.outcomeIndex]
      : OUTCOME_LABELS[pos.outcomeIndex];

    return {
      fixtureId: pos.fixtureId,
      matchLabel: fixture
        ? `${fixture.home} vs ${fixture.away}`
        : (record?.matchLabel ?? `Fixture #${pos.fixtureId}`),
      outcomeLabel,
      amountUsdc: pos.amountUsdc,
      status: pos.resolved
        ? pos.outcomeIndex === pos.marketOutcome
          ? "won"
          : "lost"
        : "open",
      claimed: pos.claimed,
      odds: record?.odds,
      stakeSignature: record?.signature,
      claimSignature: record?.claimSignature,
      placedAt: record?.placedAt,
    };
  });
}
