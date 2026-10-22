import { useCallback, useEffect, useState } from "react";
import type { AsyncState } from "../types/common";

const defaultIsEmpty = (d: unknown) => (Array.isArray(d) ? d.length === 0 : d == null);

export function useAsync<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  isEmpty: (data: T) => boolean = defaultIsEmpty,
): { state: AsyncState<NonNullable<T>>; reload: () => void } {
  const [state, setState] = useState<AsyncState<NonNullable<T>>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const [stateKey, setStateKey] = useState<{ deps: readonly unknown[]; tick: number } | null>(null);
  const stateMatchesRequest = stateKey?.tick === tick
    && stateKey.deps.length === deps.length
    && stateKey.deps.every((value, index) => Object.is(value, deps[index]));

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    setStateKey({ deps: [...deps], tick });
    load()
      .then((data) => {
        if (!cancelled)
          setState(isEmpty(data) ? { status: "empty" } : { status: "success", data: data as NonNullable<T> });
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
  return { state: stateMatchesRequest ? state : { status: "loading" }, reload };
}
