import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SyllabusNode, Status } from "./mock-syllabus";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { levelFromXp } from "./level";

interface SyllabusDbRow {
  id: string;
  parent_id: string | null;
  title: string;
  node_type: string;
  sort_order: number;
  depth: number;
}


interface StoreState {
  tree: SyllabusNode[];
  syllabusLoading: boolean;
  levelSchema: string[];
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

function walk(
  nodes: SyllabusNode[],
  fn: (n: SyllabusNode, parents: SyllabusNode[]) => void,
  parents: SyllabusNode[] = [],
) {
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
  const next: SyllabusNode = {
    ...node,
    status: "unread",
    dueToday: false,
    revisionCount: 0,
    nextRevisionAt: null,
  };
  if (node.children) next.children = node.children.map(resetSubtree);
  return next;
}

function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tree, setTree] = useState<SyllabusNode[]>([]);
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [levelSchema, setLevelSchema] = useState<string[]>([]);

  // Load syllabus tree from DB when user has a target exam.
  useEffect(() => {
    const examId = user?.targetExamId;
    setBucket([]);
    if (!user || !examId) {
      setTree([]);
      setSyllabusLoading(false);
      return;
    }
    let cancelled = false;
    setSyllabusLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("syllabus_nodes")
        .select("id, parent_id, title, node_type, sort_order, depth")
        .eq("exam_id", examId)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });
      if (cancelled) return;
      setSyllabusLoading(false);
      if (error || !data || data.length === 0) {
        setTree([]);
        return;
      }
      // Curation is at the top two levels of whatever schema the exam defines:
      // depth 0 (L1) uses selected_subject_ids, depth 1 (L2) uses selected_chapter_ids.
      const selectedL1 = new Set(user.selectedSubjectIds ?? user.selectedSubjects ?? []);
      const selectedL2 = new Set(user.selectedChapterIds ?? user.selectedChapters ?? []);
      const hasL1 = selectedL1.size > 0;
      const hasL2 = selectedL2.size > 0;
      const byParent = new Map<string | null, SyllabusDbRow[]>();
      for (const row of data as SyllabusDbRow[]) {
        const arr = byParent.get(row.parent_id) ?? [];
        arr.push(row);
        byParent.set(row.parent_id, arr);
      }
      const build = (parentId: string | null): SyllabusNode[] => {
        const rows = byParent.get(parentId) ?? [];
        return rows.flatMap((r) => {
          if (r.depth === 0 && hasL1 && !selectedL1.has(r.id)) return [];
          if (r.depth === 1 && hasL2 && !selectedL2.has(r.id)) return [];
          return [
            {
              id: r.id,
              title: r.title,
              type: r.node_type,
              depth: r.depth,
              status: "unread" as Status,
              dueToday: false,
              revisionCount: 0,
              nextRevisionAt: null,
              children: build(r.id),
            },
          ];
        });
      };
      setTree(build(null));
    })();
    return () => {
      cancelled = true;
    };
  }, [
    user,
    user?.id,
    user?.targetExamId,
    user?.selectedSubjectIds,
    user?.selectedChapterIds,
    user?.selectedSubjects,
    user?.selectedChapters,
  ]);

  const [bucket, setBucket] = useState<string[]>([]);
  const [streak] = useState(0);
  const [xp, setXp] = useState(0);
  const [lastAward, setLastAward] = useState<XpAward | null>(null);
  const awardCounter = useRef(0);
  const dailyLimit = 7;

  // Trackable items are the leaves of the tree (whatever the exam's deepest level is called).
  const flatTopics = useMemo(() => {
    const list: SyllabusNode[] = [];
    walk(tree, (n) => {
      const isLeaf = !n.children || n.children.length === 0;
      if (isLeaf && !n.excluded) list.push(n);
    });
    return list;
  }, [tree]);


  const newTargets = flatTopics.filter((n) => n.status === "unread");
  const dueToday = flatTopics.filter((n) => n.dueToday && n.status !== "unread");
  const bucketNodes = bucket
    .map((id) => flatTopics.find((n) => n.id === id))
    .filter(Boolean) as SyllabusNode[];

  const findNode = useCallback(
    (id: string) => {
      let found: SyllabusNode | undefined;
      walk(tree, (n) => {
        if (n.id === id) found = n;
      });
      return found;
    },
    [tree],
  );

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

  const rateTopic = useCallback(
    (id: string, rating: "hard" | "medium" | "easy" | "push") => {
      let newStatus: Status = "first-read";
      let nextDue = false;
      let nextRevisionAt: string | null = null;
      if (rating === "hard") {
        newStatus = "needs-revision";
        nextDue = true;
        nextRevisionAt = daysFromToday(1);
      } else if (rating === "medium") {
        newStatus = "first-read";
        nextRevisionAt = daysFromToday(3);
      } else if (rating === "easy") {
        newStatus = "mastered";
        nextRevisionAt = daysFromToday(7);
      } else if (rating === "push") {
        nextDue = true;
      }

      setTree((t) =>
        mapTree(t, (n) => {
          if (n.id !== id) return n;
          if (rating === "push") return { ...n, dueToday: true };
          return {
            ...n,
            status: newStatus,
            dueToday: nextDue,
            nextRevisionAt,
            revisionCount: (n.revisionCount ?? 0) + 1,
          };
        }),
      );

      if (rating !== "push") {
        setBucket((b) => b.filter((x) => x !== id));
        const gain = rating === "easy" ? 20 : rating === "medium" ? 15 : 10;
        awardXp(gain, `${rating[0].toUpperCase()}${rating.slice(1)} recall`);
      }
    },
    [awardXp],
  );

  const scheduleRevision = useCallback(
    (id: string, days: number) => {
      setTree((t) =>
        mapTree(t, (n) =>
          n.id === id
            ? {
                ...n,
                status: "needs-revision",
                dueToday: days === 0,
                nextRevisionAt: daysFromToday(days),
                revisionCount: (n.revisionCount ?? 0) + 1,
              }
            : n,
        ),
      );
      setBucket((b) => b.filter((x) => x !== id));
      awardXp(12, `Scheduled in ${days}d`);
    },
    [awardXp],
  );

  const value: StoreCtx = {
    tree,
    syllabusLoading,
    levelSchema,
    bucket,
    dailyLimit,
    streak,
    xp,
    flatTopics,
    newTargets,
    dueToday,
    bucketNodes,
    lastAward,
    clearAward,
    addToBucket,
    removeFromBucket,
    updateNode,
    resetNode,
    rateTopic,
    scheduleRevision,
    awardXp,
    findNode,
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
