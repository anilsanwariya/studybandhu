import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusDot } from "@/components/StatusDot";
import { StageBadge } from "@/components/StageBadge";
import { useStore, type BucketNode } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { SyllabusNode, Intent } from "@/lib/mock-syllabus";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Minus, Play, ChevronLeft, ChevronRight, Flame, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

import { THEME_COLORS } from "@/lib/theme";

type FlatTopic = SyllabusNode & {
  subjectId?: string;
  subjectTitle?: string;
  chapterId?: string;
  chapterTitle?: string;
  highYield?: boolean;
};

function extractFlatTopics(
  nodes: SyllabusNode[],
  currentSubj?: { id: string; title: string },
  currentChap?: { id: string; title: string },
): FlatTopic[] {
  let result: FlatTopic[] = [];
  for (const n of nodes) {
    if (n.excluded) continue;
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

const PANES = [
  { id: "new", title: "New Targets", subtitle: "Unread syllabus topics" },
  { id: "due", title: "Due Revisions", subtitle: "Topics needing your attention" },
  { id: "bucket", title: "Today's Bucket", subtitle: "What you commit to studying today" },
];

function formatCountdown(iso: string): string {
  const target = new Date(iso + "T09:00:00").getTime();
  const diff = target - Date.now();
  if (diff <= 0) return "today";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days === 0) return `${hours}h`;
  return `${days}d ${hours}h`;
}

export function MorningIntent() {
  const {
    tree,
    bucket,
    bucketNodes,
    dailyLimit,
    addToBucket,
    removeFromBucket,
    scheduleMode,
    studyMode,
    aggregatedUpcoming,
  } = useStore();
  const { user } = useAuth();

  const [paneIdx, setPaneIdx] = useState<0 | 1 | 2>(1);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [intentPickerFor, setIntentPickerFor] = useState<FlatTopic | null>(null);
  const [, setTick] = useState(0);

  // Live countdown update every minute for the banner.
  useEffect(() => {
    if (scheduleMode !== "test-series") return;
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [scheduleMode]);

  const subjects = useMemo(() => tree.map((n) => ({ id: n.id, title: n.title })), [tree]);
  const chapters = useMemo(() => {
    const subj = subjectFilter === "all" ? tree : tree.filter((n) => n.id === subjectFilter);
    return subj.flatMap((s) => (s.children ?? []).map((c) => ({ id: c.id, title: c.title })));
  }, [tree, subjectFilter]);

  const allFlatTopics = useMemo(() => extractFlatTopics(tree), [tree]);

  // Test-series aggregation: restrict topic universe to union of upcoming
  // mapped topic ids and flag high-yield ones.
  const testSeriesTopics = useMemo(() => {
    if (scheduleMode !== "test-series") return null;
    const { topicIdCounts } = aggregatedUpcoming;
    if (topicIdCounts.size === 0) return [] as FlatTopic[];
    return allFlatTopics
      .filter((t) => topicIdCounts.has(t.id))
      .map((t) => ({ ...t, highYield: (topicIdCounts.get(t.id) ?? 0) > 1 }));
  }, [scheduleMode, aggregatedUpcoming, allFlatTopics]);

  const baseTopics = testSeriesTopics ?? allFlatTopics;

  const filteredTopics = useMemo(() => {
    return baseTopics.filter((t) => {
      const matchSubject = subjectFilter === "all" || t.subjectId === subjectFilter;
      const matchChapter = chapterFilter === "all" || t.chapterId === chapterFilter;
      return matchSubject && matchChapter;
    });
  }, [baseTopics, subjectFilter, chapterFilter]);

  const newTopics = useMemo(() => filteredTopics.filter((t) => t.status === "unread"), [filteredTopics]);
  const dueTopics = useMemo(
    () => filteredTopics.filter((t) => !!t.dueToday && t.status !== "unread"),
    [filteredTopics],
  );

  const full = bucket.length >= dailyLimit;
  const bucketIds = useMemo(() => new Set(bucket.map((b) => b.id)), [bucket]);

  const handleAdd = (topic: FlatTopic) => {
    const stages = topic.stages ?? [];
    const isBoth = stages.length === 2;
    // Only intercept when the student is studying both AND the topic is P+M.
    if (studyMode === "both" && isBoth) {
      setIntentPickerFor(topic);
      return;
    }
    // Natural intent: single-stage topics use their stage; else "both".
    const intent: Intent = isBoth ? "both" : stages[0] === "mains" ? "mains" : stages[0] === "prelims" ? "prelims" : "both";
    addToBucket(topic.id, intent);
  };

  const resolveIntent = (intent: Intent) => {
    if (intentPickerFor) addToBucket(intentPickerFor.id, intent);
    setIntentPickerFor(null);
  };

  const nextTest = scheduleMode === "test-series" ? aggregatedUpcoming.nextTest : null;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto w-full relative px-2 sm:px-0">
        <header className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Good morning{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Choose what today looks like — gently.</p>
        </header>

        {scheduleMode === "test-series" && (
          <div className="glass-strong rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 border border-white/60">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--peach)] to-[var(--blush)] flex items-center justify-center shrink-0">
              <CalendarClock className="h-4 w-4 text-foreground/80" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">Targeting upcoming tests</div>
              <div className="text-xs text-muted-foreground truncate">
                {nextTest
                  ? `Next: ${nextTest.title} · ${nextTest.seriesTitle} · in ${formatCountdown(nextTest.date)}`
                  : "No upcoming tests in active series. Switch to Self-Paced or add one."}
              </div>
            </div>
            <Link to="/schedule">
              <Button size="sm" variant="ghost" className="rounded-full text-xs">
                Manage
              </Button>
            </Link>
          </div>
        )}

        {paneIdx !== 2 && (
          <div className="glass rounded-xl p-1.5 mb-4 flex flex-nowrap items-center gap-2">
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
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="whitespace-normal break-words py-2 pr-8 text-xs">
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={chapterFilter} onValueChange={setChapterFilter} disabled={chapters.length === 0}>
              <SelectTrigger className="h-8 rounded-lg bg-white/70 border-white/60 flex-1 min-w-0 text-xs text-left">
                <div className="truncate">
                  <SelectValue placeholder="Chapter" />
                </div>
              </SelectTrigger>
              <SelectContent className="max-w-[90vw] sm:max-w-md w-full max-h-[50vh]">
                <SelectItem value="all" className="whitespace-normal break-words py-2 pr-8 text-xs">
                  All Chapters
                </SelectItem>
                {chapters.map((c) => (
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
        )}

        <section className="relative glass-strong rounded-3xl p-4 sm:p-5 lg:p-6 flex flex-col min-w-0 h-[68vh] lg:h-[calc(100vh-14rem)]">
          {paneIdx > 0 && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute -left-5 sm:-left-6 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/40 backdrop-blur-md border border-white/50 shadow-md hover:bg-white/60 z-30"
              onClick={() => setPaneIdx((p) => Math.max(0, p - 1) as 0 | 1 | 2)}
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 text-slate-700 ml-[-2px]" />
            </Button>
          )}

          {paneIdx < 2 && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute -right-5 sm:-right-6 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/40 backdrop-blur-md border border-white/50 shadow-md hover:bg-white/60 z-30"
              onClick={() => setPaneIdx((p) => Math.min(2, p + 1) as 0 | 1 | 2)}
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-slate-700 mr-[-2px]" />
            </Button>
          )}

          <div className="text-center mb-4 pb-3 border-b border-white/20 shrink-0 px-8">
            <h2 className="font-semibold text-base sm:text-lg truncate">
              {PANES[paneIdx].title}
              {paneIdx === 0 && <span className="ml-2 text-sm opacity-60 font-normal">({newTopics.length})</span>}
              {paneIdx === 1 && <span className="ml-2 text-sm opacity-60 font-normal">({dueTopics.length})</span>}
            </h2>
            <p className="text-xs text-muted-foreground truncate">{PANES[paneIdx].subtitle}</p>
          </div>

          {paneIdx === 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 -mr-1 z-10 px-2 sm:px-4">
              <TopicList topics={newTopics} bucketIds={bucketIds} tree={tree} onAdd={handleAdd} onRemove={removeFromBucket} full={full} />
            </div>
          )}

          {paneIdx === 1 && (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 -mr-1 z-10 px-2 sm:px-4">
              <TopicList topics={dueTopics} bucketIds={bucketIds} tree={tree} onAdd={handleAdd} onRemove={removeFromBucket} full={full} />
            </div>
          )}

          {paneIdx === 2 && (
            <BucketPane
              tree={tree}
              bucketNodes={bucketNodes}
              dailyLimit={dailyLimit}
              onRemove={removeFromBucket}
            />
          )}
        </section>
      </div>

      {/* Intent picker for P+M topics when studyMode is 'both'. */}
      <Dialog open={intentPickerFor !== null} onOpenChange={(o) => { if (!o) setIntentPickerFor(null); }}>
        <DialogContent className="glass-strong z-[100] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How are you preparing this today?</DialogTitle>
            <DialogDescription className="text-xs">
              "{intentPickerFor?.title}" is relevant to both Prelims and Mains. Pick a focus for today.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <IntentButton label="Objective" sub="Prelims" onClick={() => resolveIntent("prelims")} />
            <IntentButton label="Descriptive" sub="Mains" onClick={() => resolveIntent("mains")} />
            <IntentButton label="Comprehensive" sub="Both" onClick={() => resolveIntent("both")} />
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function IntentButton({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass rounded-2xl px-3 py-4 text-center hover:scale-[1.02] hover:bg-white/80 transition-all border border-white/50"
    >
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </button>
  );
}

function BucketPane({
  tree,
  bucketNodes,
  dailyLimit,
  onRemove,
}: {
  tree: SyllabusNode[];
  bucketNodes: BucketNode[];
  dailyLimit: number;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col z-10 px-2 sm:px-4">
      <div className="mb-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Ready to focus?</span>
          <Link to="/revisions" className="shrink-0">
            <Button size="sm" className="rounded-full gap-1.5" disabled={bucketNodes.length === 0}>
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
          <span className="text-foreground/70 truncate">Daily Capacity</span>
          <span className="font-semibold shrink-0">
            {bucketNodes.length}/{dailyLimit}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--mint)] via-[var(--sky)] to-[var(--lavender)] transition-all"
            style={{ width: `${(bucketNodes.length / dailyLimit) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-2 pr-1 -mr-1">
        {bucketNodes.length === 0 ? (
          <div className="border-2 border-dashed border-white/60 rounded-2xl h-full min-h-[180px] flex flex-col items-center justify-center text-center px-6 py-10">
            <div className="h-12 w-12 rounded-full bg-white/50 flex items-center justify-center mb-3">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Your bucket is empty</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              Navigate left to <span className="font-semibold">New</span> or{" "}
              <span className="font-semibold">Due</span> topics and tap <span className="font-semibold">+</span> to commit them to today.
            </p>
          </div>
        ) : (
          bucketNodes.map((n) => {
            const parentId =
              n.depth === 2
                ? tree.find((s) => s.children?.some((c) => c.children?.some((t) => t.id === n.id)))?.id
                : null;
            const subjectIndex = parentId ? tree.findIndex((s) => s.id === parentId) : 0;
            const theme = THEME_COLORS[Math.max(0, subjectIndex) % THEME_COLORS.length];

            return (
              <div
                key={n.id}
                className="rounded-2xl px-3 py-2.5 flex items-start gap-3 min-w-0 shadow-sm backdrop-blur-sm"
                style={{ backgroundColor: theme.child, border: `1px solid ${theme.border}` }}
              >
                <div className="pt-1">
                  <StatusDot status={n.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <StageBadge stages={n.stages} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
                      · {n.intent}
                    </span>
                  </div>
                  <div className="text-sm font-medium break-words text-foreground/90">{n.title}</div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full hover:bg-white/60 shrink-0"
                  onClick={() => onRemove(n.id)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      {bucketNodes.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-3 text-center shrink-0">
          🌤 Anything left overnight rolls over softly. No guilt.
        </p>
      )}
    </div>
  );
}

function TopicList({
  topics,
  bucketIds,
  tree,
  onAdd,
  onRemove,
  full,
}: {
  topics: FlatTopic[];
  bucketIds: Set<string>;
  tree: SyllabusNode[];
  onAdd: (topic: FlatTopic) => void;
  onRemove: (id: string) => void;
  full: boolean;
}) {
  if (topics.length === 0) {
    return <div className="text-center py-10 text-sm text-muted-foreground">No topics found. Breathe.</div>;
  }
  return (
    <div className="space-y-2 pb-4">
      {topics.map((t) => (
        <TopicCard key={t.id} topic={t} bucketIds={bucketIds} tree={tree} onAdd={onAdd} onRemove={onRemove} full={full} />
      ))}
    </div>
  );
}

function TopicCard({
  topic,
  bucketIds,
  tree,
  onAdd,
  onRemove,
  full,
}: {
  topic: FlatTopic;
  bucketIds: Set<string>;
  tree: SyllabusNode[];
  onAdd: (topic: FlatTopic) => void;
  onRemove: (id: string) => void;
  full: boolean;
}) {
  const inBucket = bucketIds.has(topic.id);
  const hasSubtopics = !!topic.children && topic.children.length > 0;
  const [expanded, setExpanded] = useState(false);

  const subjectIndex = tree.findIndex((s) => s.id === topic.subjectId);
  const theme = THEME_COLORS[Math.max(0, subjectIndex) % THEME_COLORS.length];

  return (
    <div className="flex flex-col min-w-0 transition-all">
      <div
        onClick={() => {
          if (hasSubtopics) setExpanded(!expanded);
        }}
        className={cn(
          "flex items-start gap-3 px-3 py-2.5 min-w-0 select-none transition-all shadow-sm backdrop-blur-sm relative",
          hasSubtopics && "cursor-pointer hover:brightness-105",
          hasSubtopics && expanded ? "rounded-t-2xl" : "rounded-2xl",
          topic.highYield && "ring-2 ring-amber-300/70 shadow-[0_0_0_4px_rgba(251,191,36,0.15)]",
        )}
        style={{
          backgroundColor: inBucket ? theme.border : theme.child,
          border: `1px solid ${theme.border}`,
        }}
      >
        <div className="pt-0.5 shrink-0 flex items-center gap-1.5">
          {hasSubtopics && (
            <ChevronRight className={cn("h-4 w-4 text-foreground/50 transition-transform", expanded && "rotate-90")} />
          )}
          <StatusDot status={topic.status} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5 text-foreground/70">
            <span
              className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-bold"
              style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
            >
              {topic.type}
            </span>
            <StageBadge stages={topic.stages} />
            {topic.highYield && (
              <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-amber-900 bg-amber-200/80 ring-1 ring-amber-300/80 animate-pulse">
                <Flame className="h-2.5 w-2.5" /> High Yield
              </span>
            )}
            {hasSubtopics && <span className="text-[10px] font-medium">• {topic.children!.length} subtopics</span>}
          </div>

          <div className="text-sm font-medium break-words leading-tight text-foreground/90">{topic.title}</div>
          <div className="text-[10px] text-foreground/60 mt-1 truncate">
            {topic.subjectTitle} {topic.chapterTitle ? ` • ${topic.chapterTitle}` : ""}
          </div>
        </div>

        {inBucket ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full hover:bg-white/60 shrink-0 z-20 relative"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(topic.id);
            }}
          >
            <Minus className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full hover:bg-primary/30 disabled:opacity-40 shrink-0 z-20 relative"
            disabled={full}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(topic);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {hasSubtopics && expanded && (
        <div
          className="relative z-0 -mt-1 pt-2 pb-2 px-1 rounded-b-2xl"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            border: `1px solid rgba(255, 255, 255, 0.3)`,
            borderTop: "none",
          }}
        >
          <div className="space-y-1 mt-1 mx-1">
            {topic.children!.map((sub) => (
              <div
                key={sub.id}
                className="flex items-start gap-3 pl-6 py-1.5 min-w-0 rounded-xl"
              >
                <div className="pt-1 shrink-0">
                  <StatusDot status={sub.status} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="text-xs text-foreground/90 break-words leading-tight">{sub.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
