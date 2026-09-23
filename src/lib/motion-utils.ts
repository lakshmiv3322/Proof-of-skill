import { useState, useEffect } from 'react';

/**
 * Hook to detect if the user prefers reduced motion.
 * Respects OS accessibility settings.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Legacy browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return prefersReduced;
}

/**
 * Check if the current browser environment reliably supports WebGL.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/**
 * Hook to determine if 3D WebGL rendering should be enabled:
 * - Checks WebGL context availability
 * - Respects prefers-reduced-motion
 * - Checks for low-end device constraints (e.g. low logical cores or low RAM when reported)
 */
export function useCanRender3D(): { canRender: boolean; reason?: string } {
  const prefersReduced = usePrefersReducedMotion();
  const [canRender, setCanRender] = useState<boolean>(false);
  const [reason, setReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (prefersReduced) {
      setCanRender(false);
      setReason('reduced-motion');
      return;
    }

    if (!isWebGLAvailable()) {
      setCanRender(false);
      setReason('no-webgl');
      return;
    }

    // Performance heuristic: check for severely constrained mobile devices
    if (typeof navigator !== 'undefined') {
      const hwConcurrency = navigator.hardwareConcurrency || 4;
      // If single-core or reported device memory <= 1GB
      const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
      if (hwConcurrency < 2 || (deviceMemory !== undefined && deviceMemory < 1.5)) {
        setCanRender(false);
        setReason('low-hardware-tier');
        return;
      }
    }

    setCanRender(true);
    setReason(undefined);
  }, [prefersReduced]);

  return { canRender, reason };
}
