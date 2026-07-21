import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  name: string;
  email: string;
  avatarUrl?: string;
  targetExam?: string;
  academicBackground?: string;
  targetYear?: string;
  joinedAt: string; // ISO
  onboarded: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  signIn: (u: { name: string; email: string; avatarUrl?: string }) => void;
  signOut: () => void;
  completeOnboarding: (data: { targetExam: string; academicBackground: string; targetYear: string }) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "studybandhu.auth.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  }, [user, hydrated]);

  const value: AuthCtx = {
    user,
    isAuthenticated: !!user,
    needsOnboarding: !!user && !user.onboarded,
    signIn: (u) => setUser({ ...u, joinedAt: new Date().toISOString(), onboarded: false }),
    signOut: () => setUser(null),
    completeOnboarding: (data) => setUser((prev) => (prev ? { ...prev, ...data, onboarded: true } : prev)),
    updateUser: (patch) => setUser((prev) => (prev ? { ...prev, ...patch } : prev)),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
