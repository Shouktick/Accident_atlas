# RoadSentinel API v1

FastAPI interactive documentation: backend `/docs`; OpenAPI: `/openapi.json`. All current resource routes have `/api/v1` aliases. Frontend calls the same-origin `/api/service/...` gateway, which forwards only content type and authorization to the centrally configured backend. No production API URL is embedded in individual components.

## Session authorization

Prediction, comparison, sweep, local explanation, batch, activity and history requests require `Authorization: Bearer <64 lowercase hex characters>`. The frontend generates 32 cryptographically random bytes, stores the token in browser storage, and sends it only to the same-origin gateway. Database owners are SHA-256 token hashes. This is anonymous session isolation, not account authentication. Keep the token private. Clearing browser storage loses access to records. No cross-session listing or deletion is permitted.

## Scenario

```json
{"Age_of_Driver":35,"Speed_limit":30,"Weather_Conditions":1,"Road_Surface_Conditions":1,"Light_Conditions":1,"Vehicle_Type":1,"Number_of_Vehicles":1}
```

Operational bounds: age integer 16-100; speed-limit integer 10-140 native model units; vehicles integer 1-20. Source UI codes: weather 1-7; surface 1-5; light 1/4/5/6; vehicle 1/2/5/8/11. These categories' training meanings and speed units are unverified. Additional scenario fields are rejected.

## Resource contracts

- `GET /health`: status, model availability/version, database availability, class-inference ready, separately verified severity ready, SHAP availability, and history durability flag. HTTP liveness does not imply verified semantics.
- `GET /model/metadata`: feature order, numeric classes/labels, algorithm, semantic verification, speed units, calibration, source/limitations, operational bounds.
- `POST /predict`: `{scenario, save:false, explain:true}`. Returns ID, UTC timestamp, version, inputs, numeric class/label, normalized class probabilities, top-class confidence, semantics/calibration flags, nullable risk score, measured latency, explanation/status, saved flag. Single-prediction activity is recorded; raw scenario/result is retained only with save=true.
- `POST /predict/whatif`: `{baseline, scenarios:[...], find_best_change:false}`; at most eight alternatives. Returns baseline/results, feature differences, nullable index deltas and best-change status. No automatic history writes. Search is withheld when severity semantics are unverified.
- `POST /predict/speed-sweep`: `{scenario,start:20,stop:100,step:10}`. Native value range 10-140, step 5-50, maximum 27 points. Returns each genuine result and native-unit status. Not actual driving speed and not causal.
- `POST /batch/preview`: multipart file; returns unique headers, total row count and first five input rows.
- `POST /predict/batch`: multipart file plus optional JSON `mapping` from all seven feature names to distinct headers. CSV maximum 2 MiB/250 rows, UTF-8, unique headers, no silent invalid-row dropping. Returns total/success/invalid counts, original logical CSV row identifiers, original inputs, validation errors or predictions, model version and safely escaped downloadable CSV. `?format=csv` returns CSV directly. Row progress is not streamed.
- `GET /metrics`: actual matching held-out evaluation artifact with model version/dataset fingerprint; 503 when absent/mismatched.
- `POST /explain/local`: scenario directly; genuine prediction plus additive local SHAP. 503 if SHAP unavailable. Does not create history.
- `GET /explain/global`: cached representative source-sample mean absolute SHAP and dependence values; requires verified data/explainer.
- `GET /insights/overview`: actual dataset counts, target distribution, missingness and duplicates with provenance.
- `GET /insights/{hourly,weekday,weather,road-surface,lighting,vehicle,age-groups,speed-bands}`: source counts, denominator, fingerprint/source; optional weather/vehicle code filters. Time dimensions require a verified timestamp column and use UTC.
- `GET /hotspots`: source coordinate points, count and truncation status; optional severity/weather/vehicle/hour filters. Caps at 2,000 records and reports truncation. Coordinates are limited to India view bounds; a rectangular bound alone does not establish national membership. No city-coordinate guessing. No data yields 503.
- `GET /activity`: this session's actual single-prediction counts, saved count, measured mean latency and numeric class distribution. Removing a saved record also removes its activity row.
- `GET /predictions`: saved records only; search ID/label, class_id filter, page>=1, limit 1-100, order newest/oldest/confidence.
- `GET /predictions/{id}`: owned saved record; cross-session requests return 404.
- `DELETE /predictions/{id}`: owned deletion, 204; unavailable/cross-session 404. Deletion is permanent.

Legacy `/model-metrics` and `/predict-batch` are aliases without heuristic fallbacks. The old flat `/predict` payload and percentage-scale response are intentionally replaced; old clients need the new contract.

## Errors, limits and retries

```json
{"error":{"code":"CAPABILITY_UNAVAILABLE","message":"A safe explanation of the unavailable capability.","request_id":"opaque-id","details":null}}
```

422 invalid fields/CSV; 413 upload/row/body budget; 429 rate limit with Retry-After; 503 unavailable service/capability; 500 safe internal error. Validation details omit raw input. No stack traces/environment values are returned. Limits are process-local and require an external gateway for distributed production abuse protection. Query retries are bounded. Mutations are not automatically retried; they do not have an idempotency-key implementation, so a user retry after an uncertain timeout can create another activity record.

Gateway and API share a bounded request envelope. The API avoids whole unbounded file reads. CSV exports prefix potentially executable untrusted text. Unexpected errors are logged with request identifiers without payload logging.
