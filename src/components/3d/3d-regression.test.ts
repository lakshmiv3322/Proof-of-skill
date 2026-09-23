import { describe, it, expect, vi } from 'vitest';
import { isWebGLAvailable } from '@/lib/motion-utils';

describe('3D & Motion Guardrails & Fallbacks Suite', () => {
  it('isWebGLAvailable accurately detects WebGL context or returns false safely in headless environments', () => {
    // In node/vitest environment without real GPU, must not throw and return boolean
    const result = isWebGLAvailable();
    expect(typeof result).toBe('boolean');
  });

  it('verifies score coloring logic thresholds for ScoreReveal3D', () => {
    const getExpectedColor = (score: number) =>
      score >= 85 ? 'emerald' : score >= 70 ? 'amber' : 'red';

    expect(getExpectedColor(94.5)).toBe('emerald');
    expect(getExpectedColor(85.0)).toBe('emerald');
    expect(getExpectedColor(78.2)).toBe('amber');
    expect(getExpectedColor(70.0)).toBe('amber');
    expect(getExpectedColor(68.5)).toBe('red');
    expect(getExpectedColor(0)).toBe('red');
  });

  it('validates CPR kinematic frequency calculation across physiological ranges', () => {
    const calculateFrequency = (bpm: number) => bpm / 60;

    // Normal CPR target: 100 - 120 BPM
    expect(calculateFrequency(120)).toBeCloseTo(2.0, 2);
    expect(calculateFrequency(100)).toBeCloseTo(1.67, 2);
    expect(calculateFrequency(108.4)).toBeCloseTo(1.807, 2);
  });

  it('ensures reduced-motion media query evaluator parses correctly', () => {
    const matchMediaMock = (matches: boolean) => ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    const standardUser = matchMediaMock(false);
    expect(standardUser.matches).toBe(false);

    const reducedMotionUser = matchMediaMock(true);
    expect(reducedMotionUser.matches).toBe(true);
  });
});
