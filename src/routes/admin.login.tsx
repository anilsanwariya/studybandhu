import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin — StudyBandhu" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user?.isAdmin) nav({ to: "/admin" });
  }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // Try sign in first; if user doesn't exist, try signup (so seeded admin can bootstrap).
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && /invalid/i.test(error.message)) {
      const up = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
      if (up.error) error = up.error as any;
      else { toast.success("Admin account created. Signing in…"); const s = await supabase.auth.signInWithPassword({ email, password }); error = s.error as any; }
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    // Give trigger a tick to grant role, then check.
    setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      if (!isAdmin) { await supabase.auth.signOut(); toast.error("Not an admin account."); }
      else nav({ to: "/admin" });
    }, 300);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-strong rounded-3xl p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center"><Lock className="h-5 w-5 text-primary-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold">Admin Console</h1>
            <p className="text-xs text-muted-foreground">Restricted access</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/60 border-white/70 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-white/60 border-white/70 rounded-xl" />
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
