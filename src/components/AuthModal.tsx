import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/lib/auth";
import { Mail, KeyRound, ArrowLeft } from "lucide-react";

export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"form" | "otp">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");

  const handleGoogle = () => {
    signIn({ name: "Aspirant", email: "aspirant@gmail.com", avatarUrl: undefined });
    onOpenChange(false);
  };

  const handleEmail = (useOtp: boolean) => {
    if (!email) return;
    if (useOtp) {
      setMode("otp");
      return;
    }
    signIn({ name: name || email.split("@")[0], email });
    onOpenChange(false);
  };

  const handleVerify = () => {
    if (otp.length !== 6) return;
    signIn({ name: name || email.split("@")[0], email });
    onOpenChange(false);
    setMode("form");
    setOtp("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-white/60 rounded-3xl max-w-md p-0 overflow-hidden [&>button]:hidden">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl">Welcome to StudyBandhu</DialogTitle>
            <DialogDescription>Sign in or create your account to begin.</DialogDescription>
          </DialogHeader>

          {mode === "otp" ? (
            <div className="space-y-5">
              <button onClick={() => setMode("form")} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <div className="text-center space-y-2">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-lavender/60 flex items-center justify-center">
                  <KeyRound className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="bg-white/60 border-white/70" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button className="w-full rounded-full" onClick={handleVerify} disabled={otp.length !== 6}>
                Verify & Continue
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="google">
              <TabsList className="bg-white/40 backdrop-blur border border-white/50 rounded-full p-1 h-auto w-full grid grid-cols-2">
                <TabsTrigger value="google" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Google
                </TabsTrigger>
                <TabsTrigger value="email" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Email
                </TabsTrigger>
              </TabsList>

              <TabsContent value="google" className="mt-5">
                <div className="glass rounded-2xl p-5 text-center space-y-4">
                  <p className="text-sm text-muted-foreground">One tap to sign in with your Google account.</p>
                  <Button onClick={handleGoogle} variant="outline" className="w-full rounded-full bg-white/70 hover:bg-white gap-2 h-11">
                    <GoogleIcon /> Continue with Google
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="email" className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="bg-white/60 border-white/70 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="bg-white/60 border-white/70 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-white/60 border-white/70 rounded-xl" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1 rounded-full" onClick={() => handleEmail(false)} disabled={!email || !password}>
                    Continue
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-full bg-white/60 gap-1.5" onClick={() => handleEmail(true)} disabled={!email}>
                    <Mail className="h-3.5 w-3.5" /> Send OTP
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
