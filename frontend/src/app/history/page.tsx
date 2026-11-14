import { Suspense } from "react";
import HistoryWorkspace from "@/components/platform/HistoryWorkspace";
export default function Page() {
  return (
    <Suspense fallback={<p>Loading history?</p>}>
      <HistoryWorkspace />
    </Suspense>
  );
}
