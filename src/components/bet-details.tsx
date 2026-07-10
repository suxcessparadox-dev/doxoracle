"use client";

import Link from "next/link";
import { ArrowUpRight, ExternalLink, FileCheck } from "lucide-react";

import type { DisplayBet } from "@/lib/display-bets";

const placedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function StatusBadge({ status }: { status: DisplayBet["status"] }) {
  const style = {
    open: "bg-accent/10 text-accent-light",
    won: "bg-win/10 text-win",
    lost: "bg-loss/10 text-loss",
  }[status];
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${style}`}
    >
      {status}
    </span>
  );
}

/** Full detail block for one bet — used in the dashboard modal. */
export function BetDetails({
  bet,
  onNavigate,
}: {
  bet: DisplayBet;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-xl font-bold">{bet.matchLabel}</span>
        <StatusBadge status={bet.status} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Your pick", value: bet.outcomeLabel },
          {
            label: "Odds at stake",
            value: bet.odds ? bet.odds.toFixed(2) : "—",
          },
          { label: "Stake (on-chain)", value: `${bet.amountUsdc} USDC` },
          {
            label: bet.status === "won" ? "Payout" : "Est. to win",
            value: bet.odds
              ? `${(bet.amountUsdc * bet.odds).toFixed(2)} USDC`
              : "pool share",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-1 rounded-xl bg-bg px-4 py-3"
          >
            <span className="text-xs text-muted">{item.label}</span>
            <span className="font-semibold">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        {bet.placedAt ? (
          <span className="text-xs text-muted">
            Placed {placedFormat.format(new Date(bet.placedAt))} UTC
          </span>
        ) : null}
        {bet.stakeSignature ? (
          <a
            href={`https://explorer.solana.com/tx/${bet.stakeSignature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-accent-light hover:underline"
          >
            Stake transaction on Solana Explorer
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {bet.claimSignature ? (
          <a
            href={`https://explorer.solana.com/tx/${bet.claimSignature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-win hover:underline"
          >
            Payout transaction on Solana Explorer
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {bet.status !== "open" ? (
          <Link
            href={`/receipt/${bet.fixtureId}?match=${encodeURIComponent(bet.matchLabel)}`}
            onClick={onNavigate}
            className="flex items-center gap-1.5 text-win hover:underline"
          >
            <FileCheck className="h-3.5 w-3.5" />
            TxLINE Merkle proof receipt
          </Link>
        ) : null}
      </div>

      <Link
        href={bet.status === "open" ? `/markets/${bet.fixtureId}` : "/bets"}
        onClick={onNavigate}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent font-semibold transition-colors hover:bg-accent-light"
      >
        {bet.status === "open" ? "View market" : "Manage in My Bets"}
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
