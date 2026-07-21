export const XP_PER_LEVEL = 200;

export interface LevelInfo {
  level: number;
  rank: string;
  xpInLevel: number;
  xpToNext: number;
  progress: number; // 0..1
}

const RANKS: { min: number; title: string }[] = [
  { min: 50, title: "Ranker" },
  { min: 35, title: "Sharp Analyst" },
  { min: 20, title: "Focused Contender" },
  { min: 10, title: "Rising Strategist" },
  { min: 5, title: "Dedicated Scholar" },
  { min: 1, title: "Novice Aspirant" },
];

export function rankFor(level: number): string {
  return RANKS.find((r) => level >= r.min)?.title ?? "Novice Aspirant";
}

export function levelFromXp(xp: number): LevelInfo {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInLevel = xp % XP_PER_LEVEL;
  return {
    level,
    rank: rankFor(level),
    xpInLevel,
    xpToNext: XP_PER_LEVEL - xpInLevel,
    progress: xpInLevel / XP_PER_LEVEL,
  };
}
