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
  Upload,
  Zap,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// AssessmentInstructions — Trade-specific instructions (CPR & Welding)
// ─────────────────────────────────────────────────────────────

interface Step {
  number: number;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CPR_STEPS: Step[] = [
  {
    number: 1,
    title: 'Set up your recording environment',
    body: 'Place your phone or camera on a stable surface. The camera must capture your full upper body and both hands throughout the compression cycle. Use a manikin or firm surface.',
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
    body: 'Compress at least 2 inches (5.0–6.0 cm) deep at a rate of 100–120 compressions per minute. Allow full chest recoil between each compression. Do not lean on the chest between compressions.',
    icon: Clock,
  },
  {
    number: 4,
    title: 'Record and review your video',
    body: 'Your video must clearly show hand placement, compression depth, and cadence. BlazePose will extract 33 kinematic landmarks in real time.',
    icon: Camera,
  },
  {
    number: 5,
    title: 'Upload your submission',
    body: 'Submit your live recording or video file. The AI will score your kinematics immediately against the AHA CPR rule rubric, followed by assessor verification.',
    icon: Upload,
  },
];

const WELDING_STEPS: Step[] = [
  {
    number: 1,
    title: 'Equip Safety PPE & Position Camera',
    body: 'Ensure full welding PPE (helmet, leather jacket/sleeves, welding gloves) is worn. Position camera 1.5–2m away at a 45° angle to capture arm posture, torch angle, and progression path.',
    icon: Smartphone,
  },
  {
    number: 2,
    title: 'Set Lead/Drag Angle (70°–85°)',
    body: 'Establish proper electrode drag angle between 70° and 85° relative to the joint line. Keep forearm relaxed with locked wrist positioning for stable arc maintenance.',
    icon: Zap,
  },
  {
    number: 3,
    title: 'Execute Steady Travel Speed (2.5–4.5 mm/s)',
    body: 'Strike the arc and maintain a smooth, uninterrupted progression along the joint at 2.5–4.5 mm/s. Avoid stopping or dragging too fast, which leads to narrow undercut beads.',
    icon: Clock,
  },
  {
    number: 4,
    title: 'Maintain Arc Length Standoff (< 1.2 cm)',
    body: 'Keep arc gap tight and uniform (< 1.2 cm lateral deviation) to prevent porosity and spatter while maintaining consistent weld pool penetration.',
    icon: Camera,
  },
  {
    number: 5,
    title: 'Submit for Kinematic Verification',
    body: 'Submit your video. BlazePose kinematic analysis will evaluate joint angles, speed progression, and arc stability against AWS D1.1 standards.',
    icon: Upload,
  },
];

const CPR_CHECKLIST = [
  'Manikin, CPR simulator, or firm surface available',
  'Camera positioned to capture full upper body from the side or front',
  'Recording environment is well-lit with minimal background noise',
  'Target depth: 5.0–6.0 cm sternal excursion',
  'Target cadence: 100–120 BPM steady rhythm',
  'Full chest recoil without leaning',
];

const WELDING_CHECKLIST = [
  'Welding PPE (helmet, gloves, flame-resistant jacket) equipped',
  'Camera angled to clearly capture electrode holder, arm, and seam progression',
  'Lead/drag angle maintained between 70° and 85°',
  'Steady travel speed maintained between 2.5 and 4.5 mm/s',
  'Tight arc length standoff with minimal lateral wandering (< 1.2 cm)',
  'Stable welder stance and head clear of direct fume plume',
];

interface AssessmentInstructionsProps {
  skillId?: string;
  onBack: () => void;
  onStartCapture: () => void;
}

export function AssessmentInstructions({
  skillId = 'cpr',
  onBack,
  onStartCapture,
}: AssessmentInstructionsProps) {
  const isWelding = skillId.includes('weld');
  const steps = isWelding ? WELDING_STEPS : CPR_STEPS;
  const checklist = isWelding ? WELDING_CHECKLIST : CPR_CHECKLIST;
  const tradeTitle = isWelding
    ? 'SMAW Shielded Metal Arc Welding'
    : 'CPR / First-Aid Chest Compression';
  const tradeCategory = isWelding ? 'Welding & Fabrication · Advanced' : 'Emergency Medicine · Intermediate';
  const TradeIcon = isWelding ? Zap : Heart;
  const iconColor = isWelding ? 'text-orange-500' : 'text-red-500';
  const iconBg = isWelding ? 'bg-orange-500/10' : 'bg-red-500/10';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          ← Back to Catalog
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
              <TradeIcon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {tradeTitle}
              </h1>
              <p className="text-xs text-muted-foreground">{tradeCategory}</p>
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
          <span className="font-semibold">Deterministic Kinematics + Assessor Review.</span> The
          generalized rule engine analyzes your 33-point pose landmarks in real-time, verifying joint angles,
          velocities, and stability before official assessor verification.
        </p>
      </div>

      {/* Steps */}
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Step-by-Step Instructions
      </h2>

      <div className="mb-8 space-y-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.number} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {step.number}
                </div>
                {step.number < steps.length && (
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

      <Separator className="my-6" />

      {/* Pre-flight checklist */}
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Pre-Flight Checklist
      </h2>

      <div className="mb-8 space-y-2.5">
        {checklist.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span className="text-sm text-foreground">{item}</span>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <Lightbulb className="h-4 w-4" />
          <span className="text-sm font-semibold">Pro Tips for Best Score</span>
        </div>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {isWelding ? (
            <>
              <li>• Keep your wrist steady throughout the pass to maintain steady 2.5–4.5 mm/s travel speed.</li>
              <li>• Lock your elbow at 70°–85° to prevent the torch from fluctuating off-angle.</li>
              <li>• Ensure lighting allows clear landmark detection of shoulders, elbows, and wrists.</li>
            </>
          ) : (
            <>
              <li>• Lock your elbows and pivot from your hips to maintain uniform compression depth.</li>
              <li>• Audible counting helps the assessor verify rhythm alongside BlazePose kinematics.</li>
              <li>• Allow complete recoil after each compression to score maximum points.</li>
            </>
          )}
        </ul>
      </div>

      {/* Start Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button onClick={onStartCapture} className="gap-2">
          Start Assessment <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
