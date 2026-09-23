import { cn } from '@/lib/utils';
import { useApp } from '@/context/app-context';
import type { UserRole } from '@/types/database';
import { GraduationCap, ClipboardCheck, BarChart3, ShieldCheck, FlaskConical } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// RoleSwitcher — Development Testing Toolbar
// Fixed to the very top of the viewport.  Clearly labelled as a
// dev tool so it's never confused for production UI.
// ─────────────────────────────────────────────────────────────

interface PersonaConfig {
  role: UserRole;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  activeColor: string;
  description: string;
}

const PERSONAS: PersonaConfig[] = [
  {
    role: 'trainee',
    label: 'Trainee',
    icon: GraduationCap,
    color: 'hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30',
    activeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    description: 'Sarah Chen',
  },
  {
    role: 'assessor',
    label: 'Assessor',
    icon: ClipboardCheck,
    color: 'hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30',
    activeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
    description: 'Mike Rodriguez',
  },
  {
    role: 'institute_admin',
    label: 'Admin',
    icon: BarChart3,
    color: 'hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/30',
    activeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/40',
    description: 'Jennifer Park',
  },
  {
    role: 'platform_admin',
    label: 'Platform',
    icon: ShieldCheck,
    color: 'hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/30',
    activeColor: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
    description: 'Platform Admin',
  },
];

export function RoleSwitcher() {
  const { activeRole, switchRole } = useApp();

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center gap-2 border-b border-yellow-500/20 bg-background/95 px-3 py-1.5 backdrop-blur-sm">
      {/* Dev badge */}
      <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5">
        <FlaskConical className="h-3 w-3 text-yellow-500" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-yellow-500">
          Dev
        </span>
      </div>

      <span className="hidden text-xs text-muted-foreground sm:block">Switch persona:</span>

      {/* Persona buttons */}
      <div className="flex gap-1">
        {PERSONAS.map(({ role, label, icon: Icon, color, activeColor, description }) => {
          const isActive = activeRole === role;
          return (
            <button
              key={role}
              onClick={() => switchRole(role)}
              title={description}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-all duration-150',
                isActive
                  ? activeColor
                  : 'border-transparent text-muted-foreground ' + color
              )}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Active persona summary */}
      <div className="ml-auto hidden text-xs text-muted-foreground sm:block">
        Viewing as:{' '}
        <span className="font-medium text-foreground">
          {PERSONAS.find((p) => p.role === activeRole)?.description}
        </span>
      </div>
    </div>
  );
}
