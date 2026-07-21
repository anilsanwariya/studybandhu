import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusDot } from "@/components/StatusDot";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, ArrowRight, Home, Zap, Calendar, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/revisions")({
  head: () => ({
    meta: [
      { title: "Revisions — StudyBandhu" },
      { name: "description", content: "Forgiving spaced repetition with Auto, Presets, and Custom scheduling. Push back guilt-free." },
    ],
  }),
  component: RevisionsPage,
});

const PRESETS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 Days", days: 3 },
  { label: "1 Week", days: 7 },
  { label: "14 Days", days: 14 },
  { label: "1 Month", days: 30 },
];

function RevisionsPage() {
  const { bucketNodes, rateTopic, scheduleRevision, setSubtopicChecked, clearSubtopicChecks } = useStore();
  const [idx, setIdx] = useState(0);
  const [customDays, setCustomDays] = useState("5");
  const [pendingSubmit, setPendingSubmit] = useState<null | (() => void)>(null);
  const current = bucketNodes[idx];

  if (bucketNodes.length === 0 || !current) {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto mt-8 text-center">
          <div className="glass-strong rounded-3xl p-10">
            <div className="h-16 w-16 rounded-full bg-mint/60 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-foreground/70" />
            </div>
            <h1 className="text-2xl font-bold">
              {bucketNodes.length === 0 ? "Nothing in your bucket" : "Session complete 🌿"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {bucketNodes.length === 0
                ? "Head back to Morning Intent to pick a few gentle targets."
                : "You showed up. That's what matters."}
            </p>
            <Link to="/" className="inline-block mt-6">
              <Button className="rounded-full gap-2"><Home className="h-4 w-4" /> Morning Intent</Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const pushAll = () => setIdx(bucketNodes.length);
  const advance = () => setIdx((i) => i + 1);

  const subtopics = (current.children ?? []).filter((c) => !c.hidden);
  const checks = current.subtopicChecks ?? {};
  const checkedCount = subtopics.filter((s) => checks[s.id]).length;
  const allChecked = subtopics.length === 0 || checkedCount === subtopics.length;

  const guarded = (fn: () => void) => {
    if (allChecked) fn();
    else setPendingSubmit(() => fn);
  };

  const handleAuto = (r: "hard" | "medium" | "easy") => {
    guarded(() => {
      clearSubtopicChecks(current.id);
      rateTopic(current.id, r);
    });
  };
  const handlePreset = (days: number) => {
    guarded(() => {
      clearSubtopicChecks(current.id);
      scheduleRevision(current.id, days);
    });
  };
  const handleCustom = () => {
    const n = Math.max(0, Math.min(365, parseInt(customDays || "0", 10) || 0));
    guarded(() => {
      clearSubtopicChecks(current.id);
      scheduleRevision(current.id, n);
    });
  };

  const progress = (idx / bucketNodes.length) * 100;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-foreground/70">Session progress</span>
            <span className="font-semibold">{idx + 1} of {bucketNodes.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/50 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--mint)] to-[var(--sky)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="glass-strong rounded-3xl p-6 lg:p-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <StatusDot status={current.status} />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{current.type}</span>
            {current.revisionCount ? (
              <span className="glass rounded-full text-[10px] font-medium px-2 py-0.5">
                Revised {current.revisionCount}×
              </span>
            ) : null}
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight leading-tight">{current.title}</h1>
          <p className="text-muted-foreground mt-3 text-sm max-w-md mx-auto">
            Recall it in your head. Then schedule the next revision — your call.
          </p>

          {subtopics.length > 0 && (
            <div className="mt-6 glass rounded-2xl p-4 text-left max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subtopics
                </span>
                <span className="text-xs font-medium text-foreground/70">
                  {checkedCount}/{subtopics.length} recalled
                </span>
              </div>
              <div className="space-y-1.5">
                {subtopics.map((s) => {
                  const on = !!checks[s.id];
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl px-3 py-2 cursor-pointer transition-colors",
                        on ? "bg-mint/40" : "hover:bg-white/50",
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(v) => setSubtopicChecked(current.id, s.id, v === true)}
                        className="mt-0.5"
                      />
                      <span className={cn("text-sm flex-1", on && "line-through text-muted-foreground")}>
                        {s.title}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <Tabs defaultValue="auto" className="mt-8">
            <TabsList className="bg-white/40 backdrop-blur border border-white/50 rounded-full p-1 h-auto mx-auto">
              <TabsTrigger value="auto" className="rounded-full data-[state=active]:bg-white gap-1.5"><Zap className="h-3.5 w-3.5" /> Auto</TabsTrigger>
              <TabsTrigger value="preset" className="rounded-full data-[state=active]:bg-white gap-1.5"><Calendar className="h-3.5 w-3.5" /> Presets</TabsTrigger>
              <TabsTrigger value="custom" className="rounded-full data-[state=active]:bg-white gap-1.5"><Wand2 className="h-3.5 w-3.5" /> Custom</TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="mt-6">
              <div className="grid grid-cols-3 gap-3">
                <RateButton label="Hard" sub="review sooner" color="peach" onClick={() => handleAuto("hard")} />
                <RateButton label="Medium" sub="normal cadence" color="lavender" onClick={() => handleAuto("medium")} />
                <RateButton label="Easy" sub="review later" color="mint" onClick={() => handleAuto("easy")} />
              </div>
            </TabsContent>

            <TabsContent value="preset" className="mt-6">
              <div className="flex flex-wrap justify-center gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.days}
                    onClick={() => handlePreset(p.days)}
                    className="glass rounded-full px-4 py-2 text-sm font-medium hover:bg-white/70 hover:scale-[1.03] active:scale-100 transition-all"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">Force a fixed interval. No algorithm judgment.</p>
            </TabsContent>

            <TabsContent value="custom" className="mt-6">
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">Revise in</span>
                <Input
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  min={0}
                  max={365}
                  className="w-20 rounded-full bg-white/60 border-white/60 text-center font-semibold"
                />
                <span className="text-sm text-muted-foreground">days</span>
                <Button className="rounded-full ml-2" onClick={handleCustom}>Schedule</Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 flex items-center justify-center gap-6 pt-4 border-t border-white/40">
            <button
              onClick={advance}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-dotted"
            >
              Push back — not today <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={pushAll}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip whole queue
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          No streak penalty for pushing back. Come back tomorrow.
        </p>
      </div>

      <AlertDialog open={pendingSubmit !== null} onOpenChange={(o) => { if (!o) setPendingSubmit(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit without checking all subtopics?</AlertDialogTitle>
            <AlertDialogDescription>
              You've recalled {checkedCount} of {subtopics.length} subtopics for "{current.title}".
              Ticking every subtopic before rating gives you a more honest mastery signal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep checking</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const fn = pendingSubmit;
                setPendingSubmit(null);
                fn?.();
              }}
            >
              Submit anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
