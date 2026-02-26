import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#333',
          textAlign: 'center',
          background: '#faf9f7',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '12px' }}>
            页面加载出了点问题
          </h2>
          <p style={{ fontSize: '14px', color: '#888', marginBottom: '24px', maxWidth: '360px' }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              重试
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '8px',
                background: '#333',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
