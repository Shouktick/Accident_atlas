# RoadSentinel release handover

Date: 14 November 2026. The user authorized all implementation phases and deployment, and confirmed the original training dataset/codebook is unavailable.

## Outcome

The application implementation is pushed to `Shouktick/Accident_atlas` main at `7e56f0ec2299d214fb106307d1e83720be208219`. Foundation, backend, core interface, prediction experience, intelligence views, hardening, tests, and deployment configuration are separate commits. This handover records verified limits rather than claiming every original acceptance criterion has been achieved.

The public frontend and backend still serve the previous application. GitHub shows no new Vercel deployment for this pushed commit. Direct checks of the public frontend return the old Accident Atlas title, its new gateway path returns 404, and the old Render backend still returns literal metrics and 404 at `/health`. A Git push did not establish a production rollout.

## Before and after

- Before: hand-written danger score and fabricated probability outputs. After: actual original Random Forest `predict_proba`, normalized probabilities, consistent argmax class, measured latency, pinned artifact hashes and compatible scikit-learn runtime.
- Before: mock SHAP charts and static narratives. After: real local Tree SHAP with expected value, seven signed contributions, output-class identity and additivity checks. Missing global source data is explicit.
- Before: fixed batch rows and inactive export. After: preview/mapping, bounded files/rows, per-row errors, original input preservation, genuine inference, sorting/filtering/pagination, actual upload progress and formula-safe CSV export.
- Before: static dashboard totals and an unchecked Active label. After: actual per-session application activity and separate model/database/semantic readiness, with truthful unavailable metrics.
- Before: manually entered map points presented as live observations. After: no invented accident points, explicit unavailable geography, and source-backed geographic adapters for future reviewed data.
- Before: no persistent history or automated suites. After: scoped SQL storage, saved details/search/filter/delete, backend/component/browser tests, and a prepared CI workflow.
- Before: Accident Atlas branding and inconsistent dark pages. After: RoadSentinel HUD, responsive mobile/desktop shell, themes, accessible SVG gauge, onboarding, command palette, documentation, errors and installation metadata.

## Implemented and tested

Actual numeric-class prediction; input validation; local SHAP; hypothetical scenario presets; save/copy/input-sharing/JSON exports; What-If class-probability comparison; speed-limit sweeps; full bounded CSV workflow; browser-session-owned SQL history; live activity/readiness; ten primary application pages; a separately labelled GPS/manual simulation device tool; responsive navigation/themes; model transparency; provider/environment configuration; Docker/Compose definitions; complete audit, API, model, design, architecture and setup documentation.

Feature and API details: [README](../README.md), [API](API.md), [architecture](ARCHITECTURE.md), [design](DESIGN.md), [model card](MODEL_CARD.md), [phase record](PROGRESS.md). Current repository layout, local commands, Docker commands, Vercel and Render/Railway instructions, and environment variables are included there.

## Partial, unavailable, or not implemented

- Severity meanings, speed units, calibration, dataset provenance and India applicability are unverified. Numeric classes remain neutral, canonical display conversion is withheld, and the severity index/risk-reduction search is gated. No validated crash-risk percentage is reported.
- Genuine held-out evaluation, retrained model comparison, original dataset statistics, actual analytics, observed hotspots, representative global/dependence SHAP are blocked by unavailable data. A future reviewed-data training/evaluation command exists, but has not been run to invent results.
- The future training command performs validation selection and held-out testing with declared time/group-aware splits; full cross-validation/calibration is not implemented.
- Geographic observation markers are implemented for verified data; a geographic density heat layer is not implemented.
- History is SQL-backed, but hosted durability is unverified. Free ephemeral disks may lose records. PostgreSQL or a durable volume is required before claiming persistent production storage.
- Identity is anonymous bearer-session ownership, not account login/recovery/multi-device synchronization. Automatic retention, distributed rate limiting, and mutation idempotency keys are not implemented.
- No offline prediction. PWA manifest provides installation metadata only.
- Production rollout and GitHub-hosted CI execution are not yet verified.

## Validation actually performed

- Backend: 19 pytest tests pass against actual artifact inference/SHAP plus explicitly synthetic test-only aggregation fixtures. Coverage includes readiness, input rejection, normalized probabilities, class consistency, SHAP additivity, What-If/sweeps, CSV mapping/errors/limits/export safety, ownership/search/delete, model-integrity failure, unavailable data and rate limits.
- Frontend: six Vitest/component tests pass for validation, unit round trips, scenario sharing, gauge accessibility and withholding an unsupported severity index.
- Browser: six Playwright tests pass across desktop and mobile Chromium. Journeys cover actual model/SHAP, history details, comparisons, sweeps, CSV valid/invalid rows, map/analytics limits, API outages, themes, command palette, mobile navigation and overflow checks.
- Axe: zero detected WCAG A/AA/2.1 AA violations on the tested dashboard dark/light and prediction views at both viewports. This is a scoped automated check, not a full accessibility certification.
- ESLint, strict TypeScript, Prettier, backend Ruff lint/format, and Next.js 16.4.6 production build pass.
- Node npm audit and Python production pip-audit report no known vulnerabilities at check time. Unsupported transitive development glob matching was updated through a tested minimatch override; unused Plotly/CLI packages were removed.
- Actual desktop/mobile screenshots were generated and inspected in [screenshots](screenshots/).
- Docker Compose configuration validates. Docker image/runtime testing could not run because the Docker daemon is unavailable.
- Lighthouse performance/overall accessibility scores were not measured. Automatic approval review rejected a standalone local preview-server start with only `blocked by policy`; the completed automated browser test results remain the evidence reported above.

## Deployment and CI access

The application commit is published in GitHub. Vercel and Render integrations are available but not connected in this session. Their connection is needed to inspect/trigger the existing providers and verify the rollout; no new paid service was provisioned and no project audience was changed.

The prepared `.github/workflows/ci.yml` runs backend tests/lint, frontend lint/typecheck/tests/format/build/security check and desktop/mobile Chromium journeys. GitHub rejected its push because the current OAuth login lacks `workflow` scope. The workflow commit is preserved locally on `roadsentinel-ci-workflow`, and the reviewable workflow file remains in the workspace. No successful hosted CI run is claimed. Publishing it requires an authorized GitHub login with workflow-write access (for the existing CLI login, `gh auth refresh -h github.com -s workflow`).

Once provider access is connected: deploy the repository's tested main commit, confirm backend `/health` reports the expected version and class-inference readiness, run an actual prediction/SHAP smoke check, verify the frontend gateway targets the new backend, and check live history storage configuration. Record the deployed commit/URLs and terminal status before announcing production success.
