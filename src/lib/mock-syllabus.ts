export type Status = "unread" | "first-read" | "mastered" | "needs-revision";

export interface SyllabusNode {
  id: string;
  title: string;
  type: "subject" | "chapter" | "topic" | "subtopic";
  status: Status;
  excluded?: boolean;
  note?: string;
  url?: string;
  dueToday?: boolean;
  revisionCount?: number;
  nextRevisionAt?: string | null;
  children?: SyllabusNode[];
}

const t = (id: string, title: string, status: Status = "unread", dueToday = false): SyllabusNode => ({
  id, title, type: "subtopic", status, dueToday,
});

export const mockSyllabus: SyllabusNode[] = [
  {
    id: "polity",
    title: "Indian Polity",
    type: "subject",
    status: "first-read",
    children: [
      {
        id: "polity-1", title: "Constitution", type: "chapter", status: "first-read",
        children: [
          { id: "polity-1-1", title: "Historical Background", type: "topic", status: "mastered",
            children: [t("polity-1-1-a", "Regulating Act 1773", "mastered"), t("polity-1-1-b", "GOI Act 1935", "mastered", true)] },
          { id: "polity-1-2", title: "Preamble", type: "topic", status: "needs-revision", dueToday: true,
            children: [t("polity-1-2-a", "Keywords & Objectives", "needs-revision", true)] },
          { id: "polity-1-3", title: "Fundamental Rights", type: "topic", status: "unread",
            children: [t("polity-1-3-a", "Article 14–18"), t("polity-1-3-b", "Article 19–22"), t("polity-1-3-c", "Writs")] },
        ]
      },
      {
        id: "polity-2", title: "Union Government", type: "chapter", status: "unread",
        children: [
          { id: "polity-2-1", title: "President", type: "topic", status: "unread" },
          { id: "polity-2-2", title: "Parliament", type: "topic", status: "unread" },
        ]
      },
    ]
  },
  {
    id: "history",
    title: "Modern History",
    type: "subject",
    status: "unread",
    children: [
      {
        id: "hist-1", title: "Freedom Struggle", type: "chapter", status: "unread",
        children: [
          { id: "hist-1-1", title: "1857 Revolt", type: "topic", status: "first-read", dueToday: true },
          { id: "hist-1-2", title: "Gandhian Era", type: "topic", status: "unread" },
          { id: "hist-1-3", title: "Partition & Independence", type: "topic", status: "unread" },
        ]
      },
    ]
  },
  {
    id: "geo",
    title: "Geography",
    type: "subject",
    status: "first-read",
    children: [
      {
        id: "geo-1", title: "Physical Geography", type: "chapter", status: "first-read",
        children: [
          { id: "geo-1-1", title: "Plate Tectonics", type: "topic", status: "needs-revision", dueToday: true },
          { id: "geo-1-2", title: "Indian Monsoon", type: "topic", status: "mastered" },
          { id: "geo-1-3", title: "Ocean Currents", type: "topic", status: "unread" },
        ]
      },
    ]
  },
  {
    id: "eco",
    title: "Economy",
    type: "subject",
    status: "unread",
    children: [
      {
        id: "eco-1", title: "Macroeconomics", type: "chapter", status: "unread",
        children: [
          { id: "eco-1-1", title: "GDP & National Income", type: "topic", status: "unread" },
          { id: "eco-1-2", title: "Inflation", type: "topic", status: "first-read" },
        ]
      },
    ]
  },
];

export const quotes = [
  "Small consistent steps outrun sporadic sprints.",
  "You don't have to be extreme, just consistent.",
  "Discipline is choosing what you want most over what you want now.",
  "The pain of discipline weighs ounces; regret weighs tons.",
  "Progress, not perfection.",
  "One topic at a time. One day at a time.",
];
