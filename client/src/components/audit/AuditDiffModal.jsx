// client/src/components/audit/AuditDiffModal.jsx
import React from 'react';
import {
  FileCode,
  X,
  Terminal,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function AuditDiffModal({
  isOpen,
  log,
  viewMode,
  setViewMode,
  onClose,
  getLogHash,
}) {
  if (!isOpen || !log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28] shrink-0">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
              FORENSIC AUDIT ENTRY #{log.id} // {log.action} [{log.resource}]
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Visual vs Raw JSON switch */}
            <div className="flex items-center bg-[#12161f] border border-[#222834] rounded p-0.5 text-[11px] font-mono">
              <button
                onClick={() => {
                  sound.playScan();
                  setViewMode('visual');
                }}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'visual'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                VISUAL
              </button>
              <button
                onClick={() => {
                  sound.playScan();
                  setViewMode('raw');
                }}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'raw'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                RAW JSON
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs font-mono">
          {/* Event Metadata Grid */}
          <div className="bg-[#181d28] border border-[#222834] rounded p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">OPERATOR</span>
              <span className="font-bold text-white font-sans">
                {log.user_full_name || log.username || 'System Engine'}
              </span>
              <span className="text-slate-400 text-[10px] block">Role: {log.role}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">STATION HUB</span>
              <span className="font-bold text-white">
                {log.branch_name || 'HQ Global'}
              </span>
              <span className="text-slate-400 text-[10px] block">ID: #{log.branch_id || 'MESH'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">NETWORK IDENTITY</span>
              <span className="font-bold text-blue-400">{log.ip_address || '127.0.0.1'}</span>
              <span className="text-slate-400 text-[10px] block truncate">{log.user_agent || 'Platform API'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">TIMESTAMP</span>
              <span className="font-bold text-white">
                {new Date(log.created_at).toLocaleTimeString('en-KE', { hour12: false })} EAT
              </span>
              <span className="text-slate-400 text-[10px] block">
                {new Date(log.created_at).toLocaleDateString('en-KE')}
              </span>
            </div>
          </div>

          {/* Reason / Context Callout */}
          <div className="p-3 rounded bg-[#181d28] border border-blue-500/30 text-slate-300 text-[11px] flex items-start gap-2">
            <Terminal className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-blue-400 font-bold uppercase block text-[10px]">
                OPERATIONAL JUSTIFICATION & AUDIT CONTEXT:
              </span>
              <span className="text-white font-sans text-xs">
                {log.reason || 'Routine mutating operation logged through platform API.'}
              </span>
            </div>
          </div>

          {/* Side-by-side State Diff Box */}
          {viewMode === 'visual' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Previous State */}
              <div className="bg-[#151114] border border-rose-900/40 rounded p-3 space-y-2">
                <div className="flex items-center justify-between text-rose-400 font-bold uppercase text-[10px] tracking-wider pb-1 border-b border-rose-900/30">
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>PREVIOUS STATE (PRE-MUTATION)</span>
                  </div>
                  <span className="text-slate-500 text-[9px]">ORIGINAL VALUES</span>
                </div>

                {log.previous_value ? (
                  <div className="space-y-1.5 text-[11px]">
                    {Object.entries(
                      typeof log.previous_value === 'object'
                        ? log.previous_value
                        : { value: log.previous_value }
                    ).map(([key, val]) => (
                      <div
                        key={key}
                        className="bg-[#1b1417] p-2 rounded border border-rose-900/20 flex flex-col gap-0.5"
                      >
                        <span className="text-slate-400 text-[10px] font-bold uppercase">{key}:</span>
                        <span className="text-rose-200 break-all font-mono">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500 italic text-[11px]">
                    null (Resource created as fresh state)
                  </div>
                )}
              </div>

              {/* New State */}
              <div className="bg-[#0f1714] border border-emerald-900/40 rounded p-3 space-y-2">
                <div className="flex items-center justify-between text-emerald-400 font-bold uppercase text-[10px] tracking-wider pb-1 border-b border-emerald-900/30">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>NEW STATE (POST-MUTATION)</span>
                  </div>
                  <span className="text-slate-500 text-[9px]">COMMITTED VALUES</span>
                </div>

                {log.new_value ? (
                  <div className="space-y-1.5 text-[11px]">
                    {Object.entries(
                      typeof log.new_value === 'object'
                        ? log.new_value
                        : { value: log.new_value }
                    ).map(([key, val]) => (
                      <div
                        key={key}
                        className="bg-[#121c17] p-2 rounded border border-emerald-900/20 flex flex-col gap-0.5"
                      >
                        <span className="text-slate-400 text-[10px] font-bold uppercase">{key}:</span>
                        <span className="text-emerald-200 break-all font-mono">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500 italic text-[11px]">
                    null (Resource state was expunged)
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Raw JSON View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-[#181d28] border border-[#222834] rounded p-3">
                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
                  Raw Previous State:
                </span>
                <pre className="text-[11px] font-mono text-slate-300 bg-[#12161f] p-2.5 rounded border border-[#222834] overflow-x-auto max-h-60 whitespace-pre-wrap leading-relaxed">
                  {log.previous_value
                    ? JSON.stringify(log.previous_value, null, 2)
                    : 'null'}
                </pre>
              </div>
              <div className="bg-[#181d28] border border-[#222834] rounded p-3">
                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
                  Raw New State:
                </span>
                <pre className="text-[11px] font-mono text-emerald-300 bg-[#12161f] p-2.5 rounded border border-[#222834] overflow-x-auto max-h-60 whitespace-pre-wrap leading-relaxed">
                  {log.new_value
                    ? JSON.stringify(log.new_value, null, 2)
                    : 'null'}
                </pre>
              </div>
            </div>
          )}

          {/* Cryptographic Attestation Notice */}
          <div className="p-3 rounded bg-[#181d28] border border-[#222834] flex items-start gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-white">CRYPTOGRAPHIC NON-REPUDIATION ATTESTATION:</strong> This entry is permanently immutabilized under SQLite triggers <code className="text-emerald-400">prevent_audit_logs_update</code> and <code className="text-emerald-400">prevent_audit_logs_delete</code>. Any attempted modification will trigger an immediate SQL execution failure.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-[#222834] bg-[#181d28] flex items-center justify-between shrink-0">
          <span className="font-mono text-[10px] text-slate-500">
            RECORD CHECKSUM: {getLogHash(log)}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] border border-[#222834] text-xs font-mono text-slate-200 cursor-pointer"
          >
            CLOSE INSPECTOR
          </button>
        </div>
      </div>
    </div>
  );
}
