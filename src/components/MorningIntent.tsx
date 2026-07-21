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
import { Plus, Minus, Quote, Play, Inbox, CalendarClock, ChevronRight, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

type LeafPredicate = (n: SyllabusNode) => boolean;

function filterTree(nodes: SyllabusNode[], keep: LeafPredicate): SyllabusNode[] {
  const out: SyllabusNode[] = [];
  for (const n of nodes) {
    const isLeaf = !n.children || n.children.length === 0;
    if (isLeaf) {
      if (keep(n) && !n.excluded) out.push(n);
    } else {
      const kids = filterTree(n.children!, keep);
      if (kids.length > 0) out.push({ ...n, children: kids });
    }
  }
  return out;
}

function countLeaves(nodes: SyllabusNode[]): number {
  let c = 0;
  for (const n of nodes) {
    if (!n.children || n.children.length === 0) c += 1;
    else c += countLeaves(n.children);
  }
  return c;
}

/** Prune tree based on Paper/Unit, OR extract the Subject entirely to strip upper tree. */
function scopeTree(nodes: SyllabusNode[], paperId: string, unitId: string, subjectId: string): SyllabusNode[] {
  // If a specific subject is selected, extract ONLY that subject and make it the root.
  // This strips away the parent Paper and Unit nodes.
  if (subjectId !== "all") {
    let foundSubject: SyllabusNode | null = null;
    const findNode = (list: SyllabusNode[]) => {
      for (const n of list) {
        if (n.id === subjectId) {
          foundSubject = n;
          return;
        }
        if (n.children) findNode(n.children);
      }
    };
    findNode(nodes);
    return foundSubject ? [foundSubject] : [];
  }

  // Otherwise, handle standard Paper and Unit filtering
  if (paperId === "all" && unitId === "all") return nodes;

  const walk = (list: SyllabusNode[]): SyllabusNode[] => {
    const out: SyllabusNode[] = [];
    for (const n of list) {
      if (paperId !== "all" && n.depth === 0 && n.id !== paperId) continue;
      if (unitId !== "all" && n.depth === 1 && n.id !== unitId) continue;

      const kids = n.children ? walk(n.children) : undefined;

      let filteringDeeper = false;
      if (unitId !== "all" && n.depth < 1) filteringDeeper = true;

      // If we are searching deeper, and this branch has no matching children, prune it.
      if (filteringDeeper && (!kids || kids.length === 0)) {
        continue;
      }

      out.push({ ...n, children: kids });
    }
    return out;
  };
  return walk(nodes);
}

export function MorningIntent() {
  const { tree, bucketNodes, bucket, dailyLimit, addToBucket, removeFromBucket } = useStore();
  const quote = useMemo(() => quotes[new Date().getDate() % quotes.length], []);
  const [tab, setTab] = useState("new");

  const [paperFilter, setPaperFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  // Extract Papers (Depth 0)
  const papers = useMemo(() => tree.map((n) => ({ id: n.id, title: n.title })), [tree]);

  // Extract Units (Depth 1)
  const units = useMemo(() => {
    const selectedPaper = paperFilter === "all" ? tree : tree.filter((n) => n.id === paperFilter);
    return selectedPaper.flatMap((p) => (p.children ?? []).map((u) => ({ id: u.id, title: u.title })));
  }, [tree, paperFilter]);

  // Extract Subjects (Depth 2) for Swipeable Tabs
  const subjects = useMemo(() => {
    const selectedPaper = paperFilter === "all" ? tree : tree.filter((n) => n.id === paperFilter);
    const selectedUnits =
      unitFilter === "all"
        ? selectedPaper.flatMap((p) => p.children ?? [])
        : selectedPaper.flatMap((p) => (p.children ?? []).filter((u) => u.id === unitFilter));

    return selectedUnits.flatMap((u) => (u.children ?? []).map((s) => ({ id: s.id, title: s.title })));
  }, [tree, paperFilter, unitFilter]);

  const scopedTree = useMemo(
    () => scopeTree(tree, paperFilter, unitFilter, subjectFilter),
    [tree, paperFilter, unitFilter, subjectFilter],
  );

  const newTree = useMemo(() => filterTree(scopedTree, (n) => n.status === "unread"), [scopedTree]);
  const dueTree = useMemo(() => filterTree(scopedTree, (n) => !!n.dueToday && n.status !== "unread"), [scopedTree]);
  const newCount = useMemo(() => countLeaves(newTree), [newTree]);
  const dueCount = useMemo(() => countLeaves(dueTree), [dueTree]);
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

      {/* Filters: Paper & Unit */}
      <div className="glass rounded-2xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-1">
          <Filter className="h-3.5 w-3.5" /> Filter
        </div>

        <Select
          value={paperFilter}
          onValueChange={(v) => {
            setPaperFilter(v);
            setUnitFilter("all");
            setSubjectFilter("all");
          }}
        >
          <SelectTrigger className="h-9 rounded-full bg-white/70 border-white/60 w-auto min-w-[10rem] text-sm">
            <SelectValue placeholder="Paper" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Papers</SelectItem>
            {papers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={unitFilter}
          onValueChange={(v) => {
            setUnitFilter(v);
            setSubjectFilter("all");
          }}
          disabled={units.length === 0}
        >
          <SelectTrigger className="h-9 rounded-full bg-white/70 border-white/60 w-auto min-w-[10rem] text-sm">
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Units</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(paperFilter !== "all" || unitFilter !== "all") && (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full h-8 text-xs"
            onClick={() => {
              setPaperFilter("all");
              setUnitFilter("all");
              setSubjectFilter("all");
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
              <p className="text-xs text-muted-foreground">Your syllabus, ready when you are.</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="flex flex-col min-h-0 flex-1">
            <TabsList className="bg-white/40 backdrop-blur border border-white/50 rounded-full p-1 h-auto self-start max-w-full overflow-x-auto">
              <TabsTrigger
                value="new"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
              >
                <Inbox className="h-3.5 w-3.5" /> New
                <span className="opacity-60">{newCount}</span>
              </TabsTrigger>
              <TabsTrigger
                value="due"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5 text-xs sm:text-sm"
              >
                <CalendarClock className="h-3.5 w-3.5" /> Due
                <span className="opacity-60">{dueCount}</span>
              </TabsTrigger>
            </TabsList>

            {/* Swipeable Subject Tabs Inside The Bank */}
            <div className="mt-4 mb-1 flex overflow-x-auto gap-2 pb-2 snap-x hide-scrollbar [-ms-overflow-style:none] [scrollbar-width:none]">
              <button
                onClick={() => setSubjectFilter("all")}
                className={cn(
                  "snap-start shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  subjectFilter === "all" ? "bg-primary text-primary-foreground shadow-md" : "glass hover:bg-white/60",
                )}
              >
                All Subjects
              </button>

              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  onClick={() => setSubjectFilter(subject.id)}
                  className={cn(
                    "snap-start shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    subjectFilter === subject.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "glass hover:bg-white/60",
                  )}
                >
                  {subject.title}
                </button>
              ))}
            </div>

            <TabsContent value="new" className="mt-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 -mr-1">
              <BankTree nodes={newTree} bucket={bucket} onAdd={addToBucket} onRemove={removeFromBucket} full={full} />
            </TabsContent>
            <TabsContent value="due" className="mt-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 -mr-1">
              <BankTree nodes={dueTree} bucket={bucket} onAdd={addToBucket} onRemove={removeFromBucket} full={full} />
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

function BankTree({
  nodes,
  bucket,
  onAdd,
  onRemove,
  full,
}: {
  nodes: SyllabusNode[];
  bucket: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  full: boolean;
}) {
  if (nodes.length === 0) {
    return <div className="text-center py-10 text-sm text-muted-foreground">Nothing here right now. Breathe.</div>;
  }
  return (
    <div className="space-y-1">
      {nodes.map((n) => (
        <BankNode key={n.id} node={n} depth={0} bucket={bucket} onAdd={onAdd} onRemove={onRemove} full={full} />
      ))}
    </div>
  );
}

function BankNode({
  node,
  depth,
  bucket,
  onAdd,
  onRemove,
  full,
}: {
  node: SyllabusNode;
  depth: number;
  bucket: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  full: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 2); // Expand further down by default
  const hasChildren = !!node.children && node.children.length > 0;
  const inBucket = bucket.includes(node.id);
  const leafCount = hasChildren ? countLeaves(node.children!) : 0;

  return (
    <div>
      <div
        onClick={() => {
          if (hasChildren) setExpanded((e) => !e);
        }}
        className={cn(
          "flex items-start gap-1.5 rounded-2xl px-2 py-2 transition-all min-w-0 select-none",
          hasChildren ? "cursor-pointer hover:bg-white/40" : "glass",
          inBucket && !hasChildren && "bg-white/70 border-primary/40",
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {hasChildren ? (
          <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <ChevronRight
              className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-90")}
            />
          </div>
        ) : (
          <span className="h-6 w-6 shrink-0 flex items-center justify-center mt-0.5">
            <StatusDot status={node.status} />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className={cn("text-sm break-words", depth === 0 && "font-semibold", depth === 1 && "font-medium")}>
            {node.title}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground break-words">
            {node.type}
            {hasChildren ? ` · ${leafCount}` : ""}
          </div>
        </div>
        {!hasChildren &&
          (inBucket ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full hover:bg-white/60 shrink-0"
              onClick={(e) => {
                e.stopPropagation(); // Prevents clicks from triggering parent logic
                onRemove(node.id);
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full hover:bg-primary/30 disabled:opacity-40 shrink-0"
              onClick={(e) => {
                e.stopPropagation(); // Prevents clicks from triggering parent logic
                onAdd(node.id);
              }}
              disabled={full}
              aria-label="Add to bucket"
            >
              <Plus className="h-4 w-4" />
            </Button>
          ))}
      </div>
      {hasChildren && expanded && (
        <div className="space-y-1 mt-1">
          {node.children!.map((child) => (
            <BankNode
              key={child.id}
              node={child}
              depth={depth + 1}
              bucket={bucket}
              onAdd={onAdd}
              onRemove={onRemove}
              full={full}
            />
          ))}
        </div>
      )}
    </div>
  );
}
