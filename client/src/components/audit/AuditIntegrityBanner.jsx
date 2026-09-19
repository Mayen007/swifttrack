// client/src/components/audit/AuditIntegrityBanner.jsx
import React from 'react';
import { CheckCircle2, X } from 'lucide-react';

export function AuditIntegrityBanner({ report, onClose }) {
  if (!report) return null;

  return (
    <div className="bg-[#121b18] border border-emerald-500/40 rounded p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
            <span>SQL TRIGGER & INTEGRITY ATTESTATION VERIFIED</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
              {report.continuityIntegrity} VALID
            </span>
          </div>
          <p className="text-[11px] text-slate-300 mt-0.5 font-mono">
            Scanned {report.recordsScanned} immutable audit entries. Monotonic sequence and database triggers (
            <code className="text-emerald-400">prevent_audit_logs_update</code>,{' '}
            <code className="text-emerald-400">prevent_audit_logs_delete</code>) confirmed active with 0 tamper violations.
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-white self-start sm:self-center p-1 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
