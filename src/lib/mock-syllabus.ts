export type Status = "unread" | "first-read" | "mastered" | "needs-revision";

/** Fixed hierarchy for every exam. */
export const LEVEL_SCHEMA = ["subject", "chapter", "topic", "subtopic"] as const;
export type NodeType = (typeof LEVEL_SCHEMA)[number];

/** Which stage(s) of a multi-stage exam a topic is relevant to. */
export type Stage = "prelims" | "mains";
/** A student's intent when they add a topic to today's bucket. */
export type Intent = "prelims" | "mains" | "both";

export interface SyllabusNode {
  id: string;
  title: string;
  /** One of the fixed levels: subject / chapter / topic / subtopic. */
  type: NodeType | string;
  /** 0 = subject, 1 = chapter, 2 = topic, 3 = subtopic. */
  depth: number;
  /** Whether this node was added by the student or by admin. */
  kind: "admin" | "user";
  /** Only set for student-owned rows; needed to reparent/edit on the server. */
  parentKind?: "admin" | "user" | null;
  parentId?: string | null;
  /** Admin node that the current student has hidden. Still visible in Syllabus with Unhide affordance. */
  hidden?: boolean;
  status: Status;
  excluded?: boolean;
  note?: string;
  url?: string;
  dueToday?: boolean;
  revisionCount?: number;
  nextRevisionAt?: string | null;
  /** Prelims / Mains relevance. Only meaningful on topics (depth 2). */
  stages?: Stage[];
  /** For topic nodes: per-subtopic checkbox state (persisted locally). */
  subtopicChecks?: Record<string, boolean>;
  children?: SyllabusNode[];
}

/** A single item in the student's daily bucket. */
export interface BucketItem {
  id: string;
  intent: Intent;
}

/** A scheduled test inside a series. */
export interface Test {
  id: string;
  title: string;
  /** ISO date string, e.g. "2026-08-14". */
  date: string;
  /** Topic IDs (depth 2) this test covers. */
  mappedTopicIds: string[];
  marks?: number;
  maxMarks?: number;
}

/** A subscription to an external test series. */
export interface TestSeries {
  id: string;
  title: string;
  status: "active" | "paused" | "completed";
  tests: Test[];
}

export const quotes = [
  "Small consistent steps outrun sporadic sprints.",
  "You don't have to be extreme, just consistent.",
  "Discipline is choosing what you want most over what you want now.",
  "The pain of discipline weighs ounces; regret weighs tons.",
  "Progress, not perfection.",
  "One topic at a time. One day at a time.",
];

// ---------------- Mock helpers ----------------

/** Deterministic pseudo-random assignment of stages to a topic id, so the same
 * topic always shows the same P / M / P+M badge across renders and reloads. */
export function stagesForTopicId(id: string): Stage[] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const bucket = Math.abs(h) % 5;
  if (bucket < 2) return ["prelims", "mains"]; // ~40% both
  if (bucket < 4) return ["prelims"]; // ~40% prelims
  return ["mains"]; // ~20% mains
}

/** Seed 2 mock test series against a real, freshly loaded set of topic ids so
 * mapped topics link back to actual syllabus rows. Called by the store the
 * first time a user's tree loads and no persisted series exist. */
export function seedTestSeries(topicIds: string[]): TestSeries[] {
  if (topicIds.length === 0) return [];
  const today = new Date();
  const iso = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };
  const pick = (start: number, count: number) => {
    const out: string[] = [];
    for (let i = 0; i < count && i < topicIds.length; i++) {
      out.push(topicIds[(start + i * 3) % topicIds.length]);
    }
    return out;
  };

  return [
    {
      id: "series-vision",
      title: "Vision Prelims Test Series",
      status: "active",
      tests: [
        { id: "vision-t1", title: "Prelims Mock 1", date: iso(-14), mappedTopicIds: pick(0, 5), marks: 84, maxMarks: 200 },
        { id: "vision-t2", title: "Prelims Mock 2", date: iso(-3), mappedTopicIds: pick(2, 5) },
        { id: "vision-t3", title: "Prelims Mock 3", date: iso(6), mappedTopicIds: pick(4, 6) },
        { id: "vision-t4", title: "Prelims Full Length 1", date: iso(20), mappedTopicIds: pick(1, 8) },
      ],
    },
    {
      id: "series-forum",
      title: "Forum Mains Test Series",
      status: "active",
      tests: [
        { id: "forum-t1", title: "Mains Sectional GS1", date: iso(-7), mappedTopicIds: pick(3, 4) },
        // Overlap with vision-t3 so High-Yield badges show up.
        { id: "forum-t2", title: "Mains Sectional GS2", date: iso(6), mappedTopicIds: pick(4, 4) },
        { id: "forum-t3", title: "Mains Full Length 1", date: iso(28), mappedTopicIds: pick(7, 6) },
      ],
    },
    {
      id: "series-insight-old",
      title: "Insight Foundation 2024",
      status: "completed",
      tests: [
        { id: "insight-t1", title: "Diagnostic", date: iso(-120), mappedTopicIds: pick(0, 3), marks: 62, maxMarks: 100 },
      ],
    },
  ];
}
