import { NextResponse } from "next/server";

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
    | "proof-fetched"
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

      const proof = await getMerkleProof(fixture.id);

      // TODO(program): submit validateStat(proof) to the escrow program and
      // distribute USDC from the market PDA to winning stakes, then persist
      // the resolution + proof receipt for /bets.
      void proof;

      reports.push({
        fixtureId: fixture.id,
        match,
        status: "proof-fetched",
        detail: `Final ${score.home}-${score.away}; on-chain validation pending program deploy`,
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
