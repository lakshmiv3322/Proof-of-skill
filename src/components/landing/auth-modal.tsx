import { useState, useEffect } from 'react';
import { Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Institute } from '@/types/database';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'signin' | 'signup';
}

const DEFAULT_INSTITUTES: Institute[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Apex Vocational Institute',
    slug: 'apex-vocational',
    plan_tier: 'growth',
    max_seats: 100,
    contact_email: 'admin@apex.edu',
    contact_phone: null,
    logo_url: null,
    is_active: true,
    settings: {
      allow_appeals: true,
      appeal_window_days: 14,
      require_human_review: true,
      certificate_template: 'standard',
      branding_color: '#00f0ff',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Northgate Technical College',
    slug: 'northgate-tech',
    plan_tier: 'enterprise',
    max_seats: 500,
    contact_email: 'admin@northgate.edu',
    contact_phone: null,
    logo_url: null,
    is_active: true,
    settings: {
      allow_appeals: true,
      appeal_window_days: 30,
      require_human_review: true,
      certificate_template: 'enterprise',
      branding_color: '#c89b3c',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function AuthModal({ open, onOpenChange, defaultTab = 'signin' }: AuthModalProps) {
  const [tab, setTab] = useState<'signin' | 'signup'>(defaultTab);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [institutes, setInstitutes] = useState<Institute[]>(DEFAULT_INSTITUTES);
  const [selectedInstituteId, setSelectedInstituteId] = useState<string>(DEFAULT_INSTITUTES[0].id);
  const [confirmationPendingEmail, setConfirmationPendingEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const { signIn, signUp, resendConfirmationEmail } = useAuth();

  useEffect(() => {
    setTab(defaultTab);
    setError(null);
    setConfirmationPendingEmail(null);
    setResendStatus(null);
  }, [defaultTab, open]);

  // Load active institutes for the sign-up dropdown with graceful offline fallback
  useEffect(() => {
    if (!open) return;
    async function loadInstitutes() {
      try {
        const { data, error } = await supabase
          .from('institutes')
          .select('*')
          .eq('is_active', true)
          .order('name');
        if (!error && data && data.length > 0) {
          const insts = data as Institute[];
          setInstitutes(insts);
          setSelectedInstituteId((prev) => prev || insts[0].id);
        } else {
          setInstitutes(DEFAULT_INSTITUTES);
          setSelectedInstituteId((prev) => prev || DEFAULT_INSTITUTES[0].id);
        }
      } catch {
        setInstitutes(DEFAULT_INSTITUTES);
        setSelectedInstituteId((prev) => prev || DEFAULT_INSTITUTES[0].id);
      }
    }
    loadInstitutes();
  }, [open]);

  // Reset error when switching tabs or opening
  useEffect(() => {
    setError(null);
    setIsSubmitting(false);
  }, [tab, open]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const { error } = await signIn(email, password);
    setIsSubmitting(false);
    if (error) {
      setError(error);
    } else {
      onOpenChange(false);
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    const instituteId = selectedInstituteId || (formData.get('institute') as string);
    if (!instituteId) {
      setError('Please select your institute.');
      setIsSubmitting(false);
      return;
    }
    const { error, needsConfirmation } = await signUp(email, password, fullName, instituteId);
    setIsSubmitting(false);
    if (error) {
      setError(error);
    } else if (needsConfirmation) {
      setConfirmationPendingEmail(email);
    } else {
      onOpenChange(false);
    }
  }

  async function handleResend() {
    if (!confirmationPendingEmail) return;
    setResendStatus('Resending...');
    const { error } = await resendConfirmationEmail(confirmationPendingEmail);
    if (error) {
      setResendStatus(`Error: ${error}`);
    } else {
      setResendStatus('Confirmation email sent! Check your inbox.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] glass-panel border-white/10 bg-[#070a12]/95 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 rounded-2xl">
        {confirmationPendingEmail ? (
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Mail className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-headline font-bold text-white">Check your email</h3>
              <p className="text-xs text-slate-300 font-mono leading-relaxed">
                We sent a confirmation link to <span className="text-cyan-400 font-semibold">{confirmationPendingEmail}</span>.
                Please click the link in your email to activate your account.
              </p>
            </div>

            {resendStatus && (
              <p className="text-xs font-mono text-cyan-300 bg-cyan-500/10 p-2.5 rounded-lg border border-cyan-500/20">
                {resendStatus}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                onClick={handleResend}
                className="w-full h-10 text-xs font-mono bg-white/10 hover:bg-white/20 text-white rounded-xl"
              >
                Resend Confirmation Email
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setConfirmationPendingEmail(null);
                  setTab('signin');
                }}
                className="w-full h-10 text-xs font-mono text-slate-400 hover:text-white"
              >
                Return to Sign In
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline font-bold text-white tracking-tight">
                {tab === 'signin' ? 'Welcome back' : 'Create your account'}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-slate-400">
                {tab === 'signin'
                  ? 'Sign in to access your assessment dashboard and telemetry.'
                  : 'Join your accredited institute and start building verifiable credentials.'}
              </DialogDescription>
            </DialogHeader>

            <Tabs value={tab} onValueChange={(v) => setTab(v as 'signin' | 'signup')} className="mt-2">
              <TabsList className="grid w-full grid-cols-2 bg-white/[0.04] p-1 rounded-xl border border-white/10 font-mono text-xs">
                <TabsTrigger value="signin" className="rounded-lg data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-500/30">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300 data-[state=active]:border data-[state=active]:border-purple-500/30">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-xs font-mono text-slate-300">Institutional Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="you@institute.edu"
                      autoComplete="email"
                      className="h-10 bg-white/[0.03] border-white/10 focus:border-cyan-400/50 rounded-xl text-xs font-mono text-slate-200"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-xs font-mono text-slate-300">Password</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-10 bg-white/[0.03] border-white/10 focus:border-cyan-400/50 rounded-xl text-xs font-mono text-slate-200"
                      required
                    />
                  </div>
                  {error && <p className="text-xs text-red-400 font-mono bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">{error}</p>}
                  <Button type="submit" className="w-full h-11 text-xs font-mono font-bold bg-gradient-to-r from-cyan-400 to-purple-500 text-slate-950 hover:from-cyan-300 hover:to-purple-400 shadow-glow-cyan rounded-xl" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? 'Authenticating…' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-5">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-xs font-mono text-slate-300">Full Name</Label>
                    <Input
                      id="signup-name"
                      name="fullName"
                      placeholder="Jane Doe"
                      autoComplete="name"
                      className="h-10 bg-white/[0.03] border-white/10 focus:border-cyan-400/50 rounded-xl text-xs font-mono text-slate-200"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-xs font-mono text-slate-300">Institutional Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="you@institute.edu"
                      autoComplete="email"
                      className="h-10 bg-white/[0.03] border-white/10 focus:border-cyan-400/50 rounded-xl text-xs font-mono text-slate-200"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-institute" className="text-xs font-mono text-slate-300">Accredited Institute</Label>
                    <Select name="institute" value={selectedInstituteId} onValueChange={setSelectedInstituteId}>
                      <SelectTrigger id="signup-institute" className="h-10 bg-white/[0.03] border-white/10 focus:border-cyan-400/50 rounded-xl text-xs font-mono text-slate-200">
                        <SelectValue
                          placeholder={
                            institutes.length === 0
                              ? 'Loading institutes…'
                              : 'Select your institute'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 border-white/10 text-slate-200 font-mono text-xs rounded-xl">
                        {institutes.map((inst) => (
                          <SelectItem key={inst.id} value={inst.id} className="focus:bg-cyan-500/20 focus:text-cyan-300">
                            {inst.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-xs font-mono text-slate-300">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      minLength={8}
                      className="h-10 bg-white/[0.03] border-white/10 focus:border-cyan-400/50 rounded-xl text-xs font-mono text-slate-200"
                      required
                    />
                  </div>
                  {error && <p className="text-xs text-red-400 font-mono bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">{error}</p>}
                  <Button type="submit" className="w-full h-11 text-xs font-mono font-bold bg-gradient-to-r from-cyan-400 to-purple-500 text-slate-950 hover:from-cyan-300 hover:to-purple-400 shadow-glow-cyan rounded-xl" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating account…' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
