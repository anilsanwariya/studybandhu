import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  username?: string;
  targetExam?: string;
  targetExamId?: string;
  academicBackground?: string;
  targetYear?: string;
  selectedSubjects?: string[];
  selectedChapters?: string[];
  selectedSubjectIds?: string[];
  selectedChapterIds?: string[];
  joinedAt: string;
  onboarded: boolean;
  isAdmin: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  needsOnboarding: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (email: string, password: string, name?: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  completeOnboarding: (data: { username: string; targetExam: string; targetExamId?: string; selectedSubjects: string[]; selectedChapters: string[] }) => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function loadProfile(u: User): Promise<AuthUser> {
  const [profileRes, roleRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", u.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", u.id),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (roleRes.error) throw roleRes.error;
  const p: any = profileRes.data ?? {};
  let targetExam: string | undefined;
  if (p.target_exam_id) {
    const { data: exam } = await supabase.from("exams").select("name").eq("id", p.target_exam_id).maybeSingle();
    targetExam = exam?.name;
  }
  const isAdmin = (roleRes.data ?? []).some((r: any) => r.role === "admin");
  const meta: any = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? "",
    name: p.name ?? meta.name ?? meta.full_name ?? (u.email?.split("@")[0] ?? "Aspirant"),
    avatarUrl: p.avatar_url ?? meta.avatar_url,
    username: p.username ?? undefined,
    targetExamId: p.target_exam_id ?? undefined,
    targetExam,
    academicBackground: p.academic_background ?? undefined,
    targetYear: p.target_year ?? undefined,
    selectedSubjects: p.selected_subject_ids ?? [],
    selectedChapters: p.selected_chapter_ids ?? [],
    selectedSubjectIds: p.selected_subject_ids ?? [],
    selectedChapterIds: p.selected_chapter_ids ?? [],
    joinedAt: p.created_at ?? u.created_at ?? new Date().toISOString(),
    onboarded: !!p.onboarded,
    isAdmin,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user).then(setUser).catch(console.error), 0);
      } else {
        setUser(null);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        try { setUser(await loadProfile(data.session.user)); } catch (e) { console.error(e); }
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) setUser(await loadProfile(data.user));
  };

  const value: AuthCtx = {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    isAdmin: !!user?.isAdmin,
    needsOnboarding: !!user && !user.onboarded && !user.isAdmin,
    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    signUpWithPassword: async (email, password, name) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: name ? { name } : undefined },
      });
      return { error: error?.message };
    },
    signInWithGoogle: async () => {
      const { lovable } = await import("@/integrations/lovable");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) return { error: result.error instanceof Error ? result.error.message : String(result.error) };
      return {};
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setUser(null);
    },
    completeOnboarding: async (data) => {
      if (!user) return;
      const onboardingPatch: any = {
        user_id: user.id,
        username: data.username,
        target_exam_id: data.targetExamId ?? null,
        selected_subject_ids: data.selectedSubjects,
        selected_chapter_ids: data.selectedChapters,
        onboarded: true,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("profiles").upsert(onboardingPatch, { onConflict: "user_id" });
      if (error) throw error;
      await refresh();
    },
    updateUser: async (patch) => {
      if (!user) return;
      const dbPatch: any = {};
      if (patch.username !== undefined) dbPatch.username = patch.username;
      if (patch.targetExamId !== undefined) dbPatch.target_exam_id = patch.targetExamId;
      if (patch.selectedSubjects !== undefined) dbPatch.selected_subject_ids = patch.selectedSubjects;
      if (patch.selectedChapters !== undefined) dbPatch.selected_chapter_ids = patch.selectedChapters;
      if (patch.selectedSubjectIds !== undefined) dbPatch.selected_subject_ids = patch.selectedSubjectIds;
      if (patch.selectedChapterIds !== undefined) dbPatch.selected_chapter_ids = patch.selectedChapterIds;
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.academicBackground !== undefined) dbPatch.academic_background = patch.academicBackground;
      if (patch.targetYear !== undefined) dbPatch.target_year = patch.targetYear;
      if (Object.keys(dbPatch).length) {
        dbPatch.user_id = user.id;
        dbPatch.updated_at = new Date().toISOString();
        const { error } = await supabase.from("profiles").upsert(dbPatch, { onConflict: "user_id" });
        if (error) throw error;
      }
      await refresh();
    },
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
