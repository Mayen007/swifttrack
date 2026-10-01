import React from 'react';
import { FileText, Plus } from 'lucide-react';
import { sound } from '../../services/sound.js';
import { getProcurementStatusBadge } from './constants.jsx';

export function RequisitionsTab({
  requisitions,
  searchQuery,
  isManagerOrAdmin,
  onRaisePR,
  onSubmitPR,
  onApprovePR,
  onViewPR
}) {
  const filteredRequisitions = requisitions.filter(pr =>
    !searchQuery ||
    pr.pr_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr.requested_by_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr.branch_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          Purchase Requisitions Internal Requests
        </h2>
        {isManagerOrAdmin && (
          <button
            onClick={() => {
              sound.playClick();
              onRaisePR();
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Raise PR
          </button>
        )}
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">PR Number</th>
              <th className="py-3 px-4">Requested By</th>
              <th className="py-3 px-4">Branch</th>
              <th className="py-3 px-4">Urgency</th>
              <th className="py-3 px-4">Est. Cost (KES)</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredRequisitions.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-500 text-xs font-sans">
                  No purchase requisitions found. Click "Raise PR" to create an internal restock request.
                </td>
              </tr>
            ) : (
              filteredRequisitions.map((pr) => (
                <tr key={pr.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-white">
                    {pr.pr_number}
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                      {new Date(pr.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 font-sans">
                    {pr.requested_by_name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-sans">
                    {pr.branch_name}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        pr.urgency === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : pr.urgency === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {pr.urgency}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-white">
                    {Number(pr.total_estimated_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4">
                    {getProcurementStatusBadge(pr.status)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 font-sans">
                      {pr.status === 'DRAFT' && (
                        <button
                          onClick={() => {
                            sound.playClick();
                            onSubmitPR(pr);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium border border-slate-700"
                        >
                          Submit
                        </button>
                      )}
                      {isManagerOrAdmin && pr.status === 'SUBMITTED' && (
                        <button
                          onClick={() => {
                            sound.playClick();
                            onApprovePR(pr);
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => {
                          sound.playClick();
                          onViewPR(pr);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
