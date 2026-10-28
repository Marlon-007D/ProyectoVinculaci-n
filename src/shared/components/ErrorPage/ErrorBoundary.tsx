import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorPage } from './ErrorPage';

interface Props {
  children: ReactNode;
  /** Changing it (for example, the path) clears a previous failure without remounting the tree. */
  resetKey?: string;
  fallback?: (retry: () => void) => ReactNode;
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Error de interfaz', error, info.componentStack); }
  componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  retry = () => { this.setState({ failed: false }); };
  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback?.(this.retry) ?? <ErrorPage kind="unexpected" onRetry={this.retry} />;
  }
}
