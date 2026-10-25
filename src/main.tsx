import {createRoot} from 'react-dom/client';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import App from './App.tsx';
import './index.css';

// Ensure fetch descriptor has setter in JS runtime
try {
  const origFetch = window.fetch;
  let activeFetch = origFetch ? origFetch.bind(window) : undefined;
  const desc = Object.getOwnPropertyDescriptor(window, 'fetch');
  if (!desc || !desc.set) {
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      enumerable: true,
      get() {
        return activeFetch;
      },
      set(fn) {
        activeFetch = fn;
      },
    });
  }
} catch {
  // Safe fallback
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-900 p-6 text-white text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-3xl mb-4 font-bold">
            !
          </div>
          <h1 className="text-xl font-bold mb-2">CollabBoard Bir Hata ile Karşılaştı</h1>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            Uygulama çalışırken beklenmeyen bir durum oluştu. Sayfayı yenileyerek veya oturumu sıfırlayarak devam edebilirsiniz.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
            >
              Yeniden Yükle
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              Verileri Sıfırla
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

