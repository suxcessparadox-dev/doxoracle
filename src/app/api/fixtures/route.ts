import { NextResponse } from "next/server";

import { getFixtures } from "@/lib/txline";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getFixtures();
  return NextResponse.json(result);
}
