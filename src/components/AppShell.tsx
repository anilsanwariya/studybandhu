import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListTree, Sparkles, BarChart3, Flame, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Morning Intent", icon: Home },
  { to: "/syllabus", label: "Syllabus", icon: ListTree },
  { to: "/revisions", label: "Revisions", icon: Sparkles },
  { to: "/progress", label: "Progress", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { streak, xp } = useStore();

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-64 p-4 lg:p-6 flex lg:flex-col gap-4 shrink-0">
        <div className="glass-strong rounded-3xl p-5 flex-1 flex lg:flex-col gap-4 items-center lg:items-stretch">
          <div className="flex items-center gap-2 lg:mb-4">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="hidden lg:block">
              <div className="font-semibold leading-none">Cadence</div>
              <div className="text-xs text-muted-foreground mt-0.5">Study, softly.</div>
            </div>
          </div>

          <nav className="flex lg:flex-col gap-1 flex-1 overflow-x-auto lg:overflow-visible">
            {nav.map((n) => {
              const active = pathname === n.to;
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap",
                    active
                      ? "bg-white/70 text-foreground shadow-sm border border-white/60"
                      : "text-foreground/70 hover:bg-white/40"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden lg:inline">{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden lg:flex flex-col gap-2 mt-auto">
            <div className="glass rounded-2xl px-3 py-2 flex items-center gap-2">
              <Flame className="h-4 w-4 text-[oklch(0.75_0.15_40)]" />
              <div className="text-xs">
                <div className="font-semibold">{streak} day streak</div>
                <div className="text-muted-foreground">Keep it soft</div>
              </div>
            </div>
            <div className="glass rounded-2xl px-3 py-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-[oklch(0.75_0.14_85)]" />
              <div className="text-xs">
                <div className="font-semibold">{xp} XP</div>
                <div className="text-muted-foreground">Level 4</div>
              </div>
            </div>
          </div>

          {/* Mobile stats */}
          <div className="lg:hidden flex items-center gap-2 ml-auto">
            <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <Flame className="h-3.5 w-3.5 text-[oklch(0.75_0.15_40)]" />
              {streak}
            </div>
            <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <Zap className="h-3.5 w-3.5 text-[oklch(0.75_0.14_85)]" />
              {xp}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-4 lg:p-8 pt-0 lg:pt-8 min-w-0">
        {children}
      </main>
    </div>
  );
}
