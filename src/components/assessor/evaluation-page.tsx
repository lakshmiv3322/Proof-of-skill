import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OverrideForm } from './override-form';
import { useApp } from '@/context/app-context';
import { logAudit } from '@/lib/supabase/audit';
import {
  Brain,
  Calendar,
  GraduationCap,
  History,
  Play,
  ShieldCheck,
  User,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScoreReveal3D } from '@/components/3d/score-reveal-3d';

// ─────────────────────────────────────────────────────────────
// EvaluationPage — side-by-side trainee metadata vs AI scores
// ─────────────────────────────────────────────────────────────

interface CriterionScore {
  id: string;
  label: string;
  weight: number;
  aiScore: number;
  aiNotes: string;
}

const CRITERIA: CriterionScore[] = [
  {
    id: 'arc-length',
    label: 'Arc Length Control',
    weight: 25,
    aiScore: 85,
    aiNotes: 'Consistent arc length. Minor deviation at start of pass (~0:12).',
  },
  {
    id: 'travel-speed',
    label: 'Travel Speed',
    weight: 25,
    aiScore: 78,
    aiNotes: 'Slightly fast in the final third. Bead narrows after 1:35.',
  },
  {
    id: 'bead-placement',
    label: 'Bead Placement',
    weight: 20,
    aiScore: 90,
    aiNotes: 'Excellent bead placement, well-centered on joint. Good toe fusion.',
  },
  {
    id: 'slag-removal',
    label: 'Slag Removal & Cleanup',
    weight: 15,
    aiScore: 72,
    aiNotes: 'Residual slag visible at stop point. Could not verify full cleanup.',
  },
  {
    id: 'safety',
    label: 'Safety & PPE Compliance',
    weight: 15,
    aiScore: 100,
    aiNotes: 'Full PPE compliance throughout. Helmet down during entire weld.',
  },
];

const AI_OVERALL = CRITERIA.reduce(
  (acc, c) => acc + (c.aiScore * c.weight) / 100,
  0
);

const HISTORY = [
  { date: '2026-07-14', score: 61.0, status: 'Failed' },
  { date: '2026-05-20', score: 54.0, status: 'Failed' },
];

function scoreColor(score: number) {
  if (score >= 85) return 'text-emerald-500';
  if (score >= 70) return 'text-amber-500';
  return 'text-red-500';
}

interface EvaluationPageProps {
  submissionId?: string;
  onBack: () => void;
}

export function EvaluationPage({ submissionId = 'sub-010', onBack }: EvaluationPageProps) {
  const { db, activeUser } = useApp();
  const [showOverride, setShowOverride] = useState(false);
  const [savedOverrides, setSavedOverrides] = useState<Record<string, number>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleOverrideSave = (criterionId: string, newScore: number) => {
    setSavedOverrides((prev) => ({ ...prev, [criterionId]: newScore }));
    setShowOverride(false);
  };

  const effectiveScore = CRITERIA.reduce((acc, c) => {
    const s = savedOverrides[c.id] ?? c.aiScore;
    return acc + (s * c.weight) / 100;
  }, 0);

  const hasOverrides = Object.keys(savedOverrides).length > 0;

  const handleApprove = async () => {
    setSaveError(null);
    const verificationCode = `POS-CPR-2026-${Math.floor(Math.random() * 899 + 100)}AH`;
    const certId = `cert-${crypto.randomUUID()}`;

    try {
      // 1. Insert real Certificate record in Supabase
      const certRow = {
        id: certId,
        institute_id: activeUser.institute_id,
        submission_id: submissionId,
        trainee_id: activeUser.id,
        trade_id: 'trade-cpr',
        verification_code: verificationCode,
        status: 'active',
        issued_at: new Date().toISOString(),
        issued_by: activeUser.id,
        overall_score: effectiveScore,
        pdf_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: certErr } = await (db as any).from('certificates').insert(certRow);
      if (certErr) throw certErr;

      // 2. Update Submission status
      const { error: subErr } = await (db as any)
        .from('submissions')
        .update({ status: 'certified', reviewed_at: new Date().toISOString() })
        .eq('id', submissionId);
      if (subErr) throw subErr;

      // 3. Write Audit Log
      await logAudit({
        institute_id: activeUser.institute_id,
        actor_id: activeUser.id,
        actor_role: activeUser.role,
        action: 'certificate.issued',
        entity_type: 'certificate',
        entity_id: certId,
        metadata: {
          submission_id: submissionId,
          verification_code: verificationCode,
          overall_score: effectiveScore,
          state_before: { submission_status: 'under_review' },
          state_after: { submission_status: 'certified', certificate_id: certId, verification_code: verificationCode },
        },
        ip_address: null,
      });
      onBack();
    } catch (err: any) {
      console.error('[EvaluationPage] Certificate issue notice:', err);
      setSaveError("We couldn't save your submission — check your connection and retry");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-2">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Queue
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Evaluation: {submissionId}</h1>
          <p className="text-sm text-muted-foreground">CPR Chest Compression Assessment · Marcus Webb</p>
        </div>
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">AI Ready for Review</Badge>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: Trainee metadata */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-primary" />
                Trainee Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: 'Full Name', value: 'Marcus Webb', icon: GraduationCap },
                { label: 'Cohort', value: '2026-A', icon: Layers },
                { label: 'Institute', value: 'Northgate Technical College', icon: ShieldCheck },
                { label: 'Submitted', value: 'Today at 11:30 AM', icon: Calendar },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground min-w-[80px]">{label}:</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Attempt history */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-primary" />
                Attempt History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {HISTORY.map((h) => (
                  <div
                    key={h.date}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{h.date}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn('font-semibold', scoreColor(h.score))}>{h.score}%</span>
                      <Badge variant="outline" className="text-xs text-red-500 border-red-500/20 bg-red-500/5">
                        {h.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <span className="font-medium">Current (attempt 3)</span>
                  <span className="text-xs text-muted-foreground">Awaiting review</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Video placeholder */}
          <Card className="overflow-hidden">
            <div className="relative flex h-36 items-center justify-center bg-muted/50">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Play className="h-8 w-8" />
                <p className="text-xs">Play submission video</p>
              </div>
              <Badge className="absolute bottom-2 right-2 text-xs">2:45</Badge>
            </div>
          </Card>
        </div>

        {/* RIGHT: AI scores */}
        <div className="space-y-4">
          {/* Overall score */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4 text-primary" />
                AI Deterministic Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-4">
                <ScoreReveal3D score={AI_OVERALL} size="md" />
                <div>
                  <p className="text-2xl font-extrabold">{AI_OVERALL.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Weighted overall · Confidence 91%</p>
                  {hasOverrides && (
                    <p className="mt-1 text-xs text-amber-600 font-medium">
                      Human override applied → {effectiveScore.toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
              <Progress value={AI_OVERALL} className="h-2" />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Pass threshold: 70% — student{' '}
                <span className={cn('font-semibold', AI_OVERALL >= 70 ? 'text-emerald-500' : 'text-red-500')}>
                  {AI_OVERALL >= 70 ? 'PASSES' : 'FAILS'}
                </span>{' '}
                on AI score alone.
              </p>
            </CardContent>
          </Card>

          {/* Per-criterion breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Criterion Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-80">
                <div className="space-y-4 pr-2">
                  {CRITERIA.map((c) => {
                    const overridden = savedOverrides[c.id];
                    const display = overridden ?? c.aiScore;
                    return (
                      <div key={c.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{c.label}</span>
                          <div className="flex items-center gap-2">
                            {overridden !== undefined && (
                              <span className="text-xs text-muted-foreground line-through">
                                {c.aiScore}
                              </span>
                            )}
                            <span className={cn('text-sm font-bold', scoreColor(display))}>
                              {display}
                              <span className="text-xs font-normal text-muted-foreground">/100</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">×{c.weight}%</span>
                          </div>
                        </div>
                        <Progress value={display} className="h-1.5" />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {c.aiNotes}
                        </p>
                        <Separator />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/60 pt-6">
        <Button
          variant="outline"
          onClick={() => setShowOverride(true)}
        >
          Override AI Score
        </Button>
        {saveError && (
          <div className="flex flex-col gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-md">
            <p className="text-xs text-destructive font-mono">{saveError}</p>
            <Button size="sm" variant="outline" onClick={handleApprove} className="w-fit self-start h-7 text-xs">
              Retry
            </Button>
          </div>
        )}
        <Button
          className="ml-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          onClick={handleApprove}
        >
          Approve & Issue Certificate
        </Button>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={async () => {
            await logAudit({
              institute_id: activeUser.institute_id,
              actor_id: activeUser.id,
              actor_role: activeUser.role,
              action: 'submission.failed',
              entity_type: 'submission',
              entity_id: submissionId,
              metadata: {
                submission_id: submissionId,
                student_name: 'Marcus Webb',
                trade: 'CPR Chest Compression Assessment',
                overall_score: effectiveScore,
                state_before: { submission_status: 'under_review' },
                state_after: { submission_status: 'failed', rejection_reason: 'Assessor determined criteria not fully met.' },
              },
              ip_address: null,
            });
            onBack();
          }}
        >
          Flag as Failed
        </Button>
      </div>

      {/* Override form dialog */}
      {showOverride && (
        <OverrideForm
          criteria={CRITERIA}
          submissionId={submissionId}
          onSave={handleOverrideSave}
          onCancel={() => setShowOverride(false)}
        />
      )}
    </div>
  );
}
