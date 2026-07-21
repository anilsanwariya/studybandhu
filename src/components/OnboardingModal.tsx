import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { GraduationCap, BookOpen, Landmark, Ruler, Briefcase, FlaskConical, Feather, Calculator, Sparkles, Check } from "lucide-react";

const EXAMS = [
  { id: "RAS", label: "RAS", desc: "Rajasthan Administrative Services", icon: Landmark },
  { id: "UPSC", label: "UPSC", desc: "Civil Services Exam", icon: GraduationCap },
  { id: "State PCS", label: "State PCS", desc: "State Public Service", icon: BookOpen },
  { id: "Teaching", label: "Teaching Exams", desc: "CTET, TET, NET", icon: Feather },
  { id: "SSC", label: "SSC", desc: "Staff Selection Commission", icon: Ruler },
];

const BACKGROUNDS = [
  { id: "Engineering", icon: Ruler },
  { id: "Humanities", icon: Feather },
  { id: "Science", icon: FlaskConical },
  { id: "Commerce", icon: Calculator },
  { id: "Other", icon: Briefcase },
];

const YEARS = ["2026", "2027", "2028", "2029"];

export function OnboardingModal() {
  const { needsOnboarding, completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [exam, setExam] = useState("");
  const [background, setBackground] = useState("");
  const [year, setYear] = useState("");

  const finish = () => {
    completeOnboarding({ targetExam: exam, academicBackground: background, targetYear: year });
    setStep(1);
    setExam(""); setBackground(""); setYear("");
  };

  return (
    <Dialog open={needsOnboarding}>
      <DialogContent className="glass-strong border-white/60 rounded-3xl max-w-lg p-0 overflow-hidden [&>button]:hidden">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">Step {step} of 2</span>
            </div>
            <DialogTitle className="text-2xl">
              {step === 1 ? "What are you preparing for?" : "Tell us about you"}
            </DialogTitle>
            <DialogDescription>
              {step === 1 ? "Choose your target exam. You can change this later." : "Your background helps us tailor pacing."}
            </DialogDescription>
          </DialogHeader>

          <div className="h-1.5 rounded-full bg-white/50 overflow-hidden mb-5">
            <div className="h-full bg-gradient-to-r from-[var(--mint)] via-[var(--sky)] to-[var(--lavender)] transition-all" style={{ width: step === 1 ? "50%" : "100%" }} />
          </div>

          {step === 1 ? (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {EXAMS.map((e) => {
                const Icon = e.icon;
                const active = exam === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => setExam(e.id)}
                    className={cn(
                      "w-full glass rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition-all",
                      active && "bg-white/80 border-primary/60 ring-2 ring-primary/30"
                    )}
                  >
                    <div className="h-9 w-9 rounded-xl bg-lavender/60 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{e.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{e.desc}</div>
                    </div>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold mb-2">Academic Background</div>
                <div className="grid grid-cols-2 gap-2">
                  {BACKGROUNDS.map((b) => {
                    const Icon = b.icon;
                    const active = background === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => setBackground(b.id)}
                        className={cn(
                          "glass rounded-2xl px-3 py-3 flex items-center gap-2 text-left transition-all",
                          active && "bg-white/80 border-primary/60 ring-2 ring-primary/30"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{b.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-2">Target Exam Year</div>
                <div className="flex flex-wrap gap-2">
                  {YEARS.map((y) => (
                    <button
                      key={y}
                      onClick={() => setYear(y)}
                      className={cn(
                        "glass rounded-full px-4 py-2 text-sm font-medium transition-all",
                        year === y && "bg-white/80 border-primary/60 ring-2 ring-primary/30"
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-6">
            {step === 2 && (
              <Button variant="outline" className="rounded-full bg-white/60" onClick={() => setStep(1)}>
                Back
              </Button>
            )}
            {step === 1 ? (
              <Button className="flex-1 rounded-full" onClick={() => setStep(2)} disabled={!exam}>
                Continue
              </Button>
            ) : (
              <Button className="flex-1 rounded-full" onClick={finish} disabled={!background || !year}>
                Finish Setup
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
