// client/src/components/ToastContainer.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { CheckCircle2, AlertTriangle, Info, AlertCircle, X } from 'lucide-react';

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  useEffect(() => {
    const unsubscribe = api.onToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4500);
    });
    return unsubscribe;
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md pointer-events-none select-none"
    >
      {toasts.map((toast) => {
        const type = toast.type || 'info';

        // High contrast styles for light vs dark mode
        const getStyles = () => {
          if (isLight) {
            switch (type) {
              case 'success':
                return {
                  container: 'bg-white border-slate-300 border-l-4 border-l-emerald-600 text-slate-900 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5',
                  iconBox: 'bg-emerald-50 border border-emerald-300 text-emerald-700',
                  text: 'text-slate-900 font-semibold',
                  close: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
                };
              case 'error':
                return {
                  container: 'bg-white border-slate-300 border-l-4 border-l-rose-600 text-slate-900 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5',
                  iconBox: 'bg-rose-50 border border-rose-300 text-rose-700',
                  text: 'text-slate-900 font-semibold',
                  close: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
                };
              case 'warning':
                return {
                  container: 'bg-white border-slate-300 border-l-4 border-l-amber-600 text-slate-900 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5',
                  iconBox: 'bg-amber-50 border border-amber-300 text-amber-800',
                  text: 'text-slate-900 font-semibold',
                  close: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
                };
              case 'info':
              default:
                return {
                  container: 'bg-white border-slate-300 border-l-4 border-l-blue-600 text-slate-900 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5',
                  iconBox: 'bg-blue-50 border border-blue-300 text-blue-700',
                  text: 'text-slate-900 font-semibold',
                  close: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
                };
            }
          }

          // Dark Theme Styles
          switch (type) {
            case 'success':
              return {
                container: 'bg-[#0f1520] border-[#222834] border-l-4 border-l-emerald-500 text-slate-100 shadow-2xl shadow-black/70',
                iconBox: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
                text: 'text-slate-100 font-medium',
                close: 'text-slate-400 hover:text-white hover:bg-white/10',
              };
            case 'error':
              return {
                container: 'bg-[#181116] border-[#222834] border-l-4 border-l-rose-500 text-slate-100 shadow-2xl shadow-black/70',
                iconBox: 'bg-rose-500/15 border border-rose-500/30 text-rose-400',
                text: 'text-slate-100 font-medium',
                close: 'text-slate-400 hover:text-white hover:bg-white/10',
              };
            case 'warning':
              return {
                container: 'bg-[#18140e] border-[#222834] border-l-4 border-l-amber-500 text-slate-100 shadow-2xl shadow-black/70',
                iconBox: 'bg-amber-500/15 border border-amber-500/30 text-amber-400',
                text: 'text-slate-100 font-medium',
                close: 'text-slate-400 hover:text-white hover:bg-white/10',
              };
            case 'info':
            default:
              return {
                container: 'bg-[#0f1422] border-[#222834] border-l-4 border-l-blue-500 text-slate-100 shadow-2xl shadow-black/70',
                iconBox: 'bg-blue-500/15 border border-blue-500/30 text-blue-400',
                text: 'text-slate-100 font-medium',
                close: 'text-slate-400 hover:text-white hover:bg-white/10',
              };
          }
        };

        const styles = getStyles();

        return (
          <div
            key={toast.id}
            role="status"
            className={`toast-capsule pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border text-xs font-sans transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${styles.container}`}
          >
            <div className={`p-2 rounded-md shrink-0 flex items-center justify-center ${styles.iconBox}`}>
              {type === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {type === 'error' && <AlertCircle className="w-4 h-4" />}
              {type === 'warning' && <AlertTriangle className="w-4 h-4" />}
              {type === 'info' && <Info className="w-4 h-4" />}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <p className={`text-xs leading-snug break-words ${styles.text}`}>
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${styles.close}`}
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
