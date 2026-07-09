# DoxOracle ⚽ — World Cup 2026 Prediction Markets on Solana

**Stake USDC on World Cup matches. Results proven cryptographically. Payouts no human can block.**

Built for the Superteam × TxODDS World Cup Hackathon — **Prediction Markets and Settlement track**.

- 🌐 **Live app**: https://doxoracle.vercel.app (Solana devnet)
- ⛓️ **Escrow program**: [`5yPoMKGhrfgiU7iJLE1e4VgQHTvJU94QZFCVqszwFLar`](https://explorer.solana.com/address/5yPoMKGhrfgiU7iJLE1e4VgQHTvJU94QZFCVqszwFLar?cluster=devnet)
- 📡 **Data**: live TxLINE World Cup feeds (fixtures, odds, scores, Merkle proofs)

## Why it matters

Traditional betting asks you to trust the house twice: they hold your money, and the
result is whatever they say it is. DoxOracle removes both:

1. **Stakes live in a PDA escrow** — an address with no private key, controlled only
   by program code. Nobody (including us) can touch the pool.
2. **Results are cryptographically verified on-chain.** TxLINE publishes daily Merkle
   roots of match data to Solana. Our program's `resolve_verified` instruction is
   **permissionless**: anyone can settle a market by presenting a TxLINE Merkle
   proof, which the program verifies via **CPI into Txoracle's `validate_stat`** —
   no oracle authority, no multisig, no trust.

## The full loop

```
connect Phantom → pick a market (live TxLINE odds via SSE)
      → stake USDC (first staker atomically creates market + vault)
      → match ends → cron fetches TxLINE score + Merkle proof (every 10 min)
      → resolve_verified: proof checked on-chain via validate_stat CPI
      → winners claim: parimutuel share of the pool, straight to their wallet
      → Merkle proof receipt viewable on every settled bet
```

## Architecture

| Layer | Implementation |
|---|---|
| Frontend | Next.js 16 App Router, Tailwind v4, wallet-adapter (wallet = identity, no signups) |
| Data | TxLINE snapshots (fixtures/odds/scores) + SSE odds stream proxied per fixture |
| Program | Anchor: `create_market`, `stake`, `resolve_verified` (trustless), `resolve` (authority fallback), `claim` |
| Escrow | Market PDA per fixture (`["market", fixture_id]`), USDC vault as market ATA |
| Payouts | Parimutuel — winners split the entire pool pro-rata; full refunds if no winner |
| Resolution | Vercel cron (10 min) → TxLINE score + stat-validation proof → on-chain resolve |
| History | Bet positions read directly from chain — wallet is the source of truth on any device |

## Run locally

```bash
npm install
npm run dev
```

`.env.local`:

```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_TXLINE_BASE=https://txline-dev.txodds.com/api
TXLINE_JWT=        # from scripts/activate-txline.mjs
TXLINE_API_TOKEN=  # from scripts/activate-txline.mjs
```

TxLINE activation (one-time, free): `node scripts/activate-txline.mjs` — performs the
on-chain Service Level 1 subscription, guest auth, activation-message signing, and
writes both tokens to `.env.local`.

Program build/deploy (Anchor 1.1, Solana 4.1):

```bash
anchor build
solana program deploy target/deploy/doxoracle_escrow.so \
  --program-id target/deploy/doxoracle_escrow-keypair.json
```

## TxLINE endpoints used

- `POST /auth/guest/start` + `POST /token/activate` — API access (on-chain subscribe via `program.subscribe`)
- `GET /fixtures/snapshot` — World Cup fixture list
- `GET /odds/snapshot/{fixtureId}` — full-match 1X2 odds
- `GET /scores/snapshot/{fixtureId}` — score + game state for resolution
- `GET /odds/stream` (SSE) — live odds, proxied per fixture to the match page
- `GET /scores/stat-validation` — Merkle proof material for on-chain verification
- **On-chain**: CPI into Txoracle `validate_stat` against `daily_scores_roots` PDAs

## Trust model (honest edition)

- `resolve_verified` — permissionless + cryptographic (validate_stat CPI). The flagship path.
- `resolve` — authority-signed fallback (service wallet) used only when TxLINE hasn't
  published proof material for a fixture yet; commits a sha256 receipt of the score payload.
- Program is upgradeable during the hackathon; authority can be burned post-event.

---

Built by [@suxcessparadox-dev](https://github.com/suxcessparadox-dev) with Claude (AI pair-engineer) — allowed per track rules ("open to individuals, teams, and AI agents").
