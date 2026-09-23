import React, { useState, useRef } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/motion-utils';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CertificateReveal3DProps {
  children: React.ReactNode;
  backContent?: React.ReactNode;
  className?: string;
  enableFlip?: boolean;
}

export function CertificateReveal3D({
  children,
  backContent,
  className,
  enableFlip = true,
}: CertificateReveal3DProps) {
  const prefersReduced = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  // Mouse tilt tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 180 };
  const tiltX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), springConfig);
  const tiltY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), springConfig);

  // Glare / sheen coordinates
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReduced || isFlipped || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);

    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    setGlarePos({ x: px, y: py, opacity: 0.15 });
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  const toggleFlip = () => {
    if (!enableFlip || prefersReduced) return;
    setIsFlipped(!isFlipped);
    mouseX.set(0);
    mouseY.set(0);
  };

  if (prefersReduced) {
    return <div className={cn('relative w-full print:m-0', className)}>{children}</div>;
  }

  return (
    <div className={cn('relative w-full group print:m-0', className)}>
      {/* 3D Flip Action Control */}
      {enableFlip && backContent && (
        <div className="flex justify-end mb-3 print:hidden">
          <button
            type="button"
            onClick={toggleFlip}
            aria-label={isFlipped ? 'Flip to Certificate' : 'Flip to Cryptographic Proof'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs transition-all backdrop-blur-md shadow-sm"
          >
            <RotateCcw className={cn('h-3.5 w-3.5 transition-transform duration-500', isFlipped && 'rotate-180 text-amber-400')} />
            <span>{isFlipped ? 'View Certificate Face' : 'Inspect Ledger Proof (3D Flip)'}</span>
          </button>
        </div>
      )}

      {/* 3D Perspective Card Wrapper */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full relative select-none print:transform-none"
        style={{ perspective: 1400 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: 10, scale: 0.96 }}
          animate={{
            opacity: 1,
            y: 0,
            rotateX: prefersReduced ? 0 : isFlipped ? 0 : undefined,
            rotateY: isFlipped ? 180 : 0,
            scale: 1,
          }}
          transition={{
            type: 'spring',
            stiffness: 160,
            damping: 22,
            mass: 1.1,
          }}
          style={{
            rotateX: prefersReduced || isFlipped ? 0 : tiltX,
            rotateY: isFlipped ? 180 : prefersReduced ? 0 : tiltY,
            transformStyle: 'preserve-3d',
          }}
          className="relative w-full transition-shadow duration-300 shadow-2xl rounded-2xl print:shadow-none print:transform-none"
        >
          {/* FRONT FACE: Certificate Sheet */}
          <div
            className={cn(
              'w-full [backface-visibility:hidden] relative z-10 transition-opacity',
              isFlipped && 'pointer-events-none opacity-0'
            )}
            style={{ transform: 'translateZ(1px)' }}
          >
            {children}

            {/* Holographic Sheen Overlay on hover */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300 print:hidden"
              style={{
                opacity: glarePos.opacity,
                background: `radial-gradient(circle 450px at ${glarePos.x}% ${glarePos.y}%, rgba(245, 158, 11, 0.25), rgba(0, 240, 255, 0.15) 40%, transparent 80%)`,
              }}
            />
          </div>

          {/* BACK FACE: Cryptographic Proof Ledger */}
          {backContent && (
            <div
              className={cn(
                'absolute inset-0 w-full h-full rounded-2xl p-6 sm:p-10 border-4 border-double border-amber-500/40 bg-gradient-to-b from-slate-950 via-[#070b16] to-slate-950 text-white shadow-2xl [backface-visibility:hidden] overflow-auto print:hidden',
                !isFlipped && 'pointer-events-none opacity-0'
              )}
              style={{
                transform: 'rotateY(180deg) translateZ(1px)',
              }}
            >
              {backContent}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default CertificateReveal3D;
