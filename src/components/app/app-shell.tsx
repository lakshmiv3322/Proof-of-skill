import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GraduationCap,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  Menu,
  BookOpen,
  Clock,
  LayoutDashboard,
  Users,
  CreditCard,
  Settings2,
  LogOut,
  ChevronRight,
  History,
} from 'lucide-react';
import type { UserRole } from '@/types/database';

// ─────────────────────────────────────────────────────────────
// Navigation configs per role
// ─────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  trainee: [
    { id: 'catalog', label: 'Skill Catalog', icon: BookOpen },
    { id: 'instructions', label: 'My Assessment', icon: ClipboardCheck },
    { id: 'progress', label: 'My Progress', icon: Clock },
  ],
  assessor: [
    { id: 'queue', label: 'Review Queue', icon: LayoutDashboard },
    { id: 'evaluate', label: 'Evaluation', icon: ClipboardCheck },
  ],
  institute_admin: [
    { id: 'metrics', label: 'Cohort Metrics', icon: BarChart3 },
    { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
    { id: 'rubric', label: 'Rubric Config', icon: Settings2 },
    { id: 'audit', label: 'Audit & Compliance', icon: History },
  ],
  platform_admin: [
    { id: 'metrics', label: 'Platform Overview', icon: BarChart3 },
    { id: 'users', label: 'All Users', icon: Users },
    { id: 'audit', label: 'Global Audit Trail', icon: History },
  ],
};

const ROLE_ICONS: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  trainee: GraduationCap,
  assessor: ClipboardCheck,
  institute_admin: BarChart3,
  platform_admin: ShieldCheck,
};

const ROLE_LABELS: Record<UserRole, string> = {
  trainee: 'Trainee',
  assessor: 'Assessor',
  institute_admin: 'Institution Admin',
  platform_admin: 'Platform Admin',
};

// ─────────────────────────────────────────────────────────────
// Sidebar content (shared between desktop sidebar and mobile sheet)
// ─────────────────────────────────────────────────────────────

interface SidebarProps {
  activeView: string;
  onNavigate: (id: string) => void;
  onClose?: () => void;
}

function SidebarContent({ activeView, onNavigate, onClose }: SidebarProps) {
  const { activeRole, activeUser } = useApp();
  const { signOut } = useAuth();
  const navItems = NAV_BY_ROLE[activeRole] ?? [];
  const RoleIcon = ROLE_ICONS[activeRole];

  const initials = activeUser?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">ProofOfSkill</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Assessment Platform</p>
        </div>
      </div>

      {/* Role badge */}
      <div className="mx-3 mb-4 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
        <RoleIcon className="h-4 w-4 text-primary" />
        <div>
          <p className="text-xs font-semibold">{ROLE_LABELS[activeRole]}</p>
          <p className="text-[10px] text-muted-foreground">{activeUser?.full_name}</p>
        </div>
      </div>

      <Separator className="mb-3" />

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 px-2">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                onNavigate(id);
                onClose?.();
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {isActive && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
            </button>
          );
        })}
      </nav>

      <Separator className="mt-3" />

      {/* User footer */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium leading-none">{activeUser?.full_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-[130px]">
                  {activeUser?.email}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AppShell — full layout wrapper
// ─────────────────────────────────────────────────────────────

interface AppShellProps {
  activeView: string;
  onNavigate: (id: string) => void;
  children: ReactNode;
}

export function AppShell({ activeView, onNavigate, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border/60 lg:flex lg:flex-col">
        <SidebarContent activeView={activeView} onNavigate={onNavigate} />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-border/60 bg-background px-4 py-3 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent
                activeView={activeView}
                onNavigate={onNavigate}
                onClose={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold">ProofOfSkill</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
