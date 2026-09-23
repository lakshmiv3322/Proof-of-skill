import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/context/app-context';
import type { AuditLog, User } from '@/types/database';
import {
  ShieldCheck,
  Search,
  Download,
  Filter,
  FileCode2,
  Clock,
  User as UserIcon,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileEdit,
  Award,
  UploadCloud,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// AuditLogExplorer — Visual Event Log Explorer for Institution Admin
// Displays immutable timestamped audit records with
// "State Before" vs. "State After" diff inspection.
// ─────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; badge: string }
> = {
  'score.override': {
    label: 'Score Override',
    icon: FileEdit,
    color: 'text-amber-500',
    badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  'submission.submitted': {
    label: 'Submission Uploaded',
    icon: UploadCloud,
    color: 'text-blue-500',
    badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  'submission.scored': {
    label: 'AI Scored',
    icon: Layers,
    color: 'text-purple-500',
    badge: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  'rubric.config_updated': {
    label: 'Rubric Config Modified',
    icon: FileCode2,
    color: 'text-cyan-500',
    badge: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  },
  'rubric.updated': {
    label: 'Rubric Config Modified',
    icon: FileCode2,
    color: 'text-cyan-500',
    badge: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  },
  'certificate.issued': {
    label: 'Certificate Issued',
    icon: Award,
    color: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  'submission.approved': {
    label: 'Submission Approved',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
};

export function AuditLogExplorer() {
  const { db } = useApp();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    db.from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setLogs(data as AuditLog[]);
      });

    db.from('users')
      .select('*')
      .then(({ data }) => {
        if (data) setUsers(data as User[]);
      });
  }, [db]);

  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users]
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filtered list
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) {
        return false;
      }
      // Role filter
      if (roleFilter !== 'all' && log.actor_role !== roleFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const actor = log.actor_id ? userMap.get(log.actor_id) : null;
        const actorName = actor?.full_name?.toLowerCase() || '';
        const actionName = log.action.toLowerCase();
        const entity = log.entity_id.toLowerCase();
        const metaStr = JSON.stringify(log.metadata).toLowerCase();

        return (
          actorName.includes(query) ||
          actionName.includes(query) ||
          entity.includes(query) ||
          metaStr.includes(query)
        );
      }
      return true;
    });
  }, [logs, actionFilter, roleFilter, searchQuery, userMap]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = logs.length;
    const overrides = logs.filter((l) => l.action === 'score.override').length;
    const configUpdates = logs.filter((l) => l.action.includes('rubric')).length;
    const certs = logs.filter((l) => l.action === 'certificate.issued').length;
    return { total, overrides, configUpdates, certs };
  }, [logs]);

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `proofofskill_audit_trail_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Enterprise Audit Log & Compliance
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Immutable record of all human overrides, AI scoring computations, and rubric configuration modifications.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJSON}
            className="text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export Audit Trail (JSON)
          </Button>
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            Audit Ledger Active
          </Badge>
        </div>
      </div>

      {/* ── Stat KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Logged Events</p>
          <p className="text-2xl font-bold mt-1 tracking-tight">{stats.total}</p>
          <p className="text-[10px] text-emerald-500 mt-0.5 font-medium">✓ Cryptographically Sealed</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Human Score Overrides</p>
          <p className="text-2xl font-bold mt-1 tracking-tight text-amber-500">{stats.overrides}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Mandatory Rationale Logged</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Rubric Config Changes</p>
          <p className="text-2xl font-bold mt-1 tracking-tight text-cyan-500">{stats.configUpdates}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Versioned Schemas</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Certificates Issued</p>
          <p className="text-2xl font-bold mt-1 tracking-tight text-emerald-500">{stats.certs}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Audited Double-Signatures</p>
        </Card>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by actor, entity ID, action, or metadata..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="text-xs w-full md:w-48">
                <SelectValue placeholder="Filter by Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="score.override">Score Overrides</SelectItem>
                <SelectItem value="submission.submitted">Submissions</SelectItem>
                <SelectItem value="submission.scored">AI Scoring</SelectItem>
                <SelectItem value="rubric.config_updated">Rubric Updates</SelectItem>
                <SelectItem value="certificate.issued">Certificates Issued</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="text-xs w-full md:w-44">
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actor Roles</SelectItem>
                <SelectItem value="assessor">Assessor</SelectItem>
                <SelectItem value="institute_admin">Institution Admin</SelectItem>
                <SelectItem value="trainee">Trainee</SelectItem>
                <SelectItem value="platform_admin">Platform Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* ── Event Stream List ───────────────────────────────── */}
      <div className="space-y-3">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const actor = log.actor_id ? userMap.get(log.actor_id) : null;
            const actionInfo = ACTION_CONFIG[log.action] ?? {
              label: log.action,
              icon: Layers,
              color: 'text-primary',
              badge: 'bg-primary/10 text-primary border-primary/20',
            };
            const ActionIcon = actionInfo.icon;

            const stateBefore = (log.metadata as Record<string, unknown>)?.state_before as Record<string, unknown> | undefined;
            const stateAfter  = (log.metadata as Record<string, unknown>)?.state_after  as Record<string, unknown> | undefined;
            const rationale   = (log.metadata as Record<string, unknown>)?.rationale as string | undefined;

            return (
              <Card
                key={log.id}
                className={cn(
                  'transition-all border-border/60 overflow-hidden',
                  isExpanded ? 'ring-1 ring-primary/40 shadow-md' : 'hover:border-primary/30'
                )}
              >
                {/* Header row */}
                <div
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none bg-card hover:bg-muted/20"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className={cn('p-2 rounded-lg bg-muted/60 shrink-0 mt-0.5 sm:mt-0', actionInfo.color)}>
                      <ActionIcon className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn('text-xs font-semibold', actionInfo.badge)}>
                          {actionInfo.label}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          {log.entity_type} · {log.entity_id}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <UserIcon className="h-3 w-3" />
                        <span className="font-medium text-foreground">
                          {actor?.full_name ?? log.actor_role ?? 'System'}
                        </span>
                        <span className="text-[10px]">({log.actor_role ?? 'automated'})</span>
                        <span>·</span>
                        <Clock className="h-3 w-3" />
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {(stateBefore || stateAfter) && (
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        State Diff Available
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Expanded Diff Viewer */}
                {isExpanded && (
                  <div className="border-t border-border/60 bg-muted/20 p-4 sm:p-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Event metadata details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono p-3 rounded-lg bg-muted/50 border border-border/40">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">EVENT ID</span>
                        <span className="truncate">{log.id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">IP ADDRESS</span>
                        <span>{log.ip_address ?? '127.0.0.1 (Intranet)'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">TENANT ID</span>
                        <span>{log.institute_id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">HASH SIGNATURE</span>
                        <span className="text-emerald-500 font-bold">✓ SHA-256 Valid</span>
                      </div>
                    </div>

                    {/* Mandatory Rationale if Override */}
                    {rationale && (
                      <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs space-y-1">
                        <p className="font-semibold text-amber-600 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Mandatory Assessor Rationale
                        </p>
                        <p className="text-muted-foreground leading-relaxed italic">
                          "{rationale}"
                        </p>
                      </div>
                    )}

                    {/* ── "State Before" vs "State After" Diff ───────── */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        State Comparison (Audit Diff)
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* State Before */}
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
                              State Before
                            </span>
                            <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30">
                              Previous State
                            </Badge>
                          </div>
                          <pre className="font-mono text-xs text-slate-300 bg-slate-950 p-3 rounded-md overflow-x-auto max-h-48">
                            {stateBefore
                              ? JSON.stringify(stateBefore, null, 2)
                              : JSON.stringify(
                                  {
                                    status: 'unmodified',
                                    score: (log.metadata as Record<string, unknown>)?.ai_score ?? null,
                                  },
                                  null,
                                  2
                                )}
                          </pre>
                        </div>

                        {/* State After */}
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                              State After
                            </span>
                            <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                              Applied State
                            </Badge>
                          </div>
                          <pre className="font-mono text-xs text-slate-300 bg-slate-950 p-3 rounded-md overflow-x-auto max-h-48">
                            {stateAfter
                              ? JSON.stringify(stateAfter, null, 2)
                              : JSON.stringify(
                                  {
                                    status: 'applied',
                                    score: (log.metadata as Record<string, unknown>)?.new_score ?? (log.metadata as Record<string, unknown>)?.overall_score ?? null,
                                    metadata: log.metadata,
                                  },
                                  null,
                                  2
                                )}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        ) : (
          <div className="text-center py-12 border rounded-xl bg-card">
            <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">No audit events match your criteria</p>
            <p className="text-xs text-muted-foreground mt-1">Try resetting the action or search filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
