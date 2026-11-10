import { describe, expect, it } from 'vitest';
import {
  chiSquareTest,
  minimumDetectableEffect,
  sampleRatioMismatch,
  twoProportionZTest,
  welchTTest,
} from './statistics';

describe('twoProportionZTest', () => {
  it('matches a SciPy reference example', () => {
    const result = twoProportionZTest(200, 1_000, 250, 1_000);

    expect(result.statistic).toBeCloseTo(2.677397763, 9);
    expect(result.pValue).toBeCloseTo(0.007419649, 9);
    expect(result.difference).toBeCloseTo(0.05, 12);
    expect(result.significant).toBe(true);
  });

  it('handles equal all-zero groups without returning NaN', () => {
    const result = twoProportionZTest(0, 100, 0, 100);

    expect(result.statistic).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.confidenceInterval).toEqual([0, 0]);
  });

  it('rejects conversions above the sample size', () => {
    expect(() => twoProportionZTest(101, 100, 10, 100)).toThrow(/cannot exceed/);
  });
});

describe('welchTTest', () => {
  it('matches a SciPy reference example', () => {
    const result = welchTTest(50, 10, 500, 52, 9, 500);

    expect(result.statistic).toBeCloseTo(3.324112477, 9);
    expect(result.degreesOfFreedom).toBeCloseTo(987.1226979, 7);
    expect(result.pValue).toBeCloseTo(0.000919625, 9);
  });

  it('requires at least two observations per group', () => {
    expect(() => welchTTest(1, 1, 1, 2, 1, 10)).toThrow(/at least 2/);
  });

  it('rejects a zero standard error', () => {
    expect(() => welchTTest(1, 0, 10, 1, 0, 10)).toThrow(/undefined/);
  });
});

describe('chiSquareTest', () => {
  it('matches a SciPy reference example', () => {
    const result = chiSquareTest(200, 800, 250, 750);

    expect(result.statistic).toBeCloseTo(7.168458781, 9);
    expect(result.pValue).toBeCloseTo(0.007419649, 9);
    expect(result.expected).toEqual([225, 225, 775, 775]);
  });

  it('rejects an empty table', () => {
    expect(() => chiSquareTest(0, 0, 0, 0)).toThrow(/positive total/);
  });

  it('warns about small expected counts', () => {
    expect(chiSquareTest(1, 9, 4, 6).warnings).toHaveLength(1);
  });
});

describe('sampleRatioMismatch', () => {
  it('matches a SciPy reference example', () => {
    const result = sampleRatioMismatch(10_000, 9_500);

    expect(result.statistic).toBeCloseTo(12.820512821, 9);
    expect(result.pValue).toBeCloseTo(0.00034284, 8);
    expect(result.significant).toBe(true);
  });

  it('rejects an empty experiment', () => {
    expect(() => sampleRatioMismatch(0, 0)).toThrow(/positive/);
  });
});

describe('minimumDetectableEffect', () => {
  it('matches the reference normal approximation', () => {
    const result = minimumDetectableEffect(0.1, 5_000, 5_000, 0.05, 0.8);

    expect(result.absolute).toBeCloseTo(0.016809511, 9);
    expect(result.relativePercent).toBeCloseTo(16.8095113, 7);
  });
});

