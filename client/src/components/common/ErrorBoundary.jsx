import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-[#141822] border border-rose-500/30 text-slate-200 max-w-2xl mx-auto my-12 shadow-2xl">
          <div className="flex items-center gap-3 mb-4 text-rose-400">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-lg font-bold">Something went wrong</h2>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            An unexpected error occurred in this view. You can reload this view or refresh the page.
          </p>
          {this.state.error && (
            <pre className="p-3 bg-black/40 border border-white/5 rounded-lg text-xs font-mono text-rose-300 overflow-x-auto mb-6">
              {this.state.error.message || String(this.state.error)}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
