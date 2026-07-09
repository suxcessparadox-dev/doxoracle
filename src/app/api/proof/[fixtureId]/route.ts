import { NextResponse } from "next/server";

import { getMerkleProof, getScore } from "@/lib/txline";

export const dynamic = "force-dynamic";

/**
 * Verifiable resolution receipt: the TxLINE Merkle proof material plus the
 * score snapshot for a fixture, as consumed by the resolution pipeline.
 * The sha256 of the proof payload is what `resolve` commits on-chain.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;
  try {
    const [score, proof] = await Promise.all([
      getScore(fixtureId).catch(() => null),
      getMerkleProof(fixtureId),
    ]);
    return NextResponse.json({
      fixtureId,
      score,
      merkleProof: proof,
      note: proof
        ? "Merkle proof served by TxLINE stat-validation; verifiable against on-chain daily roots"
        : "Proof not yet published by TxLINE for this fixture",
    });
  } catch (err) {
    return NextResponse.json(
      { fixtureId, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
