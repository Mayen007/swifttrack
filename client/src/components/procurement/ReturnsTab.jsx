import React from 'react';
import { RotateCcw, Plus } from 'lucide-react';
import { sound } from '../../services/sound.js';
import { getProcurementStatusBadge } from './constants.jsx';

export function ReturnsTab({
  returns,
  searchQuery,
  isManagerOrAdmin,
  onReturnStock,
  onApproveReturn
}) {
  const filteredReturns = returns.filter(ret =>
    !searchQuery ||
    ret.return_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ret.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ret.warehouse_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ret.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-rose-400" />
          Supplier Returns & Debit Notes
        </h2>
        {isManagerOrAdmin && (
          <button
            onClick={() => {
              sound.playClick();
              onReturnStock();
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-rose-500/20"
          >
            <Plus className="w-3.5 h-3.5" /> Return Defective Stock
          </button>
        )}
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Return Note #</th>
              <th className="py-3 px-4">Supplier</th>
              <th className="py-3 px-4">Warehouse</th>
              <th className="py-3 px-4">Reason</th>
              <th className="py-3 px-4">Debit Value (KES)</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredReturns.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-500 text-xs font-sans">
                  No supplier returns or debit notes logged. Use "Return Defective Stock" to return damaged or oversupplied items.
                </td>
              </tr>
            ) : (
              filteredReturns.map((ret) => (
                <tr key={ret.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-rose-400">
                    {ret.return_number}
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                      {new Date(ret.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 font-sans">
                    {ret.supplier_name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-sans">
                    {ret.warehouse_name}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300 border border-slate-700">
                      {ret.reason}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-white">
                    {Number(ret.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4">
                    {getProcurementStatusBadge(ret.status)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 font-sans">
                      {ret.status === 'DRAFT' && isManagerOrAdmin && (
                        <button
                          onClick={() => {
                            sound.playClick();
                            onApproveReturn(ret);
                          }}
                          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/30"
                        >
                          Approve & Deduct Stock
                        </button>
                      )}
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
