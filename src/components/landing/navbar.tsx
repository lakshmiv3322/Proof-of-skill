import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Menu, X, Sparkles, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

interface NavbarProps {
  onAuthClick: (tab: 'signin' | 'signup') => void;
  onVerifyClick?: () => void;
}

const navLinks = [
  { label: 'Kinematics', href: '#features' },
  { label: 'Protocol', href: '#how-it-works' },
  { label: 'Calibration Ledger', href: '#demo-report' },
  { label: 'Licensing', href: '#pricing' },
];

export function Navbar({ onAuthClick, onVerifyClick }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, user, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-white/10 bg-[#070a12]/80 backdrop-blur-xl shadow-2xl shadow-black/60'
          : 'border-b border-transparent bg-transparent'
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 shadow-glow-cyan transition-transform group-hover:scale-105">
            <ShieldCheck className="h-5 w-5" />
            <div className="absolute inset-0 rounded-xl bg-cyan-400/10 blur-sm pointer-events-none" />
          </div>
          <div>
            <span className="text-lg font-headline font-bold text-white tracking-tight block leading-tight">
              Proof<span className="text-gradient-cyan-violet">OfSkill</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400 block tracking-wider uppercase">
              Vision Agent Protocol
            </span>
          </div>
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex text-xs font-mono">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-slate-300 transition-colors hover:text-cyan-300 hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 md:flex">
          {onVerifyClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onVerifyClick}
              className="h-8 gap-1.5 border-amber-500/30 bg-amber-500/5 text-amber-300 hover:bg-amber-500/15 hover:text-amber-200 hover:border-amber-400/50 font-mono text-xs rounded-lg transition-all"
            >
              <Key className="h-3 w-3 text-amber-400" />
              Public Verifier
            </Button>
          )}
          {isAuthenticated ? (
            <>
              <Badge variant="secondary" className="gap-2 font-mono text-xs bg-slate-900/90 border-white/10 text-slate-200 py-1 px-3 rounded-lg">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                {user?.full_name}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="h-8 font-mono text-xs border-white/10 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg"
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAuthClick('signin')}
                className="h-8 font-mono text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg"
              >
                Sign In
              </Button>
              <Button
                size="sm"
                onClick={() => onAuthClick('signup')}
                className="h-8 font-mono text-xs font-semibold bg-gradient-to-r from-cyan-400 to-purple-500 text-slate-950 hover:from-cyan-300 hover:to-purple-400 shadow-glow-cyan rounded-lg border-0 transition-all hover:scale-[1.02]"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-slate-950" />
                Launch Live Pilot
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-slate-300 hover:text-white p-2 rounded-lg bg-white/5 border border-white/10"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#070a12]/95 backdrop-blur-2xl px-4 py-5 md:hidden font-mono text-xs shadow-2xl">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-slate-300 transition-colors hover:text-cyan-300 py-1.5"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
              {onVerifyClick && (
                <Button
                  variant="outline"
                  className="w-full justify-center gap-1.5 border-amber-500/30 text-amber-300 text-xs font-mono rounded-lg"
                  onClick={() => {
                    setMobileOpen(false);
                    onVerifyClick();
                  }}
                >
                  <Key className="h-3.5 w-3.5 text-amber-400" />
                  Public Registry Verifier
                </Button>
              )}
              {isAuthenticated ? (
                <Button variant="outline" className="flex-1 font-mono text-xs rounded-lg" onClick={signOut}>
                  Sign Out
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 font-mono text-xs border-white/10 text-slate-300 rounded-lg"
                    onClick={() => {
                      setMobileOpen(false);
                      onAuthClick('signin');
                    }}
                  >
                    Sign In
                  </Button>
                  <Button
                    className="flex-1 font-mono text-xs font-semibold bg-gradient-to-r from-cyan-400 to-purple-500 text-slate-950 rounded-lg shadow-glow-cyan"
                    onClick={() => {
                      setMobileOpen(false);
                      onAuthClick('signup');
                    }}
                  >
                    Start Pilot
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
