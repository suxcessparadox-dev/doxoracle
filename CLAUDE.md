# DoxOracle — Claude Session Handoff

## What This Is
DoxOracle is a Solana prediction market for World Cup 2026 matches.
Submitted to: Superteam x TxLINE World Cup Hackathon — **Markets Track**
Deadline: **July 19, 2026 23:59 UTC**
Prizes: 1st $12K USDT · 2nd $4K USDT · 3rd $2K USDT

This is a SEPARATE project from DOXNPLAY. Same owner, different codebase.

---

## What's Already Done
- Next.js 14 App Router + TypeScript + Tailwind scaffolded
- All packages installed: Anchor, wallet-adapter, web3.js, spl-token, TanStack Query, lucide-react, axios, tweetnacl

---

## What To Build Next (Start Here)

### Step 1: Update Tailwind config with brand design tokens
```js
// tailwind.config.ts — extend colors:
bg: "#0D0D0F"
card: "#1A1A24"
accent: "#7C3AED"
"accent-light": "#A855F7"
win: "#4ADE80"
loss: "#EF4444"
primary: "#ECECEC"
muted: "#6B7280"
```

### Step 2: Create .env.local
```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
TXLINE_JWT=          # fill after activating (see Step 3)
TXLINE_API_TOKEN=    # fill after activating
NEXT_PUBLIC_TXLINE_BASE=https://txline-dev.txodds.com/api
```

### Step 3: Activate TxLINE (free, no cost)
Follow: https://txline.txodds.com/documentation/worldcup
- Subscribe on-chain with Service Level 1 (World Cup data, free)
- POST /auth/guest/start → get JWT
- Sign + activate → get API token
- Store as TXLINE_JWT and TXLINE_API_TOKEN

### Step 4: Build pages in this order
1. `/` — Landing hero + live market preview strip + Connect Wallet CTA
2. `/how-it-works` — 3-step explainer
3. `/markets` — World Cup fixtures from TxLINE
4. `/markets/[id]` — Match detail + stake USDC + live odds (SSE)
5. `/dashboard` — wallet stats, active stakes, activity feed
6. `/bets` — open + settled bets, Merkle proof receipts
7. `/leaderboard` — top predictors
8. `/wallet` — USDC balance + on-chain history

---

## TxLINE API Endpoints
Base: `https://txline-dev.txodds.com/api` (devnet)

All requests need:
- `Authorization: Bearer ${TXLINE_JWT}`
- `X-Api-Token: ${TXLINE_API_TOKEN}`

| Endpoint | Use |
|---|---|
| `GET /api/fixtures/snapshot` | List World Cup matches |
| `GET /api/odds/snapshot/{fixtureId}` | Odds for a match |
| `GET /api/scores/snapshot/{fixtureId}` | Current score |
| `GET /api/scores/stream` (SSE) | Real-time score stream |
| `GET /api/odds/stream` (SSE) | Real-time odds stream |

---

## Auth Pattern (Wallet = Identity)
No email/password. Wallet address IS the user.
- `useWallet()` from @solana/wallet-adapter-react
- Connected → show app. Not connected → stay on landing.

---

## Staking (USDC on Solana)
- PDA escrow per market derived from fixture ID
- User transfers USDC SPL token to PDA → Phantom signs
- On resolution: TxLINE Merkle proof → validateStat on-chain → USDC to winners
- Stake currency = USDC. NOT TxLINE token (data auth only — hackathon rule)

---

## Resolution Flow (Judges Love This)
```
Match ends → TxLINE scores stream
→ /api/cron/resolve polls result
→ Fetch Merkle proof from TxLINE
→ validateStat on Solana (trustless)
→ Distribute USDC from PDA to winners
→ Show Merkle proof receipt in /bets
```

---

## Judging Criteria
1. Core Functionality — TxLINE data feeds working
2. User Experience — Intuitive for soccer fans
3. Code Quality — Clean resolution logic

**Demo video (5 min) is the #1 factor** — must show full loop: connect wallet → market → stake → resolve → payout.

---

## Reference Docs
- TxLINE Quickstart: https://txline.txodds.com/documentation/quickstart
- World Cup free tier: https://txline.txodds.com/documentation/worldcup
- Streaming: https://txline.txodds.com/documentation/examples/streaming-data
- On-chain validation: https://txline.txodds.com/documentation/examples/onchain-validation
- Snapshot examples: https://txline.txodds.com/documentation/examples/fetching-snapshots
