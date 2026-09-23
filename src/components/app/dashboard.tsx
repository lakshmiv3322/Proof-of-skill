import { useState, useEffect, lazy, Suspense } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { RoleSwitcher } from '@/components/app/role-switcher';
import { AppProvider, useApp, DEMO_MODE } from '@/context/app-context';
import { Loader2 } from 'lucide-react';

// Code-split Trainee views
const SkillCatalog = lazy(() =>
  import('@/components/trainee/skill-catalog').then((m) => ({ default: m.SkillCatalog }))
);
const AssessmentInstructions = lazy(() =>
  import('@/components/trainee/assessment-instructions').then((m) => ({ default: m.AssessmentInstructions }))
);
const MyProgress = lazy(() =>
  import('@/components/trainee/my-progress').then((m) => ({ default: m.MyProgress }))
);
const VideoCapture = lazy(() =>
  import('@/components/trainee/video-capture').then((m) => ({ default: m.VideoCapture }))
);

// Code-split Assessor views
const ReviewQueue = lazy(() =>
  import('@/components/assessor/review-queue').then((m) => ({ default: m.ReviewQueue }))
);
const EvaluationPage = lazy(() =>
  import('@/components/assessor/evaluation-page').then((m) => ({ default: m.EvaluationPage }))
);

// Code-split Admin views
const CohortMetrics = lazy(() =>
  import('@/components/admin/cohort-metrics').then((m) => ({ default: m.CohortMetrics }))
);
const BillingCounter = lazy(() =>
  import('@/components/admin/billing-counter').then((m) => ({ default: m.BillingCounter }))
);
const RubricEditor = lazy(() =>
  import('@/components/admin/rubric-editor').then((m) => ({ default: m.RubricEditor }))
);
const AuditLogExplorer = lazy(() =>
  import('@/components/admin/audit-log-explorer').then((m) => ({ default: m.AuditLogExplorer }))
);

const PublicVerifyPage = lazy(() =>
  import('@/components/verify/public-verify-page').then((m) => ({ default: m.PublicVerifyPage }))
);

function ViewLoading() {
  return (
    <div className="flex h-full min-h-[300px] w-full items-center justify-center p-8 text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs font-medium">Loading view...</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Default view per role
// ─────────────────────────────────────────────────────────────

const DEFAULT_VIEW: Record<string, string> = {
  trainee: 'catalog',
  assessor: 'queue',
  institute_admin: 'metrics',
  platform_admin: 'metrics',
};

// ─────────────────────────────────────────────────────────────
// DashboardInner — rendered inside AppProvider so useApp works
// ─────────────────────────────────────────────────────────────

function DashboardInner() {
  const { activeRole } = useApp();
  const [activeView, setActiveView] = useState(DEFAULT_VIEW[activeRole] ?? 'catalog');
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [verifyingCertCode, setVerifyingCertCode] = useState<string | null>(null);

  // When activeRole changes (e.g. via Dev RoleSwitcher), reset view state
  useEffect(() => {
    setActiveView(DEFAULT_VIEW[activeRole] ?? 'catalog');
    setEvaluatingId(null);
    setVerifyingCertCode(null);
  }, [activeRole]);

  const handleNavigate = (view: string) => {
    setActiveView(view);
    setEvaluatingId(null);
    setVerifyingCertCode(null);
  };

  const renderView = () => {
    // If viewing a certificate
    if (verifyingCertCode) {
      return (
        <PublicVerifyPage
          initialCode={verifyingCertCode}
          onBack={() => setVerifyingCertCode(null)}
        />
      );
    }

    // ── Trainee ────────────────────────────────────────────
    if (activeRole === 'trainee') {
      if (activeView === 'catalog') {
        return (
          <SkillCatalog
            onStartAssessment={() => setActiveView('instructions')}
          />
        );
      }
      if (activeView === 'instructions') {
        return (
          <AssessmentInstructions 
            onBack={() => setActiveView('catalog')} 
            onStartCapture={() => setActiveView('capture')} 
          />
        );
      }
      if (activeView === 'capture') {
        return (
          <VideoCapture 
            onBack={() => setActiveView('instructions')} 
            onComplete={() => setActiveView('progress')} 
          />
        );
      }
      if (activeView === 'progress') {
        return (
          <MyProgress
            onViewCertificate={(code) => setVerifyingCertCode(code)}
          />
        );
      }
    }

    // ── Assessor ───────────────────────────────────────────
    if (activeRole === 'assessor') {
      if (activeView === 'queue' && !evaluatingId) {
        return (
          <ReviewQueue
            onReview={(id) => {
              setEvaluatingId(id);
              setActiveView('evaluate');
            }}
          />
        );
      }
      if (activeView === 'evaluate' || evaluatingId) {
        return (
          <EvaluationPage
            submissionId={evaluatingId ?? undefined}
            onBack={() => {
              setEvaluatingId(null);
              setActiveView('queue');
            }}
          />
        );
      }
    }

    // ── Institute Admin ────────────────────────────────────
    if (activeRole === 'institute_admin') {
      if (activeView === 'metrics') return <CohortMetrics />;
      if (activeView === 'billing') return <BillingCounter />;
      if (activeView === 'rubric') return <RubricEditor />;
      if (activeView === 'audit') return <AuditLogExplorer />;
    }

    // ── Platform Admin (reuses admin views for demo) ───────
    if (activeRole === 'platform_admin') {
      if (activeView === 'metrics') return <CohortMetrics />;
      if (activeView === 'audit') return <AuditLogExplorer />;
    }

    // Fallback
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        <div>
          <p className="text-lg font-medium">View not found</p>
          <p className="text-sm">Navigate using the sidebar.</p>
        </div>
      </div>
    );
  };

  return (
    // pt-8 only needed when the dev RoleSwitcher bar is visible
    <div className={DEMO_MODE ? 'pt-8 h-screen flex flex-col' : 'h-screen flex flex-col'}>
      {DEMO_MODE && <RoleSwitcher />}
      <div className="flex-1 overflow-hidden">
        <AppShell activeView={activeView} onNavigate={handleNavigate}>
          <Suspense fallback={<ViewLoading />}>
            {renderView()}
          </Suspense>
        </AppShell>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Dashboard — exported entry point (wraps with AppProvider)
// ─────────────────────────────────────────────────────────────

export function Dashboard() {
  return (
    <AppProvider>
      <DashboardInner />
    </AppProvider>
  );
}
