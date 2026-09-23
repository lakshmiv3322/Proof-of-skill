import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingProps {
  onAuthClick: (tab: 'signin' | 'signup') => void;
}

const tiers = [
  {
    name: 'Starter',
    price: '$99',
    period: '/month',
    description: 'For specialized trade classrooms establishing digital kinematic verification.',
    features: [
      'Up to 50 active trainees',
      'Up to 2 certified trades',
      'Client-side BlazePose estimation',
      'Deterministic DTW rubric engine',
      '1 assessor seat',
      'Public QR verification registry',
    ],
    cta: 'Start 14-Day Pilot',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '$399',
    period: '/month',
    description: 'For accredited vocational institutes scaling multi-trade assessments across departments.',
    features: [
      'Up to 500 active trainees',
      'Unlimited trade rubrics',
      'BlazePose + DTW kinematics engine',
      '10 assessor seats',
      'AI coaching telemetry layer',
      'Multi-tenant institutional analytics',
      'Automated SHA-256 PDF credentials',
      'Transparent appeals workflow',
      'Priority technical support',
    ],
    cta: 'Launch Growth Tier',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For state systems, accrediting bodies, and multi-campus vocational colleges.',
    features: [
      'Unlimited trainees & cohorts',
      'Custom gold-standard exemplar clips',
      'Dedicated Edge Function runners',
      'Unlimited assessor & admin seats',
      'SSO & SAML integration',
      'LMS & SIS programmatic API',
      'Custom institutional certificate templates',
      'Dedicated compliance manager',
      '24/7 SLA & on-premise options',
    ],
    cta: 'Contact Enterprise Team',
    highlighted: false,
  },
];

export function Pricing({ onAuthClick }: PricingProps) {
  return (
    <section id="pricing" className="relative bg-[#05070e] py-28 sm:py-36 border-t border-white/5 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] ambient-glow-violet blur-[180px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-headline font-bold tracking-tight sm:text-5xl text-white">
            Transparent institutional <span className="text-gradient-cyan-violet">licensing</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300">
            Predictable per-institute licensing. All plans include PostgreSQL row-level security and immutable audit logging.
          </p>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-stretch">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                'relative flex flex-col justify-between rounded-3xl p-8 transition-all duration-300',
                tier.highlighted
                  ? 'glass-card border-cyan-500/40 shadow-glow-cyan lg:scale-105 bg-slate-900/80 z-10'
                  : 'glass-panel border-white/10 hover:border-white/20'
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1.5 bg-gradient-to-r from-cyan-400 to-purple-500 text-slate-950 font-bold font-mono text-[10px] px-3 py-1 rounded-full shadow-lg border-0">
                    <Sparkles className="h-3 w-3" />
                    Recommended for Institutes
                  </Badge>
                </div>
              )}

              <div>
                <div className="pb-4">
                  <h3 className="text-xl font-headline font-bold text-white">{tier.name}</h3>
                  <p className="text-xs text-slate-400 mt-2 min-h-[2.5rem] leading-relaxed">
                    {tier.description}
                  </p>
                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-4xl font-headline font-extrabold tracking-tight text-white">{tier.price}</span>
                    <span className="text-xs font-mono text-slate-400">{tier.period}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <ul className="space-y-3.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-xs">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                        <span className="text-slate-300 leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8">
                <Button
                  className={cn(
                    'w-full text-xs font-mono font-bold h-11 rounded-xl transition-all',
                    tier.highlighted
                      ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-slate-950 hover:from-cyan-300 hover:to-purple-400 shadow-glow-cyan'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200'
                  )}
                  size="lg"
                  variant={tier.highlighted ? 'default' : 'outline'}
                  onClick={() => onAuthClick('signup')}
                >
                  <Zap className="mr-2 h-3.5 w-3.5 fill-current" />
                  {tier.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-slate-400 font-mono">
          All tiers include zero raw video storage compliance, multi-tenant row-level security, and audit ledger immutability.
        </p>
      </div>
    </section>
  );
}
