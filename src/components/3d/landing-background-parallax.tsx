import { useState, useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/lib/motion-utils';

export function LandingBackgroundParallax() {
  const prefersReduced = usePrefersReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0, scrollY: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReduced) return;

    let targetX = 0;
    let targetY = 0;
    let targetScroll = window.scrollY;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 40;
      targetY = (e.clientY / window.innerHeight - 0.5) * 40;
    };

    const handleScroll = () => {
      targetScroll = window.scrollY;
    };

    const updateLoop = () => {
      setOffset((prev) => ({
        x: prev.x + (targetX - prev.x) * 0.08,
        y: prev.y + (targetY - prev.y) * 0.08,
        scrollY: prev.scrollY + (targetScroll - prev.scrollY) * 0.1,
      }));
      rafId.current = requestAnimationFrame(updateLoop);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    rafId.current = requestAnimationFrame(updateLoop);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [prefersReduced]);

  if (prefersReduced) {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 select-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] ambient-glow-cyan blur-[140px] opacity-35" />
        <div className="absolute top-1/3 right-10 w-[500px] h-[500px] ambient-glow-violet blur-[150px] opacity-30" />
      </div>
    );
  }

  // Layer parallax calculations
  const layer1Transform = `translate3d(${offset.x * 0.3}px, ${offset.y * 0.3 - offset.scrollY * 0.04}px, 0)`;
  const layer2Transform = `translate3d(${-offset.x * 0.6}px, ${-offset.y * 0.6 - offset.scrollY * 0.08}px, 0)`;
  const layer3Transform = `translate3d(${offset.x * 0.9}px, ${offset.y * 0.9 - offset.scrollY * 0.14}px, 0)`;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden -z-10 select-none"
    >
      {/* Plane 1 (Deep): Ambient Radiant Volumetric Glow Orbs */}
      <div
        className="absolute inset-0 transition-transform duration-75 ease-out will-change-transform"
        style={{ transform: layer1Transform }}
      >
        <div className="absolute top-20 left-1/3 w-[650px] h-[500px] ambient-glow-cyan blur-[150px] opacity-35" />
        <div className="absolute top-96 right-1/4 w-[550px] h-[550px] ambient-glow-violet blur-[160px] opacity-30" />
        <div className="absolute top-[900px] left-1/4 w-[600px] h-[500px] ambient-glow-amber blur-[170px] opacity-25" />
      </div>

      {/* Plane 2 (Mid): BlazePose Kinematic Coordinate Dot Matrix */}
      <div
        className="absolute inset-0 transition-transform duration-75 ease-out will-change-transform"
        style={{ transform: layer2Transform }}
      >
        <svg className="w-full h-[1600px] opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dot-matrix-3d" width="48" height="48" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#00f0ff" opacity="0.6" />
              <circle cx="26" cy="26" r="0.8" fill="#a855f7" opacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-matrix-3d)" />
        </svg>
      </div>

      {/* Plane 3 (Near): Floating Micro-Kinematic Nodes */}
      <div
        className="absolute inset-0 transition-transform duration-75 ease-out will-change-transform"
        style={{ transform: layer3Transform }}
      >
        <div className="absolute top-32 left-[12%] h-2 w-2 rounded-full bg-cyan-400 blur-[1px] opacity-60 shadow-[0_0_8px_#00f0ff]" />
        <div className="absolute top-72 right-[18%] h-2.5 w-2.5 rounded-full bg-purple-400 blur-[1px] opacity-50 shadow-[0_0_8px_#a855f7]" />
        <div className="absolute top-[600px] left-[22%] h-1.5 w-1.5 rounded-full bg-cyan-300 blur-[0.5px] opacity-40" />
        <div className="absolute top-[850px] right-[12%] h-2 w-2 rounded-full bg-amber-400 blur-[1px] opacity-50 shadow-[0_0_8px_#f59e0b]" />
      </div>
    </div>
  );
}

export default LandingBackgroundParallax;
