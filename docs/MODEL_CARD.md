# RoadSentinel model card

## Current artifact

Original repository artifact `backend/rf_model.zip`, version `legacy-rf-e76f2cb`. RandomForestClassifier, 200 estimators, max-depth configuration 20, serialized scikit-learn 1.8.0, numeric classes 1/2/3. Feature order and all archive/member SHA-256 hashes are in `backend/model_metadata.json`. The loader checks these before deserializing only this trusted artifact in a matching runtime.

Actual inference and local Tree SHAP are tested. The former hand-written danger-score path and fabricated output probabilities have been removed.

## Inputs and outputs

Ordered inputs: Age_of_Driver, Speed_limit, Weather_Conditions, Road_Surface_Conditions, Light_Conditions, Vehicle_Type, Number_of_Vehicles. Current operational API bounds and provisional UI code choices are documented in API.md. They are safeguards, not recovered training distributions.

Outputs: numeric predicted class and normalized estimator probabilities, top-class confidence, actual version/latency, optional local Tree SHAP, and optional server persistence. The highest probability determines the displayed class. No original class-to-severity meaning or speed unit is verified. Source once mapped 1=Slight, 2=Serious, 3=Fatal; this is insufficient training evidence and is not used as truth.

Severity-weighted index is null until a reviewed manifest supplies complete labels and units with `semantics_verified=true`. Proposed formula is 100 times (0*p(Slight)+0.5*p(Serious)+1*p(Fatal)). These are product weights, not a probability of crashing. Class probabilities are uncalibrated.

## Dataset and methodology

The user confirmed the original dataset/training material is unavailable. Source, license, row count, dates, geography, sampling, missingness, duplicate handling, label encoding, preprocessing, split protocol, leakage, and class balance remain unknown. No application history is reclassified as training observations.

## Evaluation

No genuine accuracy, precision, recall, F1, confusion matrix, or ROC-AUC is available. Earlier dashboard/API values were hardcoded and inconsistent; they have been removed. Endpoint `/metrics` returns a structured unavailable response until a matching held-out artifact exists.

`backend/scripts/train.py` supports a future reviewed dataset, reproducible fingerprints, duplicate removal, time/group/stratified separation, RF/gradient-boosting validation comparison and one held-out test evaluation. It outputs a new artifact/manifest/metrics without replacing this legacy artifact. It has not been run to manufacture product metrics. Full cross-validation/calibration, sensitivity analysis and external validation remain future work.

## Explainability

Local Tree SHAP uses fitted tree-path counts as background. Explained output is the selected class probability. The service verifies expected value plus seven signed contributions reconstructs that output. Global mean absolute SHAP and dependence views require verified representative records; they are unavailable without data. Impurity importance is not substituted for SHAP.

## Intended use, limitations and ethics

Intended: research/demonstration and model-behavior inspection. Excluded: live safety decisions, emergency services, insurance, enforcement, causal recommendations or claims of India validity. The model classifies an incident dataset; it does not estimate whether an individual will crash. What-If inputs are hypothetical, and changing driver age/weather in a model is not an actionable safety intervention. Sampling bias, confounding, age-group bias and geographic domain shift cannot be quantified without data. General safety guidance is not derived as a guarantee from this model.
