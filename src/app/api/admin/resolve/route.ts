import { NextResponse, type NextRequest } from "next/server";

import { getMarketState, resolveMarketOnChain } from "@/lib/resolver";
import { getMerkleProof } from "@/lib/txline";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  return Boolean(secret) && req.headers.get("x-admin-secret") === secret;
}

/**
 * Operator fallback: manually settle a market when TxLINE's feed has no
 * result data. Attempts the trustless resolve_verified path first (via
 * resolveMarketOnChain); authority resolution otherwise. Requires the
 * ADMIN_SECRET header — the on-chain RESOLVER key never leaves the server.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { fixtureId, outcome } = (await req.json()) as {
    fixtureId?: string;
    outcome?: number;
  };
  if (!fixtureId || outcome === undefined || ![0, 1, 2].includes(outcome)) {
    return NextResponse.json(
      { error: "fixtureId and outcome (0|1|2) required" },
      { status: 400 },
    );
  }

  try {
    const market = await getMarketState(fixtureId);
    if (!market) {
      return NextResponse.json({ error: "market not found" }, { status: 404 });
    }
    if (market.resolved) {
      return NextResponse.json(
        { error: "market already resolved" },
        { status: 409 },
      );
    }

    const proof = await getMerkleProof(fixtureId).catch(() => null);
    const signature = await resolveMarketOnChain(fixtureId, outcome, proof);
    return NextResponse.json({ fixtureId, outcome, signature });
  } catch (err) {
    console.error(`[admin/resolve] ${fixtureId} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
