import { cn } from "@/lib/utils";
import type { Status } from "@/lib/mock-syllabus";

const map: Record<Status, string> = {
  unread: "bg-muted-foreground/30",
  "first-read": "bg-lavender",
  "needs-revision": "bg-peach",
  mastered: "bg-mint",
};

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/60", map[status], className)} />;
}
