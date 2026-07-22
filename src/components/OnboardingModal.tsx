import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AtSign, BookOpen, Check, ChevronRight, GraduationCap, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

type UsernameState = "idle" | "checking" | "available" | "taken" | "invalid";

interface Exam {
  id: string;
  name: string;
  description: string | null;
  slug: string;
}

interface SyllabusRow {
  id: string;
  parent_id: string | null;
  title: string;
  node_type: string;
  sort_order: number;
  depth: number;
}

interface L2Option {
  id: string;
  title: string;
  descendantCount: number;
}
interface L1Option {
  id: string;
  title: string;
  children: L2Option[];
}

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
  const [syllabus, setSyllabus] = useState<L1Option[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingSyllabus, setLoadingSyllabus] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [academicBackground, setAcademicBackground] = useState<string>("");
  const [targetYear, setTargetYear] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => String(currentYear + i));
  const backgroundOptions = ["12th Pass", "Undergraduate", "Graduate", "Postgraduate", "Working Professional", "Other"];

  const l1Label = "subject";
  const l2Label = "chapter";
  const hasL2 = true;

  useEffect(() => {
    if (!isOpen) return;
    setLoadingExams(true);
    supabase
      .from("exams")
      .select("id, name, description, slug")
      .eq("is_published", true)
      .order("name")
      .then(({ data }) => {
        setExams(((data as any[]) ?? []) as Exam[]);
        setLoadingExams(false);
      });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && editMode && user) {
      setStep(2);
      setUsername(user.username ?? "");
      setUState(user.username ? "available" : "idle");
      setExamId(user.targetExamId ?? "");
      setAcademicBackground(user.academicBackground ?? "");
      setTargetYear(user.targetYear ?? "");
      setSelectedSubjects(user.selectedSubjectIds ?? user.selectedSubjects ?? []);
      setSelectedChapters(user.selectedChapterIds ?? user.selectedChapters ?? []);
    } else if (isOpen && !editMode) {
      setStep(1);
      setUsername("");
      setUState("idle");
      setExamId("");
      setAcademicBackground("");
      setTargetYear("");
      setSyllabus([]);
      setSelectedSubjects([]);
      setSelectedChapters([]);
    }
  }, [isOpen, editMode, user]);

  useEffect(() => {
    if (!isOpen || !examId) {
      setSyllabus([]);
      return;
    }
    let cancelled = false;
    setLoadingSyllabus(true);
    supabase
      .from("syllabus_nodes")
      .select("id, parent_id, title, node_type, sort_order, depth")
      .eq("exam_id", examId)
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoadingSyllabus(false);
        if (error || !data) {
          setSyllabus([]);
          return;
        }
        const children = new Map<string | null, SyllabusRow[]>();
        (data as SyllabusRow[]).forEach((row) => {
          const list = children.get(row.parent_id) ?? [];
          list.push(row);
          children.set(row.parent_id, list);
        });
        // Count descendants beneath depth 1 (i.e. actual study items under each L2 group).
        const countLeaves = (id: string): number =>
          (children.get(id) ?? []).reduce((sum, row) => {
            const kids = children.get(row.id) ?? [];
            if (kids.length === 0) return sum + 1;
            return sum + countLeaves(row.id);
          }, 0);
        const next: L1Option[] = (children.get(null) ?? [])
          .filter((row) => row.depth === 0)
          .map((l1) => ({
            id: l1.id,
            title: l1.title,
            children: (children.get(l1.id) ?? [])
              .filter((row) => row.depth === 1)
              .map((l2) => ({
                id: l2.id,
                title: l2.title,
                descendantCount: countLeaves(l2.id),
              })),
          }));
        setSyllabus(next);
        setExpandedSubjects(next.slice(0, 3).map((l1) => l1.id));
        const allL1 = next.map((l1) => l1.id);
        const allL2 = next.flatMap((l1) => l1.children.map((c) => c.id));
        const sameExam = editMode && examId === user?.targetExamId;
        const savedSubjects = user?.selectedSubjectIds ?? user?.selectedSubjects ?? [];
        const savedChapters = user?.selectedChapterIds ?? user?.selectedChapters ?? [];
        setSelectedSubjects(sameExam && savedSubjects.length ? savedSubjects : allL1);
        setSelectedChapters(sameExam && savedChapters.length ? savedChapters : allL2);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    examId,
    editMode,
    user?.targetExamId,
    user?.selectedSubjectIds,
    user?.selectedChapterIds,
    user?.selectedSubjects,
    user?.selectedChapters,
  ]);

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
    if (!val) {
      setUState("idle");
      return;
    }
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
      academicBackground,
      targetYear,
      selectedSubjects,
      selectedChapters,
    };
    try {
      if (editMode) {
        await updateUser({
          username: payload.username,
          targetExamId: payload.targetExamId,
          academicBackground,
          targetYear,
          selectedSubjects,
          selectedChapters,
        });
        onOpenChange?.(false);
      } else {
        await completeOnboarding(payload);
      }
      toast.success(editMode ? "Preferences updated" : "You're all set!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  };

  const canContinue1 = uState === "available";
  const canContinue2 = !!examId && !!academicBackground && !!targetYear;
  const canFinish = !!examId && selectedSubjects.length > 0 && selectedChapters.length > 0;

  const onExamSelect = (id: string) => {
    if (id === examId) return;
    setExamId(id);
    setSyllabus([]);
    setSelectedSubjects([]);
    setSelectedChapters([]);
  };

  const toggleSubject = (l1: L1Option, checked: boolean) => {
    const l2Ids = l1.children.map((c) => c.id);
    if (checked) {
      setSelectedSubjects((prev) => Array.from(new Set([...prev, l1.id])));
      setSelectedChapters((prev) => Array.from(new Set([...prev, ...l2Ids])));
      setExpandedSubjects((prev) => Array.from(new Set([...prev, l1.id])));
    } else {
      setSelectedSubjects((prev) => prev.filter((id) => id !== l1.id));
      setSelectedChapters((prev) => prev.filter((id) => !l2Ids.includes(id)));
    }
  };

  const toggleChapter = (l1: L1Option, l2Id: string, checked: boolean) => {
    if (checked) {
      setSelectedSubjects((prev) => Array.from(new Set([...prev, l1.id])));
      setSelectedChapters((prev) => Array.from(new Set([...prev, l2Id])));
      return;
    }
    const remaining = selectedChapters.filter((id) => id !== l2Id);
    const l1L2Ids = l1.children.map((c) => c.id);
    setSelectedChapters(remaining);
    if (!remaining.some((id) => l1L2Ids.includes(id))) {
      setSelectedSubjects((prev) => prev.filter((id) => id !== l1.id));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={controlled ? onOpenChange : undefined}>
      <DialogContent className="glass-strong border-white/60 rounded-3xl max-w-2xl p-0 overflow-hidden [&>button]:hidden">
        <div className="p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {editMode ? `Edit preferences · Step ${step - 1} of 2` : `Step ${step} of 3`}
              </span>
            </div>
            <DialogTitle className="text-2xl">
              {step === 1 ? "Pick a username" : step === 2 ? "What are you preparing for?" : "Curate your syllabus"}
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? "Letters, numbers, underscores. 3+ characters."
                : step === 2
                  ? "Choose your target exam. The syllabus loads automatically."
                  : "Keep only the subjects and chapters you want to track."}
            </DialogDescription>
          </DialogHeader>

          <div className="h-1.5 rounded-full bg-white/50 overflow-hidden mb-5">
            <div
              className="h-full bg-gradient-to-r from-[var(--mint)] via-[var(--sky)] to-[var(--lavender)] transition-all"
              style={{ width: `${editMode ? ((step - 1) / 2) * 100 : (step / 3) * 100}%` }}
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
                {uState === "available" && (
                  <span className="text-emerald-700 font-medium">
                    Nice — @{username.trim().toLowerCase()} is available.
                  </span>
                )}
                {uState === "taken" && <span className="text-rose-600 font-medium">That username is taken.</span>}
                {uState === "invalid" && (
                  <span className="text-rose-600 font-medium">3+ chars, only letters, numbers, and _</span>
                )}
                {uState === "checking" && <span className="text-muted-foreground">Checking availability…</span>}
                {uState === "idle" && <span className="text-muted-foreground">Choose something you'll remember.</span>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {loadingExams && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading exams…
                </div>
              )}
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
                  <button
                    key={e.id}
                    onClick={() => onExamSelect(e.id)}
                    className={cn(
                      "w-full glass rounded-2xl px-4 py-3 flex items-start sm:items-center gap-3 text-left transition-all",
                      active && "bg-white/90 border-primary/60 ring-2 ring-primary/30",
                    )}
                  >
                    <div className="h-9 w-9 rounded-xl bg-lavender/60 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-snug break-words">{e.name}</div>
                      {e.description && (
                        <div className="text-xs text-muted-foreground break-words leading-tight mt-0.5">
                          {e.description}
                        </div>
                      )}
                    </div>
                    {active && <Check className="h-4 w-4 text-primary shrink-0 mt-1 sm:mt-0" />}
                  </button>
                );
              })}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground pl-1">Academic background</label>
                  <Select value={academicBackground} onValueChange={setAcademicBackground}>
                    <SelectTrigger className="glass rounded-2xl h-11 bg-white/60">
                      <SelectValue placeholder="Select background" />
                    </SelectTrigger>
                    {/* Z-[100] & solid bg fixed dropdown overlapping with background */}
                    <SelectContent className="z-[100] bg-white/95 backdrop-blur-xl shadow-xl border-white/40 max-h-[50vh]">
                      {backgroundOptions.map((b) => (
                        <SelectItem key={b} value={b} className="cursor-pointer">
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground pl-1">Target exam year</label>
                  <Select value={targetYear} onValueChange={setTargetYear}>
                    <SelectTrigger className="glass rounded-2xl h-11 bg-white/60">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-white/95 backdrop-blur-xl shadow-xl border-white/40 max-h-[50vh]">
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={y} className="cursor-pointer">
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {loadingSyllabus && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading syllabus…
                </div>
              )}
              {!loadingSyllabus && syllabus.length === 0 && (
                <div className="glass rounded-2xl p-6 text-center">
                  <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">No syllabus found for this exam.</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask an admin to upload and publish the syllabus.</p>
                </div>
              )}
              {syllabus.map((l1) => {
                const openL1 = expandedSubjects.includes(l1.id);
                const l2Ids = l1.children.map((c) => c.id);
                const checkedL2 = l2Ids.filter((id) => selectedChapters.includes(id)).length;
                const l1Checked = selectedSubjects.includes(l1.id) && (checkedL2 > 0 || l1.children.length === 0);
                return (
                  <div key={l1.id} className="glass rounded-2xl p-3 sm:p-4">
                    {/* Aligned items to 'start' so check/chevron stay at top even if text wraps */}
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSubjects((prev) => (openL1 ? prev.filter((id) => id !== l1.id) : [...prev, l1.id]))
                        }
                        className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/60 shrink-0 mt-0.5"
                        disabled={!hasL2 || l1.children.length === 0}
                      >
                        <ChevronRight className={cn("h-4 w-4 transition-transform", openL1 && "rotate-90")} />
                      </button>
                      <div className="pt-1.5 shrink-0">
                        <Checkbox checked={l1Checked} onCheckedChange={(v) => toggleSubject(l1, v === true)} />
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSubject(l1, !l1Checked)}
                        className="flex-1 min-w-0 text-left pt-0.5"
                      >
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                          {l1Label}
                        </div>
                        {/* Changed from truncate to break-words whitespace-normal for mobile */}
                        <div className="text-sm font-semibold break-words whitespace-normal leading-snug">
                          {l1.title}
                        </div>
                        {hasL2 && l1.children.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {checkedL2}/{l1.children.length} {l2Label} selected
                          </div>
                        )}
                      </button>
                    </div>
                    {openL1 && hasL2 && l1.children.length > 0 && (
                      <div className="mt-3 ml-7 sm:ml-10 space-y-1.5">
                        {l1.children.map((l2) => {
                          const l2Checked = selectedChapters.includes(l2.id);
                          return (
                            <label
                              key={l2.id}
                              className="flex items-start gap-3 rounded-xl px-2 py-2 sm:px-3 sm:py-2.5 hover:bg-white/45 cursor-pointer transition-colors"
                            >
                              <div className="pt-0.5 shrink-0">
                                <Checkbox
                                  checked={l2Checked}
                                  onCheckedChange={(v) => toggleChapter(l1, l2.id, v === true)}
                                />
                              </div>
                              <span className="flex-1 min-w-0 text-sm font-medium break-words leading-tight">
                                {l2.title}
                              </span>
                              <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">
                                {l2.descendantCount} items
                              </span>
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
              <Button variant="outline" className="rounded-full bg-white/60 h-11" onClick={() => onOpenChange?.(false)}>
                Cancel
              </Button>
            )}
            {step > 1 && !(editMode && step === 2) && (
              <Button variant="outline" className="rounded-full bg-white/60 h-11" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                className="flex-1 rounded-full h-11 text-sm font-semibold"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 ? !canContinue1 : !canContinue2}
              >
                Continue
              </Button>
            ) : (
              <Button
                className="flex-1 rounded-full h-11 text-sm font-semibold"
                onClick={finish}
                disabled={!canFinish || saving}
              >
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
