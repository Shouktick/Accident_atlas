"use client";
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <div>
        <h2>This view could not load.</h2>
        <p>
          Your saved server records are not affected. Try loading the view
          again.
        </p>
        <button className="button" onClick={reset}>
          Retry this view
        </button>
      </div>
    </div>
  );
}
