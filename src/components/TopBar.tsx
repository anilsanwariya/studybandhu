import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { levelFromXp } from "@/lib/level";
import { CalendarDays, Sparkles } from "lucide-react";

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

function prepDurationLabel(joinedAt?: string) {
  if (!joinedAt) return null;
  const d = Math.max(1, Math.floor((Date.now() - new Date(joinedAt).getTime()) / 86400000));
  if (d < 30) return `Day ${d} of prep`;
  const m = Math.floor(d / 30);
  return `${m} month${m > 1 ? "s" : ""} in`;
}

export function TopBar() {
  const { user } = useAuth();
  const { xp } = useStore();
  const info = levelFromXp(xp);
  if (!user) return null;
  const prep = prepDurationLabel(user.joinedAt);

  return (
    <div className="glass-strong rounded-3xl px-4 py-3 mb-6 flex items-center gap-3">
      <Link to="/profile" className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[var(--lavender)] to-[var(--sky)] flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full rounded-2xl object-cover" /> : initials(user.name)}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{user.name}</span>
          <span className="glass rounded-full text-[10px] font-semibold px-2 py-0.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-[oklch(0.75_0.14_85)]" />
            Lv {info.level} · {info.rank}
          </span>
          {prep && (
            <span className="hidden sm:inline-flex glass rounded-full text-[10px] font-medium px-2 py-0.5 items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {prep}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 rounded-full bg-white/60 overflow-hidden flex-1 max-w-xs">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--lavender)] via-[var(--sky)] to-[var(--mint)] transition-all"
              style={{ width: `${info.progress * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
            {info.xpInLevel}/{info.xpInLevel + info.xpToNext} XP
          </span>
        </div>
      </div>
    </div>
  );
}
