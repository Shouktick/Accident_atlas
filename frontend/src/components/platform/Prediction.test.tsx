import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import ScenarioForm from "./ScenarioForm";
import { RiskMeter } from "./PredictionResult";

it("validates the prediction form before submitting and keeps model units honest", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: { code: "OFFLINE", message: "Unavailable" },
      }),
    }),
  );
  const submit = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ScenarioForm pending={false} onSubmit={submit} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Driver age"), {
    target: { value: "-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Run model prediction/ }));
  await waitFor(() =>
    expect(screen.getByLabelText("Driver age")).toHaveAttribute(
      "aria-invalid",
      "true",
    ),
  );
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Driver age"), {
    target: { value: "35" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Run model prediction/ }));
  await waitFor(() => expect(submit).toHaveBeenCalled());
  expect(submit.mock.calls[0][0].Speed_limit).toBe(30);
  expect(screen.getByRole("img")).toHaveAccessibleName(/unverified/);
  vi.unstubAllGlobals();
});

it("does not replace an unavailable severity index with class confidence", () => {
  render(<RiskMeter value={null} />);
  expect(screen.getByText("Withheld")).toBeInTheDocument();
  expect(
    screen.getByText(/not an accident-risk percentage/),
  ).toBeInTheDocument();
});
