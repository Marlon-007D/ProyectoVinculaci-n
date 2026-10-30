import { useCallback, useEffect, useState } from "react";
import type { AsyncState } from "../types/common";

const defaultIsEmpty = (d: unknown) => (Array.isArray(d) ? d.length === 0 : d == null);

export function useAsync<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  isEmpty: (data: T) => boolean = defaultIsEmpty,
  /** When the inputs change (not on reload), keep showing the last loaded data instead of going back to "loading". */
  options: { keepPrevious?: boolean } = {},
): { state: AsyncState<NonNullable<T>>; reload: () => void; refresh: () => void } {
  const [state, setState] = useState<AsyncState<NonNullable<T>>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [stateKey, setStateKey] = useState<{ deps: readonly unknown[]; tick: number } | null>(null);
  // Mutable memory of the last success; it lives in state so it survives re-renders without extra hooks.
  const [memory] = useState<{ last: { state: AsyncState<NonNullable<T>>; tick: number } | null }>(() => ({ last: null }));
  const stateMatchesRequest = stateKey?.tick === tick
    && stateKey.deps.length === deps.length
    && stateKey.deps.every((value, index) => Object.is(value, deps[index]));

  useEffect(() => {
    let cancelled = false;
    // Background updates keep the current page mounted, including active simulators.
    const background = stateMatchesRequest;
    if (!background) {
      setState({ status: "loading" });
      setStateKey({ deps: [...deps], tick });
    }
    load()
      .then((data) => {
        if (!cancelled)
          setState(isEmpty(data) ? { status: "empty" } : { status: "success", data: data as NonNullable<T> });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState(previous => background && previous.status === "success" ? previous
            : { status: "error", error: err instanceof Error ? err : new Error(String(err)) });
      });
    return () => {
      cancelled = true;
    };
  }, [...deps, tick, refreshTick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);
  const current: AsyncState<NonNullable<T>> = stateMatchesRequest ? state : { status: "loading" };
  if (current.status === "success") memory.last = { state: current, tick };
  const keep = options.keepPrevious && current.status === "loading" && memory.last?.tick === tick;
  return { state: keep && memory.last ? memory.last.state : current, reload, refresh };
}
