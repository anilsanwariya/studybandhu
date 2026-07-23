import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { Test, TestSeries } from "@/lib/mock-syllabus";
import { Landing } from "@/components/Landing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarClock, MoreVertical, Upload, FileUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — StudyBandhu" },
      { name: "description", content: "Manage your test series subscriptions and see the full timeline of upcoming tests." },
      { property: "og:title", content: "Schedule — StudyBandhu" },
      { property: "og:description", content: "Test series command center: manage subscriptions, timeline, and marks." },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Landing />;
  return <ScheduleView />;
}

function ScheduleView() {
  const {
    scheduleMode,
    setScheduleMode,
    testSeries,
    setTestSeriesStatus,
    saveTestMarks,
    findNode,
    addTestSeries,
    deleteTestSeries,
    flatTopics,
  } = useStore();

  const [showCompleted, setShowCompleted] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [marksTarget, setMarksTarget] = useState<{ series: TestSeries; test: Test } | null>(null);

  const visibleSeries = testSeries.filter((s) => showCompleted || s.status !== "completed");

  const timeline = useMemo(() => {
    const items: { series: TestSeries; test: Test }[] = [];
    for (const s of testSeries) {
      if (s.status !== "active") continue;
      for (const t of s.tests) items.push({ series: s, test: t });
    }
    items.sort((a, b) => a.test.date.localeCompare(b.test.date));
    return items;
  }, [testSeries]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground mt-1">Your test-series command center.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="rounded-full gap-1.5">
          <Upload className="h-4 w-4" /> Upload Schedule
        </Button>
      </header>

      {/* Mode toggle */}
      <div className="glass-strong rounded-3xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Planning mode</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {scheduleMode === "test-series"
              ? "Morning Intent narrows to topics from your next upcoming tests."
              : "Morning Intent shows your full syllabus."}
          </div>
        </div>
        <div className="glass rounded-full p-1 flex items-center gap-1">
          {(["self-paced", "test-series"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setScheduleMode(m)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                scheduleMode === m ? "bg-white text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground",
              )}
            >
              {m === "self-paced" ? "Self-Paced" : "Test Series Directed"}
            </button>
          ))}
        </div>
      </div>

      {/* Subscriptions */}
      <section className="glass-strong rounded-3xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="font-semibold">Subscriptions</h2>
            <p className="text-xs text-muted-foreground">Pause a series to hide its tests from the timeline.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Switch checked={showCompleted} onCheckedChange={setShowCompleted} id="show-completed" />
            <Label htmlFor="show-completed" className="text-xs cursor-pointer">View completed</Label>
          </div>
        </div>

        <div className="space-y-2">
          {visibleSeries.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">
              No test series yet. Upload a schedule to get started.
            </div>
          )}
          {visibleSeries.map((s) => (
            <div key={s.id} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{s.title}</div>
                <div className="text-[11px] text-muted-foreground">{s.tests.length} tests</div>
              </div>
              <StatusPill status={s.status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-strong">
                  <DropdownMenuItem onClick={() => setTestSeriesStatus(s.id, "active")}>Mark active</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTestSeriesStatus(s.id, "paused")}>Pause</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTestSeriesStatus(s.id, "completed")}>Mark completed</DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => {
                      if (confirm(`Delete "${s.title}"? This cannot be undone.`)) {
                        deleteTestSeries(s.id);
                        toast.success("Series deleted");
                      }
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </section>

      {/* Master timeline */}
      <section className="glass-strong rounded-3xl p-5 mb-10">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock className="h-4 w-4 text-foreground/70" />
          <h2 className="font-semibold">Master Timeline</h2>
          <span className="ml-auto text-xs text-muted-foreground">Active series only</span>
        </div>

        {timeline.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No tests scheduled in any active series.
          </div>
        ) : (
          <div className="space-y-3">
            {timeline.map(({ series, test }) => {
              const isPast = test.date < today;
              // Progress: mastered mapped topics / total mapped topics.
              let mastered = 0;
              let total = 0;
              for (const tid of test.mappedTopicIds) {
                const node = findNode(tid);
                if (!node) continue;
                total++;
                if (node.status === "mastered") mastered++;
              }
              const pct = total ? Math.round((mastered / total) * 100) : 0;
              return (
                <div key={test.id} className="glass rounded-2xl p-4 border border-white/50">
                  <div className="flex items-start gap-3 flex-wrap">
                    <DateChip date={test.date} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{test.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{series.title}</div>
                    </div>
                    {isPast && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-full text-xs bg-white/70 hover:bg-white"
                        onClick={() => setMarksTarget({ series, test })}
                      >
                        {test.marks != null ? `${test.marks}/${test.maxMarks}` : "Enter Marks"}
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-white/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--mint)] to-[var(--sky)] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                      {mastered}/{total} mastered
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Marks dialog */}
      <MarksDialog
        target={marksTarget}
        onClose={() => setMarksTarget(null)}
        onSave={(marks, maxMarks) => {
          if (!marksTarget) return;
          saveTestMarks(marksTarget.series.id, marksTarget.test.id, marks, maxMarks);
          toast.success("Marks saved");
          setMarksTarget(null);
        }}
      />

      {/* Upload dialog */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        topics={flatTopics.map((t) => ({ id: t.id, title: t.title }))}
        onParsed={(series) => {
          for (const s of series) addTestSeries(s);
        }}
      />
    </AppShell>
  );
}

function StatusPill({ status }: { status: TestSeries["status"] }) {
  const map = {
    active: "bg-mint/60 text-emerald-900",
    paused: "bg-peach/60 text-orange-900",
    completed: "bg-slate-200/80 text-slate-700",
  } as const;
  return (
    <span className={cn("rounded-full text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5", map[status])}>
      {status}
    </span>
  );
}

function DateChip({ date }: { date: string }) {
  const d = new Date(date + "T00:00:00");
  const month = d.toLocaleString("en", { month: "short" });
  const day = d.getDate();
  return (
    <div className="glass rounded-xl w-14 text-center py-1.5 shrink-0 border border-white/50">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{month}</div>
      <div className="text-lg font-bold leading-none">{day}</div>
    </div>
  );
}

function MarksDialog({
  target,
  onClose,
  onSave,
}: {
  target: { series: TestSeries; test: Test } | null;
  onClose: () => void;
  onSave: (marks: number, maxMarks: number) => void;
}) {
  const [marks, setMarks] = useState("");
  const [maxMarks, setMaxMarks] = useState("");

  useEffect(() => {
    if (target) {
      setMarks(target.test.marks != null ? String(target.test.marks) : "");
      setMaxMarks(target.test.maxMarks != null ? String(target.test.maxMarks) : "");
    }
  }, [target]);

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong z-[100] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Enter Marks</DialogTitle>
          <DialogDescription>{target?.test.title}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Marks</Label>
            <Input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} className="bg-white/60 rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max Marks</Label>
            <Input type="number" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} className="bg-white/60 rounded-xl" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onClose}>Cancel</Button>
          <Button
            className="rounded-full"
            onClick={() => {
              const m = parseFloat(marks);
              const mm = parseFloat(maxMarks);
              if (isNaN(m) || isNaN(mm) || mm <= 0) {
                toast.error("Enter valid marks");
                return;
              }
              onSave(m, mm);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null | undefined) => {
    if (!f) return;
    setDropped(f.name);
    toast.success(`Received ${f.name}. AI parsing coming soon.`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong z-[100] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Test Series Schedule</DialogTitle>
          <DialogDescription className="text-xs">
            Drop a PDF of your test series calendar. Parsing coming soon — for now we'll just show what you uploaded.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "w-full border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer",
            dragging ? "border-primary bg-primary/10" : "border-white/60 bg-white/30 hover:bg-white/50",
          )}
        >
          {dropped ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <div className="text-sm font-medium">{dropped}</div>
              <div className="text-xs text-muted-foreground">Queued for parsing.</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileUp className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm font-medium">Drop your schedule PDF here</div>
              <div className="text-xs text-muted-foreground">or click to browse</div>
            </div>
          )}
        </button>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

