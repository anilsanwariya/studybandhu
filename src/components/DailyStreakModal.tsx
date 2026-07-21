import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Flame, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";

const KEY = "studybandhu.streak.lastShown";

export function DailyStreakModal() {
  const { isAuthenticated, user } = useAuth();
  const { streak, awardXp } = useStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.onboarded) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(KEY) === today) return;
      localStorage.setItem(KEY, today);
    } catch {}
    const t = setTimeout(() => setOpen(true), 500);
    return () => clearTimeout(t);
  }, [isAuthenticated, user?.onboarded]);

  const claim = () => {
    awardXp(50, `Day ${streak} streak bonus`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-none bg-transparent shadow-none p-0 max-w-sm">
        <div className="glass-strong rounded-3xl p-8 text-center relative overflow-hidden">
          <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-peach/40 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-lavender/40 blur-3xl" />
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-peach to-blush flex items-center justify-center mx-auto shadow-lg">
              <Flame className="h-10 w-10 text-foreground" />
            </div>
            <div className="mt-5 text-xs uppercase tracking-widest text-muted-foreground">Daily streak</div>
            <h2 className="text-4xl font-bold mt-1">Day {streak} 🔥</h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto">
              You showed up again. That's the whole game.
            </p>
            <div className="glass rounded-2xl px-4 py-3 mt-6 inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[oklch(0.75_0.14_85)]" />
              <span className="text-sm font-semibold">+50 Bonus XP</span>
            </div>
            <div className="mt-6">
              <Button className="rounded-full px-6" onClick={claim}>Claim & begin</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
