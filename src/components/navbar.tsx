"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Menu, X, Zap } from "lucide-react";

import { ConnectWalletButton } from "./connect-wallet-button";
import { NavBalance } from "./nav-balance";

const baseLinks = [
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/how-it-works", label: "How It Works" },
];

const walletLinks = [
  { href: "/bets", label: "My Bets" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/wallet", label: "Wallet" },
];

function NavLink({
  href,
  label,
  active,
  onClick,
  mobile = false,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
  mobile?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`${
        mobile
          ? "flex h-12 items-center rounded-xl px-4 text-base font-medium"
          : "text-sm"
      } transition-colors ${
        active
          ? mobile
            ? "bg-accent/10 text-accent-light"
            : "font-semibold text-primary"
          : "text-muted hover:text-primary"
      } ${mobile && !active ? "hover:bg-bg" : ""}`}
    >
      {label}
    </Link>
  );
}

export function Navbar() {
  const { connected } = useWallet();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = connected ? [...baseLinks, ...walletLinks] : baseLinks;
  const close = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" onClick={close}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Zap className="h-4 w-4 text-primary" />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Dox<span className="text-accent-light">Oracle</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.href}
              {...link}
              active={pathname.startsWith(link.href)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <NavBalance />
          <ConnectWalletButton />
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:text-primary md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <div className="border-t border-line bg-bg/95 px-4 pb-4 pt-2 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.href}
                {...link}
                active={pathname.startsWith(link.href)}
                onClick={close}
                mobile
              />
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
