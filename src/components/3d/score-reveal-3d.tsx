import React, { useState, useEffect, useRef } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion-utils';
import { cn } from '@/lib/utils';

interface ScoreReveal3DProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  badgeClassName?: string;
  showPercent?: boolean;
}

export function ScoreReveal3D({
  score,
  label,
  size = 'md',
  className,
  badgeClassName,
  showPercent = false,
}: ScoreReveal3DProps) {
  const prefersReduced = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // Motion values for interactive 3D tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 200 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -12]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReduced || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // Animated counter value
  const [displayScore, setDisplayScore] = useState(prefersReduced ? score : 0);

  useEffect(() => {
    if (prefersReduced) {
      setDisplayScore(score);
      return;
    }

    const start = 0;
    const duration = 1200; // ms
    const startTime = performance.now();

    const animateCount = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(+(start + (score - start) * ease).toFixed(1));

      if (progress < 1) {
        requestAnimationFrame(animateCount);
      } else {
        setDisplayScore(score);
      }
    };

    const animId = requestAnimationFrame(animateCount);
    return () => cancelAnimationFrame(animId);
  }, [score, prefersReduced]);

  const sizeClasses = {
    sm: 'h-12 w-12 text-base',
    md: 'h-16 w-16 text-xl',
    lg: 'h-20 w-20 text-2xl',
  };

  const scoreColor =
    score >= 85 ? 'from-emerald-500 to-teal-600' : score >= 70 ? 'from-amber-500 to-orange-600' : 'from-red-500 to-rose-600';

  const glowColor =
    score >= 85 ? 'rgba(16, 185, 129, 0.4)' : score >= 70 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)';

  if (prefersReduced) {
    return (
      <div className={cn('relative inline-flex items-center gap-3', className)}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full font-extrabold text-white bg-gradient-to-br shadow-lg',
            scoreColor,
            sizeClasses[size],
            badgeClassName
          )}
        >
          {score.toFixed(0)}
          {showPercent && '%'}
        </div>
        {label && <span className="text-xs text-muted-foreground font-mono">{label}</span>}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn('relative inline-flex items-center gap-3 group select-none', className)}
      style={{ perspective: 900 }}
    >
      {/* 3D Depth Backing Plane with Depth-of-Field Blur */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="absolute -inset-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md -z-10 pointer-events-none"
        style={{
          boxShadow: `0 12px 32px -8px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}
      />

      {/* Floating 3D Badge with dynamic elevation and specular tilt */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: 15, rotateX: -15 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20,
          delay: 0.1,
        }}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-full font-extrabold text-white bg-gradient-to-br shadow-2xl cursor-pointer transition-shadow',
          scoreColor,
          sizeClasses[size],
          badgeClassName
        )}
      >
        {/* Specular rim shine */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/10 to-white/30 pointer-events-none" />

        {/* 3D Elevated Score Number */}
        <span
          className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
          style={{ transform: 'translateZ(24px)' }}
        >
          {displayScore.toFixed(0)}
          {showPercent && '%'}
        </span>

        {/* Dynamic drop contact shadow beneath the floating coin */}
        <div
          className="absolute -bottom-2 inset-x-2 h-2 rounded-full blur-sm -z-10 pointer-events-none"
          style={{
            background: glowColor,
            transform: 'translateZ(-12px)',
          }}
        />
      </motion.div>

      {label && <span className="text-xs text-muted-foreground font-mono">{label}</span>}
    </div>
  );
}

export default ScoreReveal3D;
