import { Video, Brain, Eye, Award, ArrowRight } from 'lucide-react';

const steps = [
  {
    icon: Video,
    title: 'Kinematic Capture',
    tag: 'BlazePose Stream',
    color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
    description:
      'Candidates record practical demonstrations in real-time. Client-side vision extracts 33 skeletal keypoints without storing or exposing raw camera feeds.',
  },
  {
    icon: Brain,
    title: 'DTW Alignment',
    tag: 'Deterministic Edge',
    color: 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30',
    description:
      'Isolated edge functions run Dynamic Time Warping against certified exemplar models, computing rate, excursion depth, and joint alignment angles.',
  },
  {
    icon: Eye,
    title: 'Assessor Review',
    tag: 'Human Supervision',
    color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    description:
      'Accredited assessors inspect deterministic rubric scores alongside synchronized video playback, confirming or calibrating criteria before final sign-off.',
  },
  {
    icon: Award,
    title: 'Mint Credential',
    tag: 'SHA-256 Ledger',
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    description:
      'Certified passing scores generate tamper-evident credentials with cryptographic signatures and instant public QR verification.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-[#05070e] py-28 sm:py-36 border-y border-white/5 overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] ambient-glow-violet blur-[170px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[500px] h-[500px] ambient-glow-cyan blur-[170px] pointer-events-none" />
      <div className="absolute inset-0 bg-dots opacity-15 pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-headline font-bold tracking-tight sm:text-5xl text-white">
            From motion capture to{' '}
            <span className="text-gradient-cyan-violet">cryptographic credential</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            A deterministic verification pipeline built for regulatory rigor and institutional confidence.
          </p>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <div key={step.title} className="relative group">
              <div className="h-full rounded-2xl glass-card p-6 flex flex-col justify-between transition-all duration-300 group-hover:scale-[1.02]">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${step.color} border shadow-inner transition-transform group-hover:scale-110`}>
                      <step.icon className="h-6 w-6" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full bg-white/[0.04] text-slate-300 border border-white/10">
                      {step.tag}
                    </span>
                  </div>

                  <h3 className="text-lg font-headline font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-500">
                  <span>Phase {idx + 1}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/50 group-hover:bg-cyan-400 transition-colors" />
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="absolute -right-3.5 top-1/2 hidden -translate-y-1/2 lg:flex items-center justify-center z-20">
                  <div className="h-7 w-7 rounded-full bg-slate-950 border border-white/10 flex items-center justify-center text-slate-400 shadow-md">
                    <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
