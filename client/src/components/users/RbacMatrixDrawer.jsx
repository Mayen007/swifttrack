import React from 'react';
import { ShieldCheck, X, Check, Layers } from 'lucide-react';
import { sound } from '../../services/sound.js';
import { RBAC_CAPABILITY_MATRIX } from './constants.js';

export function RbacMatrixDrawer({
  isOpen,
  onClose,
}) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28] shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                  ROLE-BASED ACCESS CONTROL (RBAC) CAPABILITY MATRIX
                </h3>
              </div>
              <button
                onClick={() => {
                  sound.playScan();
                  onClose();
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Matrix Table */}
            <div className="p-4 overflow-y-auto space-y-6">
              <p className="text-xs text-slate-400">
                Below is the authoritative specification matrix mapping security roles to functional capabilities across SwiftTrack Kenya.
              </p>

              {RBAC_CAPABILITY_MATRIX.map((group) => (
                <div key={group.category} className="space-y-2">
                  <h4 className="font-mono text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {group.category}
                  </h4>
                  <div className="border border-[#222834] rounded overflow-hidden">
                    <table className="w-full text-left font-mono text-[11px]">
                      <thead className="bg-[#181d28] text-slate-400 border-b border-[#222834] uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Capability / Permission</th>
                          <th className="p-2.5 text-center">Super Admin</th>
                          <th className="p-2.5 text-center">Branch Mgr</th>
                          <th className="p-2.5 text-center">Dispatcher</th>
                          <th className="p-2.5 text-center">Cashier</th>
                          <th className="p-2.5 text-center">Driver</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222834]">
                        {group.capabilities.map((cap) => (
                          <tr key={cap.code} className="hover:bg-[#181d28]/50">
                            <td className="p-2.5">
                              <span className="font-sans font-medium text-white block">{cap.name}</span>
                              <span className="text-[9px] text-slate-400 font-mono">{cap.code}</span>
                            </td>
                            {['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER', 'DRIVER'].map(
                              (r) => {
                                const allowed = cap.roles.includes(r);
                                return (
                                  <td key={r} className="p-2.5 text-center">
                                    {allowed ? (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                        <Check className="w-3 h-3" />
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-800/40 text-slate-600">
                                        —
                                      </span>
                                    )}
                                  </td>
                                );
                              }
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#222834] bg-[#181d28] flex items-center justify-between shrink-0">
              <span className="font-mono text-[10px] text-slate-400">
                SWIFTTRACK KERNEL SECURITY POLICY: V2.6
              </span>
              <button
                onClick={() => {
                  sound.playScan();
                  onClose();
                }}
                className="px-3 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] border border-[#222834] text-xs font-mono text-slate-200"
              >
                CLOSE MATRIX
              </button>
            </div>
          </div>
        </div>
  );
}
