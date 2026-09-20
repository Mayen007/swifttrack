// client/src/components/inventory/InventoryTable.jsx
import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowRightLeft, Sliders, Barcode } from 'lucide-react';

export function InventoryTable({
  loading,
  inventory = [],
  onQuarantineItem,
  onExpireItem,
  onTransferItem,
  onAdjustItem,
}) {
  if (loading) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-8 flex flex-col items-center justify-center space-y-3 font-mono">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400">Loading multi-state inventory matrix...</span>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-12 text-center font-mono">
        <Barcode className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-200 uppercase">No Inventory Records Found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          No stock items match your search or filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden font-mono">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#222834] bg-[#0e121a] text-slate-400 text-[10px] uppercase tracking-wider">
              <th className="py-2.5 px-3">SKU / Barcode</th>
              <th className="py-2.5 px-3">Product Name & Category</th>
              <th className="py-2.5 px-3">Hub & Warehouse</th>
              <th className="py-2.5 px-3 text-right">On Hand</th>
              <th className="py-2.5 px-3 text-right text-emerald-400">Available</th>
              <th className="py-2.5 px-3 text-right text-amber-400">Reserved</th>
              <th className="py-2.5 px-3 text-right text-blue-400">In Transit</th>
              <th className="py-2.5 px-3 text-right text-rose-400">Damaged</th>
              <th className="py-2.5 px-3 text-right text-red-400">Expired</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2430]">
            {inventory.map((it) => {
              const isLowStock = (it.quantity_available ?? 0) <= (it.reorder_threshold ?? 10);
              return (
                <tr key={it.id} className="hover:bg-[#181d28]/70 transition-colors">
                  {/* SKU & Barcode */}
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-200">{it.sku}</div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                      <Barcode className="w-3 h-3" />
                      <span>{it.barcode || 'N/A'}</span>
                    </div>
                  </td>

                  {/* Name & Category */}
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-white truncate max-w-[200px]">{it.product_name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-300">
                        {it.category_name || it.category || 'General'}
                      </span>
                      {isLowStock && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          LOW STOCK
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Hub / Warehouse */}
                  <td className="py-2.5 px-3">
                    <div className="text-slate-300">{it.warehouse_name}</div>
                    <div className="text-[10px] text-slate-500">{it.branch_name}</div>
                  </td>

                  {/* ON HAND */}
                  <td className="py-2.5 px-3 text-right font-bold text-white">
                    {(it.quantity_on_hand ?? 0).toLocaleString()}
                  </td>

                  {/* AVAILABLE */}
                  <td className="py-2.5 px-3 text-right">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      {(it.quantity_available ?? 0).toLocaleString()}
                    </span>
                  </td>

                  {/* RESERVED */}
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        it.quantity_reserved > 0
                          ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {(it.quantity_reserved ?? 0).toLocaleString()}
                    </span>
                  </td>

                  {/* IN TRANSIT */}
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        it.quantity_in_transit > 0
                          ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {(it.quantity_in_transit ?? 0).toLocaleString()}
                    </span>
                  </td>

                  {/* DAMAGED */}
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        it.quantity_damaged > 0
                          ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold animate-pulse'
                          : 'text-slate-600'
                      }`}
                    >
                      {(it.quantity_damaged ?? 0).toLocaleString()}
                    </span>
                  </td>

                  {/* EXPIRED */}
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        it.quantity_expired > 0
                          ? 'bg-red-500/20 border border-red-500/40 text-red-300 font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {(it.quantity_expired ?? 0).toLocaleString()}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => onQuarantineItem(it)}
                        title="Quarantine Damaged Stock"
                        className="p-1 rounded border border-[#222834] bg-[#181d28] hover:bg-rose-950/50 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onExpireItem(it)}
                        title="Segregate Expired Stock"
                        className="p-1 rounded border border-[#222834] bg-[#181d28] hover:bg-red-950/50 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onTransferItem(it)}
                        title="Transfer to Regional Warehouse"
                        className="p-1 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onAdjustItem(it)}
                        title="Audit Stock Recount Adjustment"
                        className="p-1 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
