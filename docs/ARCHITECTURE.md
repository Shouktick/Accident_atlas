# RoadSentinel architecture

The existing Next.js/FastAPI monorepo is retained. `backend/main.py` remains compatible with provider start commands and imports the app factory in `backend/app/main.py`. No FastAPI inference is moved into a serverless JavaScript runtime.

## Frontend boundaries

Routes compose client workspace components under one provider/shell. TanStack Query handles query state and invalidation, Zod validates responses, and React Hook Form validates prediction inputs. Types are shared inside the frontend; OpenAPI and tests document the backend contract. They are not generated automatically from OpenAPI yet.

The same-origin Next route gateway reads NEXT_PUBLIC_API_URL, with a temporary legacy variable fallback. It allowlists resources, bounds bodies, forwards session authorization, disables caching and limits timeouts. It does not let a browser choose an arbitrary proxy target. Maps use dynamic imports. No production frontend silently substitutes local/demo predictions.

## Backend boundaries

- core/config: environment configuration and resource budgets.
- schemas/scenario: operational bounds and source category codes.
- services/model: fingerprinted trusted artifact loading, exact feature order/runtime checks, genuine probabilities, SHAP and nullable severity index.
- services/batch: strict CSV parsing, mapping, per-row outcomes, formula-safe export.
- services/dataset: optional verified fingerprinted source analytics, coordinate filters and global SHAP cache.
- database/store: SQLAlchemy parameter-bound persistence with per-session hashed ownership.
- main: lifespan initialization, HTTP/body/rate/error handling and API wiring.

The original model archive is preserved, not dynamically downloaded at runtime. Startup initializes the model/explainer once per worker. Use one worker unless RAM and throughput have been profiled. A deployment can be live with class inference available while verified severity readiness remains false.

## Persistence and privacy

Schema version 1 creates a prediction table and schema-version marker. An unsaved prediction stores operational metadata only; an explicitly saved prediction stores scenario/result/SHAP. Search/delete always includes owner criteria. SQLite is the local default; PostgreSQL URLs are supported. Future schema changes need explicit migration code; there is not an Alembic migration series yet.

Durability depends on hosting storage, not the use of SQL alone. Default HISTORY_DURABLE=false is displayed in the UI. Local Docker uses a named volume; hosted PostgreSQL or persistent storage is required for durable production history. Anonymous bearer sessions do not provide account recovery or cross-device access. Operational history currently has no automatic retention scheduler.

## Model/data integrity

Class semantics and speed units are held in a versioned manifest. Legacy semantics are unverified and cannot generate severity risk claims. Source analytics and observed geography require a separate dataset provenance manifest. Metrics must identify the serving model version and a held-out evaluation. No illustrative observations are mixed with real ones.

## Deployment

Frontend targets Vercel; backend targets existing Render integration or Railway. Root/ backend Python version files select 3.12.13. Docker Compose supplies local orchestration. `render.yaml` is an optional new-service blueprint, not evidence of deployed configuration. Deployment status and HTTP inference must be checked separately from Git push success. No paid infrastructure is provisioned automatically.
