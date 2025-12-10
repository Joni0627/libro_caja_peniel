import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Simple Error Boundary to catch crash on load
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', color: '#e11d48', textAlign: 'center', marginTop: '50px' }}>
          <h1>Algo salió mal al iniciar la app.</h1>
          <p style={{ color: '#475569' }}>Por favor verifica la consola para más detalles.</p>
          <pre style={{ background: '#f1f5f9', padding: '10px', borderRadius: '5px', overflow: 'auto', textAlign: 'left', display: 'inline-block', maxWidth: '100%' }}>
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);