export interface FixturePreview {
  id: string;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  kickoff: string; // ISO
  stage: string;
  odds: { home: number; draw: number; away: number };
}

// Placeholder data until TxLINE is activated (CLAUDE.md Step 3).
// Shape mirrors what /api/fixtures/snapshot + /api/odds/snapshot will feed the UI.
export const previewFixtures: FixturePreview[] = [
  {
    id: "wc26-qf-1",
    home: "Brazil",
    away: "France",
    homeFlag: "🇧🇷",
    awayFlag: "🇫🇷",
    kickoff: "2026-07-10T19:00:00Z",
    stage: "Quarter-final",
    odds: { home: 2.4, draw: 3.2, away: 2.9 },
  },
  {
    id: "wc26-qf-2",
    home: "Argentina",
    away: "England",
    homeFlag: "🇦🇷",
    awayFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    kickoff: "2026-07-10T23:00:00Z",
    stage: "Quarter-final",
    odds: { home: 2.6, draw: 3.1, away: 2.7 },
  },
  {
    id: "wc26-qf-3",
    home: "Spain",
    away: "Germany",
    homeFlag: "🇪🇸",
    awayFlag: "🇩🇪",
    kickoff: "2026-07-11T19:00:00Z",
    stage: "Quarter-final",
    odds: { home: 2.2, draw: 3.3, away: 3.4 },
  },
  {
    id: "wc26-qf-4",
    home: "Portugal",
    away: "Netherlands",
    homeFlag: "🇵🇹",
    awayFlag: "🇳🇱",
    kickoff: "2026-07-11T23:00:00Z",
    stage: "Quarter-final",
    odds: { home: 2.5, draw: 3.2, away: 2.8 },
  },
  {
    id: "wc26-sf-1",
    home: "TBD",
    away: "TBD",
    homeFlag: "🏆",
    awayFlag: "🏆",
    kickoff: "2026-07-14T23:00:00Z",
    stage: "Semi-final",
    odds: { home: 2.0, draw: 3.4, away: 3.6 },
  },
  {
    id: "wc26-sf-2",
    home: "TBD",
    away: "TBD",
    homeFlag: "🏆",
    awayFlag: "🏆",
    kickoff: "2026-07-15T23:00:00Z",
    stage: "Semi-final",
    odds: { home: 2.1, draw: 3.3, away: 3.5 },
  },
  {
    id: "wc26-final",
    home: "TBD",
    away: "TBD",
    homeFlag: "🏆",
    awayFlag: "🏆",
    kickoff: "2026-07-19T19:00:00Z",
    stage: "Final",
    odds: { home: 2.3, draw: 3.2, away: 3.1 },
  },
];
