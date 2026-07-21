export type Status = "unread" | "first-read" | "mastered" | "needs-revision";

export interface SyllabusNode {
  id: string;
  title: string;
  /** Free-form level label defined by the exam's level_schema (e.g. "paper", "unit", "subject"). */
  type: string;
  /** 0 = root child of exam. Used together with exam.level_schema to label the node. */
  depth: number;
  status: Status;
  excluded?: boolean;
  note?: string;
  url?: string;
  dueToday?: boolean;
  revisionCount?: number;
  nextRevisionAt?: string | null;
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
