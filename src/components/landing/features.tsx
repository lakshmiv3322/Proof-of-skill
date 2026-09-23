import {
  Video,
  Brain,
  FileCheck,
  ShieldCheck,
  BarChart3,
  Users,
  Eye,
  Award,
} from 'lucide-react';


const features = [
  {
    icon: Video,
    title: 'Kinematic Video Capture',
    badge: 'BlazePose 33-pt',
    color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
    description:
      'Trainees record real-world skill demonstrations. Client-side BlazePose extracts 33 joints frame-by-frame with zero raw video retention.',
  },
  {
    icon: Brain,
    title: 'Deterministic DTW Scoring',
    badge: 'Server-side Edge',
    color: 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30',
    description:
      'Dynamic Time Warping aligns performance curves mathematically against certified gold-standard reference models with zero hallucinations.',
  },
  {
    icon: Eye,
    title: 'Supervised Assessor Review',
    badge: 'Double Signature',
    color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
    description:
      'Certified domain assessors review deterministic scores, override or calibrate criteria, and append timestamped feedback before issuance.',
  },
  {
    icon: FileCheck,
    title: 'Cryptographic Certificates',
    badge: 'SHA-256 Hash',
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
    description:
      'Passing submissions generate official credentials with immutable cryptographic verification hashes and public unauthenticated QR links.',
  },
  {
    icon: BarChart3,
    title: 'Institutional Telemetry',
    badge: 'Cohort Analytics',
    color: 'from-cyan-500/20 to-teal-500/20 text-cyan-400 border-cyan-500/30',
    description:
      'Track cohort performance trends, assessor calibration distributions, and program completion outcomes across your entire institute.',
  },
  {
    icon: Users,
    title: 'Multi-Tenant Isolation',
    badge: 'Row-Level Security',
    color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30',
    description:
      'PostgreSQL Row-Level Security ensures complete data boundaries between institutes, trainees, assessors, and administrators.',
  },
  {
    icon: ShieldCheck,
    title: 'Immutable Audit Ledger',
    badge: 'Append-Only',
    color: 'from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30',
    description:
      'Every submission, scoring event, human override, and certificate mint is permanently timestamped for regulatory compliance.',
  },
  {
    icon: Award,
    title: 'Transparent Appeals Workflow',
    badge: 'Due Process',
    color: 'from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30',
    description:
      'Built-in appeals mechanism enables trainees to contest evaluations transparently backed by comprehensive historic telemetry.',
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-28 sm:py-36 bg-[#070a12] overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] ambient-glow-cyan blur-[150px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] ambient-glow-violet blur-[160px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-headline font-bold tracking-tight sm:text-5xl text-white">
            Engineered for <span className="text-gradient-cyan-violet">objective certification</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            A unified platform for practical vocational assessment, deterministic kinematics, and verifiable credentialing.
          </p>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-2xl glass-card p-6 transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} border shadow-inner transition-transform group-hover:scale-110`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/[0.04] text-slate-300 border border-white/10">
                  {feature.badge}
                </span>
              </div>
              <h3 className="text-base font-headline font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                {feature.title}
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
