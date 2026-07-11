# DoxOracle — Technical Documentation

Live app: https://doxoracle.vercel.app

Program (devnet): 5yPoMKGhrfgiU7iJLE1e4VgQHTvJU94QZFCVqszwFLar
(view on explorer: https://explorer.solana.com/address/5yPoMKGhrfgiU7iJLE1e4VgQHTvJU94QZFCVqszwFLar?cluster=devnet)

## Core idea

DoxOracle is a non-custodial World Cup prediction market on Solana devnet.
Users stake USDC on match outcomes (home, draw or away). Stakes are held in
a per-market PDA escrow that no private key controls, and markets settle
trustlessly: the escrow program verifies TxLINE's cryptographic Merkle
proofs on-chain before payouts. Winners split the full pool pro-rata
(parimutuel), claimed directly to their wallet.

## Technical highlights

### 1. Permissionless on-chain settlement engine

The Anchor program's resolve_verified instruction accepts a TxLINE Merkle
proof and performs a CPI into Txoracle's validate_stat, verifying the proof
against TxLINE's published daily_scores_roots PDAs. It enforces fixture
identity (the proof's fixtureId must match the market) and commits the
fixture's events sub-tree root on-chain as a permanent receipt. Anyone can
call it — no oracle authority required.

An authority-gated resolve exists as a fallback for devnet data gaps,
exposed through a passcode-protected operator console (/admin) whose only
power is submitting a result. It can never touch funds, and every use of it
is publicly visible on-chain.

### 2. Verifiable Resolution UI

Every settled bet links to a Cryptographic Resolution Receipt page
(/receipt/[fixtureId]) that renders the live TxLINE proof as a verification
chain: the certified stat, each Merkle proof node, and the anchor to
TxLINE's on-chain daily root. Users can trace the outcome without trusting
anyone.

### 3. Markets created by demand

The first staker on any fixture atomically creates the market account and
its USDC vault, and stakes — all in a single transaction. The tournament
schedule is the market list; there is no admin curation.

### 4. Wallet is the identity, the chain is the database

No signups. Bet history is reconstructed by scanning the wallet's on-chain
Position accounts, so it follows the wallet across devices and browsers.

### 5. Live data end-to-end

Fixtures and demargined 1X2 odds come from TxLINE snapshots. Match pages
stream odds in real time through an SSE proxy of TxLINE's odds stream.
Resolution runs on a 10-minute cron: unresolved on-chain markets, then
score snapshot, then stat-validation proof, then on-chain resolve.

## Program instructions

- create_market (permissionless): creates the market PDA with seeds
  ["market", fixture_id] plus its USDC vault (the market's token account)
- stake (permissionless): moves USDC into the vault, tracks the position,
  locks at kickoff
- resolve_verified (permissionless): trustless settlement via the
  validate_stat CPI
- resolve (RESOLVER key only): fallback for feed data gaps; commits a
  sha256 proof receipt on-chain
- claim (position owner): parimutuel payout — winners split the full pool;
  everyone is refunded if nobody backed the winner

## Stack

Next.js 16 (App Router), Tailwind v4, Solana wallet-adapter, Anchor (Rust)
escrow program, TanStack Query, Vercel (git-integrated deploys and cron).

Stake currency is USDC only. The TxLINE token is used strictly for data
authorization via the on-chain subscription, per track rules.

## TxLINE endpoints used

- POST /auth/guest/start and POST /token/activate — activation fully
  scripted, including the on-chain subscribe at Service Level 1
  (see scripts/activate-txline.mjs)
- GET /fixtures/snapshot — World Cup fixture list
- GET /odds/snapshot/{fixtureId} — full-match 1X2 odds (demargined)
- GET /scores/snapshot/{fixtureId} — game state and final score
- GET /odds/stream (SSE) — real-time odds on match pages
- GET /scores/stat-validation — Merkle proof material
- On-chain: CPI into the Txoracle program's validate_stat instruction
  (program 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J)

## Trust model, stated honestly

- resolve_verified: permissionless and cryptographic. The flagship path,
  live on devnet, demonstrated reaching TxLINE's on-chain verification.
- resolve: authority fallback, used only when TxLINE's devnet feed
  publishes no result data for a fixture (a devnet test-environment
  limitation, detailed in our API feedback). Commits a sha256 receipt.
- The program is upgradeable during the hackathon; the authority can be
  burned after the event.
