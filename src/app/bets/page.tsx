"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { ExternalLink, Receipt, Ticket } from "lucide-react";

import { loadBets, type BetRecord } from "@/lib/bets";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

const placedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function BetCard({ bet }: { bet: BetRecord }) {
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
          <span className="text-xs text-muted">Odds</span>
          <span className="font-medium">{bet.odds.toFixed(2)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted">Stake</span>
          <span className="font-medium">{bet.amountUsdc} USDC</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted">To win</span>
          <span className="font-medium text-win">
            {(bet.amountUsdc * bet.odds).toFixed(2)} USDC
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
        <span>Placed {placedFormat.format(new Date(bet.placedAt))} UTC</span>
        <a
          href={`https://explorer.solana.com/tx/${bet.signature}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-accent-light hover:underline"
        >
          Stake transaction
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {bet.status !== "open" ? (
        <div className="flex items-center gap-2 rounded-xl bg-bg px-4 py-3 text-xs text-muted">
          <Receipt className="h-4 w-4 text-win" />
          Merkle proof receipt — verified on-chain via TxLINE
        </div>
      ) : null}
    </div>
  );
}

export default function Bets() {
  const { connected, publicKey } = useWallet();
  const [bets, setBets] = useState<BetRecord[] | null>(null);

  useEffect(() => {
    // read after mount — localStorage doesn't exist during SSR
    setBets(loadBets());
  }, []);

  const walletBets =
    bets && publicKey
      ? bets.filter((bet) => bet.wallet === publicKey.toBase58())
      : [];
  const openBets = walletBets.filter((bet) => bet.status === "open");
  const settledBets = walletBets.filter((bet) => bet.status !== "open");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 pb-24 pt-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">My Bets</h1>
        <p className="text-muted">
          Your open positions and settled results, each backed by an on-chain
          transaction.
        </p>
      </div>

      {!connected ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-card px-6 py-16 text-center">
          <Ticket className="h-10 w-10 text-muted" />
          <p className="text-muted">Connect your wallet to see your bets.</p>
          <ConnectWalletButton />
        </div>
      ) : bets === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-card" />
      ) : walletBets.length === 0 ? (
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
              openBets.map((bet) => <BetCard key={bet.id} bet={bet} />)
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
              settledBets.map((bet) => <BetCard key={bet.id} bet={bet} />)
            )}
          </section>
        </>
      )}
    </main>
  );
}
