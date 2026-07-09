import { NextResponse } from "next/server";

import { getMarketState, resolveMarketOnChain } from "@/lib/resolver";
import { getFixtures, getMerkleProof, getScore } from "@/lib/txline";

export const dynamic = "force-dynamic";

// Generous upper bound: 90' + stoppage + ET + penalties
const MATCH_MAX_DURATION_MS = 2.5 * 60 * 60 * 1000;

interface ResolutionReport {
  fixtureId: string;
  match: string;
  status:
    | "awaiting-txline-activation"
    | "not-finished"
    | "no-market"
    | "already-resolved"
    | "resolved"
    | "error";
  detail?: string;
}

/**
 * Resolution pipeline (CLAUDE.md):
 * match ends -> TxLINE score -> Merkle proof -> validateStat on-chain -> payout.
 *
 * Invoked by a scheduled job (Vercel cron / manual trigger during the demo).
 * Each run is a single pass over candidate fixtures — no long-running work.
 */
export async function GET() {
  const { fixtures, source } = await getFixtures();
  const now = Date.now();

  // Only fixtures whose kickoff is far enough in the past to have ended
  const candidates = fixtures.filter(
    (f) => new Date(f.kickoff).getTime() + MATCH_MAX_DURATION_MS < now,
  );

  const reports: ResolutionReport[] = [];

  for (const fixture of candidates) {
    const match = `${fixture.home} vs ${fixture.away}`;
    try {
      const score = await getScore(fixture.id);
      if (!score) {
        reports.push({
          fixtureId: fixture.id,
          match,
          status: "awaiting-txline-activation",
          detail: "Set TXLINE_JWT and TXLINE_API_TOKEN to enable resolution",
        });
        continue;
      }
      if (score.status !== "finished") {
        reports.push({ fixtureId: fixture.id, match, status: "not-finished" });
        continue;
      }

      // Only fixtures someone staked on have a market to resolve
      const marketState = await getMarketState(fixture.id);
      if (!marketState) {
        reports.push({ fixtureId: fixture.id, match, status: "no-market" });
        continue;
      }
      if (marketState.resolved) {
        reports.push({
          fixtureId: fixture.id,
          match,
          status: "already-resolved",
        });
        continue;
      }

      // Proof receipt: real TxLINE Merkle proof when available, otherwise
      // the score snapshot itself (v1 resolution is authority-gated)
      const proof = (await getMerkleProof(fixture.id)) ?? score;
      const outcome =
        score.home > score.away ? 0 : score.home === score.away ? 1 : 2;
      const signature = await resolveMarketOnChain(fixture.id, outcome, proof);

      reports.push({
        fixtureId: fixture.id,
        match,
        status: "resolved",
        detail: `Final ${score.home}-${score.away} (outcome ${outcome}); resolve tx ${signature}`,
      });
    } catch (err) {
      console.error(`[cron/resolve] ${fixture.id} failed:`, err);
      reports.push({
        fixtureId: fixture.id,
        match,
        status: "error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    source,
    checkedAt: new Date(now).toISOString(),
    candidates: candidates.length,
    reports,
  });
}
