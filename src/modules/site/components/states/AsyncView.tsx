import type { ReactNode } from "react";
import type { AsyncState } from "../../types/common";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

interface Props<T> {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  onRetry?: () => void;
  loadingLabel?: string;
  errorTitle?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyFallback?: ReactNode;
  inline?: boolean;
}

export function AsyncView<T>({
  state, children, onRetry, loadingLabel, errorTitle, emptyTitle, emptyMessage, emptyFallback, inline,
}: Props<T>) {
  switch (state.status) {
    case "loading":
      return <LoadingState label={loadingLabel} inline={inline} />;
    case "error":
      return <ErrorState title={errorTitle} message={state.error.message} onRetry={onRetry} inline={inline} />;
    case "empty":
      return emptyFallback !== undefined ? <>{emptyFallback}</> : <EmptyState title={emptyTitle} message={emptyMessage} />;
    case "success":
      return <>{children(state.data)}</>;
  }
}
