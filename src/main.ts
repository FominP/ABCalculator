import Chart, { type ChartConfiguration } from 'chart.js/auto';
import './styles.css';
import {
  chiSquareTest,
  minimumDetectableEffect,
  sampleRatioMismatch,
  twoProportionZTest,
  welchTTest,
} from './statistics';

type TestType = 'z_proportions' | 't_means' | 'chi_square' | 'srm' | 'mde';

interface FieldConfig {
  id: string;
  label: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number | 'any';
  defaultValue?: number;
}

interface TestConfig {
  description: string;
  fields: FieldConfig[];
  example: Record<string, number>;
}

interface Metric {
  label: string;
  value: string;
  detail?: string;
}

interface ResultView {
  title: string;
  decision: string;
  tone: 'positive' | 'warning' | 'neutral';
  metrics: Metric[];
  note: string;
  chart: ChartConfiguration<'bar'>;
}

const testConfigs: Record<TestType, TestConfig> = {
  z_proportions: {
    description:
      'Compare conversion rates for two independent groups with a two-sided pooled z-test.',
    fields: [
      { id: 'controlConversions', label: 'Control conversions', min: 0, step: 1 },
      { id: 'controlUsers', label: 'Control users', min: 1, step: 1 },
      { id: 'testConversions', label: 'Test conversions', min: 0, step: 1 },
      { id: 'testUsers', label: 'Test users', min: 1, step: 1 },
      {
        id: 'alpha',
        label: 'Significance level (α)',
        help: 'Commonly 0.05',
        min: 0.001,
        max: 0.2,
        step: 0.001,
        defaultValue: 0.05,
      },
    ],
    example: {
      controlConversions: 200,
      controlUsers: 1_000,
      testConversions: 250,
      testUsers: 1_000,
      alpha: 0.05,
    },
  },
  t_means: {
    description:
      'Compare two independent means without assuming equal population variances.',
    fields: [
      { id: 'controlMean', label: 'Control mean', step: 'any' },
      { id: 'controlStd', label: 'Control standard deviation', min: 0, step: 'any' },
      { id: 'controlSize', label: 'Control sample size', min: 2, step: 1 },
      { id: 'testMean', label: 'Test mean', step: 'any' },
      { id: 'testStd', label: 'Test standard deviation', min: 0, step: 'any' },
      { id: 'testSize', label: 'Test sample size', min: 2, step: 1 },
      {
        id: 'alpha',
        label: 'Significance level (α)',
        min: 0.001,
        max: 0.2,
        step: 0.001,
        defaultValue: 0.05,
      },
    ],
    example: {
      controlMean: 50,
      controlStd: 10,
      controlSize: 500,
      testMean: 52,
      testStd: 9,
      testSize: 500,
      alpha: 0.05,
    },
  },
  chi_square: {
    description:
      'Test whether group assignment and a binary outcome are independent in a 2×2 table.',
    fields: [
      { id: 'controlConversions', label: 'Control conversions', min: 0, step: 1 },
      { id: 'controlNonConversions', label: 'Control non-conversions', min: 0, step: 1 },
      { id: 'testConversions', label: 'Test conversions', min: 0, step: 1 },
      { id: 'testNonConversions', label: 'Test non-conversions', min: 0, step: 1 },
      {
        id: 'alpha',
        label: 'Significance level (α)',
        min: 0.001,
        max: 0.2,
        step: 0.001,
        defaultValue: 0.05,
      },
    ],
    example: {
      controlConversions: 200,
      controlNonConversions: 800,
      testConversions: 250,
      testNonConversions: 750,
      alpha: 0.05,
    },
  },
  srm: {
    description:
      'Check whether observed traffic allocation differs from the planned experiment split.',
    fields: [
      { id: 'controlUsers', label: 'Control users', min: 0, step: 1 },
      { id: 'testUsers', label: 'Test users', min: 0, step: 1 },
      {
        id: 'expectedTestShare',
        label: 'Expected test share',
        help: 'Use 0.5 for a 50/50 split',
        min: 0.001,
        max: 0.999,
        step: 0.001,
        defaultValue: 0.5,
      },
      {
        id: 'alpha',
        label: 'SRM threshold (α)',
        help: 'A conservative 0.001 default reduces false alarms',
        min: 0.0001,
        max: 0.2,
        step: 0.0001,
        defaultValue: 0.001,
      },
    ],
    example: {
      controlUsers: 10_000,
      testUsers: 9_500,
      expectedTestShare: 0.5,
      alpha: 0.001,
    },
  },
  mde: {
    description:
      'Estimate the smallest absolute conversion lift detectable with a two-sided normal approximation.',
    fields: [
      {
        id: 'baselineConversion',
        label: 'Baseline conversion',
        help: 'Enter 0.1 for 10%',
        min: 0.001,
        max: 0.999,
        step: 0.001,
      },
      { id: 'controlUsers', label: 'Control users', min: 1, step: 1 },
      { id: 'testUsers', label: 'Test users', min: 1, step: 1 },
      {
        id: 'alpha',
        label: 'Significance level (α)',
        min: 0.001,
        max: 0.2,
        step: 0.001,
        defaultValue: 0.05,
      },
      {
        id: 'power',
        label: 'Statistical power',
        min: 0.5,
        max: 0.99,
        step: 0.01,
        defaultValue: 0.8,
      },
    ],
    example: {
      baselineConversion: 0.1,
      controlUsers: 5_000,
      testUsers: 5_000,
      alpha: 0.05,
      power: 0.8,
    },
  },
};

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

const form = getElement<HTMLFormElement>('calculatorForm');
const testTypeSelect = getElement<HTMLSelectElement>('testType');
const testDescription = getElement<HTMLParagraphElement>('testDescription');
const dynamicFields = getElement<HTMLDivElement>('dynamicFields');
const errorAlert = getElement<HTMLDivElement>('errorAlert');
const resultPanel = getElement<HTMLElement>('resultPanel');
const emptyResult = getElement<HTMLDivElement>('emptyResult');
const analysisResult = getElement<HTMLDivElement>('analysisResult');
const resultTitle = getElement<HTMLHeadingElement>('resultTitle');
const decisionBanner = getElement<HTMLDivElement>('decisionBanner');
const metricGrid = getElement<HTMLDivElement>('metricGrid');
const methodNote = getElement<HTMLDivElement>('methodNote');
const chartCanvas = getElement<HTMLCanvasElement>('resultChart');
const exampleButton = getElement<HTMLButtonElement>('exampleButton');
const resetButton = getElement<HTMLButtonElement>('resetButton');
const copyButton = getElement<HTMLButtonElement>('copyButton');

let chartInstance: Chart<'bar'> | null = null;

function activeType(): TestType {
  return testTypeSelect.value as TestType;
}

function renderFields(): void {
  const config = testConfigs[activeType()];
  testDescription.textContent = config.description;
  dynamicFields.replaceChildren();

  for (const field of config.fields) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';

    const label = document.createElement('label');
    label.className = 'field-label';
    label.htmlFor = field.id;
    label.textContent = field.label;

    const input = document.createElement('input');
    input.className = 'input-control';
    input.type = 'number';
    input.id = field.id;
    input.name = field.id;
    input.required = true;
    input.inputMode = 'decimal';
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.step !== undefined) input.step = String(field.step);
    if (field.defaultValue !== undefined) input.value = String(field.defaultValue);

    wrapper.append(label, input);
    if (field.help) {
      const help = document.createElement('span');
      help.className = 'field-help';
      help.textContent = field.help;
      wrapper.append(help);
    }
    dynamicFields.append(wrapper);
  }

  clearResult();
  hideError();
}

function readNumber(id: string): number {
  const input = getElement<HTMLInputElement>(id);
  return Number(input.value);
}

function formatNumber(value: number, digits = 3): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number, digits = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatPercentagePoints(value: number): string {
  return `${formatNumber(value * 100, 2)} pp`;
}

function formatPValue(value: number): string {
  if (value < 0.0001) return '< 0.0001';
  return value.toFixed(4);
}

function confidenceInterval(interval: [number, number], percent = false): string {
  return percent
    ? `${formatPercent(interval[0])} to ${formatPercent(interval[1])}`
    : `${formatNumber(interval[0], 4)} to ${formatNumber(interval[1], 4)}`;
}

function standardChartOptions(beginAtZero = true): ChartConfiguration<'bar'>['options'] {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { displayColors: false },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false } },
      y: {
        beginAtZero,
        grid: { color: 'rgba(152, 162, 179, 0.18)' },
        border: { display: false },
      },
    },
  };
}

function buildResult(): ResultView {
  const type = activeType();

  if (type === 'z_proportions') {
    const alpha = readNumber('alpha');
    const result = twoProportionZTest(
      readNumber('controlConversions'),
      readNumber('controlUsers'),
      readNumber('testConversions'),
      readNumber('testUsers'),
      alpha,
    );
    const lift = result.relativeLift === null ? 'Undefined (zero baseline)' : formatPercent(result.relativeLift);
    return {
      title: 'Conversion rate comparison',
      decision: result.significant
        ? `The data show evidence of a conversion difference at α = ${alpha}.`
        : `The data do not show a conversion difference at α = ${alpha}.`,
      tone: result.significant ? 'positive' : 'neutral',
      metrics: [
        { label: 'Absolute effect', value: formatPercentagePoints(result.difference), detail: 'Test − control' },
        { label: 'Relative lift', value: lift },
        { label: `${formatPercent(1 - alpha, 1)} confidence interval`, value: confidenceInterval(result.confidenceInterval, true) },
        { label: 'P-value', value: formatPValue(result.pValue), detail: `z = ${formatNumber(result.statistic)}` },
      ],
      note:
        'Two-sided pooled z-test. The confidence interval uses an unpooled normal approximation. Review the interval and business threshold before making a decision.',
      chart: {
        type: 'bar',
        data: {
          labels: ['Control', 'Test'],
          datasets: [{
            label: 'Conversion rate',
            data: [result.controlRate * 100, result.testRate * 100],
            backgroundColor: ['#d0d5dd', '#7f56d9'],
            borderRadius: 8,
          }],
        },
        options: standardChartOptions(),
      },
    };
  }

  if (type === 't_means') {
    const alpha = readNumber('alpha');
    const controlMean = readNumber('controlMean');
    const testMean = readNumber('testMean');
    const result = welchTTest(
      controlMean,
      readNumber('controlStd'),
      readNumber('controlSize'),
      testMean,
      readNumber('testStd'),
      readNumber('testSize'),
      alpha,
    );
    return {
      title: 'Mean comparison',
      decision: result.significant
        ? `The data show evidence of a mean difference at α = ${alpha}.`
        : `The data do not show a mean difference at α = ${alpha}.`,
      tone: result.significant ? 'positive' : 'neutral',
      metrics: [
        { label: 'Mean difference', value: formatNumber(result.difference, 4), detail: 'Test − control' },
        { label: `${formatPercent(1 - alpha, 1)} confidence interval`, value: confidenceInterval(result.confidenceInterval) },
        { label: 'P-value', value: formatPValue(result.pValue) },
        { label: 'Test statistic', value: formatNumber(result.statistic), detail: `df = ${formatNumber(result.degreesOfFreedom, 1)}` },
      ],
      note:
        "Two-sided Welch's t-test from summary statistics. It does not assume equal variances, but it does assume independent observations and sufficiently well-behaved sample means.",
      chart: {
        type: 'bar',
        data: {
          labels: ['Control', 'Test'],
          datasets: [{
            label: 'Mean',
            data: [controlMean, testMean],
            backgroundColor: ['#d0d5dd', '#7f56d9'],
            borderRadius: 8,
          }],
        },
        options: standardChartOptions(false),
      },
    };
  }

  if (type === 'chi_square') {
    const alpha = readNumber('alpha');
    const controlConversions = readNumber('controlConversions');
    const controlNonConversions = readNumber('controlNonConversions');
    const testConversions = readNumber('testConversions');
    const testNonConversions = readNumber('testNonConversions');
    const result = chiSquareTest(
      controlConversions,
      controlNonConversions,
      testConversions,
      testNonConversions,
      alpha,
    );
    const warnings = result.warnings.length > 0 ? ` ${result.warnings.join(' ')}` : '';
    return {
      title: 'Outcome independence check',
      decision: result.significant
        ? `Group and outcome are associated at α = ${alpha}.`
        : `The data do not show an association at α = ${alpha}.`,
      tone: result.significant ? 'positive' : 'neutral',
      metrics: [
        { label: 'P-value', value: formatPValue(result.pValue) },
        { label: 'Chi-square statistic', value: formatNumber(result.statistic), detail: 'df = 1' },
      ],
      note: `Pearson's chi-square test without Yates correction.${warnings}`,
      chart: {
        type: 'bar',
        data: {
          labels: ['Control', 'Test'],
          datasets: [
            { label: 'Conversions', data: [controlConversions, testConversions], backgroundColor: '#7f56d9' },
            { label: 'Non-conversions', data: [controlNonConversions, testNonConversions], backgroundColor: '#d0d5dd' },
          ],
        },
        options: {
          ...standardChartOptions(),
          plugins: { legend: { display: true, position: 'bottom' } },
          scales: {
            x: { stacked: true, grid: { display: false }, border: { display: false } },
            y: { stacked: true, beginAtZero: true, border: { display: false } },
          },
        },
      },
    };
  }

  if (type === 'srm') {
    const controlUsers = readNumber('controlUsers');
    const testUsers = readNumber('testUsers');
    const expectedTestShare = readNumber('expectedTestShare');
    const alpha = readNumber('alpha');
    const result = sampleRatioMismatch(controlUsers, testUsers, expectedTestShare, alpha);
    const total = controlUsers + testUsers;
    return {
      title: 'Traffic allocation check',
      decision: result.significant
        ? 'Potential sample ratio mismatch detected. Investigate assignment and tracking before reading experiment outcomes.'
        : 'No sample ratio mismatch detected at the selected threshold.',
      tone: result.significant ? 'warning' : 'positive',
      metrics: [
        { label: 'Observed test share', value: formatPercent(result.observedTestShare) },
        { label: 'Expected test share', value: formatPercent(result.expectedTestShare) },
        { label: 'P-value', value: formatPValue(result.pValue) },
        { label: 'Chi-square statistic', value: formatNumber(result.statistic), detail: 'df = 1' },
      ],
      note:
        'Pearson goodness-of-fit test. SRM is a diagnostic signal, not proof of a specific implementation bug.',
      chart: {
        type: 'bar',
        data: {
          labels: ['Control', 'Test'],
          datasets: [
            { label: 'Observed', data: [controlUsers, testUsers], backgroundColor: '#7f56d9', borderRadius: 6 },
            {
              label: 'Expected',
              data: [total * (1 - expectedTestShare), total * expectedTestShare],
              backgroundColor: '#d0d5dd',
              borderRadius: 6,
            },
          ],
        },
        options: {
          ...standardChartOptions(),
          plugins: { legend: { display: true, position: 'bottom' } },
        },
      },
    };
  }

  const baseline = readNumber('baselineConversion');
  const alpha = readNumber('alpha');
  const power = readNumber('power');
  const result = minimumDetectableEffect(
    baseline,
    readNumber('controlUsers'),
    readNumber('testUsers'),
    alpha,
    power,
  );
  return {
    title: 'Experiment sensitivity',
    decision: `This design can detect an approximate absolute lift of ${formatPercent(result.absolute)} at ${formatPercent(power, 0)} power.`,
    tone: result.warning ? 'warning' : 'neutral',
    metrics: [
      { label: 'Absolute MDE', value: formatPercentagePoints(result.absolute) },
      { label: 'Relative MDE', value: `${formatNumber(result.relativePercent, 2)}%` },
      { label: 'Baseline conversion', value: formatPercent(baseline) },
      { label: 'Detectable conversion', value: formatPercent(result.detectableConversion) },
    ],
    note:
      `Two-sided normal approximation with α = ${alpha} and power = ${power}.${result.warning ? ` ${result.warning}` : ''}`,
    chart: {
      type: 'bar',
      data: {
        labels: ['Baseline', 'Detectable treatment'],
        datasets: [{
          label: 'Conversion rate',
          data: [baseline * 100, Math.min(1, result.detectableConversion) * 100],
          backgroundColor: ['#d0d5dd', '#7f56d9'],
          borderRadius: 8,
        }],
      },
      options: standardChartOptions(),
    },
  };
}

function showResult(result: ResultView): void {
  emptyResult.hidden = true;
  analysisResult.hidden = false;
  resultPanel.classList.remove('empty-state');
  resultTitle.textContent = result.title;
  decisionBanner.textContent = result.decision;
  decisionBanner.className = `decision-banner ${result.tone}`;
  metricGrid.replaceChildren();

  for (const metric of result.metrics) {
    const card = document.createElement('div');
    card.className = 'metric';
    const label = document.createElement('span');
    label.textContent = metric.label;
    const value = document.createElement('strong');
    value.textContent = metric.value;
    card.append(label, value);
    if (metric.detail) {
      const detail = document.createElement('small');
      detail.textContent = metric.detail;
      card.append(detail);
    }
    metricGrid.append(card);
  }

  methodNote.textContent = result.note;
  chartInstance?.destroy();
  chartInstance = new Chart(chartCanvas, result.chart);
}

function clearResult(): void {
  chartInstance?.destroy();
  chartInstance = null;
  emptyResult.hidden = false;
  analysisResult.hidden = true;
  resultPanel.classList.add('empty-state');
}

function showError(message: string): void {
  errorAlert.textContent = message;
  errorAlert.hidden = false;
}

function hideError(): void {
  errorAlert.hidden = true;
  errorAlert.textContent = '';
}

function useExample(): void {
  const example = testConfigs[activeType()].example;
  for (const [id, value] of Object.entries(example)) {
    getElement<HTMLInputElement>(id).value = String(value);
  }
  hideError();
  clearResult();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  hideError();
  try {
    showResult(buildResult());
  } catch (error) {
    clearResult();
    showError(error instanceof Error ? error.message : 'Unable to calculate the result.');
  }
});

testTypeSelect.addEventListener('change', renderFields);
exampleButton.addEventListener('click', useExample);
resetButton.addEventListener('click', renderFields);
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(analysisResult.innerText);
    copyButton.textContent = 'Copied';
    window.setTimeout(() => {
      copyButton.textContent = 'Copy result';
    }, 1_500);
  } catch {
    showError('Your browser blocked clipboard access.');
  }
});

renderFields();

