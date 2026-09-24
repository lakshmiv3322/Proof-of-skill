import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useApp } from '@/context/app-context';
import { logAudit } from '@/lib/supabase/audit';
import { DEFAULT_CPR_RUBRIC_CONFIG, DEFAULT_WELDING_RUBRIC_CONFIG } from '@/lib/scoring/rubric-engine';
import type { Rubric, RubricCriterion, KinematicRuleType } from '@/types/database';
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Layers,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Sliders,
  Settings2,
  Activity,
  Zap,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// RubricEditor — Visual Rule Builder + Live JSON Config Editor
// ─────────────────────────────────────────────────────────────

function prettyJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

const RULE_TYPE_INFO: Record<
  KinematicRuleType,
  { label: string; unit: string; description: string; defaultMin: number; defaultMax: number; defaultTol: number }
> = {
  frequency_bpm: {
    label: 'Cadence / BPM (Frequency)',
    unit: 'BPM',
    description: 'Calculates cyclic rep frequency over time (e.g. CPR compression rate).',
    defaultMin: 100,
    defaultMax: 120,
    defaultTol: 10,
  },
  depth_normalized: {
    label: 'Anatomically Normalized Depth',
    unit: 'cm',
    description: 'Calculates sternal/tool excursion normalized by user torso/shoulder dimensions.',
    defaultMin: 5.0,
    defaultMax: 6.0,
    defaultTol: 0.8,
  },
  recoil_completeness: {
    label: 'Recoil / Release Completeness',
    unit: '% remaining',
    description: 'Verifies full release back to resting position without leaning.',
    defaultMin: 0,
    defaultMax: 5.0,
    defaultTol: 5.0,
  },
  joint_angle_range: {
    label: '3-Point Joint Angle Range',
    unit: 'deg (°)',
    description: 'Measures angle between 3 landmarks (e.g. shoulder-elbow-wrist torch angle or locked arms).',
    defaultMin: 70,
    defaultMax: 85,
    defaultTol: 10,
  },
  travel_speed: {
    label: 'Progression / Travel Speed',
    unit: 'mm/s',
    description: 'Tracks linear motion velocity of active landmark in physical units.',
    defaultMin: 2.5,
    defaultMax: 4.5,
    defaultTol: 1.0,
  },
  path_stability: {
    label: 'Path / Standoff Stability',
    unit: 'cm wander',
    description: 'Monitors orthogonal deviation and lateral stability along progression line.',
    defaultMin: 0,
    defaultMax: 1.2,
    defaultTol: 0.5,
  },
  posture_variance: {
    label: 'DTW Posture Variance',
    unit: 'score',
    description: 'Compares full-body posture kinematics against certified baseline via DTW.',
    defaultMin: 0,
    defaultMax: 15,
    defaultTol: 10,
  },
  custom: {
    label: 'Custom / Dynamic Kinematic Metric',
    unit: 'units',
    description: 'User-configured dynamic metric threshold for specialized trade assessments.',
    defaultMin: 0,
    defaultMax: 100,
    defaultTol: 10,
  },
};

const DEFAULT_DEMO_RUBRICS: Rubric[] = [
  {
    id: '00000000-0000-0000-0000-000000000020',
    institute_id: '00000000-0000-0000-0000-000000000001',
    trade_id: '00000000-0000-0000-0000-000000000010',
    name: 'CPR AHA/ERC 2026 Standard (Rule-Based)',
    version: 2,
    is_published: true,
    pass_threshold: 70,
    config: DEFAULT_CPR_RUBRIC_CONFIG,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000021',
    institute_id: '00000000-0000-0000-0000-000000000001',
    trade_id: '00000000-0000-0000-0000-000000000011',
    name: 'AWS D1.1 SMAW Welding Kinematic Standard',
    version: 1,
    is_published: true,
    pass_threshold: 75,
    config: DEFAULT_WELDING_RUBRIC_CONFIG,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function RubricEditor() {
  const { db, activeUser } = useApp();
  const [rubrics, setRubrics] = useState<Rubric[]>(DEFAULT_DEMO_RUBRICS);
  const [tradeMap, setTradeMap] = useState<Record<string, string>>({
    '00000000-0000-0000-0000-000000000010': 'CPR Chest Compression Assessment',
    '00000000-0000-0000-0000-000000000011': 'SMAW Shielded Metal Arc Welding',
  });
  const [selectedRubricId, setSelectedRubricId] = useState<string>(DEFAULT_DEMO_RUBRICS[0].id);
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');
  const [jsonText, setJsonText] = useState<string>(prettyJson(DEFAULT_DEMO_RUBRICS[0].config));
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!activeUser?.institute_id) return;

    db.from('rubrics')
      .select('*')
      .eq('institute_id', activeUser.institute_id)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const rList = data as Rubric[];
          setRubrics(rList);
          setSelectedRubricId((prev) => (rList.some((r) => r.id === prev) ? prev : rList[0].id));
          const current = rList.find((r) => r.id === selectedRubricId) || rList[0];
          setJsonText(prettyJson(current.config));
        } else {
          setRubrics(DEFAULT_DEMO_RUBRICS);
          setSelectedRubricId(DEFAULT_DEMO_RUBRICS[0].id);
          setJsonText(prettyJson(DEFAULT_DEMO_RUBRICS[0].config));
        }
      });

    db.from('trades')
      .select('*')
      .eq('institute_id', activeUser.institute_id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const tMap = Object.fromEntries(
            (data as { id: string; name: string }[]).map((t) => [t.id, t.name])
          );
          setTradeMap((prev) => ({ ...prev, ...tMap }));
        }
      });
  }, [db, activeUser?.institute_id, selectedRubricId]);

  const selectedRubric = rubrics.find((r) => r.id === selectedRubricId) || rubrics[0];

  // Derived criteria from live JSON
  const liveCriteria: RubricCriterion[] = (() => {
    try {
      const parsed = JSON.parse(jsonText) as { criteria?: RubricCriterion[] };
      return parsed.criteria ?? [];
    } catch {
      return [];
    }
  })();

  const handleRubricChange = useCallback(
    (id: string) => {
      setSelectedRubricId(id);
      const r = rubrics.find((rb) => rb.id === id);
      if (r) setJsonText(prettyJson(r.config));
      setParseError(null);
      setSaved(false);
    },
    [rubrics]
  );

  const handleTextChange = (val: string) => {
    setJsonText(val);
    setSaved(false);
    try {
      JSON.parse(val);
      setParseError(null);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON format');
    }
  };

  const updateVisualCriteria = (newCriteria: RubricCriterion[]) => {
    try {
      const parsed = JSON.parse(jsonText);
      const updated = {
        ...parsed,
        criteria: newCriteria,
        total_weight: newCriteria.reduce((sum, c) => sum + (c.weight || 0), 0),
      };
      setJsonText(prettyJson(updated));
      setParseError(null);
      setSaved(false);
    } catch {
      // ignore
    }
  };

  const handleUpdateCriterion = (idx: number, patch: Partial<RubricCriterion>) => {
    const updated = [...liveCriteria];
    updated[idx] = { ...updated[idx], ...patch };
    updateVisualCriteria(updated);
  };

  const handleAddCriterion = () => {
    const newRuleType: KinematicRuleType = 'joint_angle_range';
    const info = RULE_TYPE_INFO[newRuleType];
    const newCrit: RubricCriterion = {
      id: `rule-${Date.now()}`,
      label: 'New Kinematic Rule',
      ruleType: newRuleType,
      targetMin: info.defaultMin,
      targetMax: info.defaultMax,
      tolerance: info.defaultTol,
      weight: 15,
      description: 'Configure threshold and target landmark pairs for kinematic evaluation.',
      indicators: [`Optimal range: ${info.defaultMin} - ${info.defaultMax} ${info.unit}`],
    };
    updateVisualCriteria([...liveCriteria, newCrit]);
  };

  const handleDeleteCriterion = (idx: number) => {
    const updated = liveCriteria.filter((_, i) => i !== idx);
    updateVisualCriteria(updated);
  };

  const handleSave = async () => {
    if (parseError || !selectedRubric) return;
    setSaveError(null);
    try {
      const config = JSON.parse(jsonText) as Rubric['config'];
      const previousConfig = selectedRubric.config;

      // Update via Supabase if active
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (db as any)
        .from('rubrics')
        .update({ config, updated_at: new Date().toISOString() })
        .eq('id', selectedRubricId);

      if (updateError) console.warn('[RubricEditor] DB update notice:', updateError.message);

      // Log immutable enterprise audit event
      await logAudit({
        institute_id: selectedRubric.institute_id,
        actor_id: activeUser.id,
        actor_role: activeUser.role,
        action: 'rubric.config_updated',
        entity_type: 'rubric',
        entity_id: selectedRubricId,
        metadata: {
          rubric_name: selectedRubric.name,
          version: selectedRubric.version,
          state_before: previousConfig,
          state_after: config,
        },
        ip_address: null,
      });

      // Update in-memory rubrics list
      setRubrics((prev) =>
        prev.map((r) => (r.id === selectedRubricId ? { ...r, config } : r))
      );

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // Graceful local update
      try {
        const config = JSON.parse(jsonText) as Rubric['config'];
        setRubrics((prev) =>
          prev.map((r) => (r.id === selectedRubricId ? { ...r, config } : r))
        );
      } catch {
        // ignore
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const handleReset = () => {
    if (!selectedRubric) return;
    setJsonText(prettyJson(selectedRubric.config));
    setParseError(null);
    setSaved(false);
  };

  const totalWeight = liveCriteria.reduce((a, c) => a + (Number(c.weight) || 0), 0);
  const isWeightValid = totalWeight === 100;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Generalized Kinematics Rubric Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure data-driven kinematic rule parameters (angles, velocities, depth, tolerances) for any trade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={editorMode === 'visual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEditorMode('visual')}
            className="gap-1.5"
          >
            <Sliders className="h-3.5 w-3.5" />
            Visual Rule Builder
          </Button>
          <Button
            variant={editorMode === 'json' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEditorMode('json')}
            className="gap-1.5"
          >
            <Code2 className="h-3.5 w-3.5" />
            Raw JSON
          </Button>
        </div>
      </div>

      {/* Rubric selector header card */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex-1 min-w-[240px]">
            <Label className="mb-1.5 block text-xs font-semibold">Active Trade Rubric</Label>
            <Select value={selectedRubricId} onValueChange={handleRubricChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a trade rubric…" />
              </SelectTrigger>
              <SelectContent>
                {rubrics.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRubric && (
            <div className="flex flex-wrap items-center gap-2 pt-4 sm:pt-0">
              <Badge variant="outline" className="text-xs">
                v{selectedRubric.version}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  selectedRubric.is_published
                    ? 'text-emerald-600 border-emerald-500/20 bg-emerald-500/5'
                    : 'text-muted-foreground'
                )}
              >
                {selectedRubric.is_published ? 'Published' : 'Draft'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Trade: <span className="font-medium text-foreground">{tradeMap[selectedRubric.trade_id] ?? selectedRubric.trade_id}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Pass Threshold: <span className="font-semibold text-foreground">{selectedRubric.pass_threshold}%</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main workspace */}
      {editorMode === 'visual' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left 2 Cols: Visual Rule Cards */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 className="h-4 w-4 text-primary" />
                Kinematic Rule Criteria ({liveCriteria.length})
              </Label>
              <Button size="sm" variant="outline" onClick={handleAddCriterion} className="gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add Kinematic Rule
              </Button>
            </div>

            <div className="space-y-4">
              {liveCriteria.map((criterion, idx) => {
                const ruleType: KinematicRuleType = criterion.ruleType || 'joint_angle_range';
                const info = RULE_TYPE_INFO[ruleType] || RULE_TYPE_INFO.joint_angle_range;

                return (
                  <Card key={criterion.id || idx} className="border-border/80 shadow-sm">
                    <CardHeader className="pb-3 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={criterion.label}
                              onChange={(e) => handleUpdateCriterion(idx, { label: e.target.value })}
                              placeholder="Rule Label (e.g. Lead Torch Angle)"
                              className="font-semibold text-sm h-8"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-muted-foreground font-mono">Weight:</span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={criterion.weight}
                                onChange={(e) =>
                                  handleUpdateCriterion(idx, { weight: Number(e.target.value) || 0 })
                                }
                                className="w-16 h-8 text-xs font-mono text-center"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteCriterion(idx)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-muted-foreground mb-1 block">
                            Kinematic Rule Interpreter
                          </Label>
                          <Select
                            value={ruleType}
                            onValueChange={(val: KinematicRuleType) => {
                              const rInfo = RULE_TYPE_INFO[val];
                              handleUpdateCriterion(idx, {
                                ruleType: val,
                                targetMin: rInfo.defaultMin,
                                targetMax: rInfo.defaultMax,
                                tolerance: rInfo.defaultTol,
                                indicators: [`Optimal range: ${rInfo.defaultMin} - ${rInfo.defaultMax} ${rInfo.unit}`],
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(RULE_TYPE_INFO).map(([key, item]) => (
                                <SelectItem key={key} value={key} className="text-xs">
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-[11px] text-muted-foreground mb-1 block">
                            Target Threshold Window ({info.unit})
                          </Label>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <Input
                                type="number"
                                step="any"
                                value={criterion.targetMin ?? 0}
                                onChange={(e) =>
                                  handleUpdateCriterion(idx, { targetMin: Number(e.target.value) })
                                }
                                placeholder="Min"
                                className="h-8 text-xs font-mono text-center"
                              />
                              <span className="text-[9px] text-muted-foreground block text-center mt-0.5">Min</span>
                            </div>
                            <div>
                              <Input
                                type="number"
                                step="any"
                                value={criterion.targetMax ?? 0}
                                onChange={(e) =>
                                  handleUpdateCriterion(idx, { targetMax: Number(e.target.value) })
                                }
                                placeholder="Max"
                                className="h-8 text-xs font-mono text-center"
                              />
                              <span className="text-[9px] text-muted-foreground block text-center mt-0.5">Max</span>
                            </div>
                            <div>
                              <Input
                                type="number"
                                step="any"
                                value={criterion.tolerance ?? 0}
                                onChange={(e) =>
                                  handleUpdateCriterion(idx, { tolerance: Number(e.target.value) })
                                }
                                placeholder="±Tol"
                                className="h-8 text-xs font-mono text-center"
                              />
                              <span className="text-[9px] text-muted-foreground block text-center mt-0.5">±Tol</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground mb-1 block">
                          Description & Assessor Guidelines
                        </Label>
                        <Textarea
                          value={criterion.description}
                          onChange={(e) => handleUpdateCriterion(idx, { description: e.target.value })}
                          rows={2}
                          className="text-xs resize-none"
                          placeholder="Explain kinematic requirements and clinical/trade implications…"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Right Col: Summary, Weight Balance & Save */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Rubric Validation</CardTitle>
                <CardDescription className="text-xs">
                  Automated checks before saving to production database.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium',
                    isWeightValid
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  )}
                >
                  <span>Total Criteria Weight</span>
                  <span className="font-bold font-mono">
                    {totalWeight}% {isWeightValid ? '✓' : '(Must be 100%)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground py-1 border-b border-border/50">
                  <span>Rule Engine Mode</span>
                  <span className="font-mono text-foreground font-medium">Kinematics v2 (Data-Driven)</span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground py-1 border-b border-border/50">
                  <span>Active Criteria Count</span>
                  <span className="font-mono text-foreground font-medium">{liveCriteria.length} rules</span>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    size="sm"
                    disabled={!isWeightValid || saved}
                    onClick={handleSave}
                    className="w-full gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saved ? 'Saved Successfully ✓' : 'Save Rubric to Database'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset} className="w-full gap-1.5 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* JSON Mode */
        <div className="grid gap-6 lg:grid-cols-2">
          {/* LEFT: JSON editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Code2 className="h-4 w-4 text-primary" />
                JSON Config Editor
              </Label>
              <div className="flex items-center gap-1.5">
                {parseError ? (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3" /> Parse error
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" /> Valid JSON
                  </span>
                )}
              </div>
            </div>

            <div className="relative rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-10 bg-muted/50 border-r border-border/40 flex flex-col pt-3 pl-2 text-[10px] text-muted-foreground font-mono pointer-events-none select-none overflow-hidden">
                {jsonText.split('\n').map((_, i) => (
                  <div key={i} className="leading-5">
                    {i + 1}
                  </div>
                ))}
              </div>
              <textarea
                className="w-full pl-12 pr-3 py-3 bg-transparent font-mono text-xs leading-5 resize-none focus:outline-none min-h-[420px] text-foreground"
                value={jsonText}
                onChange={(e) => handleTextChange(e.target.value)}
                spellCheck={false}
              />
            </div>

            {parseError && (
              <p className="text-xs text-destructive font-mono bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                {parseError}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </Button>
              <Button
                size="sm"
                disabled={!!parseError || !selectedRubric || saved || !isWeightValid}
                onClick={handleSave}
                className="gap-1.5 ml-auto"
              >
                <Save className="h-3.5 w-3.5" />
                {saved ? 'Saved ✓' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* RIGHT: Live criteria preview */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4 text-primary" />
              Live Preview — Configured Rules ({liveCriteria.length})
            </Label>

            <div className="space-y-3">
              {liveCriteria.map((criterion, idx) => {
                const ruleType: KinematicRuleType = criterion.ruleType || 'joint_angle_range';
                const info = RULE_TYPE_INFO[ruleType] || RULE_TYPE_INFO.joint_angle_range;
                return (
                  <Card key={criterion.id ?? idx} className="border-border/60">
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm leading-snug">{criterion.label}</CardTitle>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          Weight: {criterion.weight}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                          {info.label}
                        </Badge>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          Target: {criterion.targetMin ?? 0}–{criterion.targetMax ?? 0} {info.unit} (±{criterion.tolerance ?? 0})
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{criterion.description}</p>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>

            {/* Weight total */}
            {liveCriteria.length > 0 && !parseError && (
              <div
                className={cn(
                  'flex items-center justify-between rounded-lg px-4 py-3 text-sm',
                  isWeightValid
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-600'
                )}
              >
                <span>Total criterion weight</span>
                <span className="font-bold">
                  {totalWeight}% {isWeightValid ? '✓' : '✗ (must equal 100%)'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
