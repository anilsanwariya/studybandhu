import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Trophy } from "lucide-react";

export function XpFeedback() {
  const { lastAward, clearAward } = useStore();
  const seen = useRef<number | null>(null);
  const [levelUp, setLevelUp] = useState<{ level: number; rank: string } | null>(null);

  useEffect(() => {
    if (!lastAward || seen.current === lastAward.id) return;
    seen.current = lastAward.id;

    toast(
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--lavender)] to-[var(--sky)] flex items-center justify-center">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">+{lastAward.amount} XP · {lastAward.reason}</div>
          <div className="text-xs text-muted-foreground">Level {lastAward.level} · {lastAward.rank}</div>
        </div>
      </div>,
      { duration: 2600 }
    );

    if (lastAward.leveledUp) {
      setLevelUp({ level: lastAward.level, rank: lastAward.rank });
    }
    clearAward();
  }, [lastAward, clearAward]);

  return (
    <Dialog open={!!levelUp} onOpenChange={(o) => !o && setLevelUp(null)}>
      <DialogContent className="border-none bg-transparent shadow-none p-0 max-w-sm">
        {levelUp && (
          <div className="glass-strong rounded-3xl p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-lavender/30 via-sky/20 to-mint/30" />
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[var(--sky)] to-[var(--lavender)] flex items-center justify-center mx-auto shadow-lg">
                <Trophy className="h-10 w-10" />
              </div>
              <div className="mt-5 text-xs uppercase tracking-widest text-muted-foreground">Level up</div>
              <h2 className="text-4xl font-bold mt-1">Level {levelUp.level}</h2>
              <p className="text-lg font-semibold mt-2">{levelUp.rank}</p>
              <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto">
                Your consistency compounds. New rank unlocked.
              </p>
              <div className="mt-6">
                <Button className="rounded-full px-6" onClick={() => setLevelUp(null)}>Continue</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
