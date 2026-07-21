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


function SchemaEditor({ schema, onChange }: { schema: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-xs font-semibold text-muted-foreground mb-2">Hierarchy levels (top → bottom)</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {schema.map((label, i) => (
          <span key={`${label}-${i}`} className="inline-flex items-center gap-1 bg-white/70 rounded-full px-2.5 py-1 text-xs font-medium">
            <span className="text-muted-foreground">L{i}</span>
            {label}
            <button className="ml-1 h-4 w-4 rounded-full hover:bg-destructive/20 hover:text-destructive flex items-center justify-center" onClick={() => onChange(schema.filter((_, idx) => idx !== i))} aria-label={`Remove ${label}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onChange([...schema, draft.trim().toLowerCase()]);
              setDraft("");
            }
          }}
          placeholder="Add level (e.g. paper)"
          className="h-8 bg-white/60 border-white/70 rounded-lg text-xs"
        />
        <Button size="sm" variant="outline" className="rounded-full h-8 bg-white/60" onClick={() => { if (draft.trim()) { onChange([...schema, draft.trim().toLowerCase()]); setDraft(""); } }}>
          Add
        </Button>
      </div>
    </div>
  );
}

function ExamEditor({ exam, onChange }: { exam: Exam; onChange: () => void }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const parseFn = useServerFn(parseSyllabusPdf);
  const schema = SCHEMA as unknown as string[];

  const loadTree = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("syllabus_nodes").select("id, parent_id, title, node_type, sort_order, depth").eq("exam_id", exam.id).order("sort_order");
    const rows = (data as DbNode[]) ?? [];
    const byParent = new Map<string | null, TreeNode[]>();
    const nodes: TreeNode[] = rows.map((r) => ({ ...r, children: [] }));
    for (const n of nodes) {
      const arr = byParent.get(n.parent_id) ?? [];
      arr.push(n);
      byParent.set(n.parent_id, arr);
    }
    for (const n of nodes) n.children = byParent.get(n.id) ?? [];
    setTree(byParent.get(null) ?? []);
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
      const result = await parseFn({ data: { fileBase64: base64, mimeType: file.type || "application/pdf", hint: `Exam: ${exam.name}` } });
      const flat = flattenAi(result.nodes ?? [], schema, 0);
      setTree(flat);
      toast.success(`Parsed ${countAll(flat)} items. Review and save.`);
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
    let arr = clone;
    for (let i = 0; i < path.length - 1; i++) arr = arr[path[i]].children;
    const idx = path[path.length - 1];
    const res = mut(arr[idx]);
    if (res === null) arr.splice(idx, 1);
    else arr[idx] = res;
    setTree(clone);
  };

  const addChild = (path: number[] | null, depth: number) => {
    const label = schema[depth] ?? `L${depth}`;
    const node: TreeNode = { id: crypto.randomUUID(), parent_id: null, title: `New ${label}`, node_type: label, sort_order: 0, depth, children: [] };
    if (!path) { setTree([...tree, node]); return; }
    updateNodeAt(path, (n) => ({ ...n, children: [...n.children, node] }));
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

      {loading ? (
        <div className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
      ) : (
        <>
          <div className="overflow-x-auto -mx-6 px-6">
            <div className="space-y-2 min-w-[520px]">
              {tree.map((n, i) => <NodeRow key={n.id} node={n} path={[i]} schema={schema} onUpdate={updateNodeAt} onAdd={addChild} />)}
            </div>
          </div>
          <Button variant="outline" className="rounded-full bg-white/60 mt-4 gap-1.5" onClick={() => addChild(null, 0)}>
            <Plus className="h-3.5 w-3.5" /> Add {schema[0]}
          </Button>
          <p className="text-xs text-muted-foreground mt-6">Tip: Upload a syllabus PDF to auto-fill Subject &rsaquo; Chapter &rsaquo; Topic &rsaquo; Subtopic. Review, edit, then Save.</p>
        </>
      )}
    </div>
  );
}


function NodeRow({ node, path, schema, onUpdate, onAdd }: {
  node: TreeNode;
  path: number[];
  schema: string[];
  onUpdate: (path: number[], mut: (n: TreeNode) => TreeNode | null) => void;
  onAdd: (path: number[], depth: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const depth = path.length - 1;
  const childDepth = depth + 1;
  const canAddChild = childDepth < schema.length;
  const label = schema[depth] ?? node.node_type;
  const indent = depth * 16;
  return (
    <div>
      <div className="glass rounded-2xl px-3 py-2 flex items-center gap-2" style={{ marginLeft: indent }}>
        <button onClick={() => setOpen(!open)} className="h-6 w-6 rounded-md hover:bg-white/60 flex items-center justify-center shrink-0">
          {node.children.length > 0 ? (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
        </button>
        <span className="text-[10px] uppercase text-muted-foreground font-semibold shrink-0 w-20 truncate">{label}</span>
        <Input value={node.title} onChange={(e) => onUpdate(path, (n) => ({ ...n, title: e.target.value }))} className="h-8 bg-white/60 border-white/70 rounded-lg text-sm" />
        {canAddChild && (
          <Button size="sm" variant="ghost" className="rounded-full h-8 gap-1" onClick={() => onAdd(path, childDepth)}>
            <Plus className="h-3 w-3" /> {schema[childDepth]}
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => onUpdate(path, () => null)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open && node.children.map((c, i) => (
        <NodeRow key={c.id} node={c} path={[...path, i]} schema={schema} onUpdate={onUpdate} onAdd={onAdd} />
      ))}
    </div>
  );
}

function flattenAi(nodes: any[], schema: string[], depth: number): TreeNode[] {
  return nodes.map((n, i) => {
    const label = schema[depth] ?? String(n.type ?? `L${depth}`);
    return {
      id: crypto.randomUUID(),
      parent_id: null,
      title: String(n.title ?? "Untitled"),
      node_type: label,
      sort_order: i,
      depth,
      children: Array.isArray(n.children) ? flattenAi(n.children, schema, depth + 1) : [],
    };
  });
}
function countAll(nodes: TreeNode[]): number {
  return nodes.reduce((s, n) => s + 1 + countAll(n.children), 0);
}
