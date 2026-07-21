import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { mockSyllabus } from "@/lib/mock-syllabus";
import { GraduationCap, BookOpen, Landmark, Ruler, Feather, Sparkles, Check, AtSign, Loader2, X } from "lucide-react";

const EXAMS = [
  { id: "RAS", label: "RAS", desc: "Rajasthan Administrative Services", icon: Landmark },
  { id: "UPSC", label: "UPSC", desc: "Civil Services Exam", icon: GraduationCap },
  { id: "State PCS", label: "State PCS", desc: "State Public Service", icon: BookOpen },
  { id: "Teaching", label: "Teaching Exams", desc: "CTET, TET, NET", icon: Feather },
  { id: "SSC", label: "SSC", desc: "Staff Selection Commission", icon: Ruler },
];

// Mock "taken" usernames to simulate uniqueness check.
const TAKEN = new Set(["admin", "test", "user", "aditya", "priya", "studybandhu"]);

type UsernameState = "idle" | "checking" | "available" | "taken" | "invalid";

interface OnboardingModalProps {
  /** Controlled open state for edit mode. If undefined, modal is driven by `needsOnboarding`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true, prefill from current user and save via updateUser instead of completeOnboarding. */
  editMode?: boolean;
}

export function OnboardingModal({ open, onOpenChange, editMode = false }: OnboardingModalProps = {}) {
  const { user, needsOnboarding, completeOnboarding, updateUser } = useAuth();
  const controlled = open !== undefined;
  const isOpen = controlled ? !!open : needsOnboarding;

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [uState, setUState] = useState<UsernameState>("idle");
  const [checkTimer, setCheckTimer] = useState<number | null>(null);
  const [exam, setExam] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);

  const subjectChapters = useMemo(
    () => mockSyllabus.map((s) => ({ id: s.id, title: s.title, chapters: (s.children ?? []).map((c) => ({ id: c.id, title: c.title })) })),
    []
  );

  // Prefill when opening in edit mode
  useEffect(() => {
    if (isOpen && editMode && user) {
      setStep(1);
      setUsername(user.username ?? "");
      setUState(user.username ? "available" : "idle");
      setExam(user.targetExam ?? "");
      setSelectedSubjects(user.selectedSubjects ?? []);
      setSelectedChapters(user.selectedChapters ?? []);
    }
  }, [isOpen, editMode, user]);

  const validateUsername = (val: string) => {
    const v = val.trim().toLowerCase();
    if (v.length < 3) return "invalid" as const;
    if (!/^[a-z0-9_]+$/.test(v)) return "invalid" as const;
    // Allow keeping your own username in edit mode
    if (editMode && user?.username && v === user.username) return "available" as const;
    return TAKEN.has(v) ? ("taken" as const) : ("available" as const);
  };

  const onUsernameChange = (val: string) => {
    setUsername(val);
    if (checkTimer) window.clearTimeout(checkTimer);
    if (!val) { setUState("idle"); return; }
    setUState("checking");
    const t = window.setTimeout(() => setUState(validateUsername(val)), 500);
    setCheckTimer(t);
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(id)) {
        const chs = subjectChapters.find((s) => s.id === id)?.chapters.map((c) => c.id) ?? [];
        setSelectedChapters((c) => c.filter((x) => !chs.includes(x)));
        return prev.filter((x) => x !== id);
      }
      const chs = subjectChapters.find((s) => s.id === id)?.chapters.map((c) => c.id) ?? [];
      setSelectedChapters((c) => Array.from(new Set([...c, ...chs])));
      return [...prev, id];
    });
  };

  const toggleChapter = (subjectId: string, chapterId: string) => {
    setSelectedChapters((prev) => {
      const has = prev.includes(chapterId);
      const next = has ? prev.filter((x) => x !== chapterId) : [...prev, chapterId];
      if (!has && !selectedSubjects.includes(subjectId)) {
        setSelectedSubjects((s) => [...s, subjectId]);
      }
      return next;
    });
  };

  const finish = () => {
    const payload = {
      username: username.trim().toLowerCase(),
      targetExam: exam,
      selectedSubjects,
      selectedChapters,
    };
    if (editMode) {
      updateUser(payload);
      onOpenChange?.(false);
    } else {
      completeOnboarding(payload);
      setStep(1); setUsername(""); setUState("idle"); setExam("");
      setSelectedSubjects([]); setSelectedChapters([]);
    }
  };

  const canContinue1 = uState === "available";
  const canContinue2 = !!exam;
  const canFinish = selectedSubjects.length > 0 && selectedChapters.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={controlled ? onOpenChange : undefined}>
      <DialogContent className="glass-strong border-white/60 rounded-3xl max-w-lg p-0 overflow-hidden [&>button]:hidden">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {editMode ? "Edit preferences · " : ""}Step {step} of 3
              </span>
            </div>
            <DialogTitle className="text-2xl">
              {step === 1 && (editMode ? "Update username" : "Pick a username")}
              {step === 2 && "What are you preparing for?"}
              {step === 3 && "Curate your syllabus"}
            </DialogTitle>
            <DialogDescription>
              {step === 1 && "This is how your squad will find you. Letters, numbers, underscores."}
              {step === 2 && "Choose your target exam. You can change this later."}
              {step === 3 && "Pick the subjects and chapters you'll focus on. You can toggle more anytime."}
            </DialogDescription>
          </DialogHeader>

          <div className="h-1.5 rounded-full bg-white/50 overflow-hidden mb-5">
            <div
              className="h-full bg-gradient-to-r from-[var(--mint)] via-[var(--sky)] to-[var(--lavender)] transition-all"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  value={username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  placeholder="your_username"
                  maxLength={24}
                  className="pl-9 pr-10 glass rounded-2xl h-12 bg-white/60"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {uState === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {uState === "available" && <Check className="h-4 w-4 text-emerald-600" />}
                  {(uState === "taken" || uState === "invalid") && <X className="h-4 w-4 text-rose-500" />}
                </div>
              </div>
              <div className="text-xs min-h-[1.25rem]">
                {uState === "available" && <span className="text-emerald-700 font-medium">Nice — @{username.trim().toLowerCase()} is available.</span>}
                {uState === "taken" && <span className="text-rose-600 font-medium">That username is taken. Try another.</span>}
                {uState === "invalid" && <span className="text-rose-600 font-medium">3+ chars, only letters, numbers, and _</span>}
                {uState === "checking" && <span className="text-muted-foreground">Checking availability…</span>}
                {uState === "idle" && <span className="text-muted-foreground">Choose something you'll remember.</span>}
              </div>
            </div>
          )}

          {step === 2 && (
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
          )}

          {step === 3 && (
            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {subjectChapters.map((s) => {
                const subjActive = selectedSubjects.includes(s.id);
                return (
                  <div key={s.id} className={cn("glass rounded-2xl p-3 transition-all", subjActive && "bg-white/70 border-primary/40")}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Checkbox checked={subjActive} onChange={() => toggleSubject(s.id)} />
                      <span className="font-semibold text-sm flex-1">{s.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {s.chapters.filter((c) => selectedChapters.includes(c.id)).length}/{s.chapters.length}
                      </span>
                    </label>
                    {subjActive && s.chapters.length > 0 && (
                      <div className="mt-2 ml-7 space-y-1.5">
                        {s.chapters.map((c) => {
                          const on = selectedChapters.includes(c.id);
                          return (
                            <label key={c.id} className="flex items-center gap-2.5 cursor-pointer text-sm">
                              <Checkbox checked={on} onChange={() => toggleChapter(s.id, c.id)} />
                              <span className={cn(on ? "text-foreground" : "text-muted-foreground")}>{c.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            {editMode && (
              <Button variant="outline" className="rounded-full bg-white/60" onClick={() => onOpenChange?.(false)}>
                Cancel
              </Button>
            )}
            {step > 1 && (
              <Button variant="outline" className="rounded-full bg-white/60" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                className="flex-1 rounded-full"
                onClick={() => setStep((s) => s + 1)}
                disabled={(step === 1 && !canContinue1) || (step === 2 && !canContinue2)}
              >
                Continue
              </Button>
            ) : (
              <Button className="flex-1 rounded-full" onClick={finish} disabled={!canFinish}>
                {editMode ? "Save changes" : "Finish Setup"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => { e.preventDefault(); onChange(); }}
      className={cn(
        "h-5 w-5 rounded-md border flex items-center justify-center transition-all shrink-0",
        checked ? "bg-primary border-primary" : "bg-white/70 border-white/80"
      )}
    >
      {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
    </span>
  );
}
