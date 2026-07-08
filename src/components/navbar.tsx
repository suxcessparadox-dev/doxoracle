"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Zap } from "lucide-react";

import { ConnectWalletButton } from "./connect-wallet-button";

const navLinks = [
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/how-it-works", label: "How It Works" },
];

export function Navbar() {
  const { connected } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Zap className="h-4 w-4 text-primary" />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Dox<span className="text-accent-light">Oracle</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          {connected ? (
            <>
              <Link
                href="/bets"
                className="text-sm text-muted transition-colors hover:text-primary"
              >
                My Bets
              </Link>
              <Link
                href="/dashboard"
                className="text-sm text-muted transition-colors hover:text-primary"
              >
                Dashboard
              </Link>
            </>
          ) : null}
        </div>

        <ConnectWalletButton />
      </nav>
    </header>
  );
}
