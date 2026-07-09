import type { Metadata } from "next";
import { Crown, Radio } from "lucide-react";

export const metadata: Metadata = {
  title: "Leaderboard — DoxOracle",
  description: "Top World Cup 2026 predictors on DoxOracle.",
};

// Demo standings until on-chain bet history aggregation lands
const leaders = [
  { wallet: "7xKq…R2vN", wins: 14, bets: 18, profit: 412.5 },
  { wallet: "3mPa…9dWc", wins: 11, bets: 15, profit: 287.2 },
  { wallet: "Bf5t…kL8s", wins: 9, bets: 14, profit: 198.4 },
  { wallet: "9rXe…Tq4m", wins: 8, bets: 13, profit: 156.0 },
  { wallet: "Hn2v…8sBd", wins: 7, bets: 12, profit: 121.7 },
  { wallet: "5wJc…mR7p", wins: 6, bets: 11, profit: 84.3 },
  { wallet: "Dk8f…2nQx", wins: 5, bets: 10, profit: 52.9 },
  { wallet: "2qYh…vC6t", wins: 4, bets: 9, profit: 31.5 },
];

export default function Leaderboard() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 pb-24 pt-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <span className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent-light">
            <Radio className="h-3 w-3" />
            Demo data
          </span>
        </div>
        <p className="text-muted">
          Top predictors this tournament, ranked by realized USDC profit.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-4 font-medium">#</th>
              <th className="px-5 py-4 font-medium">Wallet</th>
              <th className="px-5 py-4 text-right font-medium">Win rate</th>
              <th className="px-5 py-4 text-right font-medium">Bets</th>
              <th className="px-5 py-4 text-right font-medium">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leaders.map((leader, index) => (
              <tr key={leader.wallet} className="hover:bg-bg/50">
                <td className="px-5 py-4">
                  {index === 0 ? (
                    <Crown className="h-4 w-4 text-accent-light" />
                  ) : (
                    <span className="text-muted">{index + 1}</span>
                  )}
                </td>
                <td className="px-5 py-4 font-mono">{leader.wallet}</td>
                <td className="px-5 py-4 text-right">
                  {Math.round((leader.wins / leader.bets) * 100)}%
                </td>
                <td className="px-5 py-4 text-right text-muted">
                  {leader.bets}
                </td>
                <td className="px-5 py-4 text-right font-semibold text-win">
                  +{leader.profit.toFixed(2)} USDC
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
