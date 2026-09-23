import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { useCanRender3D } from '@/lib/motion-utils';
import {
  ShieldCheck,
  Activity,
  Play,
  Pause,
  Zap,
  Sliders,
  Layers,
  Cpu,
  Box,
} from 'lucide-react';

const CprSkeletonScene = lazy(() => import('@/components/3d/cpr-skeleton-scene'));

interface HeroProps {
  onAuthClick: (tab: 'signin' | 'signup') => void;
}

export function Hero({ onAuthClick }: HeroProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [traineeBpm, setTraineeBpm] = useState(108.4);
  const [traineeDepth, setTraineeDepth] = useState(5.4);
  const [armAngle, setArmAngle] = useState(178.2);
  const [dtwAlignment, setDtwAlignment] = useState(98.4);
  const [view3DMode, setView3DMode] = useState(true);

  const { canRender: canRender3D } = useCanRender3D();
  const show3D = canRender3D && view3DMode;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Optical comparator dual-skeleton animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime: number | null = null;
    const CPR_PERIOD_MS = 545; // ~110 BPM

    const render = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, w, h);

      // Split viewport: Left = Trainee (Electric Cyan), Right = Reference (Electric Violet/Amber)
      const halfW = w / 2;

      // Center laser divider
      const gradient = ctx.createLinearGradient(halfW, 0, halfW, h);
      gradient.addColorStop(0, 'rgba(0, 240, 255, 0.05)');
      gradient.addColorStop(0.5, 'rgba(0, 240, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0.05)');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(halfW, 0);
      ctx.lineTo(halfW, h);
      ctx.stroke();

      const phase = isPlaying ? (elapsed % CPR_PERIOD_MS) / CPR_PERIOD_MS : 0.2;
      const compress = Math.max(0, Math.sin(phase * Math.PI));

      // Draw Trainee Skeleton (Left, Electric Laser Cyan)
      drawComparatorSkeleton(
        ctx,
        halfW * 0.5,
        h * 0.18,
        halfW * 0.7,
        h * 0.65,
        compress * 0.95,
        '#00f0ff',
        '#38bdf8',
        'rgba(0, 240, 255, 0.4)',
        'LIVE BLAZEPOSE STREAM'
      );

      // Draw Reference Exemplar Skeleton (Right, Electric Violet / Amber)
      drawComparatorSkeleton(
        ctx,
        halfW + halfW * 0.5,
        h * 0.18,
        halfW * 0.7,
        h * 0.65,
        compress,
        '#c084fc',
        '#f59e0b',
        'rgba(192, 132, 252, 0.4)',
        'CERTIFIED EXEMPLAR MODEL'
      );

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // Telemetry fluctuation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTraineeBpm(+(107.5 + Math.random() * 2.5).toFixed(1));
      setTraineeDepth(+(5.3 + Math.random() * 0.25).toFixed(1));
      setArmAngle(+(177.5 + Math.random() * 1.5).toFixed(1));
      setDtwAlignment(+(98.1 + Math.random() * 0.6).toFixed(1));
    }, 1400);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <section className="relative overflow-hidden pt-28 pb-24 sm:pt-36 sm:pb-32">
      {/* Radiant ambient glow spheres */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] ambient-glow-cyan blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[450px] h-[450px] ambient-glow-violet blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Main Header Presentation */}
        <div className="max-w-3xl mb-14">
          <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-slate-300 font-mono text-xs mb-6 backdrop-blur-md shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span className="text-cyan-300 font-semibold">Standard: AHA-CPR-2026</span>
            <span className="text-slate-600">/</span>
            <span className="text-amber-400">Deterministic DTW Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-headline font-extrabold text-white tracking-tight leading-[1.06]">
            Objective skill verification, <span className="text-gradient-cyan-violet">proven by vision AI</span>.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed font-sans max-w-2xl">
            ProofOfSkill translates human movement into mathematical certainty. Real-time BlazePose pose estimation aligned deterministically with dynamic time warping against accredited gold standards.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              className="h-12 px-7 text-xs font-mono font-bold bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 text-slate-950 hover:from-cyan-300 hover:to-purple-400 shadow-glow-cyan border-0 rounded-xl transition-all hover:scale-[1.02]"
              onClick={() => onAuthClick('signup')}
            >
              <Zap className="mr-2 h-4 w-4 fill-current" />
              Start Live Assessment
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-6 text-xs font-mono border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-slate-200 rounded-xl backdrop-blur-md transition-all"
              asChild
            >
              <a href="#demo-report">
                <Sliders className="mr-2 h-4 w-4 text-amber-400" />
                Inspect Calibration Ledger
              </a>
            </Button>
          </div>
        </div>

        {/* ── THE SIGNATURE HERO MOMENT: Dual-Skeleton Optical Comparator ── */}
        <div className="relative rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-2xl overflow-hidden shadow-glass">
          
          {/* Terminal Instrument Header */}
          <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-slate-950/90 border-b border-white/10 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Activity className="h-4 w-4 text-cyan-400" />
                <span>OPTICAL DUAL-COMPARATOR ENGINE</span>
              </div>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-cyan-400/80 hidden sm:inline flex items-center gap-1">
                <Cpu className="h-3 w-3" />
                30.0 FPS · 33 Keypoints
              </span>
            </div>

            <div className="flex items-center gap-4">
              {canRender3D && (
                <button
                  type="button"
                  onClick={() => setView3DMode(!view3DMode)}
                  aria-label="Toggle between 3D Kinematic Rig and 2D Comparator"
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-[11px] font-mono transition-all"
                >
                  <Box className="h-3 w-3 text-cyan-400" />
                  <span>{view3DMode ? '3D RIG ACTIVE' : '2D COMPARATOR'}</span>
                </button>
              )}
              <span className="text-cyan-300 font-bold drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                DTW Alignment: {dtwAlignment}%
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400 font-bold">Tolerance: ±5.0%</span>
            </div>
          </div>

          {/* Optical Canvas Viewport */}
          <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-[#05070e] flex items-center justify-center overflow-hidden">
            {/* 2D Canvas comparator (baseline & smooth fallback) */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500 ${
                show3D ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {/* Real 3D React Three Fiber Kinematic Rig */}
            {show3D && (
              <div className="absolute inset-0 w-full h-full z-0">
                <Suspense
                  fallback={
                    <div className="w-full h-full flex items-center justify-center text-xs font-mono text-cyan-400/70">
                      Initializing 3D Kinematic Rig...
                    </div>
                  }
                >
                  <CprSkeletonScene
                    isPlaying={isPlaying}
                    traineeBpm={traineeBpm}
                    traineeDepth={traineeDepth}
                  />
                </Suspense>
              </div>
            )}

            {/* Orbit Hint in 3D mode */}
            {show3D && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center hidden md:block">
                <span className="inline-block px-3 py-1 rounded-full bg-slate-950/80 border border-white/10 text-[10px] font-mono text-slate-400 backdrop-blur-md">
                  Drag to orbit · Clamped 3D perspective
                </span>
              </div>
            )}

            {/* Left Telemetry Card (Trainee Live Stream) */}
            <div className="absolute bottom-5 left-5 p-4 rounded-xl glass-panel text-left font-mono text-xs space-y-1.5 z-20 shadow-lg border-cyan-500/20 pointer-events-auto">
              <div className="text-cyan-400 font-bold mb-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                TRAINEE TELEMETRY
              </div>
              <div className="text-slate-400">Rate: <span className="text-white font-semibold">{traineeBpm} BPM</span></div>
              <div className="text-slate-400">Depth: <span className="text-white font-semibold">{traineeDepth} cm</span></div>
              <div className="text-slate-400">Arm Angle: <span className="text-white font-semibold">{armAngle}°</span></div>
            </div>

            {/* Right Telemetry Card (Reference Exemplar) */}
            <div className="absolute bottom-5 right-5 p-4 rounded-xl glass-panel text-right font-mono text-xs space-y-1.5 z-20 shadow-lg border-purple-500/20 pointer-events-auto">
              <div className="text-purple-400 font-bold mb-1 flex items-center justify-end gap-1.5">
                EXEMPLAR STANDARD
                <Layers className="h-3 w-3 text-purple-400" />
              </div>
              <div className="text-slate-400">Target Rate: <span className="text-white font-semibold">100–120 BPM</span></div>
              <div className="text-slate-400">Target Depth: <span className="text-white font-semibold">5.0–6.0 cm</span></div>
              <div className="text-slate-400">Target Lock: <span className="text-white font-semibold">180° Vertical</span></div>
            </div>

            {/* Center Play/Pause Toggle */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'Pause Kinematics Animation' : 'Resume Kinematics Animation'}
                className="px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-slate-200 hover:text-white text-xs font-mono transition-all flex items-center gap-2 backdrop-blur-md hover:bg-white/[0.12] hover:border-cyan-400/40 shadow-sm"
              >
                {isPlaying ? <Pause className="h-3 w-3 text-cyan-400" /> : <Play className="h-3 w-3 text-cyan-400" />}
                <span>{isPlaying ? 'Pause Kinematics' : 'Resume Kinematics'}</span>
              </button>
            </div>
          </div>

          {/* Terminal Waveform & Verification Footer */}
          <div className="px-5 py-3.5 bg-slate-950/90 border-t border-white/10 grid sm:grid-cols-3 gap-4 items-center text-xs font-mono">
            <div className="text-slate-300 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Multi-Signature Ledger Verification</span>
            </div>

            <div className="flex items-center justify-center gap-1.5" aria-label="Live Telemetry Waveform Signal">
              <span className="text-[10px] text-slate-500 mr-1">SIGNAL:</span>
              {[20, 55, 90, 45, 100, 70, 30, 85, 95, 60, 75, 40, 80, 60, 95, 80, 45].map((h, i) => {
                const bpmMod = (traineeBpm % 10) * 2;
                const depthMod = (traineeDepth * 4);
                const dynamicH = Math.min(100, Math.max(10, h + ((i % 3 === 0) ? bpmMod : -depthMod)));
                return (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-gradient-to-t from-cyan-500 to-purple-500 transition-all duration-300 shadow-[0_0_6px_rgba(0,240,255,0.4)]"
                    style={{
                      height: `${Math.max(4, (dynamicH * (isPlaying ? 1 : 0.3)) * 0.18)}px`,
                      opacity: 0.35 + (i / 17) * 0.65,
                    }}
                  />
                );
              })}
            </div>

            <div className="text-right text-slate-400 truncate">
              SHA-256: <span className="text-cyan-300">8f4e3c13a0219bd948f2...</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

/**
 * Draws a clean skeletal wireframe with joint coordinates for the dual optical comparator.
 */
function drawComparatorSkeleton(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  width: number,
  height: number,
  compress: number,
  boneColor: string,
  jointColor: string,
  glowColor: string,
  headerLabel: string
) {
  const compressY = compress * height * 0.14;

  const pts = {
    nose:          { x: cx,                 y: baseY },
    leftEar:       { x: cx - width * 0.12,  y: baseY + height * 0.04 },
    rightEar:      { x: cx + width * 0.12,  y: baseY + height * 0.04 },
    neck:          { x: cx,                 y: baseY + height * 0.10 },
    leftShoulder:  { x: cx - width * 0.28,  y: baseY + height * 0.18 + compressY * 0.6 },
    rightShoulder: { x: cx + width * 0.28,  y: baseY + height * 0.18 + compressY * 0.6 },
    leftElbow:     { x: cx - width * 0.16,  y: baseY + height * 0.38 + compressY * 0.8 },
    rightElbow:    { x: cx + width * 0.16,  y: baseY + height * 0.38 + compressY * 0.8 },
    leftWrist:     { x: cx - width * 0.05,  y: baseY + height * 0.58 + compressY },
    rightWrist:    { x: cx + width * 0.05,  y: baseY + height * 0.58 + compressY },
    hands:         { x: cx,                 y: baseY + height * 0.64 + compressY },
    leftHip:       { x: cx - width * 0.30,  y: baseY + height * 0.60 },
    rightHip:      { x: cx + width * 0.30,  y: baseY + height * 0.60 },
    leftKnee:      { x: cx - width * 0.32,  y: baseY + height * 0.82 },
    rightKnee:     { x: cx + width * 0.32,  y: baseY + height * 0.82 },
  };

  const bones: [keyof typeof pts, keyof typeof pts][] = [
    ['nose', 'neck'],
    ['nose', 'leftEar'],
    ['nose', 'rightEar'],
    ['neck', 'leftShoulder'],
    ['neck', 'rightShoulder'],
    ['leftShoulder', 'leftElbow'],
    ['leftElbow', 'leftWrist'],
    ['leftWrist', 'hands'],
    ['rightShoulder', 'rightElbow'],
    ['rightElbow', 'rightWrist'],
    ['rightWrist', 'hands'],
    ['leftShoulder', 'leftHip'],
    ['rightShoulder', 'rightHip'],
    ['leftHip', 'rightHip'],
    ['leftHip', 'leftKnee'],
    ['rightHip', 'rightKnee'],
  ];

  ctx.save();

  // Header label on canvas
  ctx.fillStyle = boneColor;
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(headerLabel, cx, baseY - 12);

  // Bones
  ctx.strokeStyle = boneColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 12;

  bones.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
    ctx.stroke();
  });

  // Joints
  ctx.fillStyle = jointColor;
  ctx.shadowBlur = 8;
  Object.values(pts).forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Active contact hand point
  ctx.fillStyle = boneColor;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(pts.hands.x, pts.hands.y, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
