import Link from "next/link";
import { ExternalLink, Zap } from "lucide-react";

const PROGRAM_ID = "5yPoMKGhrfgiU7iJLE1e4VgQHTvJU94QZFCVqszwFLar";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="flex max-w-xs flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </span>
              <span className="font-bold">
                Dox<span className="text-accent-light">Oracle</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Non-custodial World Cup prediction markets. Stakes in escrow,
              results proven with TxLINE Merkle proofs, settled on Solana.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:gap-16">
            <div className="flex flex-col gap-2.5 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                App
              </span>
              <Link href="/markets" className="text-muted hover:text-primary">
                Markets
              </Link>
              <Link href="/bets" className="text-muted hover:text-primary">
                My Bets
              </Link>
              <Link href="/leaderboard" className="text-muted hover:text-primary">
                Leaderboard
              </Link>
              <Link href="/how-it-works" className="text-muted hover:text-primary">
                How It Works
              </Link>
            </div>
            <div className="flex flex-col gap-2.5 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Transparency
              </span>
              <a
                href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-muted hover:text-primary"
              >
                Escrow program <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://github.com/suxcessparadox-dev/doxoracle"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-muted hover:text-primary"
              >
                Source code <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://txline.txodds.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-muted hover:text-primary"
              >
                TxLINE data <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center">
          <span>Solana devnet · demo only — no real funds</span>
          <span>Built on Solana · Powered by TxLINE</span>
        </div>
      </div>
    </footer>
  );
}
