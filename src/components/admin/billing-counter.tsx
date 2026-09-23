import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Award,
  Brain,
  CreditCard,
  ExternalLink,
  FileVideo,
  TriangleAlert,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// BillingCounter — Stripe-style metered usage vs tier quota
// ─────────────────────────────────────────────────────────────

interface UsageMetric {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  used: number;
  quota: number;
  unit: string;
}

// Growth plan quotas vs actual usage (from seed data)
const METRICS: UsageMetric[] = [
  { label: 'Submissions', icon: FileVideo, used: 47, quota: 200, unit: 'submissions/mo' },
  { label: 'AI Assessments', icon: Brain, used: 47, quota: 200, unit: 'assessments/mo' },
  { label: 'Certificates Issued', icon: Award, used: 38, quota: 200, unit: 'certs/mo' },
  { label: 'Active Seats', icon: Users, used: 120, quota: 500, unit: 'users' },
];

const PLAN_CONFIG = {
  starter: { label: 'Starter', color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20', price: '$99/mo' },
  growth: { label: 'Growth', color: 'text-purple-600 bg-purple-500/10 border-purple-500/20', price: '$399/mo' },
  enterprise: { label: 'Enterprise', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20', price: 'Custom' },
} as const;

const INVOICE_HISTORY = [
  { date: 'Aug 1, 2026', amount: '$399.00', status: 'Paid' },
  { date: 'Jul 1, 2026', amount: '$399.00', status: 'Paid' },
  { date: 'Jun 1, 2026', amount: '$399.00', status: 'Paid' },
  { date: 'May 1, 2026', amount: '$399.00', status: 'Paid' },
];

function usagePercent(used: number, quota: number) {
  return Math.min((used / quota) * 100, 100);
}

function usageColor(pct: number) {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 80) return 'bg-amber-500';
  return 'bg-primary';
}

import { useState, useEffect } from 'react';
import { useApp } from '@/context/app-context';

export function BillingCounter() {
  const { db, activeUser } = useApp();
  const [metrics, setMetrics] = useState<UsageMetric[]>(METRICS);
  const [instituteInfo, setInstituteInfo] = useState<{ name: string; plan_tier: keyof typeof PLAN_CONFIG }>({
    name: 'My Institute',
    plan_tier: 'growth',
  });

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        const [instRes, usageRes, subCountRes, certCountRes, userCountRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (db as any).from('institutes').select('*').eq('id', activeUser.institute_id).single(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (db as any).from('usage_counters').select('*').eq('institute_id', activeUser.institute_id).eq('period_year', year).eq('period_month', month).maybeSingle(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (db as any).from('submissions').select('id', { count: 'exact', head: true }).eq('institute_id', activeUser.institute_id),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (db as any).from('certificates').select('id', { count: 'exact', head: true }).eq('institute_id', activeUser.institute_id),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (db as any).from('users').select('id', { count: 'exact', head: true }).eq('institute_id', activeUser.institute_id),
        ]);

        if (instRes.data) {
          const tier = (instRes.data.plan_tier as keyof typeof PLAN_CONFIG) || 'growth';
          setInstituteInfo({
            name: instRes.data.name || 'My Institute',
            plan_tier: PLAN_CONFIG[tier] ? tier : 'growth',
          });
        }

        const subCount = subCountRes.count ?? usageRes.data?.submissions_count ?? 47;
        const certCount = certCountRes.count ?? usageRes.data?.certificates_issued ?? 38;
        const userCount = userCountRes.count ?? usageRes.data?.active_users ?? 120;
        const aiCount = usageRes.data?.ai_assessments_count ?? subCount;

        setMetrics([
          { label: 'Submissions', icon: FileVideo, used: subCount, quota: 200, unit: 'submissions/mo' },
          { label: 'AI Assessments', icon: Brain, used: aiCount, quota: 200, unit: 'assessments/mo' },
          { label: 'Certificates Issued', icon: Award, used: certCount, quota: 200, unit: 'certs/mo' },
          { label: 'Active Seats', icon: Users, used: userCount, quota: 500, unit: 'users' },
        ]);
      } catch (err) {
        console.warn('[BillingCounter] Error fetching billing counter data:', err);
      }
    };

    fetchUsage();
  }, [activeUser.institute_id]);

  const currentPlan = instituteInfo.plan_tier;
  const planCfg = PLAN_CONFIG[currentPlan] || PLAN_CONFIG.growth;

  const isNearLimit = metrics.some((m) => usagePercent(m.used, m.quota) >= 80);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Billing & Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {instituteInfo.name} · Active Billing Period
        </p>
      </div>

      {/* Plan card */}
      <Card className="mb-6 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-background">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <CreditCard className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold">Current Plan</p>
                <Badge variant="outline" className={cn('text-xs', planCfg.color)}>
                  {planCfg.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {planCfg.price} · Renews Sep 1, 2026
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Manage Plan
            </Button>
            <Button size="sm">
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Upgrade to Enterprise
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Near-limit warning */}
      {isNearLimit && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Approaching usage limit
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              One or more metrics are above 80% of your plan quota. Upgrade to Growth Plus or
              Enterprise to avoid interruptions.
            </p>
          </div>
        </div>
      )}

      {/* Usage meters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Usage This Billing Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {metrics.map((metric) => {
              const pct = usagePercent(metric.used, metric.quota);
              const Icon = metric.icon;
              const isWarn = pct >= 80;
              return (
                <div key={metric.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4', isWarn ? 'text-amber-500' : 'text-muted-foreground')} />
                      <span className="text-sm font-medium">{metric.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={cn('font-bold', isWarn ? 'text-amber-500' : 'text-foreground')}>
                        {metric.used.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground">/ {metric.quota.toLocaleString()}</span>
                      <span className="hidden text-[10px] text-muted-foreground sm:inline">
                        {metric.unit}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', usageColor(pct))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{pct.toFixed(1)}% used</span>
                    <span>{(metric.quota - metric.used).toLocaleString()} remaining</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invoice history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {INVOICE_HISTORY.map((inv, idx) => (
              <div key={idx} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{inv.date}</p>
                  <p className="text-xs text-muted-foreground">Growth Plan · Monthly</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{inv.amount}</span>
                  <Badge
                    variant="outline"
                    className="text-xs text-emerald-600 border-emerald-500/20 bg-emerald-500/5"
                  >
                    {inv.status}
                  </Badge>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="p-4 text-center">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              View all invoices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
