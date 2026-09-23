import { Button } from '@/components/ui/button';
import { ShieldCheck, Sparkles, Video } from 'lucide-react';

interface CTAProps {
  onAuthClick: (tab: 'signin' | 'signup') => void;
}

export function CTA({ onAuthClick }: CTAProps) {
  return (
    <section className="relative py-28 sm:py-36 bg-[#070a12] overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl glass-card border border-white/10 px-8 py-20 sm:px-20 sm:py-28 shadow-glass">
          {/* Background ambient light */}
          <div className="absolute left-1/2 top-0 h-[450px] w-[550px] -translate-x-1/2 rounded-full ambient-glow-cyan blur-[130px] pointer-events-none" />
          <div className="absolute right-0 bottom-0 h-[400px] w-[400px] ambient-glow-violet blur-[140px] pointer-events-none" />
          <div className="absolute inset-0 bg-grid opacity-15 pointer-events-none" />

          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mb-8 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30 shadow-glow-cyan">
                <ShieldCheck className="h-8 w-8" />
              </div>
            </div>
            <h2 className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-5xl font-headline">
              Ready to modernize your institute with{' '}
              <span className="text-gradient-cyan-violet">biometric verification?</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-balance text-sm sm:text-base text-slate-300 leading-relaxed font-sans">
              Join leading trade schools and vocational departments moving from subjective paper scoring to deterministic, verifiable skill assessment.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-12 px-8 text-xs font-mono font-bold bg-gradient-to-r from-cyan-400 to-purple-500 text-slate-950 hover:from-cyan-300 hover:to-purple-400 shadow-glow-cyan rounded-xl transition-all hover:scale-[1.02]"
                onClick={() => onAuthClick('signup')}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Start 14-Day Pilot
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 px-8 text-xs font-mono rounded-xl backdrop-blur-md transition-all"
                onClick={() => onAuthClick('signin')}
              >
                <Video className="mr-2 h-4 w-4 text-cyan-400" />
                Sign In to Portal
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
