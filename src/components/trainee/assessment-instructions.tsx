import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  Info,
  Lightbulb,
  Smartphone,
  TriangleAlert,
  Upload,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// AssessmentInstructions — CPR/First-Aid specific instructions
// ─────────────────────────────────────────────────────────────

interface Step {
  number: number;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Set up your recording environment',
    body: 'Place your phone on a stable surface or have a partner hold it. The camera must capture your full upper body and both hands throughout the compression cycle. Use a manikin or firm surface.',
    icon: Smartphone,
  },
  {
    number: 2,
    title: 'Position your hands correctly',
    body: 'Interlock your fingers and position the heel of your bottom hand on the centre of the chest (lower half of the sternum). Keep your arms straight and shoulders directly above your hands.',
    icon: Heart,
  },
  {
    number: 3,
    title: 'Perform 30 compressions',
    body: 'Compress at least 2 inches (5 cm) deep at a rate of 100–120 compressions per minute. Allow full chest recoil between each compression. Do not lean on the chest between compressions.',
    icon: Clock,
  },
  {
    number: 4,
    title: 'Record and review your video',
    body: 'Your video must be at least 60 seconds, clearly showing hand placement, compression depth, and rate. Speak aloud your count if possible — it helps the AI verify rate accuracy.',
    icon: Camera,
  },
  {
    number: 5,
    title: 'Upload your submission',
    body: 'Upload an MP4 or MOV file under 500 MB. The AI will begin analysis immediately and you will receive initial feedback within 15 minutes. An assessor will complete the final review within 2 working days.',
    icon: Upload,
  },
];

const CHECKLIST = [
  'Manikin, CPR simulator, or firm surface available',
  'Camera positioned to capture full upper body from the side or front',
  'Recording environment is well-lit with minimal background noise',
  'Video is at least 60 seconds long',
  'File is MP4 or MOV, under 500 MB',
  'Your hands are visible throughout the entire compression sequence',
];

interface AssessmentInstructionsProps {
  onBack: () => void;
  onStartCapture: () => void;
}

export function AssessmentInstructions({ onBack, onStartCapture }: AssessmentInstructionsProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          ← Back
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
              <Heart className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                CPR / First-Aid Chest Compression
              </h1>
              <p className="text-xs text-muted-foreground">Emergency Medicine · Intermediate</p>
            </div>
          </div>
        </div>
        <Badge className="w-fit bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
          Active Assessment
        </Badge>
      </div>

      {/* AI + Human notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <span className="font-semibold">AI-Assisted, Human Reviewed.</span> The AI will score
          your video against the rubric criteria within minutes. A certified assessor then reviews
          the AI result before any certificate is issued.
        </p>
      </div>

      {/* Steps */}
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Step-by-Step Instructions
      </h2>

      <div className="mb-8 space-y-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.number} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {step.number}
                </div>
                {step.number < STEPS.length && (
                  <div className="mt-1 w-px flex-1 bg-border" />
                )}
              </div>
              <div className="pb-6">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Separator className="mb-6" />

      {/* Pre-submission checklist */}
      <div className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
          Pre-Submission Checklist
        </h2>
        <ul className="space-y-2.5">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-primary/40" />
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Tips */}
      <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Tips for a high score
          </span>
        </div>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>• Count aloud — "1 and 2 and 3..." helps the AI verify your rate</li>
          <li>• Film from the side at chest level for best depth measurement</li>
          <li>• Use a metronome app set to 110 BPM to practice beforehand</li>
          <li>• Wear close-fitting clothing — loose sleeves can obscure hand placement</li>
        </ul>
      </div>

      {/* Warning */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Assessment integrity notice:</span> Your
          submission is reviewed by a certified assessor. Any evidence of deceptive technique or
          video manipulation will result in automatic disqualification.
        </p>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1 sm:flex-none sm:px-10" onClick={onStartCapture}>
          Begin Submission
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" size="lg" className="flex-1 sm:flex-none">
          Watch Reference Video
        </Button>
      </div>
    </div>
  );
}
