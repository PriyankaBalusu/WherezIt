import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ContainerErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Container Error Boundary Caught Error]', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '2rem auto', backgroundColor: '#fef2f2', border: '2px solid #f87171', borderRadius: '0.75rem' }}>
          <h2 style={{ color: '#dc2626', marginTop: 0 }}>Container Detail Error</h2>
          <p style={{ fontWeight: 600, color: '#991b1b', fontSize: '1rem' }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering the box details.'}
          </p>
          {this.state.error?.stack && (
            <pre style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.375rem', overflowX: 'auto', fontSize: '0.8rem', color: '#b91c1c', border: '1px solid #fca5a5' }}>
              {this.state.error.stack}
            </pre>
          )}
          {this.state.errorInfo?.componentStack && (
            <div>
              <h4 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Component Stack:</h4>
              <pre style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.375rem', overflowX: 'auto', fontSize: '0.75rem', color: '#475569', border: '1px solid #cbd5e1' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => window.location.reload()}
            >
              🔄 Reload Page
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.href = '/';
              }}
            >
              🏠 Back to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
