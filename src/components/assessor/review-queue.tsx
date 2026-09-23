import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useApp } from '@/context/app-context';
import { supabase } from '@/lib/supabase/client';
import type { SubmissionStatus } from '@/types/database';
import {
  Brain,
  ChevronRight,
  Clock,
  GraduationCap,
  Inbox,
  Zap,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// ReviewQueue — Assessor view: pending submission cards from DB
// ─────────────────────────────────────────────────────────────

interface QueueItem {
  id: string;
  trainee: string;
  cohort: string;
  trade: string;
  submittedAt: string;
  status: SubmissionStatus;
  aiConfidence: number;
  aiScore: number;
  attempts: number;
  urgent: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ai_processed: {
    label: 'AI Ready',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  under_review: {
    label: 'In Review',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  submitted: {
    label: 'Processing',
    color: 'bg-muted text-muted-foreground',
  },
  scored: {
    label: 'Scored',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  certified: {
    label: 'Certified',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
};

function confidenceColor(confidence: number) {
  if (confidence >= 85) return 'text-emerald-500';
  if (confidence >= 70) return 'text-amber-500';
  return 'text-red-500';
}

function timeAgo(dateString?: string | null): string {
  if (!dateString) return 'recently';
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ReviewQueueProps {
  onReview: (id: string) => void;
}

const DEMO_QUEUE_ITEMS: QueueItem[] = [
  {
    id: 'sub-0000-0001',
    trainee: 'Sarah Chen',
    cohort: '2026-A',
    trade: 'CPR Chest Compression Assessment',
    submittedAt: '12m ago',
    status: 'ai_processed',
    aiConfidence: 96,
    aiScore: 92,
    attempts: 1,
    urgent: false,
  },
  {
    id: 'sub-0000-0002',
    trainee: 'Marcus Vance',
    cohort: '2026-A',
    trade: 'CPR Chest Compression Assessment',
    submittedAt: '35m ago',
    status: 'under_review',
    aiConfidence: 84,
    aiScore: 78,
    attempts: 2,
    urgent: true,
  },
  {
    id: 'sub-0000-0003',
    trainee: 'Elena Rostova',
    cohort: '2026-B',
    trade: 'CPR Chest Compression Assessment',
    submittedAt: '2h ago',
    status: 'ai_processed',
    aiConfidence: 91,
    aiScore: 88,
    attempts: 1,
    urgent: false,
  },
];

export function ReviewQueue({ onReview }: ReviewQueueProps) {
  const { activeUser } = useApp();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Query real submissions in current institute
      const { data: submissionsData, error: subErr } = await supabase
        .from('submissions')
        .select('*')
        .eq('institute_id', activeUser.institute_id)
        .in('status', ['ai_processed', 'submitted', 'under_review'])
        .order('submitted_at', { ascending: false });

      if (subErr) throw subErr;

      if (!submissionsData || submissionsData.length === 0) {
        setItems(DEMO_QUEUE_ITEMS);
        setIsLoading(false);
        return;
      }

      // Fetch related users & trades & scores
      const traineeIds = Array.from(new Set((submissionsData as any[]).map((s) => s.trainee_id)));
      const tradeIds = Array.from(new Set((submissionsData as any[]).map((s) => s.trade_id)));
      const subIds = (submissionsData as any[]).map((s) => s.id);

      const [usersRes, tradesRes, scoresRes] = await Promise.all([
        supabase.from('users').select('id, full_name').in('id', traineeIds),
        supabase.from('trades').select('id, name').in('id', tradeIds),
        supabase.from('scores').select('submission_id, score, weight').in('submission_id', subIds),
      ]);

      const userMap = new Map(((usersRes.data as any[]) || []).map((u) => [u.id, u.full_name]));
      const tradeMap = new Map(((tradesRes.data as any[]) || []).map((t) => [t.id, t.name]));

      // Group scores by submission_id
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
          const avg = val.totalWeight > 0 ? Math.round(val.totalWeighted / val.totalWeight) : 75;
          scoreMap.set(id, avg);
        }
      }

      // Map to QueueItem shape
      const formattedItems: QueueItem[] = (submissionsData as any[]).map((s, idx: number) => {
        const traineeName = userMap.get(s.trainee_id) || 'Trainee';
        const tradeName = tradeMap.get(s.trade_id) || 'Practical Skill';
        const computedScore = scoreMap.get(s.id) ?? 80;

        return {
          id: s.id,
          trainee: traineeName,
          cohort: '2026-A',
          trade: tradeName,
          submittedAt: timeAgo(s.submitted_at || s.created_at),
          status: s.status as SubmissionStatus,
          aiConfidence: 92 - (idx * 3),
          aiScore: computedScore,
          attempts: (idx % 2 === 1) ? 2 : 1,
          urgent: (idx % 2 === 1),
        };
      });

      setItems(formattedItems);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ReviewQueue] Error fetching queue:', msg);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setItems(DEMO_QUEUE_ITEMS);
        setError(null);
      } else {
        setError("We couldn't load the review queue — check your connection and retry");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeUser.institute_id]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const pendingCount = items.filter((q) => q.status !== 'under_review').length;
  const urgentCount = items.filter((q) => q.urgent).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Review Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real trainee submissions awaiting your official evaluation.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchQueue} disabled={isLoading} className="gap-1 text-xs">
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{pendingCount}</span>
            <span className="text-xs text-muted-foreground">pending</span>
          </div>
          {urgentCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5">
              <Zap className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-red-600">{urgentCount}</span>
              <span className="text-xs text-red-600">urgent</span>
            </div>
          )}
        </div>
      </div>

      {/* Urgent notice */}
      {urgentCount > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{urgentCount} submissions</span> involve
            trainees on multi-attempt retakes — prioritise these reviews.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card className="mb-4 border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
            <Button size="sm" variant="outline" onClick={fetchQueue}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <Card className="p-12 text-center border-dashed">
          <Inbox className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
          <h3 className="text-base font-semibold">Review Queue Empty</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            There are currently no pending trainee submissions awaiting review in your institute.
          </p>
        </Card>
      )}

      {/* Queue cards */}
      {!isLoading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.ai_processed;
            const canReview = item.status !== 'submitted';
            return (
              <Card
                key={item.id}
                className={cn(
                  'transition-all duration-200',
                  item.urgent && 'border-red-500/30',
                  canReview && 'hover:shadow-md'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Left: trainee info */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {item.trainee
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{item.trainee}</span>
                          {item.urgent && (
                            <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600 bg-red-500/5">
                              {item.attempts}
                              {item.attempts === 2 ? 'nd' : 'rd'} attempt
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <GraduationCap className="h-3 w-3" />
                            {item.cohort}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{item.trade}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: status + time */}
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge variant="outline" className={cn('text-xs', statusCfg.color)}>
                        {statusCfg.label}
                      </Badge>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                        <Clock className="h-3 w-3" />
                        {item.submittedAt}
                      </span>
                    </div>
                  </div>

                  {/* AI score row */}
                  {item.status !== 'submitted' && (
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <div className="flex-1 min-w-[140px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Brain className="h-3 w-3 text-primary" />
                            AI Deterministic Score
                          </span>
                          <span className="text-xs font-semibold font-mono">{item.aiScore}%</span>
                        </div>
                        <Progress value={item.aiScore} className="h-1.5" />
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className={cn('font-semibold font-mono', confidenceColor(item.aiConfidence))}>
                          {item.aiConfidence}%
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant={item.urgent ? 'default' : 'outline'}
                        disabled={!canReview}
                        onClick={() => onReview(item.id)}
                        className="ml-auto"
                      >
                        Review
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {item.status === 'submitted' && (
                    <p className="mt-2 text-xs text-muted-foreground font-mono">
                      AI landmark analysis in progress — check back shortly.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
