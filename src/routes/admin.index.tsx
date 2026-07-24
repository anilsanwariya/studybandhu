import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { parseSyllabusPdf } from "@/lib/syllabus-ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, LogOut, ChevronRight, ChevronDown, Trash2, Save, FilePlus, Eye, EyeOff, Sparkles, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — StudyBandhu" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminPanel,
});

interface Exam {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_published: boolean;
}
interface DbNode {
  id: string;
  parent_id: string | null;
  title: string;
  node_type: string;
  sort_order: number;
  depth: number;
  stages: string[];
}
interface TreeNode extends DbNode {
  children: TreeNode[];
}

const SCHEMA = ["subject", "chapter", "topic", "subtopic"] as const;

function AdminPanel() {
  const nav = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.isAdmin) { nav({ to: "/admin/login" }); return; }
    reloadExams();
  }, [user, loading]);

  const reloadExams = async () => {
    const { data } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
    setExams(((data as any[]) ?? []) as Exam[]);
  };

  if (loading || !user?.isAdmin) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const current = exams.find((e) => e.id === selected);

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <header className="glass-strong rounded-3xl p-5 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Console</h1>
          <p className="text-xs text-muted-foreground">Manage exams and syllabi</p>
        </div>
        <div className="flex gap-2">
          <Link to="/"><Button variant="outline" className="rounded-full bg-white/60">Back to app</Button></Link>
          <Button variant="outline" className="rounded-full bg-white/60 gap-2" onClick={() => signOut().then(() => nav({ to: "/admin/login" }))}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <aside className="glass-strong rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Exams</h2>
            <Button size="sm" className="rounded-full gap-1.5" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5" /> New</Button>
          </div>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {exams.length === 0 && <p className="text-xs text-muted-foreground">No exams yet. Create one to begin.</p>}
            {exams.map((e) => (
              <button key={e.id} onClick={() => setSelected(e.id)} className={`w-full glass rounded-2xl px-3 py-2.5 text-left transition-all ${selected === e.id ? "bg-white/80 border-primary/50 ring-1 ring-primary/30" : "hover:bg-white/60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">{e.name}</span>
                  {e.is_published ? <Eye className="h-3.5 w-3.5 text-emerald-600" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{SCHEMA.join(" > ")}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="glass-strong rounded-3xl p-6">
          {!current ? (
            <div className="text-center py-20 text-muted-foreground">
              <FilePlus className="h-8 w-8 mx-auto mb-2" />
              <p>Select an exam or create a new one.</p>
            </div>
          ) : (
            <ExamEditor exam={current} onChange={reloadExams} />
          )}
        </main>
      </div>

      <NewExamDialog open={showNew} onOpenChange={setShowNew} onCreated={async (id) => { await reloadExams(); setSelected(id); }} />
    </div>
  );
}

function NewExamDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void; }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name || !slug) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("exams")
      .insert({ name, slug: slug.toLowerCase().replace(/\s+/g, "-"), description } as any)
      .select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Exam created");
    onCreated(data.id);
    setName(""); setSlug(""); setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/60 rounded-3xl">
        <DialogHeader><DialogTitle>Create exam</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-")); }} placeholder="UPSC CSE" className="bg-white/60 border-white/70 rounded-xl" /></div>
          <div className="space-y-1.5"><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="upsc-cse" className="bg-white/60 border-white/70 rounded-xl" /></div>
          <div className="glass rounded-xl px-3 py-2 text-[11px] text-muted-foreground">
            Every exam uses the fixed hierarchy: <span className="font-semibold text-foreground">Subject &rsaquo; Chapter &rsaquo; Topic &rsaquo; Subtopic</span>.
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-white/60 border-white/70 rounded-xl" /></div>
          <Button onClick={submit} disabled={busy || !name || !slug} className="w-full rounded-full">{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}



function ExamEditor({ exam, onChange }: { exam: Exam; onChange: () => void }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploadStage, setUploadStage] = useState<"prelims" | "mains" | "both">("prelims");
  const [appendMode, setAppendMode] = useState(true);
  const parseFn = useServerFn(parseSyllabusPdf);
  const schema = SCHEMA as unknown as string[];

  const loadTree = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("syllabus_nodes").select("id, parent_id, title, node_type, sort_order, depth, stages").eq("exam_id", exam.id).order("sort_order");
    const rows = ((data as any[]) ?? []) as DbNode[];
    const byParent = new Map<string | null, TreeNode[]>();
    const nodes: TreeNode[] = rows.map((r) => ({ ...r, stages: r.stages ?? [], children: [] }));
    for (const n of nodes) {
      const arr = byParent.get(n.parent_id) ?? [];
      arr.push(n);
      byParent.set(n.parent_id, arr);
    }
    for (const n of nodes) n.children = byParent.get(n.id) ?? [];
    setTree(byParent.get(null) ?? []);
    setSelectedIds(new Set());
    setLoading(false);
  }, [exam.id]);

  useEffect(() => { loadTree(); }, [loadTree]);

  const togglePublish = async () => {
    const { error } = await supabase.from("exams").update({ is_published: !exam.is_published }).eq("id", exam.id);
    if (error) toast.error(error.message);
    else { toast.success(!exam.is_published ? "Published" : "Unpublished"); onChange(); }
  };

  const deleteExam = async () => {
    if (!confirm(`Delete "${exam.name}" and all its syllabus?`)) return;
    const { error } = await supabase.from("exams").delete().eq("id", exam.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); onChange(); }
  };

  const handlePdf = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) { toast.error("PDF too large (max 15MB)"); return; }
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
      const base64 = btoa(binary);
      const result = await parseFn({ data: { fileBase64: base64, mimeType: file.type || "application/pdf", hint: `Exam: ${exam.name}`, stage: uploadStage } });
      const topicStages = uploadStage === "both" ? ["prelims", "mains"] : [uploadStage];
      const parsed = flattenAi(result.nodes ?? [], schema, 0, topicStages);
      const next = appendMode && tree.length > 0 ? mergeTrees(tree, parsed) : parsed;
      setTree(next);
      toast.success(`Parsed ${countAll(parsed)} items (${uploadStage}). ${appendMode ? "Merged with existing." : "Replaced tree."} Review and save.`);
    } catch (e: any) {
      toast.error(e.message ?? "Parse failed");
    }
    setParsing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await supabase.from("syllabus_nodes").delete().eq("exam_id", exam.id);
      const rows: any[] = [];
      const walk = (nodes: TreeNode[], parentId: string | null, depth: number) => {
        nodes.forEach((n, i) => {
          const id = crypto.randomUUID();
          rows.push({
            id,
            exam_id: exam.id,
            parent_id: parentId,
            title: n.title,
            node_type: schema[depth] ?? n.node_type,
            sort_order: i,
            depth,
            stages: depth === 2 ? (n.stages ?? []) : [],
          });
          walk(n.children, id, depth + 1);
        });
      };
      walk(tree, null, 0);
      if (rows.length > 0) {
        const { error } = await supabase.from("syllabus_nodes").insert(rows);
        if (error) throw error;
      }
      toast.success("Saved");
      loadTree();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
    setSaving(false);
  };

  const updateNodeAt = (path: number[], mut: (n: TreeNode) => TreeNode | null) => {
    const clone = structuredClone(tree) as TreeNode[];
    const removed: string[] = [];
    let arr = clone;
    for (let i = 0; i < path.length - 1; i++) arr = arr[path[i]].children;
    const idx = path[path.length - 1];
    const res = mut(arr[idx]);
    if (res === null) {
      collectIds(arr[idx], removed);
      arr.splice(idx, 1);
    } else arr[idx] = res;
    setTree(clone);
    if (removed.length) {
      setSelectedIds((s) => {
        const next = new Set(s);
        removed.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const addChild = (path: number[] | null, depth: number) => {
    const label = schema[depth] ?? `L${depth}`;
    const node: TreeNode = { id: crypto.randomUUID(), parent_id: null, title: `New ${label}`, node_type: label, sort_order: 0, depth, stages: [], children: [] };
    if (!path) { setTree([...tree, node]); return; }
    updateNodeAt(path, (n) => ({ ...n, children: [...n.children, node] }));
  };

  // ---- Level change (single) ----
  const changeLevelAt = (path: number[], newDepth: number): { ok: boolean; reason?: string } => {
    if (newDepth < 0 || newDepth >= schema.length) return { ok: false, reason: "Invalid level" };
    const clone = structuredClone(tree) as TreeNode[];
    const node = getAt(clone, path);
    if (!node) return { ok: false, reason: "Not found" };
    const oldDepth = path.length - 1;
    if (oldDepth === newDepth) return { ok: true };
    const maxSubDepth = maxDepthOf(node, oldDepth);
    const delta = newDepth - oldDepth;
    if (maxSubDepth + delta > schema.length - 1) return { ok: false, reason: "Would exceed subtopic level" };

    // Remove node from current position
    const parentArr = getParentArr(clone, path);
    const idx = path[path.length - 1];
    parentArr.splice(idx, 1);

    // Find new insertion location
    if (newDepth < oldDepth) {
      // Promote: place after the ancestor at depth newDepth in its parent array.
      // The ancestor node is at path.slice(0, newDepth+1) — but we've removed the node, and it's a sibling chain up.
      // We insert right after the ancestor that used to contain it at depth newDepth.
      const ancestorPath = path.slice(0, newDepth + 1);
      const targetParentArr = getParentArr(clone, ancestorPath);
      const ancestorIdx = ancestorPath[ancestorPath.length - 1];
      targetParentArr.splice(ancestorIdx + 1, 0, node);
    } else {
      // Demote: place as first child of the previous sibling at oldDepth if it exists AND schema allows,
      // walking down to depth newDepth-1 via last-child chain, creating no intermediates.
      // Simpler: previous sibling must exist and have a descendant chain reaching depth newDepth-1.
      const prevIdx = idx - 1;
      if (prevIdx < 0) return revert();
      let cursor: TreeNode = parentArr[prevIdx];
      let cursorDepth = oldDepth;
      while (cursorDepth < newDepth - 1) {
        if (cursor.children.length === 0) return revert();
        cursor = cursor.children[cursor.children.length - 1];
        cursorDepth++;
      }
      cursor.children.push(node);
    }

    rewriteDepths(node, newDepth, schema);
    setTree(clone);
    return { ok: true };

    function revert() {
      return { ok: false, reason: "No valid parent at target level — add one first" };
    }
  };

  // ---- Delete with cascade-promote ----
  const deleteAndPromoteAt = (path: number[]) => {
    const clone = structuredClone(tree) as TreeNode[];
    const node = getAt(clone, path);
    if (!node) return;
    const parentArr = getParentArr(clone, path);
    const idx = path[path.length - 1];
    const nodeDepth = path.length - 1;
    const children = node.children;
    // Promote each child to node's depth
    children.forEach((c) => rewriteDepths(c, nodeDepth, schema));
    parentArr.splice(idx, 1, ...children);
    setTree(clone);
    const removed: string[] = [node.id];
    setSelectedIds((s) => {
      const next = new Set(s);
      removed.forEach((id) => next.delete(id));
      return next;
    });
  };

  // ---- Selection helpers ----
  const toggleSelect = (id: string, subtree: boolean, node: TreeNode) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const ids: string[] = [];
      if (subtree) collectIds(node, ids);
      else ids.push(id);
      const willAdd = !next.has(id);
      ids.forEach((x) => (willAdd ? next.add(x) : next.delete(x)));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const bulkChangeLevel = (newDepth: number) => {
    // Build snapshot of paths for currently selected ids, deepest first
    const paths = pathsForIds(tree, selectedIds);
    // For deepest-first when promoting, shallowest-first when demoting — keep it simple: shallowest-first for promote, deepest-first for demote.
    // Safer: process one at a time, recomputing paths from a working tree.
    let working = structuredClone(tree) as TreeNode[];
    let changed = 0, skipped = 0;
    const order = [...paths.entries()].sort((a, b) => a[1].length - b[1].length);
    // Rebuild after each op by finding node id in working tree
    for (const [id] of order) {
      const p = findPathById(working, id);
      if (!p) { skipped++; continue; }
      const res = tryChangeLevel(working, p, newDepth, schema);
      if (res.ok && res.tree) { working = res.tree; changed++; } else skipped++;
    }
    setTree(working);
    toast.success(`${changed} changed${skipped ? `, ${skipped} skipped` : ""}`);
    clearSelection();
  };

  const bulkDelete = () => {
    if (!confirm(`Delete ${selectedIds.size} item(s)? Children will be promoted up.`)) return;
    let working = structuredClone(tree) as TreeNode[];
    // Deepest first
    const ids = [...selectedIds];
    const withDepth = ids.map((id) => ({ id, d: (findPathById(working, id)?.length ?? 0) - 1 }));
    withDepth.sort((a, b) => b.d - a.d);
    for (const { id } of withDepth) {
      const p = findPathById(working, id);
      if (!p) continue;
      working = applyDeletePromote(working, p, schema);
    }
    setTree(working);
    toast.success("Deleted");
    clearSelection();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold">{exam.name}</h2>
          <p className="text-xs text-muted-foreground">{exam.description || exam.slug}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
            {schema.join(" › ")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="inline-flex">
            <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && handlePdf(e.target.files[0])} />
            <Button variant="outline" className="rounded-full bg-white/60 gap-2 cursor-pointer" asChild disabled={parsing}>
              <span>{parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} AI Parse PDF</span>
            </Button>
          </label>
          <Button variant="outline" className="rounded-full bg-white/60 gap-2" onClick={togglePublish}>
            {exam.is_published ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish</>}
          </Button>
          <Button variant="outline" className="rounded-full bg-white/60 gap-2 hover:bg-destructive/10 hover:text-destructive" onClick={deleteExam}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button className="rounded-full gap-2" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save syllabus
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="glass-strong rounded-2xl px-4 py-2.5 mb-3 flex flex-wrap items-center gap-2 border border-primary/30">
          <span className="text-sm font-semibold">{selectedIds.size} selected</span>
          <span className="text-xs text-muted-foreground mr-2">Change level to:</span>
          {schema.map((lbl, d) => (
            <Button key={d} size="sm" variant="outline" className="rounded-full h-7 bg-white/60 capitalize" onClick={() => bulkChangeLevel(d)}>
              {lbl}
            </Button>
          ))}
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="rounded-full h-7 bg-white/60 gap-1 hover:bg-destructive/10 hover:text-destructive" onClick={bulkDelete}>
            <Trash2 className="h-3 w-3" /> Delete selected
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full h-7 gap-1" onClick={clearSelection}>
            <X className="h-3 w-3" /> Clear
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-6 px-6">
            <div className="space-y-2 min-w-[620px]">
              {tree.map((n, i) => (
                <NodeRow
                  key={n.id}
                  node={n}
                  path={[i]}
                  schema={schema}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onUpdate={updateNodeAt}
                  onAdd={addChild}
                  onDelete={deleteAndPromoteAt}
                  onChangeLevel={(p, d) => {
                    const r = changeLevelAt(p, d);
                    if (!r.ok) toast.error(r.reason ?? "Can't change level");
                  }}
                />
              ))}
            </div>
          </div>
          <Button variant="outline" className="rounded-full bg-white/60 mt-4 gap-1.5" onClick={() => addChild(null, 0)}>
            <Plus className="h-3.5 w-3.5" /> Add {schema[0]}
          </Button>
          <p className="text-xs text-muted-foreground mt-6">Tip: Change a row's level with the dropdown. Deleting a row promotes its children up one level. Shift-click a checkbox to select the whole subtree.</p>
        </>
      )}
    </div>
  );
}


function NodeRow({ node, path, schema, selectedIds, onToggleSelect, onUpdate, onAdd, onDelete, onChangeLevel }: {
  node: TreeNode;
  path: number[];
  schema: string[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string, subtree: boolean, node: TreeNode) => void;
  onUpdate: (path: number[], mut: (n: TreeNode) => TreeNode | null) => void;
  onAdd: (path: number[], depth: number) => void;
  onDelete: (path: number[]) => void;
  onChangeLevel: (path: number[], depth: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const depth = path.length - 1;
  const childDepth = depth + 1;
  const canAddChild = childDepth < schema.length;
  const label = schema[depth] ?? node.node_type;
  const indent = depth * 16;
  const isSelected = selectedIds.has(node.id);
  return (
    <div>
      <div className={`glass rounded-2xl px-3 py-2 flex items-center gap-2 ${isSelected ? "ring-1 ring-primary/50 bg-white/70" : ""}`} style={{ marginLeft: indent }}>
        <span
          className="shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(node.id, e.shiftKey, node); }}
          title="Click to select. Shift-click for whole subtree."
        >
          <Checkbox checked={isSelected} onCheckedChange={() => {}} className="pointer-events-none" />
        </span>
        <button onClick={() => setOpen(!open)} className="h-6 w-6 rounded-md hover:bg-white/60 flex items-center justify-center shrink-0">
          {node.children.length > 0 ? (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
        </button>
        <Select value={String(depth)} onValueChange={(v) => onChangeLevel(path, Number(v))}>
          <SelectTrigger className="h-7 w-[104px] bg-white/60 border-white/70 rounded-lg text-[10px] uppercase font-semibold shrink-0">
            <SelectValue placeholder={label} />
          </SelectTrigger>
          <SelectContent>
            {schema.map((lbl, d) => (
              <SelectItem key={d} value={String(d)} className="capitalize text-xs">{lbl}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={node.title} onChange={(e) => onUpdate(path, (n) => ({ ...n, title: e.target.value }))} className="h-8 bg-white/60 border-white/70 rounded-lg text-sm" />
        {canAddChild && (
          <Button size="sm" variant="ghost" className="rounded-full h-8 gap-1" onClick={() => onAdd(path, childDepth)}>
            <Plus className="h-3 w-3" /> {schema[childDepth]}
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(path)} title="Delete (children promote up)">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open && node.children.map((c, i) => (
        <NodeRow key={c.id} node={c} path={[...path, i]} schema={schema} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onUpdate={onUpdate} onAdd={onAdd} onDelete={onDelete} onChangeLevel={onChangeLevel} />
      ))}
    </div>
  );
}

function flattenAi(nodes: any[], schema: string[], depth: number, topicStages: string[]): TreeNode[] {
  return nodes.map((n, i) => {
    const label = schema[depth] ?? String(n.type ?? `L${depth}`);
    return {
      id: crypto.randomUUID(),
      parent_id: null,
      title: String(n.title ?? "Untitled"),
      node_type: label,
      sort_order: i,
      depth,
      stages: depth === 2 ? [...topicStages] : [],
      children: Array.isArray(n.children) ? flattenAi(n.children, schema, depth + 1, topicStages) : [],
    };
  });
}

function mergeTrees(existing: TreeNode[], incoming: TreeNode[]): TreeNode[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const byTitle = new Map(existing.map((n) => [norm(n.title), n]));
  const out: TreeNode[] = existing.map((n) => ({ ...n, children: [...n.children] }));
  for (const inc of incoming) {
    const match = byTitle.get(norm(inc.title));
    if (!match) {
      out.push(inc);
    } else {
      // Union stages on topics
      if (match.depth === 2) {
        const set = new Set([...(match.stages ?? []), ...(inc.stages ?? [])]);
        match.stages = Array.from(set);
      }
      match.children = mergeTrees(match.children, inc.children);
    }
  }
  return out;
}
function countAll(nodes: TreeNode[]): number {
  return nodes.reduce((s, n) => s + 1 + countAll(n.children), 0);
}

// ---- Tree helpers ----
function getAt(tree: TreeNode[], path: number[]): TreeNode | null {
  let arr = tree;
  for (let i = 0; i < path.length - 1; i++) {
    const nxt = arr[path[i]];
    if (!nxt) return null;
    arr = nxt.children;
  }
  return arr[path[path.length - 1]] ?? null;
}
function getParentArr(tree: TreeNode[], path: number[]): TreeNode[] {
  let arr = tree;
  for (let i = 0; i < path.length - 1; i++) arr = arr[path[i]].children;
  return arr;
}
function maxDepthOf(node: TreeNode, baseDepth: number): number {
  let m = baseDepth;
  for (const c of node.children) m = Math.max(m, maxDepthOf(c, baseDepth + 1));
  return m;
}
function rewriteDepths(node: TreeNode, newDepth: number, schema: string[]) {
  node.depth = newDepth;
  node.node_type = schema[newDepth] ?? node.node_type;
  for (const c of node.children) rewriteDepths(c, newDepth + 1, schema);
}
function collectIds(node: TreeNode, acc: string[]) {
  acc.push(node.id);
  for (const c of node.children) collectIds(c, acc);
}
function findPathById(tree: TreeNode[], id: string, base: number[] = []): number[] | null {
  for (let i = 0; i < tree.length; i++) {
    const p = [...base, i];
    if (tree[i].id === id) return p;
    const r = findPathById(tree[i].children, id, p);
    if (r) return r;
  }
  return null;
}
function pathsForIds(tree: TreeNode[], ids: Set<string>): Map<string, number[]> {
  const out = new Map<string, number[]>();
  ids.forEach((id) => {
    const p = findPathById(tree, id);
    if (p) out.set(id, p);
  });
  return out;
}
function tryChangeLevel(tree: TreeNode[], path: number[], newDepth: number, schema: string[]): { ok: boolean; tree?: TreeNode[] } {
  if (newDepth < 0 || newDepth >= schema.length) return { ok: false };
  const clone = structuredClone(tree) as TreeNode[];
  const node = getAt(clone, path);
  if (!node) return { ok: false };
  const oldDepth = path.length - 1;
  if (oldDepth === newDepth) return { ok: true, tree: clone };
  const delta = newDepth - oldDepth;
  if (maxDepthOf(node, oldDepth) + delta > schema.length - 1) return { ok: false };
  const parentArr = getParentArr(clone, path);
  const idx = path[path.length - 1];
  parentArr.splice(idx, 1);
  if (newDepth < oldDepth) {
    const ancestorPath = path.slice(0, newDepth + 1);
    const targetParentArr = getParentArr(clone, ancestorPath);
    const ancestorIdx = ancestorPath[ancestorPath.length - 1];
    targetParentArr.splice(ancestorIdx + 1, 0, node);
  } else {
    const prevIdx = idx - 1;
    if (prevIdx < 0) return { ok: false };
    let cursor: TreeNode = parentArr[prevIdx];
    let cursorDepth = oldDepth;
    while (cursorDepth < newDepth - 1) {
      if (cursor.children.length === 0) return { ok: false };
      cursor = cursor.children[cursor.children.length - 1];
      cursorDepth++;
    }
    cursor.children.push(node);
  }
  rewriteDepths(node, newDepth, schema);
  return { ok: true, tree: clone };
}
function applyDeletePromote(tree: TreeNode[], path: number[], schema: string[]): TreeNode[] {
  const clone = structuredClone(tree) as TreeNode[];
  const node = getAt(clone, path);
  if (!node) return clone;
  const parentArr = getParentArr(clone, path);
  const idx = path[path.length - 1];
  const nodeDepth = path.length - 1;
  const children = node.children;
  children.forEach((c) => rewriteDepths(c, nodeDepth, schema));
  parentArr.splice(idx, 1, ...children);
  return clone;
}

