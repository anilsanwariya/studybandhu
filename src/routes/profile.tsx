import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Mail, GraduationCap, BookOpen, Calendar, Flame, Zap, CheckCircle2, LogOut, KeyRound, AtSign, SlidersHorizontal, Loader2, Check, X } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — StudyBandhu" },
      { name: "description", content: "Your StudyBandhu profile, study stats, and account settings." },
    ],
  }),
  component: ProfilePage,
});

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

function ProfilePage() {
  const { user, signOut, updateUser } = useAuth();
  const { streak, xp, flatTopics } = useStore();
  const [editOpen, setEditOpen] = useState(false);
  const [usernameOpen, setUsernameOpen] = useState(false);

  if (!user) {
    return (
      <AppShell>
        <div className="glass-strong rounded-3xl p-8 text-center">
          <p className="text-muted-foreground">Please sign in to view your profile.</p>
          <Link to="/"><Button className="rounded-full mt-4">Go home</Button></Link>
        </div>
      </AppShell>
    );
  }

  const mastered = flatTopics.filter((n) => n.status === "mastered").length;
  const joined = new Date(user.joinedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <AppShell>
      <header className="glass-strong rounded-3xl p-6 lg:p-8 mb-6 flex flex-col md:flex-row items-center md:items-start gap-5">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[var(--lavender)] to-[var(--sky)] flex items-center justify-center text-2xl font-bold shadow-sm">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full rounded-3xl object-cover" /> : initials(user.name)}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{user.name}</h1>
          {user.username && <div className="text-sm text-muted-foreground">@{user.username}</div>}
          <div className="flex items-center justify-center md:justify-start gap-1.5 text-sm text-muted-foreground mt-1">
            <Mail className="h-3.5 w-3.5" /> {user.email}
          </div>
          <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
            {user.targetExam && <span className="glass rounded-full px-3 py-1 text-xs font-semibold">🎯 {user.targetExam} {user.targetYear && `· ${user.targetYear}`}</span>}
            {user.academicBackground && <span className="glass rounded-full px-3 py-1 text-xs font-semibold">🎓 {user.academicBackground}</span>}
            {user.selectedSubjects?.length ? <span className="glass rounded-full px-3 py-1 text-xs font-semibold">📚 {user.selectedSubjects.length} subjects · {user.selectedChapters?.length ?? 0} chapters</span> : null}
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)} className="rounded-full gap-2 shrink-0">
          <SlidersHorizontal className="h-4 w-4" /> Edit preferences
        </Button>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="glass-strong rounded-3xl p-6 lg:col-span-2">
          <h2 className="font-semibold text-lg mb-4">User Details</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <DetailRow icon={GraduationCap} label="Target Exam" value={user.targetExam ?? "—"} />
            <DetailRow icon={BookOpen} label="Academic Background" value={user.academicBackground ?? "—"} />
            <DetailRow icon={Calendar} label="Target Year" value={user.targetYear ?? "—"} />
            <DetailRow icon={Mail} label="Email" value={user.email} />
          </div>
        </section>

        <section className="glass-strong rounded-3xl p-6">
          <h2 className="font-semibold text-lg mb-4">Study Stats</h2>
          <div className="space-y-3">
            <StatRow icon={Calendar} tint="bg-lavender/60" label="Joined" value={joined} />
            <StatRow icon={Zap} tint="bg-peach/60" label="Total XP" value={`${xp}`} />
            <StatRow icon={Flame} tint="bg-blush/60" label="Current Streak" value={`${streak} days`} />
            <StatRow icon={CheckCircle2} tint="bg-mint/60" label="Mastered Topics" value={`${mastered}`} />
          </div>
        </section>

        <section className="glass-strong rounded-3xl p-6 lg:col-span-3">
          <h2 className="font-semibold text-lg mb-4">Account Settings</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <Button onClick={() => setUsernameOpen(true)} variant="outline" className="rounded-2xl bg-white/60 h-auto py-4 flex flex-col items-start gap-1">
              <div className="flex items-center gap-2 text-sm font-semibold"><AtSign className="h-3.5 w-3.5" /> Change Username</div>
              <span className="text-xs text-muted-foreground font-normal">Pick a new @handle</span>
            </Button>
            <Button variant="outline" className="rounded-2xl bg-white/60 h-auto py-4 flex flex-col items-start gap-1">
              <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-3.5 w-3.5" /> Change Password</div>
              <span className="text-xs text-muted-foreground font-normal">Update your account password</span>
            </Button>
            <Button
              onClick={signOut}
              variant="outline"
              className="rounded-2xl bg-white/60 h-auto py-4 flex flex-col items-start gap-1 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
            >
              <div className="flex items-center gap-2 text-sm font-semibold"><LogOut className="h-3.5 w-3.5" /> Sign Out</div>
              <span className="text-xs text-muted-foreground font-normal">End your current session</span>
            </Button>
          </div>
        </section>
      </div>
      <OnboardingModal open={editOpen} onOpenChange={setEditOpen} editMode />
      <ChangeUsernameDialog
        open={usernameOpen}
        onOpenChange={setUsernameOpen}
        currentUsername={user.username ?? ""}
        onSave={async (u) => { await updateUser({ username: u }); }}
      />
    </AppShell>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, tint, label, value }: { icon: any; tint: string; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-xl ${tint} flex items-center justify-center shrink-0`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ChangeUsernameDialog({
  open, onOpenChange, currentUsername, onSave,
}: { open: boolean; onOpenChange: (o: boolean) => void; currentUsername: string; onSave: (u: string) => Promise<void> }) {
  const [value, setValue] = useState(currentUsername);
  const [state, setState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [saving, setSaving] = useState(false);

  const onChange = (v: string) => {
    setValue(v);
    const trimmed = v.trim().toLowerCase();
    if (!trimmed) { setState("idle"); return; }
    if (trimmed === currentUsername) { setState("available"); return; }
    if (trimmed.length < 3 || !/^[a-z0-9_]+$/.test(trimmed)) { setState("invalid"); return; }
    setState("checking");
    window.setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("user_id").eq("username", trimmed).maybeSingle();
      setState(data ? "taken" : "available");
    }, 300);
  };

  const save = async () => {
    if (state !== "available") return;
    setSaving(true);
    try {
      await onSave(value.trim().toLowerCase());
      toast.success("Username updated");
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) { setValue(currentUsername); setState("available"); } }}>
      <DialogContent className="glass-strong border-white/60 rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle>Change username</DialogTitle>
          <DialogDescription>Letters, numbers, underscores. 3+ characters.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Username</Label>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              maxLength={24}
              className="pl-9 pr-10 glass rounded-2xl h-11 bg-white/60"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {state === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {state === "available" && <Check className="h-4 w-4 text-emerald-600" />}
              {(state === "taken" || state === "invalid") && <X className="h-4 w-4 text-rose-500" />}
            </div>
          </div>
          <div className="text-xs min-h-[1.25rem]">
            {state === "taken" && <span className="text-rose-600 font-medium">That username is taken.</span>}
            {state === "invalid" && <span className="text-rose-600 font-medium">3+ chars, only letters, numbers, and _</span>}
            {state === "available" && value.trim().toLowerCase() !== currentUsername && (
              <span className="text-emerald-700 font-medium">Nice — @{value.trim().toLowerCase()} is available.</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full bg-white/60" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="rounded-full" onClick={save} disabled={state !== "available" || saving || value.trim().toLowerCase() === currentUsername}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
