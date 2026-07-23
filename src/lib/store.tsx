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
import type {
  SyllabusNode,
  Status,
  NodeType,
  BucketItem,
  Intent,
  TestSeries,
  Test,
} from "./mock-syllabus";
import { LEVEL_SCHEMA, stagesForTopicId } from "./mock-syllabus";
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
interface UserOverrideRow {
  id: string;
  parent_id: string;
  parent_kind: "admin" | "user";
  title: string;
  node_type: "chapter" | "topic" | "subtopic";
  depth: number;
  sort_order: number;
}

export type ScheduleMode = "self-paced" | "test-series";
export type StudyMode = "prelims" | "mains" | "both";

interface StoreState {
  tree: SyllabusNode[];
  syllabusLoading: boolean;
  levelSchema: string[];
  bucket: BucketItem[];
  dailyLimit: number;
  streak: number;
  xp: number;
  studyMode: StudyMode;
  scheduleMode: ScheduleMode;
  testSeries: TestSeries[];
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

export type BucketNode = SyllabusNode & { intent: Intent };

interface StoreCtx extends StoreState {
  flatTopics: SyllabusNode[];
  newTargets: SyllabusNode[];
  dueToday: SyllabusNode[];
  bucketNodes: BucketNode[];
  lastAward: XpAward | null;
  clearAward: () => void;
  addToBucket: (id: string, intent?: Intent) => void;
  removeFromBucket: (id: string) => void;
  updateNode: (id: string, patch: Partial<SyllabusNode>) => void;
  resetNode: (id: string) => void;
  rateTopic: (id: string, rating: "hard" | "medium" | "easy" | "push") => void;
  scheduleRevision: (id: string, days: number) => void;
  setSubtopicChecked: (topicId: string, subtopicId: string, checked: boolean) => void;
  clearSubtopicChecks: (topicId: string) => void;
  awardXp: (amount: number, reason: string) => void;
  findNode: (id: string) => SyllabusNode | undefined;
  refreshUserOverrides: () => Promise<void>;
  setStudyMode: (m: StudyMode) => void;
  setScheduleMode: (m: ScheduleMode) => void;
  setTestSeriesStatus: (id: string, status: TestSeries["status"]) => void;
  saveTestMarks: (seriesId: string, testId: string, marks: number, maxMarks: number) => void;
  /** Aggregate of upcoming (nearest future) test per active series. */
  aggregatedUpcoming: { topicIdCounts: Map<string, number>; nextTest: (Test & { seriesTitle: string }) | null };
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
    subtopicChecks: {},
  };
  if (node.children) next.children = node.children.map(resetSubtree);
  return next;
}

function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface PersistedNode {
  status: Status;
  dueToday: boolean;
  revisionCount: number;
  nextRevisionAt: string | null;
  excluded?: boolean;
  url?: string;
  note?: string;
  subtopicChecks?: Record<string, boolean>;
}
interface PersistedState {
  nodes: Record<string, PersistedNode>;
  bucket: (BucketItem | string)[]; // legacy shape allowed
  xp: number;
}

const persistKey = (userId: string, examId: string) => `sb-progress-${userId}-${examId}`;
const seriesKey = (userId: string) => `sb-test-series-${userId}`;
const modeKey = (userId: string) => `sb-modes-${userId}`;

function loadPersisted(userId: string, examId: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(persistKey(userId, examId));
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

function migrateBucket(items: (BucketItem | string)[] | undefined): BucketItem[] {
  if (!items) return [];
  return items.map((it) =>
    typeof it === "string" ? { id: it, intent: "both" as Intent } : { id: it.id, intent: it.intent ?? "both" },
  );
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tree, setTree] = useState<SyllabusNode[]>([]);
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [bucket, setBucket] = useState<BucketItem[]>([]);
  const [streak] = useState(0);
  const [xp, setXp] = useState(0);
  const [studyMode, setStudyModeState] = useState<StudyMode>("both");
  const [scheduleMode, setScheduleModeState] = useState<ScheduleMode>("self-paced");
  const [testSeries, setTestSeries] = useState<TestSeries[]>([]);
  const persistLoaded = useRef(false);
  const reloadTick = useRef(0);
  const [reloadKey, setReloadKey] = useState(0);

  // Load mode prefs on user change.
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(modeKey(user.id));
      if (raw) {
        const p = JSON.parse(raw) as { studyMode?: StudyMode; scheduleMode?: ScheduleMode };
        if (p.studyMode) setStudyModeState(p.studyMode);
        if (p.scheduleMode) setScheduleModeState(p.scheduleMode);
      }
    } catch {
      /* ignore */
    }
  }, [user]);

  // Persist mode prefs.
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(modeKey(user.id), JSON.stringify({ studyMode, scheduleMode }));
    } catch {
      /* ignore */
    }
  }, [user, studyMode, scheduleMode]);

  useEffect(() => {
    const examId = user?.targetExamId;
    persistLoaded.current = false;
    setBucket([]);
    if (!user || !examId) {
      setTree([]);
      setSyllabusLoading(false);
      return;
    }
    let cancelled = false;
    setSyllabusLoading(true);
    (async () => {
      const [adminRes, userRes, hiddenRes] = await Promise.all([
        supabase
          .from("syllabus_nodes")
          .select("id, parent_id, title, node_type, sort_order, depth")
          .eq("exam_id", examId)
          .order("sort_order", { ascending: true })
          .order("title", { ascending: true }),
        supabase
          .from("user_syllabus_nodes")
          .select("id, parent_id, parent_kind, title, node_type, depth, sort_order")
          .eq("exam_id", examId)
          .order("sort_order", { ascending: true })
          .order("title", { ascending: true }),
        supabase.from("user_node_hidden").select("node_id"),
      ]);
      if (cancelled) return;
      setSyllabusLoading(false);

      const adminRows = (adminRes.data as SyllabusDbRow[] | null) ?? [];
      const userRows = (userRes.data as UserOverrideRow[] | null) ?? [];
      const hiddenSet = new Set(((hiddenRes.data as Array<{ node_id: string }> | null) ?? []).map((r) => r.node_id));

      const selectedL1 = new Set(user.selectedSubjectIds ?? user.selectedSubjects ?? []);
      const selectedL2 = new Set(user.selectedChapterIds ?? user.selectedChapters ?? []);
      const hasL1 = selectedL1.size > 0;
      const hasL2 = selectedL2.size > 0;

      const adminByParent = new Map<string | null, SyllabusDbRow[]>();
      for (const r of adminRows) {
        const arr = adminByParent.get(r.parent_id) ?? [];
        arr.push(r);
        adminByParent.set(r.parent_id, arr);
      }
      const userByParent = new Map<string, UserOverrideRow[]>();
      const parentKey = (kind: "admin" | "user", id: string) => `${kind}:${id}`;
      for (const r of userRows) {
        const k = parentKey(r.parent_kind, r.parent_id);
        const arr = userByParent.get(k) ?? [];
        arr.push(r);
        userByParent.set(k, arr);
      }

      const persisted = loadPersisted(user.id, examId);
      const nodeMap = persisted?.nodes ?? {};

      const applyPersist = (n: SyllabusNode): SyllabusNode => {
        const withStages = n.depth === 2 ? { ...n, stages: stagesForTopicId(n.id) } : n;
        const saved = nodeMap[n.id];
        if (!saved) return withStages;
        return {
          ...withStages,
          status: (saved.status ?? "unread") as Status,
          dueToday: saved.dueToday ?? false,
          revisionCount: saved.revisionCount ?? 0,
          nextRevisionAt: saved.nextRevisionAt ?? null,
          excluded: saved.excluded,
          url: saved.url,
          note: saved.note,
          subtopicChecks: saved.subtopicChecks ?? {},
        };
      };

      const buildUserChildren = (parentK: "admin" | "user", parentId: string): SyllabusNode[] => {
        const rows = userByParent.get(parentKey(parentK, parentId)) ?? [];
        return rows.map((r) => {
          const node: SyllabusNode = {
            id: r.id,
            title: r.title,
            type: r.node_type,
            depth: r.depth,
            kind: "user",
            parentKind: r.parent_kind,
            parentId: r.parent_id,
            status: "unread",
            dueToday: false,
            revisionCount: 0,
            nextRevisionAt: null,
            children: buildUserChildren("user", r.id),
          };
          return applyPersist(node);
        });
      };

      const buildAdmin = (parentId: string | null): SyllabusNode[] => {
        const rows = adminByParent.get(parentId) ?? [];
        return rows.flatMap((r) => {
          if (r.depth === 0 && hasL1 && !selectedL1.has(r.id)) return [];
          if (r.depth === 1 && hasL2 && !selectedL2.has(r.id)) return [];
          const adminKids = buildAdmin(r.id);
          const userKids = buildUserChildren("admin", r.id);
          const node: SyllabusNode = {
            id: r.id,
            title: r.title,
            type: r.node_type,
            depth: r.depth,
            kind: "admin",
            parentKind: null,
            parentId: r.parent_id,
            hidden: hiddenSet.has(r.id),
            status: "unread",
            dueToday: false,
            revisionCount: 0,
            nextRevisionAt: null,
            children: [...adminKids, ...userKids],
          };
          return [applyPersist(node)];
        });
      };

      const built = buildAdmin(null);
      setTree(built);
      if (persisted) {
        setBucket(migrateBucket(persisted.bucket));
        setXp(persisted.xp ?? 0);
      } else {
        setBucket([]);
        setXp(0);
      }
      persistLoaded.current = true;

      // Seed test series if none persisted yet.
      try {
        const raw = localStorage.getItem(seriesKey(user.id));
        if (raw) {
          setTestSeries(JSON.parse(raw) as TestSeries[]);
        } else {
          const topicIds: string[] = [];
          walk(built, (n) => {
            if (n.depth === 2) topicIds.push(n.id);
          });
          const seeded = seedTestSeries(topicIds);
          setTestSeries(seeded);
        }
      } catch {
        setTestSeries([]);
      }
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
    reloadKey,
  ]);

  const refreshUserOverrides = useCallback(async () => {
    reloadTick.current += 1;
    setReloadKey(reloadTick.current);
  }, []);

  const [lastAward, setLastAward] = useState<XpAward | null>(null);
  const awardCounter = useRef(0);
  const dailyLimit = 7;

  useEffect(() => {
    if (!persistLoaded.current) return;
    const examId = user?.targetExamId;
    if (!user || !examId) return;
    const nodes: Record<string, PersistedNode> = {};
    walk(tree, (n) => {
      nodes[n.id] = {
        status: n.status,
        dueToday: !!n.dueToday,
        revisionCount: n.revisionCount ?? 0,
        nextRevisionAt: n.nextRevisionAt ?? null,
        excluded: n.excluded,
        url: n.url,
        note: n.note,
        subtopicChecks: n.subtopicChecks,
      };
    });
    try {
      localStorage.setItem(
        persistKey(user.id, examId),
        JSON.stringify({ nodes, bucket, xp } satisfies PersistedState),
      );
    } catch {
      /* ignore */
    }
  }, [tree, bucket, xp, user]);

  // Persist test series changes.
  useEffect(() => {
    if (!user) return;
    if (testSeries.length === 0) return;
    try {
      localStorage.setItem(seriesKey(user.id), JSON.stringify(testSeries));
    } catch {
      /* ignore */
    }
  }, [user, testSeries]);

  const flatTopics = useMemo(() => {
    const list: SyllabusNode[] = [];
    walk(tree, (n) => {
      if (n.hidden) return;
      const isTopic = n.type === "topic" || n.depth === 2;
      const isLeaf = !n.children || n.children.filter((c) => !c.hidden).length === 0;
      if ((isTopic || isLeaf) && !n.excluded && n.depth <= 2) {
        if (n.depth === 3) return;
        list.push(n);
      }
    });
    const seen = new Set<string>();
    return list.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)));
  }, [tree]);

  const newTargets = flatTopics.filter((n) => n.status === "unread");
  const dueToday = flatTopics.filter((n) => n.dueToday && n.status !== "unread");
  const bucketNodes = useMemo<BucketNode[]>(() => {
    return bucket
      .map((b) => {
        const node = flatTopics.find((n) => n.id === b.id);
        return node ? { ...node, intent: b.intent } : null;
      })
      .filter(Boolean) as BucketNode[];
  }, [bucket, flatTopics]);

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

  const addToBucket = useCallback((id: string, intent: Intent = "both") => {
    setBucket((b) => (b.some((x) => x.id === id) || b.length >= dailyLimit ? b : [...b, { id, intent }]));
  }, []);

  const removeFromBucket = useCallback((id: string) => {
    setBucket((b) => b.filter((x) => x.id !== id));
  }, []);

  const updateNode = useCallback((id: string, patch: Partial<SyllabusNode>) => {
    setTree((t) => mapTree(t, (n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const resetNode = useCallback((id: string) => {
    setTree((t) => mapTree(t, (n) => (n.id === id ? resetSubtree(n) : n)));
    setBucket((b) => b.filter((x) => x.id !== id));
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
        setBucket((b) => b.filter((x) => x.id !== id));
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
      setBucket((b) => b.filter((x) => x.id !== id));
      awardXp(12, `Scheduled in ${days}d`);
    },
    [awardXp],
  );

  const setSubtopicChecked = useCallback(
    (topicId: string, subtopicId: string, checked: boolean) => {
      setTree((t) =>
        mapTree(t, (n) => {
          if (n.id !== topicId) return n;
          const prev = n.subtopicChecks ?? {};
          const next = { ...prev, [subtopicId]: checked };
          if (!checked) delete next[subtopicId];
          return { ...n, subtopicChecks: next };
        }),
      );
    },
    [],
  );

  const clearSubtopicChecks = useCallback((topicId: string) => {
    setTree((t) => mapTree(t, (n) => (n.id === topicId ? { ...n, subtopicChecks: {} } : n)));
  }, []);

  const setStudyMode = useCallback((m: StudyMode) => setStudyModeState(m), []);
  const setScheduleMode = useCallback((m: ScheduleMode) => setScheduleModeState(m), []);

  const setTestSeriesStatus = useCallback((id: string, status: TestSeries["status"]) => {
    setTestSeries((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const saveTestMarks = useCallback((seriesId: string, testId: string, marks: number, maxMarks: number) => {
    setTestSeries((prev) =>
      prev.map((s) =>
        s.id !== seriesId
          ? s
          : { ...s, tests: s.tests.map((t) => (t.id !== testId ? t : { ...t, marks, maxMarks })) },
      ),
    );
  }, []);

  const aggregatedUpcoming = useMemo(() => {
    const counts = new Map<string, number>();
    const today = new Date().toISOString().slice(0, 10);
    const activeSeries = testSeries.filter((s) => s.status === "active");
    let nextTest: (Test & { seriesTitle: string }) | null = null;
    for (const s of activeSeries) {
      const upcoming = [...s.tests]
        .filter((t) => t.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      if (!upcoming) continue;
      for (const tid of upcoming.mappedTopicIds) counts.set(tid, (counts.get(tid) ?? 0) + 1);
      if (!nextTest || upcoming.date < nextTest.date) {
        nextTest = { ...upcoming, seriesTitle: s.title };
      }
    }
    return { topicIdCounts: counts, nextTest };
  }, [testSeries]);

  const value: StoreCtx = {
    tree,
    syllabusLoading,
    levelSchema: LEVEL_SCHEMA as unknown as string[],
    bucket,
    dailyLimit,
    streak,
    xp,
    studyMode,
    scheduleMode,
    testSeries,
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
    setSubtopicChecked,
    clearSubtopicChecks,
    awardXp,
    findNode,
    refreshUserOverrides,
    setStudyMode,
    setScheduleMode,
    setTestSeriesStatus,
    saveTestMarks,
    aggregatedUpcoming,
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

export type { NodeType } from "./mock-syllabus";
