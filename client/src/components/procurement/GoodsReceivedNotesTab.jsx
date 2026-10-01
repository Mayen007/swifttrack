import React from 'react';
import { PackageCheck } from 'lucide-react';
import { sound } from '../../services/sound.js';

export function GoodsReceivedNotesTab({
  grns,
  searchQuery,
  onInspectGRN
}) {
  const filteredGrns = grns.filter(g =>
    !searchQuery ||
    g.receipt_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.warehouse_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <PackageCheck className="w-4 h-4 text-emerald-400" />
          Goods Received Notes (Inbound Invariant Receipts)
        </h2>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">GRN Number</th>
              <th className="py-3 px-4">PO Reference</th>
              <th className="py-3 px-4">Supplier</th>
              <th className="py-3 px-4">Warehouse</th>
              <th className="py-3 px-4">Items Received</th>
              <th className="py-3 px-4">Total Cost (KES)</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredGrns.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-500 text-xs font-sans">
                  No goods received notes found. Goods receipts are generated upon checking inbound PO deliveries.
                </td>
              </tr>
            ) : (
              filteredGrns.map((g) => (
                <tr key={g.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-emerald-400">
                    {g.receipt_number}
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                      {new Date(g.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-white">
                    {g.po_number || 'ADHOC_RECEIPT'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 font-sans">
                    {g.supplier_name || 'Standard Vendor'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-sans">
                    {g.warehouse_name}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-white">
                    {g.total_items} items
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-white">
                    {Number(g.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => {
                        sound.playClick();
                        onInspectGRN(g);
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 font-sans"
                    >
                      Inspect
                    </button>
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
