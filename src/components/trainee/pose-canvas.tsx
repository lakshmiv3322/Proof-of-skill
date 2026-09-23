import { useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────
// PoseCanvas — Real MediaPipe BlazePose & Neon Telemetry Overlay
// ─────────────────────────────────────────────────────────────
// Renders real MediaPipe 33-point body landmarks with glowing
// skeletal connections, joint nodes, and spatial orientation lines.
// ─────────────────────────────────────────────────────────────

export interface LivePoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  name?: string;
}

interface PoseCanvasProps {
  isRecording: boolean;
  landmarks?: LivePoint[];
  className?: string;
  showHUD?: boolean;
}

// ── Neon HUD Palette (Laser Cyan #00f0ff Token Architecture) ────
const NEON_GREEN   = '#00f0ff'; // Laser Cyan #00f0ff
const NEON_ACTIVE  = 'rgba(0, 240, 255, 0.95)';
const NEON_CYAN    = '#00f0ff'; // Laser Cyan #00f0ff
const NEON_IDLE    = 'rgba(0, 240, 255, 0.25)';
const WHITE_JOINT  = 'rgba(255, 255, 255, 0.95)';
const WHITE_IDLE   = 'rgba(255, 255, 255, 0.25)';
const PATIENT_COLOR = 'rgba(255, 255, 255, 0.08)';

// CPR cycle period for 110 BPM → 60 000 / 110 ≈ 545 ms
const CPR_PERIOD_MS = 545;

// MediaPipe BlazePose 33 Keypoint Connections
const BLAZEPOSE_CONNECTIONS: Array<[number, number]> = [
  // Head / Face
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // Torso / Shoulders
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left Arm
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  // Right Arm
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Legs
  [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]
];

export function PoseCanvas({ isRecording, landmarks, className, showHUD = true }: PoseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const smoothedPointsRef = useRef<LivePoint[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── ResizeObserver: handles container resize & pixel density ──
    const setSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const w   = parent.clientWidth;
      const h   = parent.clientHeight;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(canvas.parentElement!);

    let startTime: number | null = null;

    const draw = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      const W = canvas.width  / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, W, H);

      // If live MediaPipe landmarks are available, draw smoothed real points
      if (landmarks && landmarks.length >= 11) {
        // Smooth landmarks with previous frame
        if (smoothedPointsRef.current.length !== landmarks.length) {
          smoothedPointsRef.current = [...landmarks];
        } else {
          smoothedPointsRef.current = landmarks.map((pt, i) => {
            const prev = smoothedPointsRef.current[i] || pt;
            const alpha = 0.65; // Smoothing factor
            return {
              x: prev.x * (1 - alpha) + pt.x * alpha,
              y: prev.y * (1 - alpha) + pt.y * alpha,
              z: (prev.z ?? 0) * (1 - alpha) + (pt.z ?? 0) * alpha,
              visibility: pt.visibility,
              name: pt.name,
            };
          });
        }

        drawRealLandmarks(ctx, W, H, smoothedPointsRef.current, isRecording, showHUD);
      } else if (isRecording) {
        // Rescuer wireframe compression simulation
        const phase      = (elapsed % CPR_PERIOD_MS) / CPR_PERIOD_MS;
        const compress   = Math.max(0, Math.sin(phase * Math.PI));
        const glowRadius = 6 + compress * 12;

        drawPatientSilhouette(ctx, W, H);
        drawRescuerSkeleton(ctx, W, H, compress, glowRadius, true);
      } else {
        // Static idle skeleton without patient
        drawRescuerSkeleton(ctx, W, H, 0, 6, false);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      ro.disconnect();
    };
  }, [isRecording, landmarks, showHUD]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none z-10 ${className ?? ''}`}
    />
  );
}

/**
 * Renders real MediaPipe 33-point body landmarks on top of the live video stream.
 */
function drawRealLandmarks(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pts: LivePoint[],
  isRecording: boolean,
  showHUD: boolean
) {
  ctx.save();
  ctx.strokeStyle = isRecording ? NEON_ACTIVE : 'rgba(6, 182, 212, 0.85)';
  ctx.lineWidth   = isRecording ? 3 : 2;
  ctx.shadowColor = isRecording ? NEON_GREEN : NEON_CYAN;
  ctx.shadowBlur  = isRecording ? 12 : 8;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // 1. Draw connections
  BLAZEPOSE_CONNECTIONS.forEach(([i, j]) => {
    const p1 = pts[i];
    const p2 = pts[j];
    if (p1 && p2 && (p1.visibility ?? 1) > 0.35 && (p2.visibility ?? 1) > 0.35) {
      ctx.beginPath();
      ctx.moveTo(p1.x * W, p1.y * H);
      ctx.lineTo(p2.x * W, p2.y * H);
      ctx.stroke();
    }
  });

  // 2. Draw landmark points
  ctx.fillStyle  = WHITE_JOINT;
  ctx.shadowBlur = 10;

  pts.forEach((pt, idx) => {
    if ((pt.visibility ?? 1) > 0.35) {
      const isWristOrHand = idx === 15 || idx === 16 || idx === 19 || idx === 20;
      const isShoulder = idx === 11 || idx === 12;
      const radius = isWristOrHand ? 5.5 : isShoulder ? 5.0 : 3.5;

      ctx.beginPath();
      ctx.arc(pt.x * W, pt.y * H, radius, 0, Math.PI * 2);
      ctx.fill();

      // Concentric rings for active wrists/compression contact points
      if (isWristOrHand && isRecording) {
        ctx.strokeStyle = NEON_GREEN;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x * W, pt.y * H, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });

  // 3. Draw Telemetry HUD overlay in top left of canvas
  if (showHUD) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(12, 12, 170, 48);
    ctx.strokeStyle = isRecording ? 'rgba(16, 185, 129, 0.4)' : 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, 170, 48);

    ctx.fillStyle = isRecording ? '#10b981' : '#06b6d4';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(isRecording ? '● LIVE TRACKING' : '○ TRACKER STANDBY', 22, 28);

    const visibleCount = pts.filter((p) => (p.visibility ?? 1) > 0.4).length;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`Keypoints: ${visibleCount}/33 locked`, 22, 44);
  }

  ctx.restore();
}

function drawPatientSilhouette(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const cx  = W * 0.5;
  const py  = H * 0.72;
  const pw  = W * 0.5;
  const ph  = H * 0.12;

  ctx.save();
  ctx.fillStyle   = PATIENT_COLOR;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth   = 1;

  ctx.beginPath();
  ctx.ellipse(cx, py, pw / 2, ph / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx - pw / 2 - ph * 0.6, py, ph * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawRescuerSkeleton(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  compress: number,
  glow: number,
  active: boolean
) {
  const cx   = W * 0.5;
  const base = H * 0.15;
  const compressY = compress * H * 0.12;

  const pts = {
    nose:          { x: cx,          y: base },
    leftEar:       { x: cx - W*0.06, y: base + H*0.025 },
    rightEar:      { x: cx + W*0.06, y: base + H*0.025 },
    neck:          { x: cx,          y: base + H*0.07 },
    leftShoulder:  { x: cx - W*0.14, y: base + H*0.13 + compressY * 0.55 },
    rightShoulder: { x: cx + W*0.14, y: base + H*0.13 + compressY * 0.55 },
    leftElbow:     { x: cx - W*0.07, y: base + H*0.25 + compressY * 0.75 },
    rightElbow:    { x: cx + W*0.07, y: base + H*0.25 + compressY * 0.75 },
    leftWrist:     { x: cx - W*0.02, y: base + H*0.37 + compressY },
    rightWrist:    { x: cx + W*0.02, y: base + H*0.37 + compressY },
    hands:         { x: cx,          y: base + H*0.41 + compressY },
    leftHip:       { x: cx - W*0.18, y: base + H*0.40 },
    rightHip:      { x: cx + W*0.18, y: base + H*0.40 },
    leftKnee:      { x: cx - W*0.20, y: base + H*0.58 },
    rightKnee:     { x: cx + W*0.20, y: base + H*0.58 },
    leftAnkle:     { x: cx - W*0.19, y: base + H*0.72 },
    rightAnkle:    { x: cx + W*0.19, y: base + H*0.72 },
  };

  const bones: [keyof typeof pts, keyof typeof pts][] = [
    ['nose', 'neck'],
    ['nose', 'leftEar'],
    ['nose', 'rightEar'],
    ['neck', 'leftShoulder'],
    ['neck', 'rightShoulder'],
    ['leftShoulder',  'leftElbow'],
    ['leftElbow',     'leftWrist'],
    ['leftWrist',     'hands'],
    ['rightShoulder', 'rightElbow'],
    ['rightElbow',    'rightWrist'],
    ['rightWrist',    'hands'],
    ['leftShoulder',  'leftHip'],
    ['rightShoulder', 'rightHip'],
    ['leftHip',       'rightHip'],
    ['leftHip',   'leftKnee'],
    ['leftKnee',  'leftAnkle'],
    ['rightHip',  'rightKnee'],
    ['rightKnee', 'rightAnkle'],
  ];

  const lineColor = active ? NEON_ACTIVE : NEON_IDLE;
  const lineWidth = active ? 2.5 : 1;
  const jointColor = active ? WHITE_JOINT : WHITE_IDLE;
  const jointRadius = active ? 4.5 : 2.5;

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth   = lineWidth;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  if (active) {
    ctx.shadowColor = NEON_GREEN;
    ctx.shadowBlur  = glow;
  }

  bones.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
    ctx.stroke();
  });

  ctx.fillStyle   = jointColor;
  ctx.shadowBlur  = active ? glow * 1.4 : 0;
  ctx.shadowColor = NEON_GREEN;

  Object.values(pts).forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, jointRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  if (active) {
    ctx.fillStyle  = NEON_ACTIVE;
    ctx.shadowBlur = glow * 2;
    ctx.beginPath();
    ctx.arc(pts.hands.x, pts.hands.y, jointRadius * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
