"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { predictionSchema, Scenario } from "@/lib/contracts";
import ScenarioForm from "./ScenarioForm";
import PredictionResult from "./PredictionResult";
import {
  Empty,
  Failure,
  Limitation,
  Loading,
  PageTitle,
  Panel,
  useHealth,
} from "./ui";

export default function PredictionWorkspace() {
  const query = useQueryClient(),
    health = useHealth();
  const mutation = useMutation({
    mutationFn: ({ scenario, save }: { scenario: Scenario; save: boolean }) =>
      api("predict", predictionSchema, {
        method: "POST",
        body: JSON.stringify({ scenario, save, explain: true }),
      }),
    onSuccess: () => {
      void query.invalidateQueries({ queryKey: ["activity"] });
      void query.invalidateQueries({ queryKey: ["history"] });
    },
  });
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="WORKSPACE / PREDICTION"
        title="Build the scenario. Inspect the response."
        description="Actual Random Forest inference with input-bound Tree SHAP explanations."
      />
      <Limitation>
        The original codebook is unavailable. Inputs retain the source UI&apos;s
        numeric codes; speed units and class-to-severity meanings are
        unverified. Outputs are numeric classes, not verified severity claims.
      </Limitation>
      {health.error && (
        <Failure error={health.error} retry={() => void health.refetch()} />
      )}
      <div className="prediction-grid">
        <Panel
          title="Scenario parameters"
          subtitle="Operational validation · seven original features"
        >
          <ScenarioForm
            allowShared
            pending={mutation.isPending}
            onSubmit={(scenario, save) => mutation.mutate({ scenario, save })}
          />
        </Panel>
        <div className="page-stack" aria-live="polite">
          {mutation.isPending ? (
            <Panel>
              <Loading message="Running the model and computing local Tree SHAP…" />
            </Panel>
          ) : mutation.error ? (
            <Failure
              error={mutation.error}
              retry={() =>
                mutation.variables && mutation.mutate(mutation.variables)
              }
            />
          ) : mutation.data ? (
            <PredictionResult prediction={mutation.data} />
          ) : (
            <Panel>
              <Empty title="Ready when you are">
                Set a hypothetical scenario and run the model. Class
                probabilities and genuine feature contributions will appear
                here.
              </Empty>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
