import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusDot } from "@/components/StatusDot";
import { useStore, statusMeta } from "@/lib/store";
import type { SyllabusNode } from "@/lib/mock-syllabus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronRight, RotateCcw, Link as LinkIcon, StickyNote, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/syllabus")({
  head: () => ({
    meta: [
      { title: "Syllabus — Cadence" },
      { name: "description", content: "Manage your entire syllabus tree with granular progress and reset controls." },
    ],
  }),
  component: SyllabusPage,
});

function SyllabusPage() {
  const { tree } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");

  const subjects = tree.map((n) => ({ id: n.id, title: n.title }));
  const chapters = (
    subjectFilter === "all" ? tree : tree.filter((n) => n.id === subjectFilter)
  ).flatMap((s) => (s.children ?? []).map((c) => ({ id: c.id, title: c.title })));

  const scopedTree: SyllabusNode[] = (() => {
    if (subjectFilter === "all" && chapterFilter === "all") return tree;
    const walk = (list: SyllabusNode[]): SyllabusNode[] => {
      const out: SyllabusNode[] = [];
      for (const n of list) {
        if (subjectFilter !== "all" && n.depth === 0 && n.id !== subjectFilter) continue;
        if (chapterFilter !== "all" && n.depth === 1 && n.id !== chapterFilter) continue;
        const kids = n.children ? walk(n.children) : undefined;
        out.push({ ...n, children: kids });
      }
      return out;
    };
    return walk(tree);
  })();

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Syllabus</h1>
        <p className="text-muted-foreground mt-1">Everything you're preparing, in one calm tree.</p>
      </header>

      <div className="grid lg:grid-cols-[1fr_auto] gap-6 mb-6">
        <div className="glass rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4 text-xs">
          {(["mastered","needs-revision","first-read","unread"] as const).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <StatusDot status={s} />
              <span className="font-medium">{statusMeta[s].label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-1">
          <Filter className="h-3.5 w-3.5" /> Filter
        </div>
        <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v); setChapterFilter("all"); }}>
          <SelectTrigger className="h-9 rounded-full bg-white/70 border-white/60 w-auto min-w-[10rem] text-sm">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={chapterFilter} onValueChange={setChapterFilter} disabled={chapters.length === 0}>
          <SelectTrigger className="h-9 rounded-full bg-white/70 border-white/60 w-auto min-w-[10rem] text-sm">
            <SelectValue placeholder="Chapter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All chapters</SelectItem>
            {chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        {(subjectFilter !== "all" || chapterFilter !== "all") && (
          <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs"
            onClick={() => { setSubjectFilter("all"); setChapterFilter("all"); }}>
            Clear
          </Button>
        )}
      </div>

      <div className="glass-strong rounded-3xl p-3 sm:p-4 lg:p-6">
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="space-y-2 min-w-[320px]">
            {scopedTree.map((node) => (
              <TreeNode key={node.id} node={node} depth={0} onOpen={setOpenId} />
            ))}
          </div>
        </div>
      </div>

      <NodeDrawer openId={openId} onClose={() => setOpenId(null)} />
    </AppShell>
  );
}

function TreeNode({ node, depth, onOpen }: { node: SyllabusNode; depth: number; onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const { resetNode } = useStore();

  return (
    <div>
      <div
        className={cn(
          "group flex items-start gap-2 rounded-2xl px-2 sm:px-3 py-2.5 transition-all min-w-0",
          "hover:bg-white/50 cursor-pointer",
          node.excluded && "opacity-40",
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded((e) => !e)} className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-white/60 shrink-0 mt-0.5">
            <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        <span className="mt-1.5 shrink-0"><StatusDot status={node.status} /></span>
        <button
          onClick={() => onOpen(node.id)}
          className={cn(
            "flex-1 text-left text-sm min-w-0 break-words",
            node.depth === 0 && "font-semibold text-base",
            node.depth === 1 && "font-medium",
            node.excluded && "line-through",
          )}
        >
          {node.title}
        </button>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          {node.type}
        </span>
        <ResetButton nodeTitle={node.title} onConfirm={() => resetNode(node.id)} />

      </div>
      {hasChildren && expanded && (
        <div className="space-y-1 mt-1">
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResetButton({ nodeTitle, onConfirm }: { nodeTitle: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-blush/60 text-foreground/60 hover:text-foreground transition-all shrink-0"
          onClick={(e) => e.stopPropagation()}
          aria-label="Reset progress"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="glass-strong">
        <AlertDialogHeader>
          <AlertDialogTitle>Reset "{nodeTitle}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Reset all progress and revision history for this section? This clears status and due dates for every item beneath it. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Keep progress</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="rounded-full bg-blush text-foreground hover:bg-blush/80">
            Reset section
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NodeDrawer({ openId, onClose }: { openId: string | null; onClose: () => void }) {
  const { findNode, updateNode } = useStore();
  const node = openId ? findNode(openId) : null;

  return (
    <Sheet open={!!node} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="glass-strong border-l border-white/60 w-full sm:max-w-md">
        {node && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 mb-1">
                <StatusDot status={node.status} />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{node.type}</span>
              </div>
              <SheetTitle className="text-2xl">{node.title}</SheetTitle>
              <SheetDescription>Attach a reference and shape how this fits into your plan.</SheetDescription>
            </SheetHeader>

            <div className="px-4 space-y-5 mt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs"><LinkIcon className="h-3.5 w-3.5" /> Reference URL</Label>
                <Input
                  placeholder="https://…"
                  value={node.url ?? ""}
                  onChange={(e) => updateNode(node.id, { url: e.target.value })}
                  className="bg-white/60 border-white/60 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs"><StickyNote className="h-3.5 w-3.5" /> Reference note</Label>
                <Input
                  placeholder="e.g. Laxmikanth, Ch. 4"
                  value={node.note ?? ""}
                  onChange={(e) => updateNode(node.id, { note: e.target.value })}
                  className="bg-white/60 border-white/60 rounded-xl"
                />
              </div>

              <div className="glass rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Exclude from study plan</div>
                  <div className="text-xs text-muted-foreground">Hide from Bank & Due lists</div>
                </div>
                <Switch
                  checked={!!node.excluded}
                  onCheckedChange={(v) => updateNode(node.id, { excluded: v })}
                />
              </div>

              <div className="glass rounded-2xl p-4">
                <div className="text-xs font-medium mb-2">Status</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["unread","first-read","needs-revision","mastered"] as const).map((s) => (
                    <Button
                      key={s}
                      variant={node.status === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateNode(node.id, { status: s })}
                      className="rounded-full justify-start gap-2 bg-white/50 border-white/60 hover:bg-white/80 data-[state=on]:bg-primary"
                    >
                      <StatusDot status={s} />
                      <span className="text-xs">{statusMeta[s].label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
