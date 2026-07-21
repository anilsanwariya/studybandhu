import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { mockSyllabus, type SyllabusNode, type Status } from "./mock-syllabus";

interface StoreState {
  tree: SyllabusNode[];
  bucket: string[]; // topic ids
  dailyLimit: number;
  streak: number;
  xp: number;
}

interface StoreCtx extends StoreState {
  flatTopics: SyllabusNode[];
  newTargets: SyllabusNode[];
  dueToday: SyllabusNode[];
  bucketNodes: SyllabusNode[];
  addToBucket: (id: string) => void;
  removeFromBucket: (id: string) => void;
  updateNode: (id: string, patch: Partial<SyllabusNode>) => void;
  resetNode: (id: string) => void;
  rateTopic: (id: string, rating: "hard" | "medium" | "easy" | "push") => void;
  findNode: (id: string) => SyllabusNode | undefined;
}

const StoreContext = createContext<StoreCtx | null>(null);

function walk(nodes: SyllabusNode[], fn: (n: SyllabusNode, parents: SyllabusNode[]) => void, parents: SyllabusNode[] = []) {
  for (const n of nodes) {
    fn(n, parents);
    if (n.children) walk(n.children, fn, [...parents, n]);
  }
}

function mapTree(nodes: SyllabusNode[], fn: (n: SyllabusNode) => SyllabusNode): SyllabusNode[] {
  return nodes.map((n) => {
    const next = fn(n);
    return next.children ? { ...next, children: mapTree(next.children, fn) } : next;
  });
}

function resetSubtree(node: SyllabusNode): SyllabusNode {
  const next: SyllabusNode = { ...node, status: "unread", dueToday: false };
  if (node.children) next.children = node.children.map(resetSubtree);
  return next;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tree, setTree] = useState<SyllabusNode[]>(mockSyllabus);
  const [bucket, setBucket] = useState<string[]>([]);
  const [streak] = useState(7);
  const [xp, setXp] = useState(1240);
  const dailyLimit = 7;

  const flatTopics = useMemo(() => {
    const list: SyllabusNode[] = [];
    walk(tree, (n) => {
      if ((n.type === "topic" || n.type === "subtopic") && !n.excluded) list.push(n);
    });
    return list;
  }, [tree]);

  const newTargets = flatTopics.filter((n) => n.status === "unread");
  const dueToday = flatTopics.filter((n) => n.dueToday && n.status !== "unread");
  const bucketNodes = bucket.map((id) => flatTopics.find((n) => n.id === id)).filter(Boolean) as SyllabusNode[];

  const findNode = useCallback((id: string) => {
    let found: SyllabusNode | undefined;
    walk(tree, (n) => { if (n.id === id) found = n; });
    return found;
  }, [tree]);

  const addToBucket = useCallback((id: string) => {
    setBucket((b) => (b.includes(id) || b.length >= dailyLimit ? b : [...b, id]));
  }, []);

  const removeFromBucket = useCallback((id: string) => {
    setBucket((b) => b.filter((x) => x !== id));
  }, []);

  const updateNode = useCallback((id: string, patch: Partial<SyllabusNode>) => {
    setTree((t) => mapTree(t, (n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const resetNode = useCallback((id: string) => {
    setTree((t) => mapTree(t, (n) => (n.id === id ? resetSubtree(n) : n)));
    setBucket((b) => b.filter((x) => x !== id));
  }, []);

  const rateTopic = useCallback((id: string, rating: "hard" | "medium" | "easy" | "push") => {
    let newStatus: Status = "first-read";
    let dueToday = false;
    if (rating === "hard") { newStatus = "needs-revision"; dueToday = true; }
    else if (rating === "medium") { newStatus = "first-read"; }
    else if (rating === "easy") { newStatus = "mastered"; }
    else if (rating === "push") { dueToday = true; }
    setTree((t) => mapTree(t, (n) => (n.id === id ? { ...n, status: rating === "push" ? n.status : newStatus, dueToday } : n)));
    if (rating !== "push") {
      setBucket((b) => b.filter((x) => x !== id));
      setXp((x) => x + (rating === "easy" ? 20 : rating === "medium" ? 15 : 10));
    }
  }, []);

  const value: StoreCtx = {
    tree, bucket, dailyLimit, streak, xp,
    flatTopics, newTargets, dueToday, bucketNodes,
    addToBucket, removeFromBucket, updateNode, resetNode, rateTopic, findNode,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export const statusMeta: Record<Status, { label: string; dot: string; text: string }> = {
  unread: { label: "Unread", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
  "first-read": { label: "First Read", dot: "bg-lavender", text: "text-foreground" },
  "needs-revision": { label: "Needs Revision", dot: "bg-peach", text: "text-foreground" },
  mastered: { label: "Mastered", dot: "bg-mint", text: "text-foreground" },
};
