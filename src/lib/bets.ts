export type Outcome = "home" | "draw" | "away";

export interface BetRecord {
  id: string;
  fixtureId: string;
  matchLabel: string;
  outcome: Outcome;
  outcomeLabel: string;
  odds: number;
  amountUsdc: number;
  signature: string;
  wallet: string;
  placedAt: string; // ISO
  status: "open" | "won" | "lost";
}

// v1 schema — bump the key if the shape changes
const STORAGE_KEY = "doxoracle.bets.v1";

// Local record of placed bets so /bets and /dashboard render instantly.
// The on-chain transaction signature is the source of truth.
export function loadBets(): BetRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BetRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveBet(bet: BetRecord): void {
  const bets = loadBets();
  bets.unshift(bet);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}
