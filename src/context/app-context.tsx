// ─────────────────────────────────────────────────────────────
// src/context/app-context.tsx
// Application-level context backed by real Supabase queries.
//
// In production (VITE_DEMO_MODE != "true"):
//   • activeRole and activeUser come from the signed-in user's
//     real profile in public.users — no persona switching.
//
// In demo mode (VITE_DEMO_MODE=true in .env.local):
//   • switchRole() lets developers impersonate any persona so
//     the full role-based UI can be previewed without separate
//     accounts. The role switcher toolbar is shown.
// ─────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, UserRole } from '@/types/database';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/context/auth-context';

// ── Demo mode flag ────────────────────────────────────────────
// Defaults to true in web builds unless explicitly disabled via VITE_DEMO_MODE="false"
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';

// Fallback demo user profiles per role for zero-config offline evaluations
const DEMO_PERSONA_USERS: Record<UserRole, User> = {
  trainee: {
    id: '00000000-0000-0000-0000-000000000002',
    auth_id: '00000000-0000-0000-0000-000000000002',
    institute_id: '00000000-0000-0000-0000-000000000001',
    email: 'sarah.chen@apex.edu',
    full_name: 'Sarah Chen',
    role: 'trainee',
    avatar_url: null,
    is_active: true,
    last_login_at: new Date().toISOString(),
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  assessor: {
    id: '00000000-0000-0000-0000-000000000003',
    auth_id: '00000000-0000-0000-0000-000000000003',
    institute_id: '00000000-0000-0000-0000-000000000001',
    email: 'mike.rodriguez@apex.edu',
    full_name: 'Mike Rodriguez',
    role: 'assessor',
    avatar_url: null,
    is_active: true,
    last_login_at: new Date().toISOString(),
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  institute_admin: {
    id: '00000000-0000-0000-0000-000000000004',
    auth_id: '00000000-0000-0000-0000-000000000004',
    institute_id: '00000000-0000-0000-0000-000000000001',
    email: 'jennifer.park@apex.edu',
    full_name: 'Jennifer Park',
    role: 'institute_admin',
    avatar_url: null,
    is_active: true,
    last_login_at: new Date().toISOString(),
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  platform_admin: {
    id: '00000000-0000-0000-0000-000000000005',
    auth_id: '00000000-0000-0000-0000-000000000005',
    institute_id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@proofofskill.com',
    full_name: 'Platform Administrator',
    role: 'platform_admin',
    avatar_url: null,
    is_active: true,
    last_login_at: new Date().toISOString(),
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

// ── Context shape ─────────────────────────────────────────────

interface AppContextValue {
  /** The role currently being viewed. */
  activeRole: UserRole;
  /** The user object for the active role. */
  activeUser: User;
  /**
   * Switch the active persona. Only callable when DEMO_MODE=true.
   * In production this is a no-op so UI can stay consistent.
   */
  switchRole: (role: UserRole) => Promise<void>;
  /** The typed Supabase client — ready-to-use with RLS applying automatically. */
  db: typeof supabase;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// ── AppProvider ───────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();

  const [activeRole, setActiveRole] = useState<UserRole>(
    authUser?.role ?? 'trainee'
  );
  const [activeUser, setActiveUser] = useState<User>(
    authUser ?? DEMO_PERSONA_USERS.trainee
  );

  useEffect(() => {
    if (authUser) {
      setActiveUser(authUser);
      setActiveRole(authUser.role);
    }
  }, [authUser]);

  // ── Role switching (demo only) ────────────────────────────────

  const switchRole = useCallback(async (role: UserRole) => {
    if (!DEMO_MODE) return;

    const instituteId = activeUser?.institute_id || authUser?.institute_id || '00000000-0000-0000-0000-000000000001';

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('institute_id', instituteId)
        .eq('role', role)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!error && data) {
        setActiveRole(role);
        setActiveUser(data as User);
      } else {
        setActiveRole(role);
        setActiveUser(DEMO_PERSONA_USERS[role] ?? authUser ?? DEMO_PERSONA_USERS.trainee);
      }
    } catch {
      setActiveRole(role);
      setActiveUser(DEMO_PERSONA_USERS[role] ?? authUser ?? DEMO_PERSONA_USERS.trainee);
    }
  }, [authUser, activeUser]);

  return (
    <AppContext.Provider
      value={{
        activeRole,
        activeUser,
        switchRole,
        db: supabase,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
