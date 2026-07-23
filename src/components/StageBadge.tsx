import type { Stage } from "@/lib/mock-syllabus";
import { cn } from "@/lib/utils";

interface Props {
  stages?: Stage[];
  className?: string;
}

/** Small P / M / P+M pill for topic cards. Renders nothing when no stages. */
export function StageBadge({ stages, className }: Props) {
  if (!stages || stages.length === 0) return null;
  const hasP = stages.includes("prelims");
  const hasM = stages.includes("mains");
  const label = hasP && hasM ? "P+M" : hasP ? "P" : "M";
  const tone = hasP && hasM
    ? "bg-gradient-to-r from-[oklch(0.9_0.09_300)] to-[oklch(0.9_0.09_180)] text-purple-900"
    : hasP
      ? "bg-[oklch(0.9_0.08_270)] text-purple-900"
      : "bg-[oklch(0.9_0.09_60)] text-orange-900";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider ring-1 ring-white/60",
        tone,
        className,
      )}
      title={hasP && hasM ? "Prelims + Mains" : hasP ? "Prelims" : "Mains"}
    >
      {label}
    </span>
  );
}
