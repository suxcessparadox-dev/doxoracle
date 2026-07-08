import type { NextRequest } from "next/server";

import { previewFixtures } from "@/lib/fixtures";
import { getFixtures, txlineConfigured, txlineHeaders } from "@/lib/txline";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sseChunk(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Random walk step for one odds value, clamped to sane bookmaker range. */
function drift(value: number): number {
  const next = value + (Math.random() - 0.5) * 0.08;
  return Math.min(15, Math.max(1.05, Number(next.toFixed(2))));
}

interface TxOddsMessage {
  FixtureId: number;
  SuperOddsType: string;
  MarketPeriod: string | null;
  PriceNames: string[];
  Prices: number[];
}

function mapOddsMessage(msg: TxOddsMessage) {
  const price = (name: string) => {
    const index = msg.PriceNames.indexOf(name);
    return index === -1 ? null : msg.Prices[index] / 1000;
  };
  const part1 = price("part1");
  const draw = price("draw");
  const part2 = price("part2");
  if (part1 == null || draw == null || part2 == null) return null;
  // NOTE: assumes Participant1IsHome; the snapshot-mapped fixture list keeps
  // the same orientation, so home/away stay consistent in the UI.
  return { home: part1, draw, away: part2 };
}

/** Proxy TxLINE's global odds SSE stream, filtered to one fixture. */
function txlineStream(req: NextRequest, fixtureId: string): ReadableStream {
  const base =
    process.env.NEXT_PUBLIC_TXLINE_BASE ?? "https://txline-dev.txodds.com/api";
  const numericId = Number(fixtureId);

  return new ReadableStream({
    async start(controller) {
      // Baseline odds immediately so the UI isn't empty while the
      // stream warms up
      const { fixtures } = await getFixtures();
      const fixture = fixtures.find((f) => f.id === fixtureId);
      if (fixture) controller.enqueue(sseChunk("odds", fixture.odds));

      const upstream = await fetch(`${base}/odds/stream`, {
        headers: {
          ...txlineHeaders(),
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        signal: req.signal,
      });
      if (!upstream.ok || !upstream.body) {
        console.error(
          `[api/live] TxLINE odds stream failed: ${upstream.status}`,
        );
        controller.close();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const dataLines = frame
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim());
            if (dataLines.length === 0) continue;
            try {
              const parsed = JSON.parse(dataLines.join(""));
              const messages: TxOddsMessage[] = Array.isArray(parsed)
                ? parsed
                : [parsed];
              for (const msg of messages) {
                if (
                  msg.FixtureId === numericId &&
                  msg.SuperOddsType === "1X2_PARTICIPANT_RESULT" &&
                  !msg.MarketPeriod
                ) {
                  const odds = mapOddsMessage(msg);
                  if (odds) controller.enqueue(sseChunk("odds", odds));
                }
              }
            } catch {
              // non-JSON keepalive/comment frame — skip
            }
          }
        }
      } catch {
        // aborted by client or upstream dropped — EventSource will reconnect
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });
}

/** Demo simulator with the same event contract as the real proxy. */
function simulatorStream(
  req: NextRequest,
  odds: { home: number; draw: number; away: number },
): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const current = { ...odds };
      controller.enqueue(sseChunk("odds", current));

      const interval = setInterval(() => {
        current.home = drift(current.home);
        current.draw = drift(current.draw);
        current.away = drift(current.away);
        try {
          controller.enqueue(sseChunk("odds", current));
        } catch {
          clearInterval(interval);
        }
      }, 4000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId } = await params;

  let stream: ReadableStream;
  if (txlineConfigured()) {
    stream = txlineStream(req, fixtureId);
  } else {
    const fixture = previewFixtures.find((f) => f.id === fixtureId);
    if (!fixture) return new Response("fixture not found", { status: 404 });
    stream = simulatorStream(req, fixture.odds);
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
