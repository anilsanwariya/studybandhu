import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { levelFromXp } from "@/lib/level";
import type { SyllabusNode, Status } from "@/lib/mock-syllabus";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Flame, Zap, Target, TrendingUp, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progress — StudyBandhu" },
      { name: "description", content: "Mastery donut, subject completion, and per-topic revision stats." },
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

const SUBJECT_TINTS = ["from-lavender to-sky", "from-mint to-sky", "from-peach to-blush", "from-sky to-mint"];

interface SubjectStat {
  id: string;
  title: string;
  total: number;
  mastered: number;
  firstRead: number;
  pct: number;
}

function collectTopics(node: SyllabusNode, out: SyllabusNode[]) {
  const isLeaf = !node.children || node.children.length === 0;
  if (isLeaf && !node.excluded) out.push(node);
  node.children?.forEach((c) => collectTopics(c, out));
}


function masteryBadge(status: Status, rev: number) {
  if (status === "mastered") return { label: "Mastered", cls: "bg-mint/70" };
  if (status === "needs-revision") return { label: "Intermediate", cls: "bg-peach/70" };
  if (status === "first-read") return { label: rev >= 2 ? "Intermediate" : "Beginner", cls: "bg-lavender/70" };
  return { label: "Unread", cls: "bg-muted/60 text-muted-foreground" };
}

function nextDueLabel(iso?: string | null) {
  if (!iso) return "—";
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function ProgressPage() {
  const { tree, flatTopics, streak, xp, awardXp, levelSchema } = useStore();
  const info = levelFromXp(xp);

  const data = useMemo(() => {
    const counts = { unread: 0, "first-read": 0, "needs-revision": 0, mastered: 0 };
    flatTopics.forEach((n) => counts[n.status]++);
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

  // Find the "subject" level in the exam's schema — fall back to depth 0.
  const subjectDepth = useMemo(() => {
    const i = levelSchema.findIndex((s) => s?.toLowerCase() === "subject");
    return i >= 0 ? i : 0;
  }, [levelSchema]);

  const subjectStats: SubjectStat[] = useMemo(() => {
    const subjectNodes: SyllabusNode[] = [];
    const collectAtDepth = (nodes: SyllabusNode[]) => {
      for (const n of nodes) {
        if (n.depth === subjectDepth) subjectNodes.push(n);
        else if (n.children) collectAtDepth(n.children);
      }
    };
    collectAtDepth(tree);
    return subjectNodes.map((subj) => {
      const list: SyllabusNode[] = [];
      collectTopics(subj, list);
      const masteredN = list.filter((n) => n.status === "mastered").length;
      const firstRead = list.filter((n) => n.status === "first-read" || n.status === "needs-revision").length;
      return {
        id: subj.id,
        title: subj.title,
        total: list.length,
        mastered: masteredN,
        firstRead,
        pct: list.length ? Math.round(((masteredN + firstRead * 0.5) / list.length) * 100) : 0,
      };
    });
  }, [tree, subjectDepth]);

  return (
    <AppShell>
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Progress</h1>
          <p className="text-muted-foreground mt-1">Where you are, not where you should be.</p>
        </div>
        <Button
          variant="secondary"
          className="rounded-full gap-1.5 bg-white/60 backdrop-blur border-white/50"
          onClick={() => awardXp(20, "Demo action")}
        >
          <Sparkles className="h-4 w-4 text-[oklch(0.75_0.14_85)]" />
          Test XP toast
        </Button>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={<Flame className="h-4 w-4" />} label="Current streak" value={`${streak} days`} tint="peach" />
        <Stat icon={<Zap className="h-4 w-4" />} label={`Level ${info.level}`} value={info.rank} tint="lavender" />
        <Stat icon={<Target className="h-4 w-4" />} label="Mastery" value={`${pct}%`} tint="mint" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Topics tracked" value={String(total)} tint="sky" />
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="glass-strong rounded-3xl p-6">
          <h2 className="font-semibold">Mastery Breakdown</h2>
          <p className="text-xs text-muted-foreground mb-4">Every tracked topic, sorted by state.</p>

          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative h-56 w-56 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} innerRadius={62} outerRadius={98} paddingAngle={4} dataKey="value" stroke="rgba(255,255,255,0.7)" strokeWidth={2}>
                    {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-3xl font-bold">{pct}%</div>
                <div className="text-xs text-muted-foreground">mastered</div>
              </div>
            </div>

            <div className="flex-1 space-y-2 w-full">
              {data.map((d) => (
                <div key={d.name} className="glass rounded-2xl px-4 py-2.5 flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full ring-2 ring-white/60" style={{ background: d.color }} />
                  <span className="text-sm font-medium flex-1">{d.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-strong rounded-3xl p-6">
          <h2 className="font-semibold">Subject Completion</h2>
          <p className="text-xs text-muted-foreground mb-4">Weighted: first-read counts half, mastered full.</p>
          <div className="space-y-4">
            {subjectStats.map((s, i) => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium">{s.title}</span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{s.mastered}</span>/{s.total} mastered · {s.pct}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white/50 overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${SUBJECT_TINTS[i % SUBJECT_TINTS.length]} transition-all`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-strong rounded-3xl p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Topic Mastery & Revisions</h2>
            <p className="text-xs text-muted-foreground">Every tracked topic — level, count, and next due.</p>
          </div>
          <span className="glass rounded-full text-xs font-medium px-3 py-1">{flatTopics.length} topics</span>
        </div>

        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="space-y-1 min-w-[320px]">
            {tree.map((n) => (
              <MasteryTreeNode key={n.id} node={n} depth={0} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MasteryTreeNode({ node, depth }: { node: SyllabusNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = !!node.children && node.children.length > 0;
  const isLeaf = !hasChildren;
  const b = isLeaf ? masteryBadge(node.status, node.revisionCount ?? 0) : null;
  return (
    <div>
      <div
        className="flex items-start gap-2 rounded-2xl px-2 py-2 hover:bg-white/40 min-w-0"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setOpen((o) => !o)} className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-white/60 shrink-0 mt-0.5">
            <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className={cn("text-sm break-words", depth === 0 && "font-semibold", depth === 1 && "font-medium")}>
            {node.title}
          </div>
          {isLeaf && (
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              {b && <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${b.cls}`}>{b.label}</span>}
              <span>Revisions: <span className="tabular-nums text-foreground/80 font-medium">{node.revisionCount ?? 0}×</span></span>
              <span>Next due: <span className="text-foreground/80 font-medium">{nextDueLabel(node.nextRevisionAt)}</span></span>
            </div>
          )}
        </div>
      </div>
      {hasChildren && open && (
        <div className="space-y-1 mt-1">
          {node.children!.map((c) => (
            <MasteryTreeNode key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: "peach" | "lavender" | "mint" | "sky" }) {
  const bg = { peach: "bg-peach/60", lavender: "bg-lavender/60", mint: "bg-mint/60", sky: "bg-sky/60" }[tint];
  return (
    <div className="glass-strong rounded-3xl p-5">
      <div className={`h-9 w-9 rounded-2xl ${bg} flex items-center justify-center mb-3`}>{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-0.5 truncate">{value}</div>
    </div>
  );
}
