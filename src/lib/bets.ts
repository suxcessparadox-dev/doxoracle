export type Outcome = "home" | "draw" | "away";

export const OUTCOME_INDEX: Record<Outcome, number> = {
  home: 0,
  draw: 1,
  away: 2,
};

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
  claimed?: boolean;
  claimSignature?: string;
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

export function updateBet(id: string, patch: Partial<BetRecord>): void {
  const bets = loadBets().map((bet) =>
    bet.id === id ? { ...bet, ...patch } : bet,
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}
