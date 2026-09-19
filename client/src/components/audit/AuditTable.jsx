// client/src/components/audit/AuditTable.jsx
import React from 'react';
import { RotateCcw, ShieldCheck, Building2, Eye, Lock } from 'lucide-react';

export function AuditTable({
  loading,
  totalLogsCount,
  filteredLogs,
  searchQuery,
  actionFilter,
  resourceFilter,
  onOpenDiffModal,
  getActionBadgeStyle,
  getLogHash,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#181d28] text-slate-400 border-b border-[#222834] text-[10px] uppercase tracking-wider">
            <tr>
              <th className="p-3 font-semibold">Entry ID & Fingerprint</th>
              <th className="p-3 font-semibold">Timestamp</th>
              <th className="p-3 font-semibold">Operator & Role</th>
              <th className="p-3 font-semibold">Action</th>
              <th className="p-3 font-semibold">Target Resource</th>
              <th className="p-3 font-semibold">Station Hub</th>
              <th className="p-3 font-semibold">Reason / Context</th>
              <th className="p-3 font-semibold text-right">State Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834]">
            {loading && totalLogsCount === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  <RotateCcw className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
                  <span>Synchronizing immutable cryptographic audit records...</span>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  <ShieldCheck className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <span className="block text-white font-bold text-sm">No Audit Records Found</span>
                  <span className="text-xs text-slate-500 mt-0.5 block">
                    {searchQuery || actionFilter || resourceFilter
                      ? 'No events match active filter criteria. Try clearing filters.'
                      : 'Audit ledger currently has no recorded mutating events.'}
                  </span>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const hasDiff = Boolean(log.previous_value || log.new_value);
                const hashTag = getLogHash(log);

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-[#181d28]/60 transition-colors"
                  >
                    {/* 1. ID & Pseudo Hash */}
                    <td className="p-3">
                      <div className="font-bold text-white">
                        #{String(log.id).padStart(4, '0')}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                        <span>{hashTag}</span>
                      </div>
                    </td>

                    {/* 2. Timestamp */}
                    <td className="p-3 text-slate-300 whitespace-nowrap text-[11px]">
                      <div>
                        {new Date(log.created_at).toLocaleTimeString('en-KE', {
                          hour12: false,
                        })}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(log.created_at).toLocaleDateString('en-KE')}
                      </div>
                    </td>

                    {/* 3. Operator & Role */}
                    <td className="p-3">
                      <div className="font-bold text-white font-sans text-xs">
                        {log.user_full_name || log.username || 'SYSTEM ENGINE'}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#181d28] border border-[#222834] text-slate-300">
                          {log.role}
                        </span>
                      </div>
                    </td>

                    {/* 4. Action */}
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getActionBadgeStyle(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* 5. Target Resource */}
                    <td className="p-3">
                      <div className="font-bold text-blue-400">
                        {log.resource_id ? `#${log.resource_id}` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase">
                        {log.resource}
                      </div>
                    </td>

                    {/* 6. Station Hub */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 text-slate-300 text-xs font-sans">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{log.branch_name || 'HQ Global Operations'}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        IP: {log.ip_address || '127.0.0.1'}
                      </div>
                    </td>

                    {/* 7. Reason / Context */}
                    <td className="p-3 text-slate-400 max-w-xs text-[11px] truncate font-sans">
                      <span title={log.reason || 'Routine operation'}>
                        {log.reason || 'Routine operation'}
                      </span>
                    </td>

                    {/* 8. State Diff Trigger */}
                    <td className="p-3 text-right">
                      {hasDiff ? (
                        <button
                          onClick={() => onOpenDiffModal(log)}
                          className="px-2 py-1 rounded bg-[#181d28] hover:bg-[#222836] text-blue-400 hover:text-blue-300 text-[11px] font-mono font-bold flex items-center gap-1 ml-auto border border-[#222834] transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-blue-400" />
                          <span>INSPECT DIFF</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">NO DELTA</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Governance Notice */}
      <div className="p-3 bg-[#141822] border-t border-[#222834] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-1.5 text-[11px]">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>ENFORCED APPEND-ONLY: DATABASE MUTATIONS TRIGGER HARD FAIL ON UPDATE OR DELETE</span>
        </div>
        <div className="text-[10px] text-slate-400">
          SHOWING {filteredLogs.length} OF {totalLogsCount} AUDIT RECORDS
        </div>
      </div>
    </div>
  );
}
