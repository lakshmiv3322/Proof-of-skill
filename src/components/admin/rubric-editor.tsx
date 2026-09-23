import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
import type { Rubric, RubricCriterion } from '@/types/database';
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Layers,
  RefreshCw,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// RubricEditor — live JSON config editor for active trade rubrics
// ─────────────────────────────────────────────────────────────

function prettyJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

const DEFAULT_DEMO_RUBRIC: Rubric = {
  id: '00000000-0000-0000-0000-000000000020',
  institute_id: '00000000-0000-0000-0000-000000000001',
  trade_id: '00000000-0000-0000-0000-000000000010',
  name: 'AHA-CPR-2026-v2',
  version: 1,
  is_published: true,
  pass_threshold: 70,
  config: {
    criteria: [
      {
        id: 'rate',
        label: 'Compression Rate',
        weight: 30,
        description: 'Maintain cadence between 100 and 120 compressions per minute.',
        indicators: ['100.0 - 120.0 BPM target window'],
      },
      {
        id: 'depth',
        label: 'Compression Depth',
        weight: 30,
        description: 'Maintain sternal excursion depth between 5.0cm and 6.0cm.',
        indicators: ['5.0 - 6.0 cm target depth'],
      },
      {
        id: 'recoil',
        label: 'Full Recoil Completeness',
        weight: 20,
        description: 'Allow complete thoracic recoil without residual leaning.',
        indicators: ['< 5.0% incomplete recoil'],
      },
      {
        id: 'posture',
        label: 'Arm Posture & Vertical Lock',
        weight: 20,
        description: 'Elbows locked straight and shoulders positioned vertically over sternum.',
        indicators: ['< 15.0° angular deviation'],
      },
    ],
    scoring_scale: {
      min: 0,
      max: 100,
      bands: [
        { label: 'Pass', min: 70, max: 100, color: '#00f0ff' },
        { label: 'Needs Practice', min: 0, max: 69, color: '#f59e0b' },
      ],
    },
    total_weight: 100,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function RubricEditor() {
  const { db, activeUser } = useApp();
  const [rubrics, setRubrics] = useState<Rubric[]>([DEFAULT_DEMO_RUBRIC]);
  const [tradeMap, setTradeMap] = useState<Record<string, string>>({
    '00000000-0000-0000-0000-000000000010': 'CPR Chest Compression Assessment',
  });
  const [selectedRubricId, setSelectedRubricId] = useState<string>(DEFAULT_DEMO_RUBRIC.id);
  const [jsonText, setJsonText] = useState<string>(prettyJson(DEFAULT_DEMO_RUBRIC.config));
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
          setSelectedRubricId((prev) => prev || rList[0].id);
          setJsonText((prev) => prev || prettyJson(rList[0].config));
        } else {
          setRubrics([DEFAULT_DEMO_RUBRIC]);
          setSelectedRubricId(DEFAULT_DEMO_RUBRIC.id);
          setJsonText(prettyJson(DEFAULT_DEMO_RUBRIC.config));
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
          setTradeMap(tMap);
        }
      });
  }, [db, activeUser?.institute_id]);

  const selectedRubric = rubrics.find((r) => r.id === selectedRubricId);

  // Derived criteria from live JSON (for the preview cards)
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
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const handleSave = async () => {
    if (parseError || !selectedRubric) return;
    setSaveError(null);
    try {
      const config = JSON.parse(jsonText) as Rubric['config'];
      const previousConfig = selectedRubric.config;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (db as any).from('rubrics').update({ config }).eq('id', selectedRubricId);
      if (updateError) throw updateError;

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

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      console.error('[RubricEditor] update error:', err);
      setSaveError("We couldn't save your submission — check your connection and retry");
    }
  };

  const handleReset = () => {
    if (!selectedRubric) return;
    setJsonText(prettyJson(selectedRubric.config));
    setParseError(null);
    setSaved(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Rubric Configuration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect and edit the JSON config that governs AI scoring for each active trade.
        </p>
      </div>

      {/* Rubric selector */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex-1 min-w-[200px]">
            <Label className="mb-1.5 block text-xs">Active Rubric</Label>
            <Select value={selectedRubricId} onValueChange={handleRubricChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a rubric…" />
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
            <div className="flex flex-wrap gap-2">
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
                Trade: <span className="font-medium text-foreground">{tradeMap[selectedRubric.trade_id] ?? 'Unknown'}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Pass threshold: <span className="font-medium text-foreground">{selectedRubric.pass_threshold}%</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

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
            {/* Line numbers overlay */}
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-muted/50 border-r border-border/40 flex flex-col pt-3 pl-2 text-[10px] text-muted-foreground font-mono pointer-events-none select-none overflow-hidden">
              {jsonText.split('\n').map((_, i) => (
                <div key={i} className="leading-5">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              className="w-full pl-12 pr-3 py-3 bg-transparent font-mono text-xs leading-5 resize-none focus:outline-none min-h-[380px] text-foreground"
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

          {saveError && (
            <div className="flex flex-col gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-md">
              <p className="text-xs text-destructive font-mono">{saveError}</p>
              <Button size="sm" variant="outline" onClick={handleSave} className="w-fit self-start h-7 text-xs">
                Retry
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              size="sm"
              disabled={!!parseError || !selectedRubric || saved}
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
            Live Preview — Criteria ({liveCriteria.length})
          </Label>

          {liveCriteria.length === 0 && !parseError && (
            <p className="text-sm text-muted-foreground">
              No criteria found. Check that the JSON includes a `criteria` array.
            </p>
          )}

          {parseError && (
            <p className="text-sm text-muted-foreground">
              Fix the JSON error on the left to see a live preview.
            </p>
          )}

          <div className="space-y-3">
            {liveCriteria.map((criterion, idx) => (
              <Card key={criterion.id ?? idx} className="border-border/60">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm leading-snug">{criterion.label}</CardTitle>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      Weight: {criterion.weight}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{criterion.description}</p>
                </CardHeader>
                {criterion.indicators?.length > 0 && (
                  <CardContent className="pt-0">
                    <Separator className="mb-2" />
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Indicators
                    </p>
                    <ul className="space-y-1">
                      {criterion.indicators.map((ind, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <span className="mt-0.5 text-primary">•</span>
                          {ind}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          {/* Weight total */}
          {liveCriteria.length > 0 && !parseError && (
            <div className={cn(
              'flex items-center justify-between rounded-lg px-4 py-3 text-sm',
              liveCriteria.reduce((a, c) => a + c.weight, 0) === 100
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-600'
            )}>
              <span>Total criterion weight</span>
              <span className="font-bold">
                {liveCriteria.reduce((a, c) => a + c.weight, 0)}%
                {liveCriteria.reduce((a, c) => a + c.weight, 0) === 100 ? ' ✓' : ' ✗ (must equal 100%)'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
