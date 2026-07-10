"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChevronRight,
  Coins,
  RefreshCw,
  Ticket,
  TrendingUp,
} from "lucide-react";

import { loadBets } from "@/lib/bets";
import { buildDisplayBets, type DisplayBet } from "@/lib/display-bets";
import { fetchWalletPositions, getEscrowProgram } from "@/lib/program";
import { USDC_MINT } from "@/lib/solana";
import { BetDetails, StatusBadge } from "@/components/bet-details";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { Modal } from "@/components/modal";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 transition-colors hover:border-accent/40">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
        <Icon className="h-4 w-4 text-accent-light" />
      </span>
      <div className="flex flex-col">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xl font-bold tabular-nums">{value}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [bets, setBets] = useState<DisplayBet[] | null>(null);
  const [selected, setSelected] = useState<DisplayBet | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const program = useMemo(
    () => (anchorWallet ? getEscrowProgram(connection, anchorWallet) : null),
    [connection, anchorWallet],
  );

  const { data: balances } = useQuery({
    queryKey: ["balances", publicKey?.toBase58()],
    enabled: Boolean(publicKey),
    refetchInterval: 30_000,
    queryFn: async () => {
      const sol = await connection.getBalance(publicKey!);
      let usdc = 0;
      try {
        const ata = getAssociatedTokenAddressSync(USDC_MINT, publicKey!);
        const account = await connection.getTokenAccountBalance(ata);
        usdc = account.value.uiAmount ?? 0;
      } catch {
        // no USDC token account yet
      }
      return { sol: sol / LAMPORTS_PER_SOL, usdc };
    },
  });

  useEffect(() => {
    if (!program || !publicKey) return;
    let cancelled = false;
    (async () => {
      try {
        const [positions, fixturesRes] = await Promise.all([
          fetchWalletPositions(program, publicKey),
          fetch("/api/fixtures")
            .then((r) => r.json())
            .catch(() => ({ fixtures: [] })),
        ]);
        if (cancelled) return;
        const local = loadBets().filter(
          (b) => b.wallet === publicKey.toBase58(),
        );
        setBets(buildDisplayBets(positions, local, fixturesRes.fixtures ?? []));
      } catch (err) {
        console.error("dashboard: failed to load positions:", err);
        if (!cancelled) setBets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [program, publicKey, refreshKey]);

  if (!connected) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 px-4 pb-24 pt-12">
        <Activity className="h-10 w-10 text-muted" />
        <p className="text-muted">Connect your wallet to see your dashboard.</p>
        <ConnectWalletButton />
      </main>
    );
  }

  const openBets = (bets ?? []).filter((b) => b.status === "open");
  const totalStaked = openBets.reduce((sum, b) => sum + b.amountUsdc, 0);
  const potential = openBets.reduce(
    (sum, b) => sum + (b.odds ? b.amountUsdc * b.odds : b.amountUsdc),
    0,
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pb-24 pt-12 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="font-mono text-sm text-muted">
            {publicKey?.toBase58().slice(0, 8)}…
            {publicKey?.toBase58().slice(-8)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-xs text-muted transition-colors hover:border-accent hover:text-primary"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Coins}
          label="USDC balance"
          value={balances ? balances.usdc.toFixed(2) : "—"}
          hint="Devnet"
        />
        <StatCard
          icon={Coins}
          label="SOL balance"
          value={balances ? balances.sol.toFixed(3) : "—"}
          hint="Devnet"
        />
        <StatCard
          icon={Ticket}
          label="Open stakes"
          value={`${openBets.length}`}
          hint={`${totalStaked.toFixed(2)} USDC staked`}
        />
        <StatCard
          icon={TrendingUp}
          label="Potential payout"
          value={potential.toFixed(2)}
          hint="If all open picks win"
        />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Activity</h2>
          <Link
            href="/bets"
            className="text-sm text-accent-light hover:underline"
          >
            View all bets →
          </Link>
        </div>

        {bets === null ? (
          <div className="h-40 animate-pulse rounded-2xl bg-card" />
        ) : bets.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card px-6 py-12 text-center">
            <p className="text-muted">
              No activity yet — your stakes will show up here.
            </p>
            <Link
              href="/markets"
              className="flex h-11 items-center rounded-xl bg-accent px-6 font-semibold transition-colors hover:bg-accent-light"
            >
              Browse markets
            </Link>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {bets.slice(0, 8).map((bet) => (
              <button
                key={bet.fixtureId}
                type="button"
                onClick={() => setSelected(bet)}
                className="group flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-bg/60"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {bet.amountUsdc} USDC on {bet.outcomeLabel}
                  </span>
                  <span className="text-xs text-muted">{bet.matchLabel}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={bet.status} />
                  <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Bet details"
      >
        {selected ? (
          <BetDetails bet={selected} onNavigate={() => setSelected(null)} />
        ) : null}
      </Modal>
    </main>
  );
}
