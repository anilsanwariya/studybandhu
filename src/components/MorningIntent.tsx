import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusDot } from "@/components/StatusDot";
import { useStore } from "@/lib/store";
import type { SyllabusNode } from "@/lib/mock-syllabus";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import { THEME_COLORS } from "@/lib/theme";

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

export function MorningIntent() {
  const { tree, bucketNodes, bucket, dailyLimit, addToBucket, removeFromBucket } = useStore();

  // 0 = New, 1 = Due, 2 = Bucket. Default is Due (1).
  const [paneIdx, setPaneIdx] = useState<0 | 1 | 2>(1);

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");

  // Extract subjects and chapters for the dropdowns
  const subjects = useMemo(() => tree.map((n) => ({ id: n.id, title: n.title })), [tree]);
  const chapters = useMemo(() => {
    const subj = subjectFilter === "all" ? tree : tree.filter((n) => n.id === subjectFilter);
    return subj.flatMap((s) => (s.children ?? []).map((c) => ({ id: c.id, title: c.title })));
  }, [tree, subjectFilter]);

  // Create a flattened list of all available topics, carrying their subject/chapter context
  const allFlatTopics = useMemo(() => extractFlatTopics(tree), [tree]);

  // Apply the dropdown selections directly to the flattened list
  const filteredTopics = useMemo(() => {
    return allFlatTopics.filter((t) => {
      const matchSubject = subjectFilter === "all" || t.subjectId === subjectFilter;
      const matchChapter = chapterFilter === "all" || t.chapterId === chapterFilter;
      return matchSubject && matchChapter;
    });
  }, [allFlatTopics, subjectFilter, chapterFilter]);

  // Separate into New and Due lists
  const newTopics = useMemo(() => filteredTopics.filter((t) => t.status === "unread"), [filteredTopics]);
  const dueTopics = useMemo(
    () => filteredTopics.filter((t) => !!t.dueToday && t.status !== "unread"),
    [filteredTopics],
  );

  const full = bucket.length >= dailyLimit;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto w-full relative px-2 sm:px-0">
        <header className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Good morning.</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Choose what today looks like — gently.</p>
        </header>

        {/* Selectors - Only show when NOT on the Bucket tab */}
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

        {/* Main Focused Carousel Card */}
        <section className="relative glass-strong rounded-3xl p-4 sm:p-5 lg:p-6 flex flex-col min-w-0 h-[68vh] lg:h-[calc(100vh-14rem)]">
          {/* Half-in, Half-out Navigation Arrows */}
          {paneIdx > 0 && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute -left-5 sm:-left-6 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/40 backdrop-blur-md border border-white/50 shadow-md hover:bg-white/60 z-30 transition-all flex items-center justify-center"
              onClick={() => setPaneIdx((p) => Math.max(0, p - 1) as 0 | 1 | 2)}
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 text-slate-700 ml-[-2px]" />
            </Button>
          )}

          {paneIdx < 2 && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute -right-5 sm:-right-6 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/40 backdrop-blur-md border border-white/50 shadow-md hover:bg-white/60 z-30 transition-all flex items-center justify-center"
              onClick={() => setPaneIdx((p) => Math.min(2, p + 1) as 0 | 1 | 2)}
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-slate-700 mr-[-2px]" />
            </Button>
          )}

          {/* Header - Centered title */}
          <div className="text-center mb-4 pb-3 border-b border-white/20 shrink-0 px-8">
            <h2 className="font-semibold text-base sm:text-lg truncate">
              {PANES[paneIdx].title}
              {paneIdx === 0 && <span className="ml-2 text-sm opacity-60 font-normal">({newTopics.length})</span>}
              {paneIdx === 1 && <span className="ml-2 text-sm opacity-60 font-normal">({dueTopics.length})</span>}
            </h2>
            <p className="text-xs text-muted-foreground truncate">{PANES[paneIdx].subtitle}</p>
          </div>

          {/* New Topics Pane */}
          {paneIdx === 0 && (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 -mr-1 z-10 px-2 sm:px-4">
              <TopicList
                topics={newTopics}
                bucket={bucket}
                tree={tree}
                onAdd={addToBucket}
                onRemove={removeFromBucket}
                full={full}
              />
            </div>
          )}

          {/* Due Topics Pane */}
          {paneIdx === 1 && (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 -mr-1 z-10 px-2 sm:px-4">
              <TopicList
                topics={dueTopics}
                bucket={bucket}
                tree={tree}
                onAdd={addToBucket}
                onRemove={removeFromBucket}
                full={full}
              />
            </div>
          )}

          {/* Today's Bucket Pane */}
          {paneIdx === 2 && (
            <div className="flex-1 min-h-0 flex flex-col z-10 px-2 sm:px-4">
              <div className="mb-4 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Ready to focus?</span>
                  <Link to="/revisions" className="shrink-0">
                    <Button size="sm" className="rounded-full gap-1.5" disabled={bucket.length === 0}>
                      <Play className="h-3.5 w-3.5" /> Start
                    </Button>
                  </Link>
                </div>
                <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                  <span className="text-foreground/70 truncate">Daily Capacity</span>
                  <span className="font-semibold shrink-0">
                    {bucket.length}/{dailyLimit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--mint)] via-[var(--sky)] to-[var(--lavender)] transition-all"
                    style={{ width: `${(bucket.length / dailyLimit) * 100}%` }}
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
                      <span className="font-semibold">Due</span> topics and tap <span className="font-semibold">+</span>{" "}
                      to commit them to today.
                    </p>
                  </div>
                ) : (
                  bucketNodes.map((n) => {
                    // Calculate theme for items in the bucket too!
                    const parentId =
                      n.depth === 2
                        ? tree.find((s) => s.children?.some((c) => c.children?.some((t) => t.id === n.id)))?.id
                        : null;
                    const subjectIndex = parentId ? tree.findIndex((s) => s.id === parentId) : 0;
                    const theme = THEME_COLORS[Math.max(0, subjectIndex) % THEME_COLORS.length];

                    return (
                      <div
                        key={n.id}
                        className="rounded-2xl px-3 py-2.5 flex items-start gap-3 min-w-0 shadow-sm backdrop-blur-sm transition-all"
                        style={{
                          backgroundColor: theme.child,
                          border: `1px solid ${theme.border}`,
                        }}
                      >
                        <div className="pt-1">
                          <StatusDot status={n.status} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium break-words text-foreground/90">{n.title}</div>
                          <div className="text-[11px] text-foreground/60 capitalize mt-0.5">{n.type}</div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full hover:bg-white/60 shrink-0"
                          onClick={() => removeFromBucket(n.id)}
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
          )}
        </section>
      </div>
    </AppShell>
  );
}

// Renders the flat list of topics
function TopicList({
  topics,
  bucket,
  tree,
  onAdd,
  onRemove,
  full,
}: {
  topics: FlatTopic[];
  bucket: string[];
  tree: SyllabusNode[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  full: boolean;
}) {
  if (topics.length === 0) {
    return <div className="text-center py-10 text-sm text-muted-foreground">No topics found. Breathe.</div>;
  }
  return (
    <div className="space-y-2 pb-4">
      {topics.map((t) => (
        <TopicCard key={t.id} topic={t} bucket={bucket} tree={tree} onAdd={onAdd} onRemove={onRemove} full={full} />
      ))}
    </div>
  );
}

// Renders an individual, fully clickable Topic Card
function TopicCard({
  topic,
  bucket,
  tree,
  onAdd,
  onRemove,
  full,
}: {
  topic: FlatTopic;
  bucket: string[];
  tree: SyllabusNode[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  full: boolean;
}) {
  const inBucket = bucket.includes(topic.id);
  const hasSubtopics = !!topic.children && topic.children.length > 0;
  const [expanded, setExpanded] = useState(false);

  // Find the subject index to consistently assign a theme color
  const subjectIndex = tree.findIndex((s) => s.id === topic.subjectId);
  const theme = THEME_COLORS[Math.max(0, subjectIndex) % THEME_COLORS.length];

  return (
    <div className="flex flex-col min-w-0 transition-all">
      {/* Main Topic Row */}
      <div
        onClick={() => {
          if (hasSubtopics) setExpanded(!expanded);
        }}
        className={cn(
          "flex items-start gap-3 px-3 py-2.5 min-w-0 select-none transition-all shadow-sm backdrop-blur-sm",
          hasSubtopics && "cursor-pointer hover:brightness-105",
          hasSubtopics && expanded ? "rounded-t-2xl" : "rounded-2xl",
        )}
        style={{
          backgroundColor: inBucket ? theme.border : theme.child, // Highlight slightly stronger if in bucket
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
              onAdd(topic.id);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Expanded Subtopics Area */}
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
            {topic.children!.map((sub) => {
              const subInBucket = bucket.includes(sub.id);
              return (
                <div
                  key={sub.id}
                  className="flex items-start gap-3 pl-6 py-1.5 min-w-0 rounded-xl hover:bg-white/30 transition-colors"
                >
                  <div className="pt-1 shrink-0">
                    <StatusDot status={sub.status} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-xs text-foreground/90 break-words leading-tight">{sub.title}</div>
                  </div>

                  {subInBucket ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-full hover:bg-white/60 shrink-0 z-20 relative"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(sub.id);
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-full hover:bg-primary/30 disabled:opacity-40 shrink-0 z-20 relative"
                      disabled={full}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdd(sub.id);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
