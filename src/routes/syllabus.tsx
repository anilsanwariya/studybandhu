import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusDot } from "@/components/StatusDot";
import { useStore, statusMeta } from "@/lib/store";
import type { SyllabusNode, NodeType } from "@/lib/mock-syllabus";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import {
  addUserNode,
  updateUserNode,
  deleteUserNode,
  setAdminNodeHidden,
} from "@/lib/user-syllabus.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronRight, RotateCcw, Link as LinkIcon, StickyNote, Filter,
  Plus, Pencil, Trash2, Eye, EyeOff, Sparkles,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/syllabus")({
  head: () => ({
    meta: [
      { title: "Syllabus — Cadence" },
      { name: "description", content: "Manage your entire syllabus tree with granular progress and reset controls." },
    ],
  }),
  component: SyllabusPage,
});

const CHILD_TYPE: Record<number, NodeType | null> = {
  0: "chapter",
  1: "topic",
  2: "subtopic",
  3: null,
};

type NodeEdit =
  | { mode: "add"; parent: SyllabusNode; childType: NodeType; childDepth: number }
  | { mode: "edit"; node: SyllabusNode };

function SyllabusPage() {
  const { tree } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [showHidden, setShowHidden] = useState(false);
  const [edit, setEdit] = useState<NodeEdit | null>(null);

  const subjects = tree.map((n) => ({ id: n.id, title: n.title }));
  const chapters = (
    subjectFilter === "all" ? tree : tree.filter((n) => n.id === subjectFilter)
  ).flatMap((s) => (s.children ?? []).map((c) => ({ id: c.id, title: c.title })));

  const scopedTree: SyllabusNode[] = (() => {
    const walk = (list: SyllabusNode[]): SyllabusNode[] => {
      const out: SyllabusNode[] = [];
      for (const n of list) {
        if (!showHidden && n.hidden) continue;
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
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Syllabus</h1>
          <p className="text-muted-foreground mt-1">Add your own chapters, topics, or subtopics — or hide the ones you won't study.</p>
        </div>
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
        <div className="ml-auto flex items-center gap-2 text-xs">
          <Switch checked={showHidden} onCheckedChange={setShowHidden} id="show-hidden" />
          <Label htmlFor="show-hidden" className="text-xs font-medium cursor-pointer">Show hidden</Label>
        </div>
      </div>

      <div className="glass-strong rounded-3xl p-3 sm:p-4 lg:p-6">
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="space-y-2 min-w-[320px]">
            {scopedTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                onOpen={setOpenId}
                onEdit={setEdit}
              />
            ))}
          </div>
        </div>
      </div>

      <NodeDrawer openId={openId} onClose={() => setOpenId(null)} />
      <NodeEditDialog edit={edit} onClose={() => setEdit(null)} />
    </AppShell>
  );
}

function TreeNode({
  node, depth, onOpen, onEdit,
}: {
  node: SyllabusNode;
  depth: number;
  onOpen: (id: string) => void;
  onEdit: (e: NodeEdit) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const { resetNode, refreshUserOverrides } = useStore();
  const hideFn = useServerFn(setAdminNodeHidden);
  const delFn = useServerFn(deleteUserNode);

  const childType = CHILD_TYPE[node.depth];
  const canAddChild = childType !== null;
  const isUserNode = node.kind === "user";
  const canHide = node.kind === "admin" && node.depth > 0; // subjects can't be hidden

  const handleAddChild = () => {
    if (!childType) return;
    onEdit({ mode: "add", parent: node, childType, childDepth: node.depth + 1 });
  };

  const handleToggleHidden = async () => {
    try {
      await hideFn({ data: { nodeId: node.id, hidden: !node.hidden } });
      await refreshUserOverrides();
      toast.success(node.hidden ? "Unhidden" : "Hidden from your syllabus");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const handleDelete = async () => {
    try {
      await delFn({ data: { id: node.id } });
      await refreshUserOverrides();
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    }
  };

  return (
    <div>
      <div
        className={cn(
          "group flex items-start gap-2 rounded-2xl px-2 sm:px-3 py-2.5 transition-all min-w-0",
          "hover:bg-white/50 cursor-pointer",
          node.excluded && "opacity-40",
          node.hidden && "opacity-50",
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
          {isUserNode && (
            <span className="inline-flex items-center gap-1 ml-2 text-[9px] uppercase tracking-wider bg-lavender/60 text-foreground/70 rounded-full px-1.5 py-0.5 align-middle">
              <Sparkles className="h-2.5 w-2.5" /> yours
            </span>
          )}
          {node.hidden && (
            <span className="ml-2 text-[9px] uppercase tracking-wider bg-white/60 text-muted-foreground rounded-full px-1.5 py-0.5 align-middle">
              hidden
            </span>
          )}
        </button>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center">
          {node.type}
        </span>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
          {canAddChild && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAddChild(); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-mint/60 text-foreground/60 hover:text-foreground transition-all"
              aria-label={`Add ${childType}`}
              title={`Add ${childType}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {isUserNode && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit({ mode: "edit", node }); }}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-sky/60 text-foreground/60 hover:text-foreground transition-all"
                aria-label="Edit"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-blush/60 text-foreground/60 hover:text-foreground transition-all"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-strong">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{node.title}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the node and every child you added under it. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="rounded-full bg-blush text-foreground hover:bg-blush/80">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {canHide && (
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleHidden(); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/70 text-foreground/60 hover:text-foreground transition-all"
              aria-label={node.hidden ? "Unhide" : "Hide"}
              title={node.hidden ? "Unhide" : "Hide from my syllabus"}
            >
              {node.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          )}
          <ResetButton nodeTitle={node.title} onConfirm={() => resetNode(node.id)} />
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="space-y-1 mt-1">
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} onOpen={onOpen} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeEditDialog({ edit, onClose }: { edit: NodeEdit | null; onClose: () => void }) {
  const { user } = useAuth();
  const { refreshUserOverrides } = useStore();
  const addFn = useServerFn(addUserNode);
  const updFn = useServerFn(updateUserNode);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync title when edit changes
  const open = edit !== null;

  useEffect(() => {
    if (edit?.mode === "edit") setTitle(edit.node.title);
    else if (edit?.mode === "add") setTitle("");
  }, [edit]);


  const handleSave = async () => {
    if (!edit) return;
    const t = title.trim();
    if (!t) { toast.error("Enter a title"); return; }
    setSaving(true);
    try {
      if (edit.mode === "add") {
        if (!user?.targetExamId) throw new Error("No exam selected");
        await addFn({
          data: {
            examId: user.targetExamId,
            parentKind: edit.parent.kind,
            parentId: edit.parent.id,
            title: t,
            nodeType: edit.childType,
            depth: edit.childDepth,
          },
        });
        toast.success(`Added ${edit.childType}`);
      } else {
        await updFn({ data: { id: edit.node.id, title: t } });
        toast.success("Renamed");
      }
      await refreshUserOverrides();
      setTitle("");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
    setSaving(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) { setTitle(""); onClose(); } }}
    >
      <DialogContent className="glass-strong">
        <DialogHeader>
          <DialogTitle>
            {edit?.mode === "add"
              ? `Add ${edit.childType} under "${edit.parent.title}"`
              : `Rename "${edit?.mode === "edit" ? edit.node.title : ""}"`}
          </DialogTitle>
          <DialogDescription>
            {edit?.mode === "add"
              ? "Only you will see this — it lives in your personal syllabus."
              : "Update the title of your custom node."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="node-title" className="text-xs">Title</Label>
          <Input
            id="node-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !saving) handleSave(); }}
            placeholder={edit?.mode === "add" ? `New ${edit.childType}` : "Title"}
            className="bg-white/60 border-white/60 rounded-xl"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => { setTitle(""); onClose(); }}>
            Cancel
          </Button>
          <Button className="rounded-full" onClick={handleSave} disabled={saving || !title.trim()}>
            {edit?.mode === "add" ? "Add" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetButton({ nodeTitle, onConfirm }: { nodeTitle: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-blush/60 text-foreground/60 hover:text-foreground transition-all shrink-0"
          onClick={(e) => e.stopPropagation()}
          aria-label="Reset progress"
          title="Reset progress"
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
