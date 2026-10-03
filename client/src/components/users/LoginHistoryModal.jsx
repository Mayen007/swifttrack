import React, { useEffect } from 'react';
import { X, RotateCcw, History } from 'lucide-react';

export function LoginHistoryModal({
  isOpen,
  onClose,
  user,
  loginHistoryLoading,
  loginHistoryList,
}) {
  // Allow dismissing modal with Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-history-modal-title"
    >
      <div
        className="bg-[#12161f] border border-[#222834] rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28] shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-400" />
            <h3 id="login-history-modal-title" className="font-bold text-sm text-white font-mono uppercase tracking-wider">
              LOGIN AUDIT TRAIL // @{user.username.toUpperCase()}
            </h3>
          </div>
          <button
            onClick={() => onClose()}
            aria-label="Close login history"
            title="Close (Esc)"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#222834] border border-transparent hover:border-slate-700/60 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs overscroll-contain">
          {loginHistoryLoading ? (
            <div className="p-8 text-center text-slate-400">
              <RotateCcw className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
              <span>Loading authentication log history...</span>
            </div>
          ) : loginHistoryList.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No recorded authentication events on file for this operator.
            </div>
          ) : (
            <div className="border border-[#222834] rounded overflow-hidden">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-[#181d28] text-slate-400 border-b border-[#222834] uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Event Status</th>
                    <th className="p-2.5">Failure / Reason</th>
                    <th className="p-2.5">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222834]">
                  {loginHistoryList.map((log) => {
                    const isSuccess = log.status === 'SUCCESS';
                    const isLocked = log.status === 'ACCOUNT_LOCKED';
                    return (
                      <tr key={log.id} className="hover:bg-[#181d28]/60">
                        <td className="p-2.5 text-slate-300">
                          {new Date(log.created_at).toLocaleString('en-KE', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="p-2.5">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              SUCCESS
                            </span>
                          ) : isLocked ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              LOCKED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              {log.status}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-400 max-w-[200px] truncate">
                          {log.failure_reason || 'Terminal Authentication Verified'}
                        </td>
                        <td className="p-2.5 text-slate-300">{log.ip_address || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[#222834] bg-[#181d28] flex items-center justify-between shrink-0 font-mono text-[10px] text-slate-400">
          <span>SHOWING RECENT {loginHistoryList.length} ATTEMPTS</span>
          <button
            onClick={() => onClose()}
            className="px-3 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] border border-[#222834] text-xs font-mono text-slate-200 hover:text-white cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
