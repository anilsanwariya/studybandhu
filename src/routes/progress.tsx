import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StageBadge } from "@/components/StageBadge";
import { useStore } from "@/lib/store";
import { levelFromXp } from "@/lib/level";
import type { SyllabusNode, Status, Stage } from "@/lib/mock-syllabus";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Flame, Zap, Target, TrendingUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { THEME_COLORS } from "@/lib/theme";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Progress — Cadence" },
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


// Extend the node type to carry its parent context in a flat list
type FlatTopic = SyllabusNode & {
  subjectId?: string;
  subjectTitle?: string;
  chapterId?: string;
  chapterTitle?: string;
};

// Flattens the hierarchical tree into a single array of just topics (depth 2)
function extractFlatTopics(
  nodes: SyllabusNode[],
  currentSubj?: { id: string; title: string },
  currentChap?: { id: string; title: string },
): FlatTopic[] {
  let result: FlatTopic[] = [];
  for (const n of nodes) {
    if (n.depth === 0) {
      result.push(...extractFlatTopics(n.children || [], { id: n.id, title: n.title }, currentChap));
    } else if (n.depth === 1) {
      result.push(...extractFlatTopics(n.children || [], currentSubj, { id: n.id, title: n.title }));
    } else if (n.depth === 2) {
      result.push({
        ...n,
        subjectId: currentSubj?.id,
        subjectTitle: currentSubj?.title,
        chapterId: currentChap?.id,
        chapterTitle: currentChap?.title,
      });
    }
  }
  return result;
}

interface SubjectStat {
  id: string;
  title: string;
  total: number;
  mastered: number;
  firstRead: number;
  pct: number;
  themeIndex: number;
}

function collectTopics(node: SyllabusNode, out: SyllabusNode[]) {
  const isLeaf = !node.children || node.children.length === 0;
  if (isLeaf && !node.excluded) out.push(node);
  node.children?.forEach((c) => collectTopics(c, out));
}

function masteryBadge(status: Status, rev: number) {
  if (status === "mastered") return { label: "Mastered", cls: "bg-mint/70 text-emerald-900" };
  if (status === "needs-revision") return { label: "Intermediate", cls: "bg-peach/70 text-orange-900" };
  if (status === "first-read")
    return { label: rev >= 2 ? "Intermediate" : "Beginner", cls: "bg-lavender/70 text-purple-900" };
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

  // Filter States
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");

  const matchesStage = (n: SyllabusNode): boolean =>
    stageFilter === "all" ? true : (n.stages ?? []).includes(stageFilter);

  const stagedTopics = useMemo(
    () => (stageFilter === "all" ? flatTopics : flatTopics.filter(matchesStage)),
    [flatTopics, stageFilter],
  );

  const data = useMemo(() => {
    const counts = { unread: 0, "first-read": 0, "needs-revision": 0, mastered: 0 };
    stagedTopics.forEach((n) => counts[n.status]++);
    return [
      { name: "Mastered", value: counts.mastered, color: PASTELS.mastered },
      { name: "First Read", value: counts["first-read"], color: PASTELS["first-read"] },
      { name: "Needs Revision", value: counts["needs-revision"], color: PASTELS["needs-revision"] },
      { name: "Unread", value: counts.unread, color: PASTELS.unread },
    ];
  }, [stagedTopics]);

  const total = stagedTopics.length;
  const mastered = data.find((d) => d.name === "Mastered")?.value ?? 0;
  const pct = total ? Math.round((mastered / total) * 100) : 0;

  const subjectDepth = useMemo(() => {
    const i = levelSchema.findIndex((s) => s?.toLowerCase() === "subject");
    return i >= 0 ? i : 0;
  }, [levelSchema]);

  const subjectStats: SubjectStat[] = useMemo(() => {
    const subjectNodes: { node: SyllabusNode; index: number }[] = [];
    const collectAtDepth = (nodes: SyllabusNode[]) => {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.depth === subjectDepth) subjectNodes.push({ node: n, index: i });
        else if (n.children) collectAtDepth(n.children);
      }
    };
    collectAtDepth(tree);

    return subjectNodes
      .map((s) => {
        const list: SyllabusNode[] = [];
        collectTopics(s.node, list);
        const filtered = stageFilter === "all" ? list : list.filter(matchesStage);
        const masteredN = filtered.filter((n) => n.status === "mastered").length;
        const firstRead = filtered.filter((n) => n.status === "first-read" || n.status === "needs-revision").length;
        return {
          id: s.node.id,
          title: s.node.title,
          total: filtered.length,
          mastered: masteredN,
          firstRead,
          pct: filtered.length ? Math.round(((masteredN + firstRead * 0.5) / filtered.length) * 100) : 0,
          themeIndex: s.index,
        };
      })
      .filter((s) => s.total > 0);
  }, [tree, subjectDepth, stageFilter]);

  // Dropdown Extractors
  const subjectsList = useMemo(() => tree.map((n) => ({ id: n.id, title: n.title })), [tree]);
  const chaptersList = useMemo(() => {
    const subj = subjectFilter === "all" ? tree : tree.filter((n) => n.id === subjectFilter);
    return subj.flatMap((s) => (s.children ?? []).map((c) => ({ id: c.id, title: c.title })));
  }, [tree, subjectFilter]);

  // Create a flattened list of all topics and filter them
  const allFlatTopics = useMemo(() => extractFlatTopics(tree), [tree]);

  const filteredTopics = useMemo(() => {
    return allFlatTopics.filter((t) => {
      const matchSubject = subjectFilter === "all" || t.subjectId === subjectFilter;
      const matchChapter = chapterFilter === "all" || t.chapterId === chapterFilter;
      const matchStage = stageFilter === "all" || (t.stages ?? []).includes(stageFilter);
      return matchSubject && matchChapter && matchStage;
    });
  }, [allFlatTopics, subjectFilter, chapterFilter, stageFilter]);

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
                  <Pie
                    data={data}
                    innerRadius={62}
                    outerRadius={98}
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
          <div className="space-y-3">
            {subjectStats.map((s) => {
              const theme = THEME_COLORS[s.themeIndex % THEME_COLORS.length];
              return (
                <div
                  key={s.id}
                  className="rounded-2xl p-3.5 transition-all shadow-sm backdrop-blur-sm"
                  style={{ backgroundColor: theme.child, border: `1px solid ${theme.border}` }}
                >
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-foreground/90 truncate mr-2">{s.title}</span>
                    <span className="text-xs text-foreground/60 shrink-0 font-medium">
                      <span className="font-bold text-foreground/90">{s.mastered}</span>/{s.total} mastered · {s.pct}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/60 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r transition-all", theme.progress)}
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass-strong rounded-3xl p-4 sm:p-6 mt-6 mb-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold">Topic Mastery & Revisions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Track your individual topic levels.</p>
          </div>
          <span className="glass rounded-full text-xs font-medium px-3 py-1">
            {filteredTopics.length} {filteredTopics.length === 1 ? "topic" : "topics"}
          </span>
        </div>

        {/* Dynamic Filters - MorningIntent Style */}
        <div className="glass rounded-xl p-1.5 mb-5 flex flex-nowrap items-center gap-2">
          <Select
            value={subjectFilter}
            onValueChange={(v) => {
              setSubjectFilter(v);
              setChapterFilter("all");
            }}
          >
            <SelectTrigger className="h-8 rounded-lg bg-white/70 border-white/60 flex-1 min-w-0 text-xs text-left">
              <div className="truncate">
                <SelectValue placeholder="Subject" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-w-[90vw] sm:max-w-md w-full max-h-[50vh]">
              <SelectItem value="all" className="whitespace-normal break-words py-2 pr-8 text-xs">
                All Subjects
              </SelectItem>
              {subjectsList.map((s) => (
                <SelectItem key={s.id} value={s.id} className="whitespace-normal break-words py-2 pr-8 text-xs">
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={chapterFilter} onValueChange={setChapterFilter} disabled={chaptersList.length === 0}>
            <SelectTrigger className="h-8 rounded-lg bg-white/70 border-white/60 flex-1 min-w-0 text-xs text-left">
              <div className="truncate">
                <SelectValue placeholder="Chapter" />
              </div>
            </SelectTrigger>
            <SelectContent className="max-w-[90vw] sm:max-w-md w-full max-h-[50vh]">
              <SelectItem value="all" className="whitespace-normal break-words py-2 pr-8 text-xs">
                All Chapters
              </SelectItem>
              {chaptersList.map((c) => (
                <SelectItem key={c.id} value={c.id} className="whitespace-normal break-words py-2 pr-8 text-xs">
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(subjectFilter !== "all" || chapterFilter !== "all") && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg h-8 px-2.5 text-xs shrink-0"
              onClick={() => {
                setSubjectFilter("all");
                setChapterFilter("all");
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Flat List Rendering */}
        <div className="w-full min-w-0 space-y-2">
          {filteredTopics.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No topics found.</div>
          ) : (
            filteredTopics.map((topic) => <MasteryTopicCard key={topic.id} topic={topic} tree={tree} />)
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MasteryTopicCard({ topic, tree }: { topic: FlatTopic; tree: SyllabusNode[] }) {
  // Find the subject index to consistently assign a theme color
  const subjectIndex = tree.findIndex((s) => s.id === topic.subjectId);
  const theme = THEME_COLORS[Math.max(0, subjectIndex) % THEME_COLORS.length];

  const b = masteryBadge(topic.status, topic.revisionCount ?? 0);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-3.5 rounded-2xl relative z-10 w-full transition-all shadow-sm backdrop-blur-sm",
        topic.excluded && "opacity-60 grayscale-[0.5]",
      )}
      style={{
        backgroundColor: theme.child,
        border: `1px solid ${theme.border}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1 text-foreground/70">
          <span
            className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-bold"
            style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
          >
            {topic.type}
          </span>
          {topic.excluded && (
            <span className="bg-slate-200/80 text-slate-600 rounded-full px-1.5 py-0.5 text-[9px] font-medium ml-1">
              excluded
            </span>
          )}
        </div>

        <div
          className={cn(
            "text-sm font-medium break-words leading-tight text-foreground/90",
            topic.excluded && "line-through text-muted-foreground",
          )}
        >
          {topic.title}
        </div>
        <div className="text-[10px] text-foreground/60 mt-1 truncate">
          {topic.subjectTitle} {topic.chapterTitle ? ` • ${topic.chapterTitle}` : ""}
        </div>
      </div>

      <div className="flex flex-wrap items-center sm:justify-end gap-2 text-[11px] text-muted-foreground shrink-0 bg-white/40 p-2 rounded-xl border border-white/40 w-full sm:w-auto">
        {b && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${b.cls}`}>{b.label}</span>
        )}
        <span className="bg-white/50 px-2 py-0.5 rounded-full font-medium">
          Revs: <span className="text-foreground/80 font-bold">{topic.revisionCount ?? 0}</span>
        </span>
        <span className="bg-white/50 px-2 py-0.5 rounded-full font-medium">
          Due: <span className="text-foreground/80 font-bold">{nextDueLabel(topic.nextRevisionAt)}</span>
        </span>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: "peach" | "lavender" | "mint" | "sky";
}) {
  const bg = { peach: "bg-peach/60", lavender: "bg-lavender/60", mint: "bg-mint/60", sky: "bg-sky/60" }[tint];
  return (
    <div className="glass-strong rounded-3xl p-5">
      <div className={`h-9 w-9 rounded-2xl ${bg} flex items-center justify-center mb-3`}>{icon}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-0.5 truncate">{value}</div>
    </div>
  );
}
