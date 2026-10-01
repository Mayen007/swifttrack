import React from 'react';
import { ArrowRight } from 'lucide-react';

export function CriticalInventoryGrid({ lowStock, branchPerformance, onNavigate }) {
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
              {lowStock.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400 font-mono text-xs">
                    [NOMINAL] All warehouse SKU inventory above configured safety thresholds.
                  </td>
                </tr>
              ) : (
                lowStock.slice(0, 6).map((item) => {
                  const ratio = item.reorder_level > 0 ? Math.min(100, Math.round((item.quantity / item.reorder_level) * 100)) : 100;

                  return (
                    <tr key={item.id} className="hover:bg-[#161b26] transition-colors">
                      <td className="py-2.5 text-slate-200">
                        <div className="font-medium text-white">{item.product_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                      </td>
                      <td className="py-2.5 text-slate-300 font-mono text-[11px]">
                        {item.warehouse_name || 'Central Hub'}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold tabular-nums text-amber-400">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-400">
                        {item.reorder_level}
                      </td>
                      <td className="py-2.5 text-right font-mono text-[11px] tabular-nums">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-400">
                          {ratio}% CAP
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
                NETWORK TOPOLOGY
              </div>
              <h2 className="text-sm font-bold text-white font-sans mt-0.5">
                Regional Hub Status
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#0c0e12]">
              {branchPerformance.length || 3} NODES
            </span>
          </div>

          <div className="space-y-2">
            {branchPerformance.map((b) => (
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
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    ACTIVE
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[#222834] text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            SQLite Distributed Ledger
          </span>
          <span className="text-slate-400">P2P REPL</span>
        </div>
      </div>
    </div>
  );
}
