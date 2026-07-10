import "server-only";

import { countryFlag } from "./flags";
import { previewFixtures, type FixturePreview } from "./fixtures";

export type FixtureSource = "txline" | "demo";

export interface FixturesResult {
  fixtures: FixturePreview[];
  source: FixtureSource;
}

const WORLD_CUP_COMPETITION_ID = 72;
const MAX_MARKETS = 12;
// When 1X2 odds aren't published yet for a fixture
const FALLBACK_ODDS = { home: 2.1, draw: 3.3, away: 3.4 };

/** TxLINE /fixtures/snapshot entry (verified against the live devnet feed) */
interface TxFixture {
  Ts: number;
  StartTime: number; // epoch ms
  Competition: string;
  CompetitionId: number;
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome: boolean;
  GameState?: number;
}

/** TxLINE /odds/snapshot entry (Prices are odds x1000) */
interface TxOdds {
  FixtureId: number;
  Ts: number;
  SuperOddsType: string;
  MarketPeriod: string | null;
  PriceNames: string[];
  Prices: number[];
}

export function txlineConfigured(): boolean {
  return Boolean(process.env.TXLINE_JWT && process.env.TXLINE_API_TOKEN);
}

export function txlineHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.TXLINE_JWT}`,
    "X-Api-Token": process.env.TXLINE_API_TOKEN!,
  };
}

function txlineBase(): string {
  return process.env.NEXT_PUBLIC_TXLINE_BASE ?? "https://txline-dev.txodds.com/api";
}

/**
 * Full-match 1X2 odds for a fixture, oriented home/draw/away.
 * Picks the newest `1X2_PARTICIPANT_RESULT` entry without a MarketPeriod
 * (MarketPeriod like "half=1" means a partial-match market).
 */
function extractMatchOdds(
  entries: TxOdds[],
  participant1IsHome: boolean,
): FixturePreview["odds"] | null {
  const fullMatch = entries
    .filter(
      (e) => e.SuperOddsType === "1X2_PARTICIPANT_RESULT" && !e.MarketPeriod,
    )
    .sort((a, b) => b.Ts - a.Ts)[0];
  if (!fullMatch) return null;

  const price = (name: string) => {
    const index = fullMatch.PriceNames.indexOf(name);
    return index === -1 ? null : fullMatch.Prices[index] / 1000;
  };
  const part1 = price("part1");
  const draw = price("draw");
  const part2 = price("part2");
  if (part1 == null || draw == null || part2 == null) return null;

  return participant1IsHome
    ? { home: part1, draw, away: part2 }
    : { home: part2, draw, away: part1 };
}

async function fetchOddsFor(
  fixture: TxFixture,
): Promise<FixturePreview["odds"]> {
  try {
    const res = await fetch(`${txlineBase()}/odds/snapshot/${fixture.FixtureId}`, {
      headers: txlineHeaders(),
      next: { revalidate: 60 },
    });
    if (!res.ok) return FALLBACK_ODDS;
    const entries = (await res.json()) as TxOdds[];
    return extractMatchOdds(entries, fixture.Participant1IsHome) ?? FALLBACK_ODDS;
  } catch {
    return FALLBACK_ODDS;
  }
}

function mapFixture(fx: TxFixture, odds: FixturePreview["odds"]): FixturePreview {
  const home = fx.Participant1IsHome ? fx.Participant1 : fx.Participant2;
  const away = fx.Participant1IsHome ? fx.Participant2 : fx.Participant1;
  return {
    id: String(fx.FixtureId),
    home,
    away,
    homeFlag: countryFlag(home),
    awayFlag: countryFlag(away),
    kickoff: new Date(fx.StartTime).toISOString(),
    stage: fx.Competition,
    odds,
  };
}

/**
 * World Cup fixtures with full-match odds from the TxLINE snapshot API.
 * Falls back to demo data until activation (CLAUDE.md Step 3) or on error.
 */
export async function getFixtures(): Promise<FixturesResult> {
  if (!txlineConfigured()) {
    return { fixtures: previewFixtures, source: "demo" };
  }

  try {
    const res = await fetch(`${txlineBase()}/fixtures/snapshot`, {
      headers: txlineHeaders(),
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`TxLINE fixtures snapshot: ${res.status}`);
    const all = (await res.json()) as TxFixture[];

    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    let worldCup = all
      .filter(
        (f) =>
          f.CompetitionId === WORLD_CUP_COMPETITION_ID && f.StartTime > cutoff,
      )
      .sort((a, b) => a.StartTime - b.StartTime);
    if (worldCup.length === 0) {
      // Tournament fixtures all in the past — show the most recent ones
      worldCup = all
        .filter((f) => f.CompetitionId === WORLD_CUP_COMPETITION_ID)
        .sort((a, b) => b.StartTime - a.StartTime);
    }
    worldCup = worldCup.slice(0, MAX_MARKETS);
    if (worldCup.length === 0) throw new Error("no World Cup fixtures in feed");

    const odds = await Promise.all(worldCup.map(fetchOddsFor));
    return {
      fixtures: worldCup.map((f, i) => mapFixture(f, odds[i])),
      source: "txline",
    };
  } catch (err) {
    console.error("TxLINE fetch failed, serving demo fixtures:", err);
    return { fixtures: previewFixtures, source: "demo" };
  }
}

/**
 * Direct lookup of one fixture by ID from the full snapshot — no time-window
 * filter, so detail pages for ended matches (where users hold positions)
 * keep working after the fixture leaves the markets list.
 */
export async function getFixtureById(
  fixtureId: string,
): Promise<FixturePreview | null> {
  if (!txlineConfigured()) {
    return previewFixtures.find((f) => f.id === fixtureId) ?? null;
  }
  try {
    const res = await fetch(`${txlineBase()}/fixtures/snapshot`, {
      headers: txlineHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`TxLINE fixtures snapshot: ${res.status}`);
    const all = (await res.json()) as TxFixture[];
    const fx = all.find((f) => String(f.FixtureId) === fixtureId);
    if (!fx) return null;
    return mapFixture(fx, await fetchOddsFor(fx));
  } catch (err) {
    console.error(`getFixtureById(${fixtureId}) failed:`, err);
    return previewFixtures.find((f) => f.id === fixtureId) ?? null;
  }
}

export interface ScoreSnapshot {
  fixtureId: string;
  home: number;
  away: number;
  status: "scheduled" | "live" | "finished";
}

interface TxScoreEvent {
  FixtureId: number;
  GameState: string;
  Ts: number;
  Data?: Record<string, unknown>;
  Stats?: Record<string, unknown>;
}

function mapGameState(state: string): ScoreSnapshot["status"] {
  const s = state.toLowerCase();
  if (s === "scheduled" || s === "not_started") return "scheduled";
  if (s.includes("finish") || s.includes("full_time") || s.includes("ended")) {
    return "finished";
  }
  return "live";
}

/** Latest score/state for a fixture. Null when TxLINE isn't activated yet. */
export async function getScore(
  fixtureId: string,
): Promise<ScoreSnapshot | null> {
  if (!txlineConfigured()) return null;

  const res = await fetch(`${txlineBase()}/scores/snapshot/${fixtureId}`, {
    headers: txlineHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TxLINE score snapshot: ${res.status}`);
  const events = (await res.json()) as TxScoreEvent[];
  const latest = events.sort((a, b) => b.Ts - a.Ts)[0];
  if (!latest) return null;

  // TODO(txline): extract goals from Data/Stats once a live match confirms
  // the exact keys — the devnet feed only carries "scheduled" events so far.
  const stats = (latest.Stats ?? {}) as Record<string, number>;
  return {
    fixtureId,
    home: stats.HomeGoals ?? 0,
    away: stats.AwayGoals ?? 0,
    status: mapGameState(latest.GameState),
  };
}

/**
 * Merkle proof material for a finished fixture's result
 * (GET /scores/stat-validation, per the on-chain validation docs).
 * statKey 1002 = full-time score stat used in TxLINE's own examples.
 * Returns null if the proof isn't available yet — resolution then commits
 * the score snapshot hash as the receipt instead (v1 is authority-gated;
 * v2 CPI validation will require the real proof).
 */
export async function getMerkleProof(fixtureId: string): Promise<unknown> {
  if (!txlineConfigured()) return null;

  try {
    const params = new URLSearchParams({
      fixtureId,
      seq: "1",
      statKey: "1002",
    });
    const res = await fetch(
      `${txlineBase()}/scores/stat-validation?${params}`,
      { headers: txlineHeaders(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`TxLINE stat-validation: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[txline] proof fetch failed for ${fixtureId}:`, err);
    return null;
  }
}
