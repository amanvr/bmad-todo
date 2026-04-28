import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Last-resort logging — pino isn't available in the browser.
    // Architecture line 612: ErrorBoundary catches React render errors only;
    // it is NOT a substitute for useTodos's error state.
    console.error('[ErrorBoundary]', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div role="alert">
            <h2>Something went wrong.</h2>
            <p>Please refresh the page. If the problem persists, contact support.</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
