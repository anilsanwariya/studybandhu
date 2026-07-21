import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { GraduationCap, Sparkles, Check, AtSign, Loader2, X, BookOpen } from "lucide-react";
import { toast } from "sonner";

type UsernameState = "idle" | "checking" | "available" | "taken" | "invalid";

interface Exam { id: string; name: string; description: string | null; slug: string; }

interface Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editMode?: boolean;
}

export function OnboardingModal({ open, onOpenChange, editMode = false }: Props = {}) {
  const { user, needsOnboarding, completeOnboarding, updateUser } = useAuth();
  const controlled = open !== undefined;
  const isOpen = controlled ? !!open : needsOnboarding;

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [uState, setUState] = useState<UsernameState>("idle");
  const [checkTimer, setCheckTimer] = useState<number | null>(null);
  const [examId, setExamId] = useState<string>("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingExams(true);
    supabase.from("exams").select("id, name, description, slug").eq("is_published", true).order("name")
      .then(({ data }) => { setExams((data as Exam[]) ?? []); setLoadingExams(false); });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && editMode && user) {
      setStep(1);
      setUsername(user.username ?? "");
      setUState(user.username ? "available" : "idle");
      setExamId(user.targetExamId ?? "");
    } else if (isOpen && !editMode) {
      setStep(1);
    }
  }, [isOpen, editMode, user]);

  const validateUsername = async (val: string): Promise<UsernameState> => {
    const v = val.trim().toLowerCase();
    if (v.length < 3 || !/^[a-z0-9_]+$/.test(v)) return "invalid";
    if (editMode && user?.username && v === user.username) return "available";
    const { data } = await supabase.from("profiles").select("user_id").eq("username", v).maybeSingle();
    if (data) return "taken";
    return "available";
  };

  const onUsernameChange = (val: string) => {
    setUsername(val);
    if (checkTimer) window.clearTimeout(checkTimer);
    if (!val) { setUState("idle"); return; }
    setUState("checking");
    const t = window.setTimeout(async () => setUState(await validateUsername(val)), 500);
    setCheckTimer(t);
  };

  const finish = async () => {
    setSaving(true);
    const payload = {
      username: username.trim().toLowerCase(),
      targetExam: exams.find((e) => e.id === examId)?.name ?? "",
      targetExamId: examId,
      selectedSubjects: [] as string[],
      selectedChapters: [] as string[],
    };
    try {
      if (editMode) {
        await updateUser({ username: payload.username, targetExamId: payload.targetExamId });
        onOpenChange?.(false);
      } else {
        await completeOnboarding(payload);
      }
      toast.success(editMode ? "Preferences updated" : "You're all set!");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    }
    setSaving(false);
  };

  const canContinue1 = uState === "available";
  const canFinish = !!examId;

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
                {editMode ? "Edit preferences · " : ""}Step {step} of 2
              </span>
            </div>
            <DialogTitle className="text-2xl">
              {step === 1 ? (editMode ? "Update username" : "Pick a username") : "What are you preparing for?"}
            </DialogTitle>
            <DialogDescription>
              {step === 1 ? "Letters, numbers, underscores. 3+ characters." : "Choose your target exam. The syllabus loads automatically."}
            </DialogDescription>
          </DialogHeader>

          <div className="h-1.5 rounded-full bg-white/50 overflow-hidden mb-5">
            <div className="h-full bg-gradient-to-r from-[var(--mint)] via-[var(--sky)] to-[var(--lavender)] transition-all" style={{ width: `${(step / 2) * 100}%` }} />
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input autoFocus value={username} onChange={(e) => onUsernameChange(e.target.value)} placeholder="your_username" maxLength={24} className="pl-9 pr-10 glass rounded-2xl h-12 bg-white/60" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {uState === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {uState === "available" && <Check className="h-4 w-4 text-emerald-600" />}
                  {(uState === "taken" || uState === "invalid") && <X className="h-4 w-4 text-rose-500" />}
                </div>
              </div>
              <div className="text-xs min-h-[1.25rem]">
                {uState === "available" && <span className="text-emerald-700 font-medium">Nice — @{username.trim().toLowerCase()} is available.</span>}
                {uState === "taken" && <span className="text-rose-600 font-medium">That username is taken.</span>}
                {uState === "invalid" && <span className="text-rose-600 font-medium">3+ chars, only letters, numbers, and _</span>}
                {uState === "checking" && <span className="text-muted-foreground">Checking availability…</span>}
                {uState === "idle" && <span className="text-muted-foreground">Choose something you'll remember.</span>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {loadingExams && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading exams…</div>}
              {!loadingExams && exams.length === 0 && (
                <div className="glass rounded-2xl p-6 text-center">
                  <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">No exams available yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask an admin to publish an exam.</p>
                </div>
              )}
              {exams.map((e) => {
                const active = examId === e.id;
                return (
                  <button key={e.id} onClick={() => setExamId(e.id)} className={cn("w-full glass rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition-all", active && "bg-white/80 border-primary/60 ring-2 ring-primary/30")}>
                    <div className="h-9 w-9 rounded-xl bg-lavender/60 flex items-center justify-center shrink-0"><GraduationCap className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{e.name}</div>
                      {e.description && <div className="text-xs text-muted-foreground truncate">{e.description}</div>}
                    </div>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            {editMode && <Button variant="outline" className="rounded-full bg-white/60" onClick={() => onOpenChange?.(false)}>Cancel</Button>}
            {step > 1 && <Button variant="outline" className="rounded-full bg-white/60" onClick={() => setStep((s) => s - 1)}>Back</Button>}
            {step < 2 ? (
              <Button className="flex-1 rounded-full" onClick={() => setStep(2)} disabled={!canContinue1}>Continue</Button>
            ) : (
              <Button className="flex-1 rounded-full" onClick={finish} disabled={!canFinish || saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editMode ? "Save changes" : "Finish Setup"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
