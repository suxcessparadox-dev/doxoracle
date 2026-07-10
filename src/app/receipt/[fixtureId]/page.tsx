import Link from "next/link";
import {
  Anchor,
  ArrowLeft,
  ExternalLink,
  FileJson,
  Fingerprint,
  Hash,
  ShieldCheck,
} from "lucide-react";

import { getMarketState } from "@/lib/resolver";
import { getFixtureById, getMerkleProof, getScore } from "@/lib/txline";

export const dynamic = "force-dynamic";

interface ProofNode {
  hash: number[];
  isRightSibling: boolean;
}

/** TxLINE stat-validation payload (shape confirmed against the live API) */
interface TxValidation {
  ts: number;
  statToProve: { key: number; value: number; period: number };
  eventStatRoot: number[];
  summary: {
    fixtureId: number;
    updateStats: {
      updateCount: number;
      minTimestamp: number;
      maxTimestamp: number;
    };
    eventStatsSubTreeRoot: number[];
  };
  statProof: ProofNode[];
  subTreeProof: ProofNode[];
  mainTreeProof: ProofNode[];
}

function toHex(bytes: number[] | undefined): string {
  if (!bytes) return "";
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function shortHex(bytes: number[] | undefined): string {
  const hex = toHex(bytes);
  return hex ? `${hex.slice(0, 10)}…${hex.slice(-10)}` : "—";
}

function ChainNode({
  icon: Icon,
  title,
  subtitle,
  bytes,
  accent = false,
  last = false,
}: {
  icon: typeof Hash;
  title: string;
  subtitle?: string;
  bytes?: number[];
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      {/* connector line */}
      {!last ? (
        <span
          aria-hidden
          className="absolute left-[19px] top-10 h-[calc(100%-2rem)] w-px bg-gradient-to-b from-accent/60 to-line"
        />
      ) : null}
      <span
        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
          accent
            ? "border-win/50 bg-win/15 shadow-[0_0_18px_rgba(46,189,133,0.35)]"
            : "border-accent/40 bg-accent/10"
        }`}
      >
        <Icon
          className={`h-4 w-4 ${accent ? "text-win" : "text-accent-light"}`}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
        <span className="text-sm font-semibold">{title}</span>
        {subtitle ? (
          <span className="text-xs text-muted">{subtitle}</span>
        ) : null}
        {bytes ? (
          <details className="group">
            <summary className="w-fit cursor-pointer list-none rounded-lg bg-bg px-3 py-1.5 font-mono text-xs text-accent-light transition-colors hover:bg-bg/60 group-open:hidden">
              {shortHex(bytes)} <span className="text-muted">· expand</span>
            </summary>
            <code className="hidden break-all rounded-lg bg-bg px-3 py-2 font-mono text-xs leading-relaxed text-accent-light group-open:block">
              {toHex(bytes)}
            </code>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export default async function Receipt({
  params,
  searchParams,
}: {
  params: Promise<{ fixtureId: string }>;
  searchParams: Promise<{ match?: string }>;
}) {
  const { fixtureId } = await params;
  const { match } = await searchParams;
  const [fixture, score, proofRaw, market] = await Promise.all([
    getFixtureById(fixtureId).catch(() => null),
    getScore(fixtureId).catch(() => null),
    getMerkleProof(fixtureId).catch(() => null),
    getMarketState(fixtureId).catch(() => null),
  ]);
  const proof = proofRaw as TxValidation | null;

  const matchLabel = fixture
    ? `${fixture.homeFlag} ${fixture.home}  vs  ${fixture.away} ${fixture.awayFlag}`
    : (match ?? `Fixture #${fixtureId}`);

  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-24 pt-10 sm:px-6">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,rgba(46,189,133,0.08),transparent_65%)]"
      />

      <Link
        href="/bets"
        className="relative flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        My Bets
      </Link>

      {/* Certificate */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-card shadow-2xl shadow-black/40">
        {/* settled stamp */}
        {market?.resolved ? (
          <div
            aria-hidden
            className="pointer-events-none absolute -right-7 top-7 rotate-[24deg] border-2 border-win/50 px-8 py-1 text-xs font-black uppercase tracking-[0.25em] text-win/70"
          >
            Settled
          </div>
        ) : null}

        {/* header */}
        <div className="flex flex-col items-center gap-3 border-b border-dashed border-line px-6 pb-6 pt-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-win/40 bg-win/10 shadow-[0_0_28px_rgba(46,189,133,0.3)]">
            <ShieldCheck className="h-7 w-7 text-win" />
          </span>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Cryptographic Resolution Receipt
          </h1>
          <span className="text-lg">{matchLabel}</span>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="rounded-full bg-accent/10 px-3 py-1 font-mono text-xs text-accent-light">
              #{fixtureId}
            </span>
            <span className="rounded-full bg-bg px-3 py-1 text-xs capitalize text-muted">
              feed: {score?.status ?? "n/a"}
              {score ? ` · ${score.home}–${score.away}` : ""}
            </span>
            {market?.resolved ? (
              <span className="rounded-full bg-win/10 px-3 py-1 text-xs font-semibold text-win">
                ✓ settled on Solana
              </span>
            ) : (
              <span className="rounded-full bg-bg px-3 py-1 text-xs text-muted">
                awaiting settlement
              </span>
            )}
          </div>
        </div>

        {/* certified fact */}
        {proof ? (
          <div className="flex flex-col gap-4 border-b border-dashed border-line p-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">
              Certified fact
            </span>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Stat key", value: proof.statToProve.key },
                { label: "Value", value: proof.statToProve.value },
                { label: "Period", value: proof.statToProve.period },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col gap-1 rounded-xl bg-bg px-3 py-3 text-center"
                >
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    {item.label}
                  </span>
                  <span className="text-xl font-bold tabular-nums text-accent-light">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <span className="text-center text-xs text-muted">
              {proof.summary.updateStats.updateCount} feed updates · snapshot{" "}
              {new Date(proof.ts).toUTCString()}
            </span>
          </div>
        ) : null}

        {/* verification chain */}
        <div className="flex flex-col p-6">
          <span className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted">
            Verification chain
          </span>

          {proof ? (
            <div className="flex flex-col">
              <ChainNode
                icon={Fingerprint}
                title="Fact fingerprint"
                subtitle="The certified stat is hashed into a leaf"
                bytes={proof.eventStatRoot}
              />
              {proof.statProof.map((node, i) => (
                <ChainNode
                  key={`s${i}`}
                  icon={Hash}
                  title={`Stat proof · node ${i + 1}`}
                  subtitle={`${node.isRightSibling ? "right" : "left"} sibling hash`}
                  bytes={node.hash}
                />
              ))}
              <ChainNode
                icon={Hash}
                title="Fixture events sub-tree root"
                subtitle="All of this match's data rolls up here"
                bytes={proof.summary.eventStatsSubTreeRoot}
              />
              {proof.subTreeProof.map((node, i) => (
                <ChainNode
                  key={`b${i}`}
                  icon={Hash}
                  title={`Batch proof · node ${i + 1}`}
                  bytes={node.hash}
                />
              ))}
              {proof.mainTreeProof.map((node, i) => (
                <ChainNode
                  key={`m${i}`}
                  icon={Hash}
                  title={`Main tree proof · node ${i + 1}`}
                  bytes={node.hash}
                />
              ))}
              <ChainNode
                icon={Anchor}
                title="Anchored on Solana"
                subtitle="Chain must reproduce TxLINE's on-chain daily root — one changed byte anywhere and verification fails. Checked on-chain by resolve_verified via CPI."
                accent
                last
              />
            </div>
          ) : (
            <p className="text-sm text-muted">
              TxLINE has not published proof material for this fixture yet.
            </p>
          )}
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-dashed border-line bg-bg/40 px-6 py-4 text-xs">
          <a
            href={`/api/proof/${fixtureId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-accent-light hover:underline"
          >
            <FileJson className="h-3.5 w-3.5" /> Raw JSON
          </a>
          <a
            href="https://explorer.solana.com/address/6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J?cluster=devnet"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-accent-light hover:underline"
          >
            TxLINE oracle on explorer <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-muted">
            DoxOracle · trustless settlement on Solana devnet
          </span>
        </div>
      </div>
    </main>
  );
}
