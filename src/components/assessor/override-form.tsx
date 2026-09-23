import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, FileText, Save } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/context/app-context';
import { logAudit } from '@/lib/supabase/audit';

// ─────────────────────────────────────────────────────────────
// OverrideForm — Mandatory rationale before changing AI score
// All overrides are written to the audit log.
// ─────────────────────────────────────────────────────────────

const MIN_RATIONALE_CHARS = 50;

const overrideSchema = z.object({
  criterionId: z.string().min(1, 'Select a criterion'),
  newScore: z.number().min(0).max(100),
  rationale: z
    .string()
    .min(MIN_RATIONALE_CHARS, `Rationale must be at least ${MIN_RATIONALE_CHARS} characters. Provide a specific, justifiable reason for overriding the AI score.`),
});

type OverrideFormValues = z.infer<typeof overrideSchema>;

import { supabase } from '@/lib/supabase/client';

interface CriterionInfo {
  id: string;
  label: string;
  aiScore: number;
  weight: number;
}

interface OverrideFormProps {
  criteria: CriterionInfo[];
  submissionId?: string;
  onSave: (criterionId: string, newScore: number) => void;
  onCancel: () => void;
}

export function OverrideForm({ criteria, submissionId = 'sub-010', onSave, onCancel }: OverrideFormProps) {
  const { activeUser } = useApp();
  const [scoreValue, setScoreValue] = useState(75);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OverrideFormValues>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      criterionId: '',
      newScore: 75,
      rationale: '',
    },
  });

  const selectedId = watch('criterionId');
  const rationaleValue = watch('rationale') ?? '';
  const selectedCriterion = criteria.find((c) => c.id === selectedId);

  const onSubmit = async (data: OverrideFormValues) => {
    // 1. Primary Record: Update the scores table in Supabase
    try {
      if (submissionId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: scoreErr } = await (supabase as any)
          .from('scores')
          .update({
            score: data.newScore,
            source: 'human',
            assessor_id: activeUser.id,
            notes: data.rationale,
            updated_at: new Date().toISOString(),
          })
          .match({ submission_id: submissionId, rubric_criterion_id: data.criterionId });

        if (scoreErr) {
          console.warn('[OverrideForm] Supabase score table update notice:', scoreErr.message);
        }
      }
    } catch (e) {
      console.warn('[OverrideForm] Error updating scores table:', e);
    }

    // 2. Secondary Record: Write to audit log with State Before vs State After
    await logAudit({
      institute_id: activeUser.institute_id,
      actor_id: activeUser.id,
      actor_role: activeUser.role,
      action: 'score.override',
      entity_type: 'score',
      entity_id: `score-${data.criterionId}`,
      metadata: {
        submission_id: submissionId,
        criterion_id: data.criterionId,
        criterion_label: selectedCriterion?.label ?? data.criterionId,
        ai_score: selectedCriterion?.aiScore ?? null,
        new_score: data.newScore,
        rationale: data.rationale,
        state_before: {
          criterion: selectedCriterion?.label ?? data.criterionId,
          score: selectedCriterion?.aiScore ?? null,
          source: 'ai',
          weight: selectedCriterion?.weight ?? null,
        },
        state_after: {
          criterion: selectedCriterion?.label ?? data.criterionId,
          score: data.newScore,
          source: 'human',
          override_rationale: data.rationale,
          assessor_id: activeUser.id,
        },
      },
      ip_address: null,
    });

    setSaved(true);
    setTimeout(() => {
      onSave(data.criterionId, data.newScore);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-primary" />
            Override AI Score
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Overrides are permanently recorded in the audit log. A mandatory written rationale is
            required.
          </p>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-5">
            {/* Criterion selector */}
            <div className="space-y-1.5">
              <Label htmlFor="criterion-select">Criterion to override</Label>
              <Select
                onValueChange={(val) => {
                  setValue('criterionId', val);
                  const c = criteria.find((cr) => cr.id === val);
                  if (c) {
                    setScoreValue(c.aiScore);
                    setValue('newScore', c.aiScore);
                  }
                }}
              >
                <SelectTrigger id="criterion-select">
                  <SelectValue placeholder="Select a criterion…" />
                </SelectTrigger>
                <SelectContent>
                  {criteria.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label} — AI: {c.aiScore}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.criterionId && (
                <p className="text-xs text-destructive">{errors.criterionId.message}</p>
              )}
            </div>

            {/* Score slider */}
            {selectedCriterion && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>New Score</Label>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground line-through">
                      AI: {selectedCriterion.aiScore}%
                    </span>
                    <span className="text-lg font-bold text-primary">{scoreValue}%</span>
                  </div>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[scoreValue]}
                  onValueChange={([v]) => {
                    setScoreValue(v);
                    setValue('newScore', v);
                  }}
                  className="py-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>

                {/* Weighted impact */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <span>Weighted contribution:</span>
                  <span className="font-semibold text-foreground">
                    {((scoreValue * selectedCriterion.weight) / 100).toFixed(1)} pts
                  </span>
                  <span>(was {((selectedCriterion.aiScore * selectedCriterion.weight) / 100).toFixed(1)} pts)</span>
                </div>
              </div>
            )}

            {/* Mandatory rationale */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="rationale">
                  Rationale <span className="text-destructive">*</span>
                </Label>
                <span
                  className={
                    rationaleValue.length >= MIN_RATIONALE_CHARS
                      ? 'text-[10px] text-emerald-500'
                      : 'text-[10px] text-muted-foreground'
                  }
                >
                  {rationaleValue.length}/{MIN_RATIONALE_CHARS} min chars
                </span>
              </div>
              <Textarea
                id="rationale"
                placeholder="Provide a specific, evidence-based reason for changing the AI score. Reference the timestamp, observable technique, or rubric indicator that informed your decision…"
                rows={5}
                className="resize-none text-sm"
                {...register('rationale')}
              />
              {errors.rationale && (
                <p className="text-xs text-destructive">{errors.rationale.message}</p>
              )}
            </div>

            {/* Audit notice */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <p className="text-xs text-muted-foreground">
                This override will be permanently recorded in the audit log with your name,
                timestamp, and the full rationale text.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || saved}
            >
              {saved ? (
                'Saved ✓'
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Override
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
