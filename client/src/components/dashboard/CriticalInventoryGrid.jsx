import React from 'react';
import { ArrowRight } from 'lucide-react';

export function CriticalInventoryGrid({ lowStock, branchPerformance, loading, onNavigate }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              INVENTORY TELEMETRY
            </div>
            <h2 className="text-sm font-bold text-white font-sans mt-0.5">
              Critical Replenishment Matrix
            </h2>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-mono font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>OPEN_INVENTORY</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-widest text-slate-400 border-b border-[#222834]">
                <th className="pb-2 font-medium">SKU / ITEM</th>
                <th className="pb-2 font-medium">HUB</th>
                <th className="pb-2 font-medium text-right">ON HAND</th>
                <th className="pb-2 font-medium text-right">MIN LEVEL</th>
                <th className="pb-2 font-medium text-right">DEFICIT RATIO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b212c]">
              {lowStock == null || lowStock.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400 font-mono text-xs">
                    {lowStock == null
                      ? loading ? 'Loading inventory data…' : 'Inventory data is unavailable. Try refreshing the dashboard.'
                      : 'No inventory items are currently below their configured safety threshold.'}
                  </td>
                </tr>
              ) : (
                lowStock.slice(0, 6).map((item) => {
                  const ratio = item.reorder_level > 0 ? Math.min(100, Math.round((item.quantity / item.reorder_level) * 100)) : null;

                  return (
                    <tr key={item.id} className="hover:bg-[#161b26] transition-colors">
                      <td className="py-2.5 text-slate-200">
                        <div className="font-medium text-white">{item.product_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                      </td>
                      <td className="py-2.5 text-slate-300 font-mono text-[11px]">
                        {item.warehouse_name || 'Unassigned'}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold tabular-nums text-amber-400">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-400">
                        {item.reorder_level}
                      </td>
                      <td className="py-2.5 text-right font-mono text-[11px] tabular-nums">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-400">
                          {ratio == null ? '—' : `${ratio}% CAP`}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                BRANCH NETWORK
              </div>
              <h2 className="text-sm font-bold text-white font-sans mt-0.5">
                Configured Branches
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#0c0e12]">
              {branchPerformance == null ? '—' : branchPerformance.length} BRANCHES
            </span>
          </div>

          <div className="space-y-2">
            {branchPerformance?.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded bg-[#0c0e12] border border-[#222834] flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-white">{b.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    NODE: {b.code} • {b.city}
                  </div>
                </div>
              </div>
            ))}
            {branchPerformance == null && (
              <p className="rounded-lg border border-dashed border-[#30394a] p-4 text-center text-xs text-slate-500">
                {loading ? 'Loading branch data…' : 'Branch data is unavailable.'}
              </p>
            )}
            {branchPerformance?.length === 0 && (
              <p className="rounded-lg border border-dashed border-[#30394a] p-4 text-center text-xs text-slate-500">
                No branches have been provisioned yet.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#222834] text-[11px] font-mono text-slate-400">
          Branch details from the configured network.
        </div>
      </div>
    </div>
  );
}
