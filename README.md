# Experiment Lab

A privacy-first, browser-based toolkit for planning and analyzing A/B tests.

[![Test and deploy to GitHub Pages](https://github.com/FominP/ABCalculator/actions/workflows/pages.yml/badge.svg)](https://github.com/FominP/ABCalculator/actions/workflows/pages.yml)

**Live demo:** [fominp.github.io/ABCalculator](https://fominp.github.io/ABCalculator/)

## Why this architecture?

Experiment Lab is a static application. Statistical calculations run in the
browser, so entered experiment data is never uploaded to a server. This also
means the project can be hosted on GitHub Pages without a backend, a database,
or a paid compute plan.

```text
Browser
├── TypeScript statistics engine
├── Input validation and interpretation
├── Chart.js visualization
└── No network request for calculations

GitHub Actions
├── Install locked dependencies
├── Run deterministic reference tests
├── Build the production bundle
└── Deploy dist/ to GitHub Pages
```

## Methods

- Two-proportion z-test with an effect confidence interval
- Welch's t-test from summary statistics
- Pearson chi-square test for a 2×2 table
- Sample ratio mismatch check
- Minimum detectable effect for a conversion metric

The UI exposes assumptions and warnings instead of reducing an experiment to a
single “winner” label. The statistical engine also handles degenerate inputs
that previously produced `NaN` or server errors.

## Development

Requirements:

- Node.js 24
- npm 11 or newer

```bash
git clone https://github.com/FominP/ABCalculator.git
cd ABCalculator
npm ci
npm run dev
```

Useful commands:

```bash
npm test          # Run statistical reference and edge-case tests
npm run build     # Type-check and create the production bundle
npm run preview   # Preview the production bundle locally
```

## Enable GitHub Pages after merging

The repository contains a complete deployment workflow in
`.github/workflows/pages.yml`. The repository owner only needs to enable it once:

1. Open **Settings → Pages** in the GitHub repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Merge the migration pull request into `main`.
4. Open the **Actions** tab and wait for **Test and deploy to GitHub Pages** to
   finish successfully.
5. The application will be available at
   `https://fominp.github.io/ABCalculator/`.

If GitHub Pages was previously configured for a branch or `/docs` folder,
switching the source to GitHub Actions is required. A custom domain can be added
later in the same Pages settings screen; the build uses relative asset paths and
works both under `/ABCalculator/` and at a custom-domain root.

## Statistical implementation

Distribution functions are provided by modular
[`@stdlib`](https://stdlib.io/) packages. Reference values in the test suite are
generated from SciPy. The related Python package is maintained separately in
[`ABTestAnalyzer`](https://github.com/FominP/ABTestAnalyzer).

## Limitations

- Results assume independent observations and correctly aggregated inputs.
- The proportion confidence interval and MDE use normal approximations.
- Small expected counts can make Pearson's chi-square approximation unreliable;
  the application surfaces a warning in this case.
- Statistical evidence is not the same as practical or business significance.

## License

[MIT](LICENSE) © 2026 Pavel Fomin
