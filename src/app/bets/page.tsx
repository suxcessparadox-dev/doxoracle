"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { ExternalLink, Loader2, Receipt, Ticket } from "lucide-react";

import {
  OUTCOME_INDEX,
  loadBets,
  updateBet,
  type BetRecord,
} from "@/lib/bets";
import {
  buildClaimTransaction,
  fetchMarket,
  getEscrowProgram,
} from "@/lib/program";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

const placedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function BetCard({
  bet,
  onClaim,
  claiming,
}: {
  bet: BetRecord;
  onClaim: (bet: BetRecord) => void;
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
          <span className="font-medium">{bet.odds.toFixed(2)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted">Stake</span>
          <span className="font-medium">{bet.amountUsdc} USDC</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted">Est. to win</span>
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

      {bet.claimed && bet.claimSignature ? (
        <a
          href={`https://explorer.solana.com/tx/${bet.claimSignature}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl bg-bg px-4 py-3 text-xs text-win hover:underline"
        >
          <Receipt className="h-4 w-4" />
          Payout claimed — view transaction ↗
        </a>
      ) : null}

      {bet.status !== "open" && !bet.claimed ? (
        <div className="flex items-center gap-2 rounded-xl bg-bg px-4 py-3 text-xs text-muted">
          <Receipt className="h-4 w-4 text-win" />
          Resolved on-chain with TxLINE Merkle proof receipt
        </div>
      ) : null}
    </div>
  );
}

export default function Bets() {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [bets, setBets] = useState<BetRecord[] | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const program = useMemo(
    () => (anchorWallet ? getEscrowProgram(connection, anchorWallet) : null),
    [connection, anchorWallet],
  );

  // Load local records, then reconcile open bets against on-chain markets
  useEffect(() => {
    const local = loadBets();
    setBets(local);
    if (!program) return;

    let cancelled = false;
    (async () => {
      const openFixtures = [
        ...new Set(
          local
            .filter((b) => b.status === "open")
            .map((b) => b.fixtureId),
        ),
      ];
      for (const fixtureId of openFixtures) {
        try {
          const market = await fetchMarket(program, fixtureId);
          if (!market?.resolved || cancelled) continue;
          for (const bet of local.filter(
            (b) => b.fixtureId === fixtureId && b.status === "open",
          )) {
            const won = OUTCOME_INDEX[bet.outcome] === market.outcome;
            updateBet(bet.id, { status: won ? "won" : "lost" });
          }
        } catch {
          // market may not exist yet — bet stays open
        }
      }
      if (!cancelled) setBets(loadBets());
    })();
    return () => {
      cancelled = true;
    };
  }, [program]);

  const claim = useCallback(
    async (bet: BetRecord) => {
      if (!program || !publicKey) return;
      setClaimingId(bet.id);
      try {
        const tx = await buildClaimTransaction(program, {
          fixtureId: bet.fixtureId,
          claimer: publicKey,
        });
        const signature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(signature, "confirmed");
        updateBet(bet.id, { claimed: true, claimSignature: signature });
        setBets(loadBets());
      } catch (err) {
        console.error("claim failed:", err);
      } finally {
        setClaimingId(null);
      }
    },
    [program, publicKey, sendTransaction, connection],
  );

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
              openBets.map((bet) => (
                <BetCard
                  key={bet.id}
                  bet={bet}
                  onClaim={claim}
                  claiming={claimingId === bet.id}
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
                  key={bet.id}
                  bet={bet}
                  onClaim={claim}
                  claiming={claimingId === bet.id}
                />
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
