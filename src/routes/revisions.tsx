import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusDot } from "@/components/StatusDot";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/revisions")({
  head: () => ({
    meta: [
      { title: "Revisions — Cadence" },
      { name: "description", content: "Forgiving spaced repetition. Rate each topic gently — or push it back with no penalty." },
    ],
  }),
  component: RevisionsPage,
});

function RevisionsPage() {
  const { bucketNodes, rateTopic } = useStore();
  const [idx, setIdx] = useState(0);
  const current = bucketNodes[idx];

  if (bucketNodes.length === 0) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto mt-16 text-center">
          <div className="glass-strong rounded-3xl p-10">
            <div className="h-16 w-16 rounded-full bg-mint/60 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-foreground/70" />
            </div>
            <h1 className="text-2xl font-bold">Nothing in your bucket</h1>
            <p className="text-muted-foreground mt-2 text-sm">Head back to Morning Intent to pick a few gentle targets.</p>
            <Link to="/" className="inline-block mt-6">
              <Button className="rounded-full gap-2"><Home className="h-4 w-4" /> Morning Intent</Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!current) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto mt-16 text-center">
          <div className="glass-strong rounded-3xl p-10">
            <div className="h-16 w-16 rounded-full bg-mint/60 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-foreground/70" />
            </div>
            <h1 className="text-2xl font-bold">Session complete 🌿</h1>
            <p className="text-muted-foreground mt-2 text-sm">You showed up. That's what matters.</p>
            <Link to="/" className="inline-block mt-6">
              <Button className="rounded-full gap-2"><Home className="h-4 w-4" /> Back home</Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const handle = (rating: "hard" | "medium" | "easy" | "push") => {
    rateTopic(current.id, rating);
    if (rating === "push") setIdx((i) => i + 1);
    // On other ratings, current is removed from bucket, so keep idx (next slides in).
  };

  const progress = ((idx) / bucketNodes.length) * 100;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-foreground/70">Session progress</span>
            <span className="font-semibold">{idx + 1} of {bucketNodes.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/50 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--mint)] to-[var(--sky)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-3xl p-8 lg:p-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <StatusDot status={current.status} />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{current.type}</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight">{current.title}</h1>
          <p className="text-muted-foreground mt-3 text-sm max-w-md mx-auto">
            Recall it in your head — outline, keywords, examples. Then rate honestly.
          </p>

          <div className="grid grid-cols-3 gap-3 mt-8">
            <RateButton label="Hard" sub="review sooner" color="peach" onClick={() => handle("hard")} />
            <RateButton label="Medium" sub="normal cadence" color="lavender" onClick={() => handle("medium")} />
            <RateButton label="Easy" sub="review later" color="mint" onClick={() => handle("easy")} />
          </div>

          <button
            onClick={() => handle("push")}
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-dotted"
          >
            Push back — I'm not ready today <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          No streak penalty for pushing back. Come back tomorrow.
        </p>
      </div>
    </AppShell>
  );
}

function RateButton({
  label, sub, color, onClick,
}: { label: string; sub: string; color: "peach" | "lavender" | "mint"; onClick: () => void }) {
  const bg = { peach: "hover:bg-peach/70", lavender: "hover:bg-lavender/70", mint: "hover:bg-mint/70" }[color];
  const dot = { peach: "bg-peach", lavender: "bg-lavender", mint: "bg-mint" }[color];
  return (
    <button
      onClick={onClick}
      className={cn(
        "glass rounded-2xl px-4 py-5 flex flex-col items-center gap-2 transition-all",
        "hover:scale-[1.03] hover:shadow-lg active:scale-100",
        bg,
      )}
    >
      <span className={cn("h-3 w-3 rounded-full ring-4 ring-white/60", dot)} />
      <span className="font-semibold text-sm">{label}</span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </button>
  );
}
