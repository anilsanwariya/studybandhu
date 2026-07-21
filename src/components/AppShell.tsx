import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListTree, Sparkles, BarChart3, Flame, Zap } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Intent", icon: Home },
  { to: "/syllabus", label: "Syllabus", icon: ListTree },
  { to: "/revisions", label: "Revisions", icon: Sparkles },
  { to: "/progress", label: "Progress", icon: BarChart3 },
] as const;

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { streak, xp } = useStore();
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full flex flex-col">
      {/* Fixed edge-to-edge top header */}
      <header className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl backdrop-saturate-150 border-b border-white/60 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_8px_24px_-16px_rgba(60,60,120,0.15)]">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--lavender)] to-[var(--sky)] flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="h-4.5 w-4.5 text-foreground/80" />
            </div>
            <div className="font-bold tracking-tight truncate">StudyBandhu</div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <Flame className="h-3.5 w-3.5 text-[oklch(0.75_0.15_40)]" />
              {streak}
            </div>
            <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold">
              <Zap className="h-3.5 w-3.5 text-[oklch(0.75_0.14_85)]" />
              {xp}
            </div>
            {user && (
              <Link
                to="/profile"
                aria-label="Profile"
                className={cn(
                  "h-9 w-9 rounded-full bg-gradient-to-br from-[var(--lavender)] to-[var(--sky)] flex items-center justify-center text-xs font-bold shadow-sm border border-white/60 shrink-0 overflow-hidden",
                  pathname === "/profile" && "ring-2 ring-primary/50"
                )}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(user.name)
                )}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-28 min-w-0">
        {children}
      </main>

      {/* Floating bottom nav */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 glass-strong rounded-full px-2 py-2 flex items-center gap-1 shadow-xl">
        {nav.map((n) => {
          const active = pathname === n.to;
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                active
                  ? "bg-white text-foreground shadow-sm border border-white/70"
                  : "text-foreground/70 hover:bg-white/50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn(active ? "inline" : "hidden sm:inline")}>{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
