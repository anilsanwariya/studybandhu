export type Status = "unread" | "first-read" | "mastered" | "needs-revision";

/** Fixed hierarchy for every exam. */
export const LEVEL_SCHEMA = ["subject", "chapter", "topic", "subtopic"] as const;
export type NodeType = (typeof LEVEL_SCHEMA)[number];

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
  /** For topic nodes: per-subtopic checkbox state (persisted locally). */
  subtopicChecks?: Record<string, boolean>;
  children?: SyllabusNode[];
}

export const quotes = [
  "Small consistent steps outrun sporadic sprints.",
  "You don't have to be extreme, just consistent.",
  "Discipline is choosing what you want most over what you want now.",
  "The pain of discipline weighs ounces; regret weighs tons.",
  "Progress, not perfection.",
  "One topic at a time. One day at a time.",
];
