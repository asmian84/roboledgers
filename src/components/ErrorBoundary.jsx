import React from 'react';

/**
 * ErrorBoundary - Catches React rendering errors and shows a fallback UI
 * instead of crashing the entire app with a white screen.
 *
 * Usage:
 *   <ErrorBoundary fallbackMessage="Failed to load transactions">
 *     <TransactionsTable ... />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        // Log to console for debugging (this is intentional error logging, not debug spam)
        console.error('[ErrorBoundary] Component crashed:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            const message = this.props.fallbackMessage || 'Something went wrong';

            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    minHeight: '200px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    margin: '12px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}>
                    <div style={{ fontSize: '24px', marginBottom: '12px' }}>
                        &#x26A0;
                    </div>
                    <h3 style={{
                        color: '#991b1b',
                        fontSize: '16px',
                        fontWeight: 600,
                        margin: '0 0 8px 0'
                    }}>
                        {message}
                    </h3>
                    <p style={{
                        color: '#b91c1c',
                        fontSize: '13px',
                        margin: '0 0 16px 0',
                        textAlign: 'center',
                        maxWidth: '400px'
                    }}>
                        {this.state.error?.message || 'An unexpected error occurred while rendering this component.'}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        style={{
                            padding: '8px 20px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#fff',
                            background: '#dc2626',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
