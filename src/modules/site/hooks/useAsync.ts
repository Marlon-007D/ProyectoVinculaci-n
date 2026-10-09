import { useCallback, useEffect, useState } from "react";
import type { AsyncState } from "../types/common";

const defaultIsEmpty = (d: unknown) => (Array.isArray(d) ? d.length === 0 : d == null);

export function useAsync<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  isEmpty: (data: T) => boolean = defaultIsEmpty,
): { state: AsyncState<T>; reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    load()
      .then((data) => {
        if (!cancelled) setState(isEmpty(data) ? { status: "empty" } : { status: "success", data });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({ status: "error", error: err instanceof Error ? err : new Error(String(err)) });
      });
    return () => {
      cancelled = true;
    };
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, reload };
}
