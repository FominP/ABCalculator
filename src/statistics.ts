import gammainc from '@stdlib/math-base-special-gammainc';
import normalCdf from '@stdlib/stats-base-dists-normal-cdf';
import normalQuantile from '@stdlib/stats-base-dists-normal-quantile';
import tCdf from '@stdlib/stats-base-dists-t-cdf';
import tQuantile from '@stdlib/stats-base-dists-t-quantile';

export interface TestResult {
  statistic: number;
  pValue: number;
  significant: boolean;
}

export interface ProportionResult extends TestResult {
  controlRate: number;
  testRate: number;
  difference: number;
  relativeLift: number | null;
  confidenceInterval: [number, number];
}

export interface WelchResult extends TestResult {
  degreesOfFreedom: number;
  difference: number;
  confidenceInterval: [number, number];
}

export interface ChiSquareResult extends TestResult {
  expected: [number, number, number, number];
  warnings: string[];
}

export interface SrmResult extends TestResult {
  observedTestShare: number;
  expectedTestShare: number;
}

export interface MdeResult {
  absolute: number;
  relativePercent: number;
  detectableConversion: number;
  warning: string | null;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function assertPositiveInteger(value: number, label: string, minimum = 1): void {
  assertFinite(value, label);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer of at least ${minimum}.`);
  }
}

function assertAlpha(alpha: number): void {
  assertFinite(alpha, 'Alpha');
  if (alpha <= 0 || alpha >= 1) {
    throw new Error('Alpha must be between 0 and 1.');
  }
}

function twoSidedNormalPValue(statistic: number): number {
  return Math.min(1, 2 * normalCdf(-Math.abs(statistic), 0, 1));
}

function chiSquareSurvival(statistic: number, degreesOfFreedom: number): number {
  return gammainc(statistic / 2, degreesOfFreedom / 2, true, true);
}

export function twoProportionZTest(
  controlConversions: number,
  controlUsers: number,
  testConversions: number,
  testUsers: number,
  alpha = 0.05,
): ProportionResult {
  assertPositiveInteger(controlUsers, 'Control sample size');
  assertPositiveInteger(testUsers, 'Test sample size');
  assertPositiveInteger(controlConversions, 'Control conversions', 0);
  assertPositiveInteger(testConversions, 'Test conversions', 0);
  assertAlpha(alpha);

  if (controlConversions > controlUsers || testConversions > testUsers) {
    throw new Error('Conversions cannot exceed their group sample size.');
  }

  const controlRate = controlConversions / controlUsers;
  const testRate = testConversions / testUsers;
  const difference = testRate - controlRate;
  const pooledRate = (controlConversions + testConversions) / (controlUsers + testUsers);
  const pooledSe = Math.sqrt(
    pooledRate * (1 - pooledRate) * (1 / controlUsers + 1 / testUsers),
  );

  // Equal all-zero or all-one groups carry no evidence of a difference.
  const statistic = pooledSe === 0 ? 0 : difference / pooledSe;
  const pValue = pooledSe === 0 ? 1 : twoSidedNormalPValue(statistic);

  const unpooledSe = Math.sqrt(
    (controlRate * (1 - controlRate)) / controlUsers +
      (testRate * (1 - testRate)) / testUsers,
  );
  const criticalValue = normalQuantile(1 - alpha / 2, 0, 1);
  const confidenceInterval: [number, number] = [
    Math.max(-1, difference - criticalValue * unpooledSe),
    Math.min(1, difference + criticalValue * unpooledSe),
  ];

  return {
    statistic,
    pValue,
    significant: pValue < alpha,
    controlRate,
    testRate,
    difference,
    relativeLift: controlRate === 0 ? null : difference / controlRate,
    confidenceInterval,
  };
}

export function welchTTest(
  controlMean: number,
  controlStd: number,
  controlSize: number,
  testMean: number,
  testStd: number,
  testSize: number,
  alpha = 0.05,
): WelchResult {
  [controlMean, controlStd, testMean, testStd].forEach((value, index) => {
    const labels = ['Control mean', 'Control standard deviation', 'Test mean', 'Test standard deviation'];
    assertFinite(value, labels[index] ?? 'Value');
  });
  assertPositiveInteger(controlSize, 'Control sample size', 2);
  assertPositiveInteger(testSize, 'Test sample size', 2);
  assertAlpha(alpha);

  if (controlStd < 0 || testStd < 0) {
    throw new Error('Standard deviations cannot be negative.');
  }

  const controlVarianceTerm = controlStd ** 2 / controlSize;
  const testVarianceTerm = testStd ** 2 / testSize;
  const standardError = Math.sqrt(controlVarianceTerm + testVarianceTerm);
  if (standardError === 0) {
    throw new Error("Welch's t-test is undefined when both standard errors are zero.");
  }

  const difference = testMean - controlMean;
  const statistic = difference / standardError;
  const degreesOfFreedom =
    (controlVarianceTerm + testVarianceTerm) ** 2 /
    (controlVarianceTerm ** 2 / (controlSize - 1) +
      testVarianceTerm ** 2 / (testSize - 1));
  const pValue = Math.min(1, 2 * tCdf(-Math.abs(statistic), degreesOfFreedom));
  const criticalValue = tQuantile(1 - alpha / 2, degreesOfFreedom);

  return {
    statistic,
    pValue,
    significant: pValue < alpha,
    degreesOfFreedom,
    difference,
    confidenceInterval: [
      difference - criticalValue * standardError,
      difference + criticalValue * standardError,
    ],
  };
}

export function chiSquareTest(
  controlConversions: number,
  controlNonConversions: number,
  testConversions: number,
  testNonConversions: number,
  alpha = 0.05,
): ChiSquareResult {
  const observed = [
    controlConversions,
    testConversions,
    controlNonConversions,
    testNonConversions,
  ] as const;
  observed.forEach((value, index) => {
    const labels = [
      'Control conversions',
      'Test conversions',
      'Control non-conversions',
      'Test non-conversions',
    ];
    assertPositiveInteger(value, labels[index] ?? 'Cell count', 0);
  });
  assertAlpha(alpha);

  const outcomePositive = controlConversions + testConversions;
  const outcomeNegative = controlNonConversions + testNonConversions;
  const controlTotal = controlConversions + controlNonConversions;
  const testTotal = testConversions + testNonConversions;
  const total = controlTotal + testTotal;

  if (total === 0 || outcomePositive === 0 || outcomeNegative === 0 || controlTotal === 0 || testTotal === 0) {
    throw new Error('Every row and column of the 2×2 table must have a positive total.');
  }

  const expected: [number, number, number, number] = [
    (outcomePositive * controlTotal) / total,
    (outcomePositive * testTotal) / total,
    (outcomeNegative * controlTotal) / total,
    (outcomeNegative * testTotal) / total,
  ];
  const statistic =
    (observed[0] - expected[0]) ** 2 / expected[0] +
    (observed[1] - expected[1]) ** 2 / expected[1] +
    (observed[2] - expected[2]) ** 2 / expected[2] +
    (observed[3] - expected[3]) ** 2 / expected[3];
  const pValue = chiSquareSurvival(statistic, 1);
  const warnings = expected.some((value) => value < 5)
    ? [
        "At least one expected cell count is below 5. Pearson's chi-square approximation may be unreliable; consider Fisher's exact test.",
      ]
    : [];

  return { statistic, pValue, significant: pValue < alpha, expected, warnings };
}

export function sampleRatioMismatch(
  controlUsers: number,
  testUsers: number,
  expectedTestShare = 0.5,
  alpha = 0.001,
): SrmResult {
  assertPositiveInteger(controlUsers, 'Control sample size', 0);
  assertPositiveInteger(testUsers, 'Test sample size', 0);
  assertFinite(expectedTestShare, 'Expected test share');
  assertAlpha(alpha);
  if (expectedTestShare <= 0 || expectedTestShare >= 1) {
    throw new Error('Expected test share must be between 0 and 1.');
  }

  const total = controlUsers + testUsers;
  if (total === 0) {
    throw new Error('The total sample size must be positive.');
  }
  const expectedControl = total * (1 - expectedTestShare);
  const expectedTest = total * expectedTestShare;
  const statistic =
    (controlUsers - expectedControl) ** 2 / expectedControl +
    (testUsers - expectedTest) ** 2 / expectedTest;
  const pValue = chiSquareSurvival(statistic, 1);

  return {
    statistic,
    pValue,
    significant: pValue < alpha,
    observedTestShare: testUsers / total,
    expectedTestShare,
  };
}

export function minimumDetectableEffect(
  baselineConversion: number,
  controlUsers: number,
  testUsers: number,
  alpha = 0.05,
  power = 0.8,
): MdeResult {
  assertFinite(baselineConversion, 'Baseline conversion');
  assertFinite(power, 'Power');
  assertPositiveInteger(controlUsers, 'Control sample size');
  assertPositiveInteger(testUsers, 'Test sample size');
  assertAlpha(alpha);
  if (baselineConversion <= 0 || baselineConversion >= 1) {
    throw new Error('Baseline conversion must be between 0 and 1.');
  }
  if (power <= 0 || power >= 1) {
    throw new Error('Power must be between 0 and 1.');
  }

  const effectiveSampleSize =
    (2 * controlUsers * testUsers) / (controlUsers + testUsers);
  const absolute =
    (normalQuantile(1 - alpha / 2, 0, 1) + normalQuantile(power, 0, 1)) *
    Math.sqrt((2 * baselineConversion * (1 - baselineConversion)) / effectiveSampleSize);
  const detectableConversion = baselineConversion + absolute;

  return {
    absolute,
    relativePercent: (absolute / baselineConversion) * 100,
    detectableConversion,
    warning:
      detectableConversion >= 1
        ? 'The normal approximation produces an impossible conversion above 100%. Increase sample size or use an exact power calculation.'
        : null,
  };
}

