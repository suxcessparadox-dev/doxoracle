import { NextResponse } from "next/server";

import { listResolvableMarkets, resolveMarketOnChain } from "@/lib/resolver";
import { getMerkleProof, getScore } from "@/lib/txline";

export const dynamic = "force-dynamic";

interface ResolutionReport {
  fixtureId: string;
  status:
    | "awaiting-txline-activation"
    | "awaiting-score"
    | "not-finished"
    | "resolved"
    | "error";
  detail?: string;
}

/**
 * Resolution pipeline: iterate unresolved on-chain markets (source of truth)
 * whose match should have ended -> TxLINE score -> Merkle proof ->
 * resolve_verified on-chain (validate_stat CPI), authority fallback inside
 * resolveMarketOnChain. Invoked by Vercel cron every 10 minutes.
 */
export async function GET() {
  let markets;
  try {
    markets = await listResolvableMarkets();
  } catch (err) {
    console.error("[cron/resolve] failed to list markets:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const reports: ResolutionReport[] = [];

  for (const market of markets) {
    try {
      const score = await getScore(market.fixtureId).catch(() => null);
      if (!score) {
        reports.push({
          fixtureId: market.fixtureId,
          status: "awaiting-score",
          detail:
            "No score data from TxLINE for this fixture (devnet feed may not cover it)",
        });
        continue;
      }
      if (score.status !== "finished") {
        reports.push({
          fixtureId: market.fixtureId,
          status: "not-finished",
          detail: `GameState: ${score.status}`,
        });
        continue;
      }

      const proof = (await getMerkleProof(market.fixtureId)) ?? score;
      const outcome =
        score.home > score.away ? 0 : score.home === score.away ? 1 : 2;
      const signature = await resolveMarketOnChain(
        market.fixtureId,
        outcome,
        proof,
      );

      reports.push({
        fixtureId: market.fixtureId,
        status: "resolved",
        detail: `Final ${score.home}-${score.away} (outcome ${outcome}); tx ${signature}`,
      });
    } catch (err) {
      console.error(`[cron/resolve] ${market.fixtureId} failed:`, err);
      reports.push({
        fixtureId: market.fixtureId,
        status: "error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    unresolvedMarkets: markets.length,
    reports,
  });
}
