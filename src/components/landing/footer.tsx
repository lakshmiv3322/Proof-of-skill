import { ShieldCheck, Twitter, Linkedin, Github, ExternalLink } from 'lucide-react';

const footerLinks = {
  Product: ['Features', 'Pricing', 'Demo Report', 'BlazePose Kinematics'],
  Company: ['About Us', 'Accreditation', 'Blog', 'Security Whitepaper'],
  Resources: ['Rubric Standards', 'AHA Guidelines', 'Edge API Docs', 'Status Page'],
  Legal: ['Privacy Policy', 'Zero Video Retention', 'FERPA Compliance', 'Terms'],
};

interface FooterProps {
  onVerifyClick?: () => void;
}

export function Footer({ onVerifyClick }: FooterProps) {
  return (
    <footer className="border-t border-white/10 bg-[#05070e] text-slate-400 font-sans">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 shadow-glow-cyan">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="text-lg font-headline font-bold tracking-tight text-white">
                Proof<span className="text-gradient-cyan-violet">OfSkill</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-xs text-slate-400 leading-relaxed">
              Deterministic vision kinematics and cryptographically verifiable skill credentials for modern institutions.
            </p>
            <div className="mt-5">
              <button
                onClick={onVerifyClick}
                className="inline-flex items-center gap-2 text-xs text-amber-300 font-semibold font-mono hover:text-amber-200 transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span>Public Registry Verifier</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-6 flex gap-3">
              {[Twitter, Linkedin, Github].map((Icon, idx) => (
                <a
                  key={idx}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 transition-all hover:border-cyan-400/40 hover:text-cyan-300 hover:shadow-glow-cyan"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 mb-4">{category}</h4>
              <ul className="space-y-3 text-xs text-slate-400 font-mono">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="transition-colors hover:text-cyan-300"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row text-xs text-slate-500 font-mono">
          <p>
            &copy; 2026 ProofOfSkill, Inc. All rights reserved.
          </p>
          <p>
            Zero raw video retention · Row-Level Security · SHA-256 Ledger
          </p>
        </div>
      </div>
    </footer>
  );
}
