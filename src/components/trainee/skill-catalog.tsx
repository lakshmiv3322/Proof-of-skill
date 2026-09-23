import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Heart,
  Zap,
  Clock,
  Wrench,
  FlaskConical,
  Flame,
  Sword,
  Truck,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// SkillCatalog — Trainee view, trade selection grid
// ─────────────────────────────────────────────────────────────

interface SkillCard {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  active: boolean;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
}

const SKILL_CARDS: SkillCard[] = [
  {
    id: 'cpr',
    name: 'CPR / First-Aid Chest Compression',
    category: 'Emergency Medicine',
    icon: Heart,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    active: true,
    duration: '15 min assessment',
    difficulty: 'Intermediate',
    description:
      'Demonstrate proper CPR chest compression technique: hand placement, compression depth, rate (100–120 BPM), and rescuer safety.',
  },
  {
    id: 'welding-smaw',
    name: 'SMAW Shielded Metal Arc Welding',
    category: 'Welding',
    icon: Zap,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    active: false,
    duration: '20 min assessment',
    difficulty: 'Advanced',
    description:
      'Stick welding fundamentals including arc control, bead placement, and PPE compliance.',
  },
  {
    id: 'carpentry',
    name: 'Carpentry — Wall Framing',
    category: 'Carpentry',
    icon: Wrench,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    active: false,
    duration: '25 min assessment',
    difficulty: 'Intermediate',
    description:
      'Residential wall framing techniques including plating, stud layout, and squaring.',
  },
  {
    id: 'electrical',
    name: 'Electrical — Conduit Bending',
    category: 'Electrical',
    icon: Flame,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    active: false,
    duration: '20 min assessment',
    difficulty: 'Intermediate',
    description:
      'EMT conduit bending including offsets, saddles, and 90-degree bends.',
  },
  {
    id: 'plumbing',
    name: 'Plumbing — Pipe Fitting',
    category: 'Plumbing',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    active: false,
    duration: '20 min assessment',
    difficulty: 'Beginner',
    description:
      'Copper pipe cutting, flaring, and fitting connections with proper sealing.',
  },
  {
    id: 'machining',
    name: 'CNC Machining — G-Code Setup',
    category: 'Manufacturing',
    icon: FlaskConical,
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    active: false,
    duration: '30 min assessment',
    difficulty: 'Advanced',
    description:
      'CNC lathe toolpath setup, G-code verification, and safe machine start procedure.',
  },
  {
    id: 'hvac',
    name: 'HVAC — Refrigerant Handling',
    category: 'HVAC',
    icon: Sword,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    active: false,
    duration: '25 min assessment',
    difficulty: 'Advanced',
    description:
      'Safe refrigerant recovery, leak testing, and system recharge procedures.',
  },
  {
    id: 'forklift',
    name: 'Forklift — Load Handling',
    category: 'Logistics',
    icon: Truck,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    active: false,
    duration: '15 min assessment',
    difficulty: 'Beginner',
    description:
      'Safe forklift operation: load pickup, travel, placement, and daily inspection.',
  },
];

const DIFFICULTY_COLOR: Record<string, string> = {
  Beginner: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
  Intermediate: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  Advanced: 'text-red-600 bg-red-500/10 border-red-500/20',
};

interface SkillCatalogProps {
  onStartAssessment: () => void;
}

export function SkillCatalog({ onStartAssessment }: SkillCatalogProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Skill Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a trade to view your assigned assessment.
        </p>
      </div>

      {/* Active skill callout */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Ready to assess
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            CPR / First-Aid Chest Compression is currently active for your cohort. Additional
            trades will be unlocked by your instructor.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SKILL_CARDS.map((skill) => {
          const Icon = skill.icon;
          return (
            <Card
              key={skill.id}
              className={cn(
                'flex flex-col transition-all duration-200',
                skill.active
                  ? 'border-emerald-500/40 shadow-md hover:shadow-lg'
                  : 'opacity-70'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className={cn('rounded-lg p-2', skill.bgColor)}>
                    <Icon className={cn('h-5 w-5', skill.color)} />
                  </div>
                  {skill.active ? (
                    <Badge className="shrink-0 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/15">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-muted-foreground">
                      Coming Soon
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-3 text-base leading-snug">{skill.name}</CardTitle>
                <CardDescription className="text-xs">{skill.category}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 pb-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {skill.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn('text-[10px]', DIFFICULTY_COLOR[skill.difficulty])}
                  >
                    {skill.difficulty}
                  </Badge>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {skill.duration}
                  </span>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  size="sm"
                  disabled={!skill.active}
                  onClick={skill.active ? onStartAssessment : undefined}
                  variant={skill.active ? 'default' : 'outline'}
                >
                  {skill.active ? (
                    <>
                      View Assessment <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                    </>
                  ) : (
                    'Coming Soon'
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
