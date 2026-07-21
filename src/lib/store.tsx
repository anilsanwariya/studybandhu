import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { mockSyllabus, type SyllabusNode, type Status } from "./mock-syllabus";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { levelFromXp } from "./level";

interface StoreState {
  tree: SyllabusNode[];
  bucket: string[];
  dailyLimit: number;
  streak: number;
  xp: number;
}

export interface XpAward {
  id: number;
  amount: number;
  reason: string;
  level: number;
  rank: string;
  leveledUp: boolean;
  prevLevel: number;
}

interface StoreCtx extends StoreState {
  flatTopics: SyllabusNode[];
  newTargets: SyllabusNode[];
  dueToday: SyllabusNode[];
  bucketNodes: SyllabusNode[];
  lastAward: XpAward | null;
  clearAward: () => void;
  addToBucket: (id: string) => void;
  removeFromBucket: (id: string) => void;
  updateNode: (id: string, patch: Partial<SyllabusNode>) => void;
  resetNode: (id: string) => void;
  rateTopic: (id: string, rating: "hard" | "medium" | "easy" | "push") => void;
  scheduleRevision: (id: string, days: number) => void;
  awardXp: (amount: number, reason: string) => void;
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
  const next: SyllabusNode = { ...node, status: "unread", dueToday: false, revisionCount: 0, nextRevisionAt: null };
  if (node.children) next.children = node.children.map(resetSubtree);
  return next;
}

function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tree, setTree] = useState<SyllabusNode[]>(mockSyllabus);
  const [bucket, setBucket] = useState<string[]>([]);
  const [streak] = useState(7);
  const [xp, setXp] = useState(1240);
  const [lastAward, setLastAward] = useState<XpAward | null>(null);
  const awardCounter = useRef(0);
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

  const awardXp = useCallback((amount: number, reason: string) => {
    setXp((prev) => {
      const next = prev + amount;
      const prevInfo = levelFromXp(prev);
      const nextInfo = levelFromXp(next);
      awardCounter.current += 1;
      setLastAward({
        id: awardCounter.current,
        amount,
        reason,
        level: nextInfo.level,
        rank: nextInfo.rank,
        prevLevel: prevInfo.level,
        leveledUp: nextInfo.level > prevInfo.level,
      });
      return next;
    });
  }, []);

  const clearAward = useCallback(() => setLastAward(null), []);

  const rateTopic = useCallback((id: string, rating: "hard" | "medium" | "easy" | "push") => {
    let newStatus: Status = "first-read";
    let nextDue = false;
    let nextRevisionAt: string | null = null;
    if (rating === "hard") { newStatus = "needs-revision"; nextDue = true; nextRevisionAt = daysFromToday(1); }
    else if (rating === "medium") { newStatus = "first-read"; nextRevisionAt = daysFromToday(3); }
    else if (rating === "easy") { newStatus = "mastered"; nextRevisionAt = daysFromToday(7); }
    else if (rating === "push") { nextDue = true; }

    setTree((t) => mapTree(t, (n) => {
      if (n.id !== id) return n;
      if (rating === "push") return { ...n, dueToday: true };
      return {
        ...n,
        status: newStatus,
        dueToday: nextDue,
        nextRevisionAt,
        revisionCount: (n.revisionCount ?? 0) + 1,
      };
    }));

    if (rating !== "push") {
      setBucket((b) => b.filter((x) => x !== id));
      const gain = rating === "easy" ? 20 : rating === "medium" ? 15 : 10;
      awardXp(gain, `${rating[0].toUpperCase()}${rating.slice(1)} recall`);
    }
  }, [awardXp]);

  const scheduleRevision = useCallback((id: string, days: number) => {
    setTree((t) => mapTree(t, (n) => n.id === id ? {
      ...n,
      status: "needs-revision",
      dueToday: days === 0,
      nextRevisionAt: daysFromToday(days),
      revisionCount: (n.revisionCount ?? 0) + 1,
    } : n));
    setBucket((b) => b.filter((x) => x !== id));
    awardXp(12, `Scheduled in ${days}d`);
  }, [awardXp]);

  const value: StoreCtx = {
    tree, bucket, dailyLimit, streak, xp,
    flatTopics, newTargets, dueToday, bucketNodes,
    lastAward, clearAward,
    addToBucket, removeFromBucket, updateNode, resetNode, rateTopic, scheduleRevision, awardXp, findNode,
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
