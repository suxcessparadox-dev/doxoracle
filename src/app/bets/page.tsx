"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  ExternalLink,
  FileCheck,
  Loader2,
  RefreshCw,
  Ticket,
} from "lucide-react";

import { loadBets, updateBet, type BetRecord } from "@/lib/bets";
import {
  buildClaimTransaction,
  fetchWalletPositions,
  getEscrowProgram,
  type ChainPosition,
} from "@/lib/program";
import type { FixturePreview } from "@/lib/fixtures";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

const OUTCOME_LABELS = ["Home win", "Draw", "Away win"];

interface DisplayBet {
  fixtureId: string;
  matchLabel: string;
  outcomeLabel: string;
  amountUsdc: number;
  status: "open" | "won" | "lost";
  claimed: boolean;
  odds?: number;
  stakeSignature?: string;
  claimSignature?: string;
}

function buildDisplayBets(
  positions: ChainPosition[],
  local: BetRecord[],
  fixtures: FixturePreview[],
): DisplayBet[] {
  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));
  const localByFixture = new Map(local.map((b) => [b.fixtureId, b]));

  return positions.map((pos) => {
    const fixture = fixtureById.get(pos.fixtureId);
    const record = localByFixture.get(pos.fixtureId);
    const outcomeLabel = fixture
      ? [fixture.home, "Draw", fixture.away][pos.outcomeIndex]
      : OUTCOME_LABELS[pos.outcomeIndex];

    return {
      fixtureId: pos.fixtureId,
      matchLabel: fixture
        ? `${fixture.home} vs ${fixture.away}`
        : (record?.matchLabel ?? `Fixture #${pos.fixtureId}`),
      outcomeLabel,
      amountUsdc: pos.amountUsdc,
      status: pos.resolved
        ? pos.outcomeIndex === pos.marketOutcome
          ? "won"
          : "lost"
        : "open",
      claimed: pos.claimed,
      odds: record?.odds,
      stakeSignature: record?.signature,
      claimSignature: record?.claimSignature,
    };
  });
}

function BetCard({
  bet,
  onClaim,
  claiming,
}: {
  bet: DisplayBet;
  onClaim: (bet: DisplayBet) => void;
  claiming: boolean;
}) {
  const statusStyle = {
    open: "bg-accent/10 text-accent-light",
    won: "bg-win/10 text-win",
    lost: "bg-loss/10 text-loss",
  }[bet.status];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
      <div className="flex items-center justify-between">
        <Link
          href={`/markets/${bet.fixtureId}`}
          className="font-semibold hover:text-accent-light"
        >
          {bet.matchLabel}
        </Link>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusStyle}`}
        >
          {bet.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="flex flex-col">
          <span className="text-xs text-muted">Pick</span>
          <span className="font-medium">{bet.outcomeLabel}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted">Odds at stake</span>
          <span className="font-medium">
            {bet.odds ? bet.odds.toFixed(2) : "—"}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted">Stake (on-chain)</span>
          <span className="font-medium">{bet.amountUsdc} USDC</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted">Est. to win</span>
          <span className="font-medium text-win">
            {bet.odds ? (bet.amountUsdc * bet.odds).toFixed(2) : "pool share"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-xs">
        {bet.stakeSignature ? (
          <a
            href={`https://explorer.solana.com/tx/${bet.stakeSignature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-accent-light hover:underline"
          >
            Stake transaction <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
        {bet.status !== "open" ? (
          <a
            href={`/api/proof/${bet.fixtureId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-win hover:underline"
          >
            <FileCheck className="h-3.5 w-3.5" />
            TxLINE Merkle proof receipt <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      {bet.status === "won" && !bet.claimed ? (
        <button
          type="button"
          onClick={() => onClaim(bet)}
          disabled={claiming}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-win/90 font-semibold text-bg transition-colors hover:bg-win disabled:opacity-50"
        >
          {claiming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Claiming…
            </>
          ) : (
            "Claim payout"
          )}
        </button>
      ) : null}

      {bet.claimed ? (
        <div className="flex items-center gap-2 rounded-xl bg-bg px-4 py-3 text-xs text-win">
          <FileCheck className="h-4 w-4" />
          Payout claimed
          {bet.claimSignature ? (
            <a
              href={`https://explorer.solana.com/tx/${bet.claimSignature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="text-accent-light hover:underline"
            >
              — view transaction ↗
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function Bets() {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [bets, setBets] = useState<DisplayBet[] | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const program = useMemo(
    () => (anchorWallet ? getEscrowProgram(connection, anchorWallet) : null),
    [connection, anchorWallet],
  );

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
        setBets(
          buildDisplayBets(positions, local, fixturesRes.fixtures ?? []),
        );
      } catch (err) {
        console.error("failed to load on-chain positions:", err);
        if (!cancelled) setBets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [program, publicKey, refreshKey]);

  const claim = useCallback(
    async (bet: DisplayBet) => {
      if (!program || !publicKey) return;
      setClaimingId(bet.fixtureId);
      try {
        const tx = await buildClaimTransaction(program, {
          fixtureId: bet.fixtureId,
          claimer: publicKey,
        });
        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(signature, "confirmed");
        // enrich the local record (if any) with the claim signature
        const record = loadBets().find(
          (b) =>
            b.fixtureId === bet.fixtureId &&
            b.wallet === publicKey.toBase58(),
        );
        if (record) {
          updateBet(record.id, { claimed: true, claimSignature: signature });
        }
        setRefreshKey((k) => k + 1);
      } catch (err) {
        console.error("claim failed:", err);
      } finally {
        setClaimingId(null);
      }
    },
    [program, publicKey, sendTransaction, connection],
  );

  const openBets = (bets ?? []).filter((bet) => bet.status === "open");
  const settledBets = (bets ?? []).filter((bet) => bet.status !== "open");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 pb-24 pt-12 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">My Bets</h1>
          <p className="text-muted">
            Read live from the Solana blockchain — your positions follow your
            wallet, on any device.
          </p>
        </div>
        {connected ? (
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs text-muted transition-colors hover:border-accent hover:text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        ) : null}
      </div>

      {!connected ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card px-6 py-16 text-center">
          <Ticket className="h-10 w-10 text-muted" />
          <p className="text-muted">Connect your wallet to see your bets.</p>
          <ConnectWalletButton />
        </div>
      ) : bets === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-card" />
      ) : bets.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card px-6 py-16 text-center">
          <Ticket className="h-10 w-10 text-muted" />
          <p className="text-muted">
            No bets yet. Pick a match and place your first stake.
          </p>
          <Link
            href="/markets"
            className="flex h-11 items-center rounded-xl bg-accent px-6 font-semibold transition-colors hover:bg-accent-light"
          >
            Browse markets
          </Link>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">
              Open{" "}
              <span className="text-sm font-normal text-muted">
                ({openBets.length})
              </span>
            </h2>
            {openBets.length === 0 ? (
              <p className="text-sm text-muted">No open positions.</p>
            ) : (
              openBets.map((bet) => (
                <BetCard
                  key={bet.fixtureId}
                  bet={bet}
                  onClaim={claim}
                  claiming={claimingId === bet.fixtureId}
                />
              ))
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">
              Settled{" "}
              <span className="text-sm font-normal text-muted">
                ({settledBets.length})
              </span>
            </h2>
            {settledBets.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing settled yet — results land here with their Merkle proof
                receipts.
              </p>
            ) : (
              settledBets.map((bet) => (
                <BetCard
                  key={bet.fixtureId}
                  bet={bet}
                  onClaim={claim}
                  claiming={claimingId === bet.fixtureId}
                />
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
