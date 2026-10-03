import React, { useEffect } from 'react';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';

export function SecurityAuditDrawer({
  isOpen,
  onClose,
  failedLoginsLoading,
  failedLoginsList,
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

  if (!isOpen) return null;

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
      aria-labelledby="security-audit-title"
    >
      <div
        className="bg-[#12161f] border border-[#222834] rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28] shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 id="security-audit-title" className="font-bold text-sm text-white font-mono uppercase tracking-wider">
              SECURITY AUDIT // FAILED LOGINS & LOCKOUT EVENTS
            </h3>
          </div>
          <button
            onClick={() => onClose()}
            aria-label="Close audit"
            title="Close audit (Esc)"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#222834] border border-transparent hover:border-slate-700/60 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-3 overscroll-contain">
          <p className="text-slate-400">
            Log of recent rejected credentials, lockouts, and authentication anomalies within your authorized station scope.
          </p>

          {failedLoginsLoading ? (
            <div className="p-8 text-center text-slate-400">
              <RotateCcw className="w-5 h-5 text-amber-400 animate-spin mx-auto mb-2" />
              <span>Loading failed login audit records...</span>
            </div>
          ) : failedLoginsList.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No failed login attempts recorded. System security integrity nominal.
            </div>
          ) : (
            <div className="border border-[#222834] rounded overflow-hidden">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-[#181d28] text-slate-400 border-b border-[#222834] uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Target Username</th>
                    <th className="p-2.5">Station Hub</th>
                    <th className="p-2.5">Failure Reason</th>
                    <th className="p-2.5">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222834]">
                  {failedLoginsList.map((log) => (
                    <tr key={log.id} className="hover:bg-[#181d28]/60">
                      <td className="p-2.5 text-slate-300">
                        {new Date(log.created_at).toLocaleString('en-KE', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="p-2.5 font-bold text-amber-400">
                        @{log.username_attempted || 'unknown'}
                      </td>
                      <td className="p-2.5 text-slate-400">
                        {log.branch_code || log.branch_name || 'HQ / Global'}
                      </td>
                      <td className="p-2.5 text-rose-400 font-medium">
                        {log.failure_reason || log.status}
                      </td>
                      <td className="p-2.5 text-slate-300">{log.ip_address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[#222834] bg-[#181d28] flex items-center justify-between shrink-0 font-mono text-[10px] text-slate-400">
          <span>{failedLoginsList.length} RECENT ANOMALOUS ATTEMPTS</span>
          <button
            onClick={() => onClose()}
            className="px-3 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] border border-[#222834] text-xs font-mono text-slate-200 hover:text-white cursor-pointer"
          >
            CLOSE AUDIT
          </button>
        </div>
      </div>
    </div>
  );
}
