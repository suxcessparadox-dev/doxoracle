import { NextResponse, type NextRequest } from "next/server";

import { listResolvableMarkets } from "@/lib/resolver";
import { getScore } from "@/lib/txline";

export const dynamic = "force-dynamic";

/** Unresolved, ended markets + what TxLINE currently knows about each. */
export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const markets = await listResolvableMarkets();
    const withFeed = await Promise.all(
      markets.map(async (m) => ({
        ...m,
        feed: await getScore(m.fixtureId).catch(() => null),
      })),
    );
    return NextResponse.json({ markets: withFeed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
