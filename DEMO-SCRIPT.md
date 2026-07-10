# DoxOracle — Demo Video Shooting Script

Target length: **≈ 4:45** (limit 5:00). Record in two segments around a real
match (e.g. Spain vs Belgium, July 10, 19:00 UTC). Do one throwaway practice
take first.

---

## Pre-flight checklist (before recording)

- [ ] Phantom unlocked, **Testnet Mode ON**, devnet USDC + SOL in the wallet
- [ ] Tabs open in order:
  1. https://doxoracle.vercel.app
  2. Solana Explorer (devnet) on your wallet address
  3. The receipt page from a previous settled bet
  4. GitHub repo: https://github.com/suxcessparadox-dev/doxoracle
- [ ] QuickTime → File → New Screen Recording → mic ON, record browser window
- [ ] Segment A must be recorded **before kickoff**

Delivery tips: speak ~10% slower than feels natural · pause a beat after
each click so the UI catches up on camera · if you flub a line, pause two
seconds and repeat it (trim later in iMovie).

---

## SEGMENT A — record before kickoff

### Scene 1 — The problem (0:00–0:30)
**On screen:** landing page, no scrolling yet.

> "When you bet with a traditional bookmaker, you trust them twice: they hold
> your money, and the result is whatever they say it is. DoxOracle removes
> both. It's a prediction market for the World Cup where your stake sits in a
> Solana smart-contract escrow that no human controls — and results are
> settled with cryptographic proofs from TxLINE, not somebody's word."

### Scene 2 — Live TxLINE data (0:30–1:15)
**On screen:** scroll landing → click **Markets** → point at the
"Live TxLINE data" badge.

> "Everything you see is live TxLINE data. This badge confirms it — real
> World Cup fixtures from their feed, with real demargined bookmaker odds."

**Then:** click the match (Spain vs Belgium). Let the odds tick a few
seconds — hover near them.

> "On the match page, odds stream in real time over TxLINE's SSE feed —
> watch them move. This is the same data layer the app resolves against
> later, so the odds you stake at and the result you're paid on come from
> one verifiable source."

### Scene 3 — The stake (1:15–2:15)
**On screen:** connect Phantom, pick an outcome, enter 5 USDC, stake.

> "I connect my wallet — no email, no signup, the wallet *is* my account.
> I'm backing Spain with five devnet USDC."

**Then:** sign in Phantom, wait for the green success box, click
**View transaction**.

> "One signature did three things atomically: created the market on-chain,
> created its USDC vault, and moved my stake in. Here it is on the Solana
> explorer — my USDC is now in an escrow owned by the program itself. Not by
> me, not by the platform. Nobody can touch this pool except the program's
> own code."

**Then:** open **Dashboard**, click the bet row so the detail popup opens.

> "My dashboard reads everything straight from the blockchain — my positions
> follow my wallet onto any device."

**STOP RECORDING.** Wait for full time (~2h after kickoff).

---

## SEGMENT B — record ~15 minutes after full time

### Scene 4 — Resolution (0:00–1:00)
**On screen:** My Bets showing won/lost → click
**TxLINE Merkle proof receipt**.

> "The match is over. A scheduled job polls TxLINE every ten minutes for
> finished matches; when the final score lands, it settles the market
> on-chain. No support ticket, no manual review — my bet has already
> flipped."

**On the certificate page:**

> "And this is my favorite part: every settlement produces a cryptographic
> receipt. TxLINE publishes a daily Merkle root — a master fingerprint of
> all match data — onto Solana itself. This chain of hashes must reproduce
> that on-chain fingerprint exactly; change one byte of the result and it
> breaks. Our escrow program verifies this on-chain, by calling TxLINE's
> validate_stat instruction directly from our smart contract — so settlement
> doesn't trust an oracle operator, a multisig, or us."

### Scene 5 — The payout (1:00–1:45)
**On screen:** back to My Bets → click **Claim payout** (if won) → show the
navbar balance update → click the payout transaction link.

> "I backed the winner, so I claim — one signature, and the escrow pays me
> straight from the pool. Markets are parimutuel: winners split the entire
> pot pro-rata."

> "There's the payout on the explorer — vault to my wallet. The full loop:
> stake, escrow, cryptographic settlement, payout. Zero human sign-offs."

### Scene 6 — Close (1:45–2:30)
**On screen:** GitHub repo → scroll to
`programs/doxoracle-escrow/src/lib.rs` → back to the live site.

> "Everything is open source — the Anchor escrow program with
> resolve_verified, the Next.js app, the TxLINE integration — deployed on
> Solana devnet at doxoracle.vercel.app, live for judges to test. DoxOracle:
> predict the World Cup, win on-chain. Thanks for watching."

---

## Contingency lines

**Match resolves while Segment A is still rolling:** keep recording — one
continuous take is even better.

**TxLINE devnet feed doesn't publish the result** (settle via operator
fallback, then record Segment B normally and swap this sentence into
Scene 4):

> "TxLINE's devnet feed doesn't always publish final scores — a
> test-environment limitation — so the platform includes an operator
> fallback that still writes the proof receipt on-chain. On mainnet data,
> the same pipeline settles fully trustlessly, and the verification code is
> live in the program today."

This honesty line reads as a strength to judges: it shows you know exactly
where the trust boundaries are.

---

## After recording

1. Trim/stitch Segments A + B in iMovie (keep under 5:00)
2. Upload to Loom or YouTube (unlisted is fine)
3. Paste the link into the table in `SUBMISSION.md`
4. Submit on Superteam Earn before **July 19, 23:59 UTC**
