import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { Button } from "@/components/ui/button";
import { Sparkles, FileSearch, HeartHandshake, Sunrise, BarChart3, Users } from "lucide-react";

const features = [
  { icon: FileSearch, tint: "bg-lavender/60", emoji: "🤖", title: "AI Syllabus Parser", desc: "Convert syllabus PDFs into editable, structured topic trees in seconds." },
  { icon: HeartHandshake, tint: "bg-mint/60", emoji: "🧘", title: "Forgiving Revision Engine", desc: "Spaced repetition that adapts to missed days — no guilt, no pile-ups." },
  { icon: Sunrise, tint: "bg-peach/60", emoji: "🌅", title: "Morning Intent Planner", desc: "Daily motivation and capacity-based targets tuned to your energy." },
  { icon: BarChart3, tint: "bg-sky/60", emoji: "📊", title: "Granular Progress & Resets", desc: "Track read vs. mastered, and reset any chapter cleanly when needed." },
  { icon: Users, tint: "bg-blush/60", emoji: "👥", title: "Study Squads & Leaderboards", desc: "Compete and collaborate with peer groups preparing for the same exam." },
];

export function Landing() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen w-full">
      <header className="sticky top-0 z-40 w-full bg-white/70 backdrop-blur-xl backdrop-saturate-150 border-b border-white/60 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_8px_24px_-16px_rgba(60,60,120,0.15)]">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--lavender)] to-[var(--sky)] flex items-center justify-center shadow-sm">
              <Sparkles className="h-4.5 w-4.5 text-foreground/80" />
            </div>
            <div className="font-bold tracking-tight">StudyBandhu</div>
          </div>
          <Button onClick={() => setOpen(true)} className="rounded-full bg-white/70 hover:bg-white text-foreground border border-white/70 shadow-sm">
            Sign In / Sign Up
          </Button>
        </div>
      </header>


      <main className="px-4 lg:px-8 py-10 lg:py-16 max-w-6xl mx-auto">
        <section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Built for competitive exam aspirants
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold tracking-tight leading-tight">
            Why Choose <span className="bg-gradient-to-r from-[oklch(0.55_0.15_280)] via-[oklch(0.6_0.15_220)] to-[oklch(0.6_0.14_180)] bg-clip-text text-transparent">StudyBandhu</span> for Your Prep?
          </h1>
          <p className="text-muted-foreground mt-5 text-base lg:text-lg max-w-xl mx-auto">
            A calming, forgiving study companion that helps you pace, revise, and stay consistent — without the anxiety.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" onClick={() => setOpen(true)} className="rounded-full shadow-md">
              Get Started — It's Free
            </Button>
            <Button size="lg" variant="outline" className="rounded-full bg-white/60">
              See how it works
            </Button>
          </div>
        </section>

        <section className="mt-16 lg:mt-20 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`glass-strong rounded-3xl p-6 flex flex-col gap-3 ${i === 0 ? "lg:col-span-2" : ""}`}
            >
              <div className={`h-12 w-12 rounded-2xl ${f.tint} flex items-center justify-center text-2xl`}>
                {f.emoji}
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        <footer className="mt-16 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} StudyBandhu · Study, softly.
        </footer>
      </main>

      <AuthModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
