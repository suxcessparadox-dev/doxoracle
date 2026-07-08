"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import type { FixturePreview } from "@/lib/fixtures";
import { saveBet, type Outcome } from "@/lib/bets";
import {
  USDC_DECIMALS,
  USDC_MINT,
  deriveMarketEscrow,
  toUsdcUnits,
} from "@/lib/solana";
import { ConnectWalletButton } from "./connect-wallet-button";

const QUICK_AMOUNTS = [5, 10, 25, 50];

type SubmitState =
  | { phase: "idle" }
  | { phase: "signing" }
  | { phase: "confirmed"; signature: string }
  | { phase: "error"; message: string };

export function StakePanel({ fixture }: { fixture: FixturePreview }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [outcome, setOutcome] = useState<Outcome>("home");
  const [amount, setAmount] = useState("10");
  const [submit, setSubmit] = useState<SubmitState>({ phase: "idle" });

  const outcomes: { key: Outcome; label: string; odds: number }[] = [
    { key: "home", label: fixture.home, odds: fixture.odds.home },
    { key: "draw", label: "Draw", odds: fixture.odds.draw },
    { key: "away", label: fixture.away, odds: fixture.odds.away },
  ];

  const selected = outcomes.find((o) => o.key === outcome)!;
  const parsedAmount = Number.parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const payout = validAmount ? parsedAmount * selected.odds : 0;

  async function placeStake() {
    if (!publicKey || !validAmount) return;
    setSubmit({ phase: "signing" });

    try {
      const escrowAuthority = deriveMarketEscrow(fixture.id);
      const escrowAta = getAssociatedTokenAddressSync(
        USDC_MINT,
        escrowAuthority,
        true, // escrow authority is a PDA (off-curve)
      );
      const userAta = getAssociatedTokenAddressSync(USDC_MINT, publicKey);

      const tx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          publicKey,
          escrowAta,
          escrowAuthority,
          USDC_MINT,
        ),
        createTransferCheckedInstruction(
          userAta,
          USDC_MINT,
          escrowAta,
          publicKey,
          toUsdcUnits(parsedAmount),
          USDC_DECIMALS,
        ),
      );

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      saveBet({
        id: crypto.randomUUID(),
        fixtureId: fixture.id,
        matchLabel: `${fixture.home} vs ${fixture.away}`,
        outcome,
        outcomeLabel: selected.label,
        odds: selected.odds,
        amountUsdc: parsedAmount,
        signature,
        wallet: publicKey.toBase58(),
        placedAt: new Date().toISOString(),
        status: "open",
      });
      setSubmit({ phase: "confirmed", signature });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSubmit({
        phase: "error",
        message: message.includes("could not find account")
          ? "No devnet USDC found in your wallet. Grab some free at faucet.circle.com (Solana devnet)."
          : message,
      });
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-6">
      <h2 className="text-lg font-semibold">Place your stake</h2>

      {/* Outcome selector */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">
          Outcome
        </span>
        <div className="grid grid-cols-3 gap-2">
          {outcomes.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setOutcome(option.key)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-sm transition-colors ${
                outcome === option.key
                  ? "border-accent bg-accent/10 text-primary"
                  : "border-line bg-bg text-muted hover:border-accent/50"
              }`}
            >
              <span className="max-w-full truncate font-medium">
                {option.label}
              </span>
              <span
                className={
                  outcome === option.key ? "text-accent-light" : "text-muted"
                }
              >
                {option.odds.toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="stake-amount"
          className="text-xs uppercase tracking-wide text-muted"
        >
          Stake (USDC)
        </label>
        <div className="flex items-center rounded-xl border border-line bg-bg px-4">
          <input
            id="stake-amount"
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-12 w-full bg-transparent text-lg font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-sm font-medium text-muted">USDC</span>
        </div>
        <div className="flex gap-2">
          {QUICK_AMOUNTS.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setAmount(String(quick))}
              className="flex-1 rounded-lg border border-line bg-bg py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-primary"
            >
              ${quick}
            </button>
          ))}
        </div>
      </div>

      {/* Payout summary */}
      <div className="flex items-center justify-between rounded-xl bg-bg px-4 py-3">
        <span className="text-sm text-muted">Potential payout</span>
        <span className="text-lg font-bold text-win">
          {payout.toFixed(2)} USDC
        </span>
      </div>

      {/* Action */}
      {connected ? (
        <button
          type="button"
          onClick={placeStake}
          disabled={!validAmount || submit.phase === "signing"}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent font-semibold transition-colors hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submit.phase === "signing" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Confirm in wallet…
            </>
          ) : (
            `Stake ${validAmount ? parsedAmount : 0} USDC on ${selected.label}`
          )}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <ConnectWalletButton />
          <span className="text-xs text-muted">
            Connect your wallet to stake
          </span>
        </div>
      )}

      {submit.phase === "confirmed" ? (
        <div className="flex flex-col gap-1 rounded-xl border border-win/30 bg-win/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-medium text-win">
            <CheckCircle2 className="h-4 w-4" />
            Stake placed on-chain
          </span>
          <a
            href={`https://explorer.solana.com/tx/${submit.signature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="truncate text-accent-light hover:underline"
          >
            View transaction ↗
          </a>
        </div>
      ) : null}

      {submit.phase === "error" ? (
        <div className="flex items-start gap-2 rounded-xl border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{submit.message}</span>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-muted">
        Stakes are held in a per-market escrow on Solana devnet. Payouts are
        settled trustlessly after the result is verified with a TxLINE Merkle
        proof.
      </p>
    </div>
  );
}
