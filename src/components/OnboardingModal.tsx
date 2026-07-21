import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  AtSign,
  BookOpen,
  Check,
  ChevronRight,
  GraduationCap,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
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
}

interface SubjectOption {
  id: string;
  title: string;
  chapters: { id: string; title: string; topicCount: number }[];
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
  const [syllabus, setSyllabus] = useState<SubjectOption[]>([]);
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
  const backgroundOptions = [
    "12th Pass",
    "Undergraduate",
    "Graduate",
    "Postgraduate",
    "Working Professional",
    "Other",
  ];

  useEffect(() => {
    if (!isOpen) return;
    setLoadingExams(true);
    supabase
      .from("exams")
      .select("id, name, description, slug")
      .eq("is_published", true)
      .order("name")
      .then(({ data }) => {
        setExams((data as Exam[]) ?? []);
        setLoadingExams(false);
      });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && editMode && user) {
      setStep(1);
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
      .select("id, parent_id, title, node_type, sort_order")
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
        const countTopics = (id: string): number =>
          (children.get(id) ?? []).reduce((sum, row) => {
            if (row.node_type === "topic" || row.node_type === "subtopic") {
              return sum + 1 + countTopics(row.id);
            }
            return sum + countTopics(row.id);
          }, 0);
        const next = (children.get(null) ?? [])
          .filter((row) => row.node_type === "subject")
          .map((subject) => ({
            id: subject.id,
            title: subject.title,
            chapters: (children.get(subject.id) ?? [])
              .filter((row) => row.node_type === "chapter")
              .map((chapter) => ({
                id: chapter.id,
                title: chapter.title,
                topicCount: countTopics(chapter.id),
              })),
          }));
        setSyllabus(next);
        setExpandedSubjects(next.slice(0, 3).map((subject) => subject.id));
        const allSubjects = next.map((subject) => subject.id);
        const allChapters = next.flatMap((subject) =>
          subject.chapters.map((chapter) => chapter.id),
        );
        const sameExam = editMode && examId === user?.targetExamId;
        const savedSubjects = user?.selectedSubjectIds ?? user?.selectedSubjects ?? [];
        const savedChapters = user?.selectedChapterIds ?? user?.selectedChapters ?? [];
        setSelectedSubjects(sameExam && savedSubjects.length ? savedSubjects : allSubjects);
        setSelectedChapters(sameExam && savedChapters.length ? savedChapters : allChapters);
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
    const { data } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", v)
      .maybeSingle();
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

  const toggleSubject = (subject: SubjectOption, checked: boolean) => {
    const chapterIds = subject.chapters.map((chapter) => chapter.id);
    if (checked) {
      setSelectedSubjects((prev) => Array.from(new Set([...prev, subject.id])));
      setSelectedChapters((prev) => Array.from(new Set([...prev, ...chapterIds])));
      setExpandedSubjects((prev) => Array.from(new Set([...prev, subject.id])));
    } else {
      setSelectedSubjects((prev) => prev.filter((id) => id !== subject.id));
      setSelectedChapters((prev) => prev.filter((id) => !chapterIds.includes(id)));
    }
  };

  const toggleChapter = (subject: SubjectOption, chapterId: string, checked: boolean) => {
    if (checked) {
      setSelectedSubjects((prev) => Array.from(new Set([...prev, subject.id])));
      setSelectedChapters((prev) => Array.from(new Set([...prev, chapterId])));
      return;
    }
    const remaining = selectedChapters.filter((id) => id !== chapterId);
    const subjectChapterIds = subject.chapters.map((chapter) => chapter.id);
    setSelectedChapters(remaining);
    if (!remaining.some((id) => subjectChapterIds.includes(id))) {
      setSelectedSubjects((prev) => prev.filter((id) => id !== subject.id));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={controlled ? onOpenChange : undefined}>
      <DialogContent className="glass-strong border-white/60 rounded-3xl max-w-2xl p-0 overflow-hidden [&>button]:hidden">
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
              {step === 1
                ? editMode
                  ? "Update username"
                  : "Pick a username"
                : step === 2
                  ? "What are you preparing for?"
                  : "Curate your syllabus"}
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
                  {uState === "checking" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {uState === "available" && <Check className="h-4 w-4 text-emerald-600" />}
                  {(uState === "taken" || uState === "invalid") && (
                    <X className="h-4 w-4 text-rose-500" />
                  )}
                </div>
              </div>
              <div className="text-xs min-h-[1.25rem]">
                {uState === "available" && (
                  <span className="text-emerald-700 font-medium">
                    Nice — @{username.trim().toLowerCase()} is available.
                  </span>
                )}
                {uState === "taken" && (
                  <span className="text-rose-600 font-medium">That username is taken.</span>
                )}
                {uState === "invalid" && (
                  <span className="text-rose-600 font-medium">
                    3+ chars, only letters, numbers, and _
                  </span>
                )}
                {uState === "checking" && (
                  <span className="text-muted-foreground">Checking availability…</span>
                )}
                {uState === "idle" && (
                  <span className="text-muted-foreground">Choose something you'll remember.</span>
                )}
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Ask an admin to publish an exam.
                  </p>
                </div>
              )}
              {exams.map((e) => {
                const active = examId === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => onExamSelect(e.id)}
                    className={cn(
                      "w-full glass rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition-all",
                      active && "bg-white/80 border-primary/60 ring-2 ring-primary/30",
                    )}
                  >
                    <div className="h-9 w-9 rounded-xl bg-lavender/60 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{e.name}</div>
                      {e.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {e.description}
                        </div>
                      )}
                    </div>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground pl-1">
                    Academic background
                  </label>
                  <Select value={academicBackground} onValueChange={setAcademicBackground}>
                    <SelectTrigger className="glass rounded-2xl h-11 bg-white/60">
                      <SelectValue placeholder="Select background" />
                    </SelectTrigger>
                    <SelectContent>
                      {backgroundOptions.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground pl-1">
                    Target exam year
                  </label>
                  <Select value={targetYear} onValueChange={setTargetYear}>
                    <SelectTrigger className="glass rounded-2xl h-11 bg-white/60">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={y}>
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
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {loadingSyllabus && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading syllabus…
                </div>
              )}
              {!loadingSyllabus && syllabus.length === 0 && (
                <div className="glass rounded-2xl p-6 text-center">
                  <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">No syllabus found for this exam.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ask an admin to upload and publish the syllabus.
                  </p>
                </div>
              )}
              {syllabus.map((subject) => {
                const openSubject = expandedSubjects.includes(subject.id);
                const chapterIds = subject.chapters.map((chapter) => chapter.id);
                const checkedChapters = chapterIds.filter((id) =>
                  selectedChapters.includes(id),
                ).length;
                const subjectChecked = selectedSubjects.includes(subject.id) && checkedChapters > 0;
                return (
                  <div key={subject.id} className="glass rounded-2xl p-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSubjects((prev) =>
                            openSubject
                              ? prev.filter((id) => id !== subject.id)
                              : [...prev, subject.id],
                          )
                        }
                        className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/60"
                      >
                        <ChevronRight
                          className={cn("h-4 w-4 transition-transform", openSubject && "rotate-90")}
                        />
                      </button>
                      <Checkbox
                        checked={subjectChecked}
                        onCheckedChange={(v) => toggleSubject(subject, v === true)}
                      />
                      <button
                        type="button"
                        onClick={() => toggleSubject(subject, !subjectChecked)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-sm font-semibold truncate">{subject.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {checkedChapters}/{subject.chapters.length} chapters selected
                        </div>
                      </button>
                    </div>
                    {openSubject && (
                      <div className="mt-3 ml-10 space-y-2">
                        {subject.chapters.map((chapter) => {
                          const chapterChecked = selectedChapters.includes(chapter.id);
                          return (
                            <label
                              key={chapter.id}
                              className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/45 cursor-pointer"
                            >
                              <Checkbox
                                checked={chapterChecked}
                                onCheckedChange={(v) =>
                                  toggleChapter(subject, chapter.id, v === true)
                                }
                              />
                              <span className="flex-1 min-w-0 text-sm font-medium truncate">
                                {chapter.title}
                              </span>
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                {chapter.topicCount} topics
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
              <Button
                variant="outline"
                className="rounded-full bg-white/60"
                onClick={() => onOpenChange?.(false)}
              >
                Cancel
              </Button>
            )}
            {step > 1 && (
              <Button
                variant="outline"
                className="rounded-full bg-white/60"
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                className="flex-1 rounded-full"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 ? !canContinue1 : !canContinue2}
              >
                Continue
              </Button>
            ) : (
              <Button
                className="flex-1 rounded-full"
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
