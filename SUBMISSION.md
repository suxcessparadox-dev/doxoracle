# DoxOracle — Submission Materials

Copy-paste-ready content for the Superteam Earn submission form
(Prediction Markets and Settlement track).

---

## Links

| Field | Value |
|---|---|
| Live application | https://doxoracle.vercel.app |
| Public repo | https://github.com/suxcessparadox-dev/doxoracle |
| Demo video | _add Loom/YouTube link after recording_ |
| Program (devnet) | `5yPoMKGhrfgiU7iJLE1e4VgQHTvJU94QZFCVqszwFLar` |

---

## Brief Technical Documentation

**Core idea.** DoxOracle is a non-custodial World Cup prediction market on Solana
devnet. Users stake USDC on match outcomes (home/draw/away); stakes are held in a
per-market PDA escrow that no private key controls, and markets settle
**trustlessly**: the escrow program verifies TxLINE's cryptographic Merkle proofs
on-chain before any payout logic runs. Winners split the full pool pro-rata
(parimutuel), claimable straight to their wallet.

**Technical highlights.**

1. **Permissionless on-chain settlement engine.** The Anchor program's
   `resolve_verified` instruction accepts a TxLINE Merkle proof and performs a
   **CPI into Txoracle's `validate_stat`**, verifying the proof against TxLINE's
   published `daily_scores_roots` PDAs. It enforces fixture identity
   (proof's fixture_id must match the market) and commits the fixture's events
   sub-tree root on-chain as a permanent receipt. Anyone can call it — resolution
   requires no oracle authority. (Authority-signed `resolve` exists only as a
   fallback when proof material isn't published yet, and stores a sha256 receipt.)

2. **Markets created by demand.** The first staker on any fixture atomically
   creates the market account + USDC vault and stakes, in one transaction. No
   admin market curation; the tournament schedule *is* the market list.

3. **Wallet = identity, chain = database.** No signups; bet history is
   reconstructed by scanning the user's on-chain Position accounts, so it follows
   the wallet across devices. Every settled bet links its TxLINE Merkle proof
   receipt (verifiable resolution UI).

4. **Live data end-to-end.** Fixtures/odds come from TxLINE snapshots (odds
   decoded from the demargined 1X2 price feed); match pages stream odds in real
   time through an SSE proxy of TxLINE's odds stream. Resolution runs on a
   10-minute cron: score snapshot → stat-validation proof → on-chain resolve.

5. **Compliance with track rules.** Stake currency is USDC only; the TxLINE token
   is used strictly for data authorization via the on-chain subscription.

**Stack.** Next.js 16 (App Router) + Tailwind v4 + Solana wallet-adapter;
Anchor 1.1 program (Rust); TanStack Query; Vercel (git-integrated deploys + cron).

**TxLINE endpoints used.**

- `POST /auth/guest/start`, `POST /token/activate` (+ on-chain
  `subscribe(SERVICE_LEVEL_ID=1)` — activation fully scripted in
  `scripts/activate-txline.mjs`)
- `GET /fixtures/snapshot` — fixture list (World Cup filter, CompetitionId 72)
- `GET /odds/snapshot/{fixtureId}` — full-match 1X2 odds
  (`1X2_PARTICIPANT_RESULT`, demargined)
- `GET /scores/snapshot/{fixtureId}` — game state + final score for resolution
- `GET /odds/stream` (SSE) — real-time odds on match pages
- `GET /scores/stat-validation` — Merkle proof material
- **On-chain:** CPI into Txoracle `validate_stat`
  (`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`) against `daily_scores_roots`

---

## TxLINE API Feedback

**What we liked most:**

- **The activation flow is fully scriptable.** Allowing the activation message to
  be signed with a local keypair (not just a browser wallet) let us automate the
  entire on-chain subscribe → guest JWT → token activation pipeline in one Node
  script. Great developer ergonomics.
- **Normalized, predictable schema.** One JSON shape across snapshots; odds as
  integers ×1000 with demargined percentages made decoding trivial; fixture IDs
  consistent across every endpoint.
- **The on-chain validation design is genuinely good.** Daily Merkle roots in
  per-epoch PDAs + a `validate_stat` view instruction is a clean primitive; the
  full IDL being available made a Rust CPI integration (via Anchor
  `declare_program!`) straightforward once we had the IDL JSON.

**Where we hit friction:**

1. **The Txoracle IDL isn't published on-chain** (`anchor idl fetch` fails with
   "Account not found"). It's only embedded in the docs page as
   syntax-highlighted HTML, so we had to scrape and reconstruct the JSON.
   Publishing the IDL on-chain (or a raw `.json` download link) would save teams
   hours.
2. **stat-validation parameter discovery.** `seq` and `statKey` values for
   `GET /scores/stat-validation` are hard to determine before a fixture has
   finished — a reference table of statKeys (e.g., which key is full-time home
   goals) and guidance on obtaining the right `seq` would help a lot.
3. **The SSE streams are global** (no `?fixtureId=` filter), so a per-match UI
   must consume the whole firehose and filter client-side. A fixture filter
   query param would cut bandwidth and code.
4. **Devnet score events for scheduled fixtures are sparse** — hard to test the
   scores pipeline before matches actually run. A "simulated finished fixture" on
   devnet (fixture that finishes every hour, with proofs) would make end-to-end
   settlement testable any time. This was our single biggest testing bottleneck.
5. Minor: the response shape of `stat-validation` isn't fully documented
   (we mapped defensively with fallbacks).

---

## Demo Video Outline (5 min)

1. (0:00) Problem: custodial betting = trust the house twice
2. (0:30) Live markets — "Live TxLINE data" badge, SSE odds ticking
3. (1:15) Stake USDC with Phantom → explorer: funds into the market vault PDA
4. (2:15) Resolution: cron output → `resolve_verified` — Merkle proof verified
   on-chain via validate_stat CPI (no oracle authority)
5. (3:15) Bet flips to "won" → claim → USDC lands in wallet; proof receipt link
6. (4:00) Repo + program tour: `resolve_verified` in `programs/doxoracle-escrow`
