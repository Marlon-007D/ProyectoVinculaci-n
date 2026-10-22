import type { ReactNode } from "react";
import type { AsyncState } from "../../types/common";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState, type LoadingVariant } from "./LoadingState";

interface Props<T> {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  onRetry?: () => void;
  loadingLabel?: string;
  loadingVariant?: LoadingVariant;
  errorTitle?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyFallback?: ReactNode;
  inline?: boolean;
}

export function AsyncView<T>({
  state, children, onRetry, loadingLabel, loadingVariant, errorTitle, emptyTitle, emptyMessage, emptyFallback, inline,
}: Props<T>) {
  switch (state.status) {
    case "loading":
      return <LoadingState label={loadingLabel} inline={inline} variant={loadingVariant} />;
    case "error":
      return <ErrorState title={errorTitle} message={state.error.message} onRetry={onRetry} inline={inline} />;
    case "empty":
      return emptyFallback !== undefined ? <>{emptyFallback}</> : <EmptyState title={emptyTitle} message={emptyMessage} />;
    case "success":
      return <>{children(state.data)}</>;
  }
}
