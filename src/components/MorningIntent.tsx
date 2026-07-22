import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusDot } from "@/components/StatusDot";
import { useStore } from "@/lib/store";
import { quotes } from "@/lib/mock-syllabus";
import type { SyllabusNode } from "@/lib/mock-syllabus";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Quote, Play, Inbox, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function MorningIntent() {
  const { tree, bucketNodes, bucket, dailyLimit, addToBucket, removeFromBucket } = useStore();
  const quote = useMemo(() => quotes[new Date().getDate() % quotes.length], []);
  const [tab, setTab] = useState("new");
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
      {/* Quote banner */}
      <div className="glass rounded-3xl px-4 py-3 flex items-start gap-3 mb-5">
        <div className="h-8 w-8 rounded-full bg-lavender/70 flex items-center justify-center shrink-0 mt-0.5">
          <Quote className="h-4 w-4 text-foreground/70" />
        </div>
        <p className="text-sm font-medium italic text-foreground/80 leading-relaxed break-words">"{quote}"</p>
      </div>

      <header className="mb-5">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Good morning.</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Choose what today looks like — gently.</p>
      </header>

      {/* Selectors - Adjusted for a single line on mobile */}
      <div className="glass rounded-2xl p-2 mb-4 flex flex-nowrap items-center gap-2">
        <Select
          value={subjectFilter}
          onValueChange={(v) => {
            setSubjectFilter(v);
            setChapterFilter("all");
          }}
        >
          <SelectTrigger className="h-9 rounded-full bg-white/70 border-white/60 flex-1 min-w-0 text-sm">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={chapterFilter} onValueChange={setChapterFilter} disabled={chapters.length === 0}>
          <SelectTrigger className="h-9 rounded-full bg-white/70 border-white/60 flex-1 min-w-0 text-sm">
            <SelectValue placeholder="Chapter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chapters</SelectItem>
            {chapters.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(subjectFilter !== "all" || chapterFilter !== "all") && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full h-9 px-3 text-xs shrink-0"
            onClick={() => {
              setSubjectFilter("all");
              setChapterFilter("all");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 lg:gap-6">
        {/* The Bank */}
        <section className="glass-strong rounded-3xl p-4 sm:p-5 lg:p-6 flex flex-col min-w-0 max-h-[70vh] lg:max-h-[calc(100vh-16rem)]">
          <div className="flex items-start justify-between mb-3 gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="font-semibold text-base sm:text-lg">The Bank</h2>
              <p className="text-xs text-muted-foreground">Your syllabus topics, ready when you are.</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="flex flex-col min-h-0 flex-1">
            <TabsList className="bg-white/40 backdrop-blur border border-white/50 rounded-full p-1 h-auto self-start max-w-full overflow-x-auto">
              <TabsTrigger
                value="new"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
              >
                <Inbox className="h-3.5 w-3.5" /> New
                <span className="opacity-60">{newTopics.length}</span>
              </TabsTrigger>
              <TabsTrigger
                value="due"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
              >
                <CalendarClock className="h-3.5 w-3.5" /> Due
                <span className="opacity-60">{dueTopics.length}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="mt-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 -mr-1">
              <TopicList
                topics={newTopics}
                bucket={bucket}
                onAdd={addToBucket}
                onRemove={removeFromBucket}
                full={full}
              />
            </TabsContent>
            <TabsContent value="due" className="mt-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 -mr-1">
              <TopicList
                topics={dueTopics}
                bucket={bucket}
                onAdd={addToBucket}
                onRemove={removeFromBucket}
                full={full}
              />
            </TabsContent>
          </Tabs>
        </section>

        {/* Today's Bucket */}
        <section className="glass-strong rounded-3xl p-4 sm:p-5 lg:p-6 flex flex-col min-w-0 max-h-[70vh] lg:max-h-[calc(100vh-16rem)]">
          <div className="flex items-start justify-between mb-3 gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="font-semibold text-base sm:text-lg">Today's Bucket</h2>
              <p className="text-xs text-muted-foreground">What you commit to studying today.</p>
            </div>
            <Link to="/revisions" className="shrink-0">
              <Button size="sm" className="rounded-full gap-1.5" disabled={bucket.length === 0}>
                <Play className="h-3.5 w-3.5" /> Start
              </Button>
            </Link>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
              <span className="font-medium text-foreground/70 truncate">Capacity</span>
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
                  Tap <span className="font-semibold">+</span> on items in The Bank to commit them to today.
                </p>
              </div>
            ) : (
              bucketNodes.map((n) => (
                <div key={n.id} className="glass rounded-2xl px-3 py-2.5 flex items-start gap-3 min-w-0">
                  <div className="pt-1">
                    <StatusDot status={n.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium break-words">{n.title}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">{n.type}</div>
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
              ))
            )}
          </div>

          {bucketNodes.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-3 text-center">
              🌤 Anything left overnight rolls over softly. No guilt.
            </p>
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
  onAdd,
  onRemove,
  full,
}: {
  topics: FlatTopic[];
  bucket: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  full: boolean;
}) {
  if (topics.length === 0) {
    return <div className="text-center py-10 text-sm text-muted-foreground">No topics found. Breathe.</div>;
  }
  return (
    <div className="space-y-2">
      {topics.map((t) => (
        <TopicCard key={t.id} topic={t} bucket={bucket} onAdd={onAdd} onRemove={onRemove} full={full} />
      ))}
    </div>
  );
}

// Renders an individual, fully clickable Topic Card
function TopicCard({
  topic,
  bucket,
  onAdd,
  onRemove,
  full,
}: {
  topic: FlatTopic;
  bucket: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  full: boolean;
}) {
  const inBucket = bucket.includes(topic.id);

  return (
    <div
      onClick={() => {
        if (inBucket) {
          onRemove(topic.id);
        } else if (!full) {
          onAdd(topic.id);
        }
      }}
      className={cn(
        "flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-all min-w-0 cursor-pointer select-none",
        inBucket ? "bg-white/70 border-primary/40 shadow-sm" : "glass hover:bg-white/40",
      )}
    >
      <div className="pt-0.5 shrink-0">
        <StatusDot status={topic.status} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium break-words leading-tight">{topic.title}</div>
        <div className="text-[11px] text-muted-foreground mt-1 truncate">
          {topic.subjectTitle} {topic.chapterTitle ? ` • ${topic.chapterTitle}` : ""}
        </div>
      </div>

      {inBucket ? (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full hover:bg-white/60 shrink-0 pointer-events-none"
        >
          <Minus className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full hover:bg-primary/30 disabled:opacity-40 shrink-0 pointer-events-none"
          disabled={full}
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
