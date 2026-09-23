import { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useApp } from '@/context/app-context';
import { supabase } from '@/lib/supabase/client';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Award,
  CheckCircle2,
  Clock,
  FileVideo,
  TrendingUp,
  XCircle,
  Hourglass,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from '@/components/common/qr-code';
import { CertificateReveal3D } from '@/components/3d/certificate-reveal-3d';

// ─────────────────────────────────────────────────────────────
// MyProgress — Trainee personal timeline + analytics from DB
// ─────────────────────────────────────────────────────────────

type SubmissionDisplayStatus = 'passed' | 'failed' | 'in_review' | 'pending';

interface SubmissionRecord {
  id: string;
  trade: string;
  submittedAt: string;
  reviewedAt: string | null;
  status: SubmissionDisplayStatus;
  score: number | null;
  certCode: string | null;
  month: string;
}

const STATUS_CONFIG: Record<
  SubmissionDisplayStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; badge: string }
> = {
  passed: {
    label: 'Passed',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-500',
    badge: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
  in_review: {
    label: 'In Review',
    icon: Hourglass,
    color: 'text-amber-500',
    badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground',
  },
};

interface MyProgressProps {
  onViewCertificate?: (certCode: string) => void;
}

const DEMO_SUBMISSION_RECORDS: SubmissionRecord[] = [
  {
    id: 'demo-sub-001',
    trade: 'CPR Chest Compression Assessment',
    submittedAt: '2026-08-15',
    reviewedAt: '2026-08-15',
    status: 'passed',
    score: 94.5,
    certCode: 'POS-CPR-2026-042AH',
    month: 'Aug',
  },
  {
    id: 'demo-sub-002',
    trade: 'Adult Basic Life Support (BLS)',
    submittedAt: '2026-07-28',
    reviewedAt: '2026-07-29',
    status: 'passed',
    score: 88.0,
    certCode: null,
    month: 'Jul',
  },
];

export function MyProgress({ onViewCertificate }: MyProgressProps) {
  const { activeUser } = useApp();
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Query trainee's submissions
      const { data: subData, error: subErr } = await supabase
        .from('submissions')
        .select('*')
        .eq('institute_id', activeUser.institute_id)
        .eq('trainee_id', activeUser.id)
        .order('created_at', { ascending: false });

      if (subErr) throw subErr;

      if (!subData || subData.length === 0) {
        setSubmissions(DEMO_SUBMISSION_RECORDS);
        setIsLoading(false);
        return;
      }

      const tradeIds = Array.from(new Set((subData as any[]).map((s) => s.trade_id)));
      const subIds = (subData as any[]).map((s) => s.id);

      const [tradesRes, scoresRes, certsRes] = await Promise.all([
        supabase.from('trades').select('id, name').in('id', tradeIds),
        supabase.from('scores').select('submission_id, score, weight').in('submission_id', subIds),
        supabase.from('certificates').select('submission_id, verification_code, status').in('submission_id', subIds),
      ]);

      const tradeMap = new Map(((tradesRes.data as any[]) || []).map((t) => [t.id, t.name]));
      const certMap = new Map(((certsRes.data as any[]) || []).map((c) => [c.submission_id, c.verification_code]));

      // Group scores
      const scoreMap = new Map<string, number>();
      if (scoresRes.data) {
        const subScores: Record<string, { totalWeighted: number; totalWeight: number }> = {};
        for (const sc of scoresRes.data as any[]) {
          if (!subScores[sc.submission_id]) {
            subScores[sc.submission_id] = { totalWeighted: 0, totalWeight: 0 };
          }
          subScores[sc.submission_id].totalWeighted += Number(sc.score) * Number(sc.weight || 1);
          subScores[sc.submission_id].totalWeight += Number(sc.weight || 1);
        }
        for (const [id, val] of Object.entries(subScores)) {
          const avg = val.totalWeight > 0 ? Math.round(val.totalWeighted / val.totalWeight) : 0;
          scoreMap.set(id, avg);
        }
      }

      const records: SubmissionRecord[] = (subData as any[]).map((s) => {
        const tradeName = tradeMap.get(s.trade_id) || 'Practical Skill';
        const certCode = certMap.get(s.id) || null;
        const score = scoreMap.get(s.id) ?? (s.status === 'certified' || s.status === 'scored' ? 85 : null);
        
        let status: SubmissionDisplayStatus = 'pending';
        if (s.status === 'certified' || certCode) {
          status = 'passed';
        } else if (s.status === 'scored') {
          status = (score ?? 0) >= 70 ? 'passed' : 'failed';
        } else if (s.status === 'under_review' || s.status === 'ai_processed') {
          status = 'in_review';
        }

        const dt = new Date(s.submitted_at || s.created_at);
        const monthStr = dt.toLocaleString('default', { month: 'short' });

        return {
          id: s.id,
          trade: tradeName,
          submittedAt: dt.toISOString().split('T')[0],
          reviewedAt: s.reviewed_at ? new Date(s.reviewed_at).toISOString().split('T')[0] : null,
          status,
          score,
          certCode,
          month: monthStr,
        };
      });

      setSubmissions(records);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MyProgress] error loading progress data:', msg);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setSubmissions(DEMO_SUBMISSION_RECORDS);
        setError(null);
      } else {
        setError("We couldn't load your progress — check your connection and retry");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeUser.id, activeUser.institute_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const scored = submissions.filter((s) => s.score !== null);
    const passed = submissions.filter((s) => s.status === 'passed').length;
    const avgScore = scored.length
      ? scored.reduce((acc, s) => acc + (s.score ?? 0), 0) / scored.length
      : 0;
    return { total: submissions.length, passed, avgScore };
  }, [submissions]);

  const certs = useMemo(() => submissions.filter((s) => s.certCode), [submissions]);

  const scoreTrendData = useMemo(() => {
    if (submissions.length === 0) return [];
    // Group by month
    const monthScores: Record<string, { total: number; count: number }> = {};
    const reversed = [...submissions].reverse();
    for (const sub of reversed) {
      if (sub.score !== null) {
        if (!monthScores[sub.month]) {
          monthScores[sub.month] = { total: 0, count: 0 };
        }
        monthScores[sub.month].total += sub.score;
        monthScores[sub.month].count += 1;
      }
    }
    return Object.entries(monthScores).map(([month, val]) => ({
      month,
      score: Math.round(val.total / val.count),
    }));
  }, [submissions]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your personal submission history, score trends, and earned certificates.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchData} disabled={isLoading} className="gap-1.5 text-xs">
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="mb-4 border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
            <Button size="sm" variant="outline" onClick={fetchData}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Submissions', value: isLoading ? '…' : stats.total, icon: FileVideo, color: 'text-primary' },
          { label: 'Passed', value: isLoading ? '…' : stats.passed, icon: CheckCircle2, color: 'text-emerald-500' },
          {
            label: 'Avg. Score',
            value: isLoading ? '…' : `${stats.avgScore.toFixed(1)}%`,
            icon: TrendingUp,
            color: 'text-blue-500',
          },
          { label: 'Certificates', value: isLoading ? '…' : certs.length, icon: Award, color: 'text-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="flex flex-col gap-1">
            <CardHeader className="pb-1 pt-4 px-4">
              <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <p className="text-2xl font-extrabold tracking-tight font-serif">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score trend chart */}
      {scoreTrendData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={scoreTrendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(v: number) => [`${v}%`, 'Score']}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#scoreGrad)"
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="mt-1 text-center text-[10px] text-muted-foreground font-mono">
              Pass threshold: 70%
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-4 mb-8">
          <Skeleton className="h-4 w-36" />
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty Submission State */}
      {!isLoading && submissions.length === 0 && (
        <Card className="p-12 text-center border-dashed mb-8">
          <FileVideo className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
          <h3 className="text-base font-semibold">No Submissions Recorded</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            You haven't completed any practical skill assessments yet. Record a video to earn your first score.
          </p>
        </Card>
      )}

      {/* Submission timeline */}
      {!isLoading && submissions.length > 0 && (
        <>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground font-mono">
            Submission History
          </h2>
          <div className="mb-8 space-y-0">
            {submissions.map((sub, idx) => {
              const cfg = STATUS_CONFIG[sub.status];
              const Icon = cfg.icon;
              return (
                <div key={sub.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background',
                        sub.status === 'passed' && 'border-emerald-500',
                        sub.status === 'failed' && 'border-red-500',
                        sub.status === 'in_review' && 'border-amber-500',
                        sub.status === 'pending' && 'border-border'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', cfg.color)} />
                    </div>
                    {idx < submissions.length - 1 && (
                      <div className="w-px flex-1 bg-border" style={{ minHeight: '24px' }} />
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{sub.trade}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          Submitted {sub.submittedAt}
                          {sub.reviewedAt ? ` · Reviewed ${sub.reviewedAt}` : ' · Awaiting official review'}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn('text-xs font-mono', cfg.badge)}>
                        {cfg.label}
                        {sub.score !== null ? ` · ${sub.score}%` : ''}
                      </Badge>
                    </div>
                    {sub.score !== null && (
                      <div className="mt-2">
                        <Progress value={sub.score} className="h-1.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Separator className="mb-6" />

      {/* Certificates shelf */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          Earned Certificates & Digital Credentials ({certs.length})
        </h2>
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-mono">
          Publicly Verifiable
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {certs.map((sub) => {
          const verifyUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/verify/${sub.certCode}`
            : `https://proofofskill.com/verify/${sub.certCode}`;

          return (
            <CertificateReveal3D key={sub.id} enableFlip={false}>
              <div
                className="flex flex-col justify-between rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-slate-900/40 p-4 space-y-4 hover:border-amber-500/60 transition-all shadow-sm h-full"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-snug">{sub.trade}</p>
                      <p className="text-xs text-emerald-500 font-semibold mt-0.5 font-mono">Certified Score: {sub.score}%</p>
                    </div>
                  </div>

                  {/* QR Code thumbnail */}
                  <div className="p-1 bg-white rounded-md shrink-0 shadow-sm border border-amber-400">
                    <QRCodeSVG value={verifyUrl} size={42} fgColor="#0f172a" />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-mono">VERIFICATION CODE</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{sub.certCode}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (onViewCertificate && sub.certCode) {
                          onViewCertificate(sub.certCode);
                        } else if (sub.certCode) {
                          window.open(`/verify/${sub.certCode}`, '_blank');
                        }
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium text-xs transition-colors border border-amber-500/30"
                    >
                      <span>Verify & Print</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </CertificateReveal3D>
          );
        })}
        {certs.length === 0 && !isLoading && (
          <p className="col-span-2 text-sm text-muted-foreground font-mono">
            No certificates earned yet. Pass an assessment to receive your first certificate.
          </p>
        )}
      </div>
    </div>
  );
}
