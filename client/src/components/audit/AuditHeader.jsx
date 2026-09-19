// client/src/components/audit/AuditHeader.jsx
import React from 'react';
import { ShieldCheck, Lock, FileText, RotateCcw } from 'lucide-react';

export function AuditHeader({
  loading,
  isVerifyingIntegrity,
  onVerifyIntegrity,
  onExportJson,
  onRefresh,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-bold tracking-wider uppercase">
            <ShieldCheck className="w-3 h-3" />
            CRYPTOGRAPHIC STATE FORENSICS
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            SQL TRIGGER TAMPER-PROOF
          </span>
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 mt-1">
          <Lock className="w-5 h-5 text-blue-400" />
          Immutable Forensic Platform Audit Trail
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Append-only cryptographically verifiable event ledger recording every mutating platform state transition with before/after state diffs
        </p>
      </div>

      {/* Action Switchboard */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onVerifyIntegrity}
          disabled={isVerifyingIntegrity || loading}
          title="Execute cryptographic validation of SQLite append-only trigger constraints"
          className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <ShieldCheck className={`w-3.5 h-3.5 ${isVerifyingIntegrity ? 'animate-spin text-emerald-400' : ''}`} />
          <span>{isVerifyingIntegrity ? 'VERIFYING...' : 'VERIFY LEDGER'}</span>
        </button>

        <button
          onClick={onExportJson}
          title="Export filtered audit logs as JSON file for compliance"
          className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>EXPORT JSON</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh immutable audit ledger"
          className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
          <span>SYNC</span>
        </button>
      </div>
    </div>
  );
}
