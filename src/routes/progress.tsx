import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Flame, Zap, Target, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progress — Cadence" },
      { name: "description", content: "Your mastery breakdown, streak, and momentum — soft and honest." },
    ],
  }),
  component: ProgressPage,
});

const PASTELS = {
  unread: "oklch(0.9 0.02 280)",
  "first-read": "oklch(0.82 0.08 300)",
  "needs-revision": "oklch(0.85 0.09 55)",
  mastered: "oklch(0.82 0.11 165)",
};

function ProgressPage() {
  const { flatTopics, streak, xp } = useStore();

  const data = useMemo(() => {
    const counts = { unread: 0, "first-read": 0, "needs-revision": 0, mastered: 0 };
    flatTopics.forEach((n) => (counts[n.status]++));
    return [
      { name: "Mastered", value: counts.mastered, color: PASTELS.mastered },
      { name: "First Read", value: counts["first-read"], color: PASTELS["first-read"] },
      { name: "Needs Revision", value: counts["needs-revision"], color: PASTELS["needs-revision"] },
      { name: "Unread", value: counts.unread, color: PASTELS.unread },
    ];
  }, [flatTopics]);

  const total = flatTopics.length;
  const mastered = data.find((d) => d.name === "Mastered")?.value ?? 0;
  const pct = total ? Math.round((mastered / total) * 100) : 0;

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground mt-1">Where you are, not where you should be.</p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={<Flame className="h-4 w-4" />} label="Current streak" value={`${streak} days`} tint="peach" />
        <Stat icon={<Zap className="h-4 w-4" />} label="XP" value={xp.toLocaleString()} tint="lavender" />
        <Stat icon={<Target className="h-4 w-4" />} label="Mastery" value={`${pct}%`} tint="mint" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Topics tracked" value={String(total)} tint="sky" />
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="glass-strong rounded-3xl p-6">
          <h2 className="font-semibold">Mastery Breakdown</h2>
          <p className="text-xs text-muted-foreground mb-4">Every tracked topic, sorted by state.</p>

          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative h-64 w-64 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth={2}
                  >
                    {data.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255,255,255,0.9)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255,255,255,0.7)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-3xl font-bold">{pct}%</div>
                <div className="text-xs text-muted-foreground">mastered</div>
              </div>
            </div>

            <div className="flex-1 space-y-2 w-full">
              {data.map((d) => (
                <div key={d.name} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full ring-2 ring-white/60" style={{ background: d.color }} />
                  <span className="text-sm font-medium flex-1">{d.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-strong rounded-3xl p-6">
          <h2 className="font-semibold">This week</h2>
          <p className="text-xs text-muted-foreground mb-4">Gentle rhythm, not a race.</p>
          <div className="grid grid-cols-7 gap-2">
            {["M","T","W","T","F","S","S"].map((d, i) => {
              const height = [40, 65, 30, 80, 55, 90, 45][i];
              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="w-full h-32 rounded-2xl bg-white/40 border border-white/50 flex items-end p-1">
                    <div
                      className="w-full rounded-xl bg-gradient-to-t from-[var(--sky)] to-[var(--lavender)]"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{d}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 glass rounded-2xl p-4">
            <div className="text-xs text-muted-foreground">Weekly average</div>
            <div className="text-2xl font-bold mt-0.5">5.4 topics/day</div>
            <div className="text-xs text-mint-foreground mt-1 text-[oklch(0.5_0.1_160)]">+12% vs last week</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: "peach" | "lavender" | "mint" | "sky" }) {
  const bg = { peach: "bg-peach/60", lavender: "bg-lavender/60", mint: "bg-mint/60", sky: "bg-sky/60" }[tint];
  return (
    <div className="glass-strong rounded-3xl p-5">
      <div className={`h-9 w-9 rounded-2xl ${bg} flex items-center justify-center mb-3`}>{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </div>
  );
}
