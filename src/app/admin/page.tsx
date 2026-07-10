"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  Settings2,
  XCircle,
} from "lucide-react";

interface AdminMarket {
  fixtureId: string;
  kickoffTs: number;
  feed: { home: number; away: number; status: string } | null;
}

interface FixtureInfo {
  id: string;
  home: string;
  away: string;
}

const OUTCOMES = ["Home win", "Draw", "Away win"];
const SECRET_KEY = "doxoracle.admin.secret";

const kickoffFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default function AdminConsole() {
  const [secret, setSecret] = useState("");
  const [entered, setEntered] = useState(false);
  const [markets, setMarkets] = useState<AdminMarket[] | null>(null);
  const [fixtures, setFixtures] = useState<Map<string, FixtureInfo>>(new Map());
  const [outcomes, setOutcomes] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<
    Record<string, { ok: boolean; message: string; signature?: string }>
  >({});
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SECRET_KEY);
    if (saved) {
      setSecret(saved);
      setEntered(true);
    }
  }, []);

  const load = useCallback(async (adminSecret: string) => {
    setMarkets(null);
    setAuthError(false);
    const [marketsRes, fixturesRes] = await Promise.all([
      fetch("/api/admin/markets", {
        headers: { "x-admin-secret": adminSecret },
      }),
      fetch("/api/fixtures")
        .then((r) => r.json())
        .catch(() => ({ fixtures: [] })),
    ]);
    if (marketsRes.status === 401) {
      setAuthError(true);
      setEntered(false);
      window.localStorage.removeItem(SECRET_KEY);
      setMarkets([]);
      return;
    }
    const data = await marketsRes.json();
    setMarkets(data.markets ?? []);
    setFixtures(
      new Map(
        (fixturesRes.fixtures ?? []).map((f: FixtureInfo) => [f.id, f]),
      ),
    );
  }, []);

  useEffect(() => {
    if (entered && secret) void load(secret);
  }, [entered, secret, load]);

  async function resolveMarket(fixtureId: string) {
    const outcome = outcomes[fixtureId];
    if (outcome === undefined) return;
    setBusy(fixtureId);
    try {
      const res = await fetch("/api/admin/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ fixtureId, outcome }),
      });
      const data = await res.json();
      setResults((prev) => ({
        ...prev,
        [fixtureId]: res.ok
          ? { ok: true, message: "Resolved on-chain", signature: data.signature }
          : { ok: false, message: data.error ?? "failed" },
      }));
      if (res.ok) setTimeout(() => load(secret), 1500);
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [fixtureId]: { ok: false, message: String(err) },
      }));
    } finally {
      setBusy(null);
    }
  }

  if (!entered) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 pb-24">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
          <KeyRound className="h-6 w-6 text-accent-light" />
        </span>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Operator Console</h1>
          <p className="mt-1 text-sm text-muted">
            Enter the operator passcode to continue.
          </p>
          {authError ? (
            <p className="mt-2 text-sm text-loss">Wrong passcode.</p>
          ) : null}
        </div>
        <form
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!secret) return;
            window.localStorage.setItem(SECRET_KEY, secret);
            setEntered(true);
          }}
        >
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Passcode"
            className="h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="h-12 rounded-xl bg-accent px-6 font-semibold transition-colors hover:bg-accent-light"
          >
            Enter
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 pb-24 pt-12 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Settings2 className="h-7 w-7 text-accent-light" />
            Operator Console
          </h1>
          <p className="text-muted">
            Markets whose match has ended but remain unresolved. Resolution
            attempts the TxLINE Merkle-proof path first, with authority
            fallback when the feed has no result data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(secret)}
          className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-xs text-muted transition-colors hover:border-accent hover:text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {markets === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-card" />
      ) : markets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-card px-6 py-16 text-center">
          <CheckCircle2 className="h-8 w-8 text-win" />
          <p className="font-medium">All markets settled</p>
          <p className="text-sm text-muted">
            Nothing awaiting resolution right now.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {markets.map((market) => {
            const fixture = fixtures.get(market.fixtureId);
            const result = results[market.fixtureId];
            const label = fixture
              ? `${fixture.home} vs ${fixture.away}`
              : `Fixture #${market.fixtureId}`;
            const outcomeLabels = fixture
              ? [fixture.home, "Draw", fixture.away]
              : OUTCOMES;
            return (
              <div
                key={market.fixtureId}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{label}</span>
                  <span className="text-xs text-muted">
                    Kickoff{" "}
                    {kickoffFormat.format(new Date(market.kickoffTs * 1000))}{" "}
                    UTC ·{" "}
                    {market.feed
                      ? `feed: ${market.feed.status} ${market.feed.home}–${market.feed.away}`
                      : "feed: no data"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {outcomeLabels.map((outcomeLabel, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() =>
                        setOutcomes((prev) => ({
                          ...prev,
                          [market.fixtureId]: index,
                        }))
                      }
                      className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors ${
                        outcomes[market.fixtureId] === index
                          ? "border-accent bg-accent/10 text-primary"
                          : "border-line bg-bg text-muted hover:border-accent/50"
                      }`}
                    >
                      {outcomeLabel}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={
                    outcomes[market.fixtureId] === undefined ||
                    busy === market.fixtureId
                  }
                  onClick={() => resolveMarket(market.fixtureId)}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent font-semibold transition-colors hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === market.fixtureId ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Resolving on-chain…
                    </>
                  ) : (
                    "Resolve market"
                  )}
                </button>

                {result ? (
                  <div
                    className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
                      result.ok
                        ? "bg-win/10 text-win"
                        : "bg-loss/10 text-loss"
                    }`}
                  >
                    {result.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span className="break-words">
                      {result.message}
                      {result.signature ? (
                        <a
                          href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-accent-light hover:underline"
                        >
                          View transaction <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
