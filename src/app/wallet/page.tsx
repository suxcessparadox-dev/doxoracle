"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Wallet as WalletIcon } from "lucide-react";

import { USDC_MINT } from "@/lib/solana";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

const txFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default function WalletPage() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [copied, setCopied] = useState(false);

  const address = publicKey?.toBase58();

  const { data: balances } = useQuery({
    queryKey: ["wallet-balances", address],
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

  const { data: history } = useQuery({
    queryKey: ["wallet-history", address],
    enabled: Boolean(publicKey),
    queryFn: () =>
      connection.getSignaturesForAddress(publicKey!, { limit: 10 }),
  });

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!connected) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4 pb-24 pt-12">
        <WalletIcon className="h-10 w-10 text-muted" />
        <p className="text-muted">Connect your wallet to view balances.</p>
        <ConnectWalletButton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 pb-24 pt-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
        <button
          type="button"
          onClick={copyAddress}
          className="flex w-fit max-w-full items-center gap-2 break-all text-left font-mono text-sm text-muted transition-colors hover:text-primary"
        >
          {address}
          {copied ? (
            <Check className="h-3.5 w-3.5 text-win" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-6">
          <span className="text-sm text-muted">USDC balance</span>
          <span className="text-3xl font-bold">
            {balances ? balances.usdc.toFixed(2) : "—"}
          </span>
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex w-fit items-center gap-1 text-xs text-accent-light hover:underline"
          >
            Get devnet USDC <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-6">
          <span className="text-sm text-muted">SOL balance</span>
          <span className="text-3xl font-bold">
            {balances ? balances.sol.toFixed(4) : "—"}
          </span>
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex w-fit items-center gap-1 text-xs text-accent-light hover:underline"
          >
            Get devnet SOL <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Recent on-chain activity</h2>
        {!history ? (
          <div className="h-40 animate-pulse rounded-2xl bg-card" />
        ) : history.length === 0 ? (
          <p className="text-sm text-muted">
            No transactions on devnet yet for this wallet.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-card">
            {history.map((tx) => (
              <a
                key={tx.signature}
                href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-bg/50"
              >
                <div className="flex flex-col">
                  <span className="font-mono text-sm">
                    {tx.signature.slice(0, 20)}…
                  </span>
                  <span
                    className={`text-xs ${tx.err ? "text-loss" : "text-win"}`}
                  >
                    {tx.err ? "Failed" : "Confirmed"}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {tx.blockTime
                    ? `${txFormat.format(new Date(tx.blockTime * 1000))} UTC`
                    : "—"}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
