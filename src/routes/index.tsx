import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusDot } from "@/components/StatusDot";
import { useStore } from "@/lib/store";
import { quotes } from "@/lib/mock-syllabus";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Minus, Quote, Play, Inbox, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Morning Intent — Cadence" },
      { name: "description", content: "Set your daily study intent with a forgiving, glassmorphic syllabus tracker for competitive exam aspirants." },
      { property: "og:title", content: "Morning Intent — Cadence" },
      { property: "og:description", content: "A calming spaced-repetition companion for exam prep." },
    ],
  }),
  component: MorningIntent,
});

function MorningIntent() {
  const { newTargets, dueToday, bucketNodes, bucket, dailyLimit, addToBucket, removeFromBucket } = useStore();
  const quote = useMemo(() => quotes[new Date().getDate() % quotes.length], []);
  const [tab, setTab] = useState("new");

  return (
    <AppShell>
      {/* Quote banner */}
      <div className="glass rounded-full px-5 py-3 flex items-center gap-3 mb-6">
        <div className="h-8 w-8 rounded-full bg-lavender/70 flex items-center justify-center shrink-0">
          <Quote className="h-4 w-4 text-foreground/70" />
        </div>
        <p className="text-sm font-medium italic text-foreground/80 truncate">"{quote}"</p>
      </div>

      <header className="mb-6">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Good morning.</h1>
        <p className="text-muted-foreground mt-1">Choose what today looks like — gently.</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* The Bank */}
        <section className="glass-strong rounded-3xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-lg">The Bank</h2>
              <p className="text-xs text-muted-foreground">Everything waiting for your attention.</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-white/40 backdrop-blur border border-white/50 rounded-full p-1 h-auto">
              <TabsTrigger value="new" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
                <Inbox className="h-3.5 w-3.5" /> New Targets
                <span className="text-xs opacity-60">{newTargets.length}</span>
              </TabsTrigger>
              <TabsTrigger value="due" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
                <CalendarClock className="h-3.5 w-3.5" /> Due Today
                <span className="text-xs opacity-60">{dueToday.length}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="mt-4">
              <BankList items={newTargets} bucket={bucket} onAdd={addToBucket} onRemove={removeFromBucket} full={bucket.length >= dailyLimit} />
            </TabsContent>
            <TabsContent value="due" className="mt-4">
              <BankList items={dueToday} bucket={bucket} onAdd={addToBucket} onRemove={removeFromBucket} full={bucket.length >= dailyLimit} />
            </TabsContent>
          </Tabs>
        </section>

        {/* Today's Bucket */}
        <section className="glass-strong rounded-3xl p-5 lg:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-lg">Today's Bucket</h2>
              <p className="text-xs text-muted-foreground">What you commit to studying today.</p>
            </div>
            <Link to="/revisions">
              <Button size="sm" className="rounded-full gap-1.5" disabled={bucket.length === 0}>
                <Play className="h-3.5 w-3.5" /> Start
              </Button>
            </Link>
          </div>

          {/* Capacity */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-foreground/70">Capacity</span>
              <span className="font-semibold">{bucket.length}/{dailyLimit} targets</span>
            </div>
            <div className="h-2 rounded-full bg-white/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--mint)] via-[var(--sky)] to-[var(--lavender)] transition-all"
                style={{ width: `${(bucket.length / dailyLimit) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex-1 space-y-2 min-h-[240px]">
            {bucketNodes.length === 0 ? (
              <div className="border-2 border-dashed border-white/60 rounded-2xl h-full min-h-[240px] flex flex-col items-center justify-center text-center px-6 py-12">
                <div className="h-12 w-12 rounded-full bg-white/50 flex items-center justify-center mb-3">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Your bucket is empty</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                  Tap <span className="font-semibold">+</span> on items in The Bank to commit them to today.
                </p>
              </div>
            ) : (
              bucketNodes.map((n) => (
                <div key={n.id} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
                  <StatusDot status={n.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground capitalize">{n.type}</div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/60" onClick={() => removeFromBucket(n.id)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {bucketNodes.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              🌤 Anything left overnight rolls over softly. No guilt.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function BankList({
  items, bucket, onAdd, onRemove, full,
}: { items: any[]; bucket: string[]; onAdd: (id: string) => void; onRemove: (id: string) => void; full: boolean }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Nothing here right now. Breathe.
      </div>
    );
  }
  return (
    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
      {items.map((n) => {
        const inBucket = bucket.includes(n.id);
        return (
          <div key={n.id} className={cn(
            "glass rounded-2xl px-4 py-3 flex items-center gap-3 transition-all",
            inBucket && "bg-white/70 border-primary/40"
          )}>
            <StatusDot status={n.status} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{n.title}</div>
              <div className="text-xs text-muted-foreground capitalize">{n.type}</div>
            </div>
            {inBucket ? (
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/60" onClick={() => onRemove(n.id)}>
                <Minus className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full hover:bg-primary/30 disabled:opacity-40"
                onClick={() => onAdd(n.id)}
                disabled={full}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
