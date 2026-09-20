// client/src/components/inventory/InventoryValuationView.jsx
import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, ShieldAlert, ArrowUpRight, BarChart3, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.js';

export function InventoryValuationView({ branchId, warehouseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadValuation();
  }, [branchId, warehouseId]);

  async function loadValuation() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (branchId) params.append('branch_id', branchId);
      if (warehouseId) params.append('warehouse_id', warehouseId);

      const res = await api.get(`/api/v1/inventory/valuation?${params.toString()}`);
      setData(res);
    } catch (err) {
      console.error('Error loading valuation:', err);
      api.toast('Failed to load inventory valuation: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-12 flex flex-col items-center justify-center space-y-3 font-mono">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400">Computing enterprise inventory valuation & COGS matrix...</span>
      </div>
    );
  }

  const summary = data?.summary || {};
  const items = data?.items || [];

  const filteredItems = items.filter(it => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      it.productName?.toLowerCase().includes(q) ||
      it.sku?.toLowerCase().includes(q) ||
      it.categoryName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 font-mono text-xs animate-in fade-in duration-150">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total On-Hand Value */}
        <div className="bg-[#12161f] border border-[#222834] rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
            <span>On-Hand Asset Value</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-white mt-1">
            KES {(summary.totalOnHandValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {summary.totalProductsTracked || 0} catalog products tracked
          </div>
        </div>

        {/* Available Working Capital */}
        <div className="bg-[#12161f] border border-[#222834] rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
            <span>Available Value</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-blue-300 mt-1">
            KES {(summary.totalAvailableValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Active sellable capital</div>
        </div>

        {/* Potential Retail Value & Gross Profit */}
        <div className="bg-[#12161f] border border-[#222834] rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
            <span>Potential Retail Value</span>
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-300 mt-1">
            KES {(summary.totalPotentialRetailValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-400 mt-1">
            Potential Profit: +KES {(summary.totalPotentialGrossProfit || 0).toLocaleString()}
          </div>
        </div>

        {/* Losses (Damaged & Expired) */}
        <div className="bg-[#12161f] border border-[#222834] rounded p-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
            <span>Loss Exposure</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg font-bold text-rose-400 mt-1">
            KES {((summary.totalDamagedLossValue || 0) + (summary.totalExpiredLossValue || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex gap-2">
            <span>Damaged: {(summary.totalDamagedLossValue || 0).toFixed(0)}</span>
            <span>Expired: {(summary.totalExpiredLossValue || 0).toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Header & Filter Bar */}
      <div className="flex items-center justify-between gap-3 bg-[#12161f] border border-[#222834] rounded p-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white text-xs uppercase">Financial Valuation & Costing Breakdown</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter product or category..."
            className="bg-[#181d28] border border-[#222834] rounded px-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={loadValuation}
            className="p-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#222834] text-slate-300 hover:text-white cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Valuation Table */}
      <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#222834] bg-[#0e121a] text-slate-400 text-[10px] uppercase">
                <th className="py-2.5 px-3">Product / SKU</th>
                <th className="py-2.5 px-3 text-center">Costing Method</th>
                <th className="py-2.5 px-3 text-right">Unit Cost</th>
                <th className="py-2.5 px-3 text-right">Selling Price</th>
                <th className="py-2.5 px-3 text-right">Available Qty</th>
                <th className="py-2.5 px-3 text-right text-blue-400">Available Value</th>
                <th className="py-2.5 px-3 text-right text-purple-400">Retail Value</th>
                <th className="py-2.5 px-3 text-right text-emerald-400">Gross Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2430]">
              {filteredItems.map(it => {
                const marginPct = it.sellingPrice > 0
                  ? (((it.sellingPrice - it.unitCost) / it.sellingPrice) * 100).toFixed(1)
                  : '0.0';

                return (
                  <tr key={`${it.productId}-${it.warehouseName}`} className="hover:bg-[#181d28]/60">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{it.productName}</div>
                      <div className="text-[10px] text-slate-500 flex gap-2 mt-0.5">
                        <span>{it.sku}</span>
                        <span>•</span>
                        <span>{it.warehouseName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        it.costingMethod === 'WEIGHTED_AVERAGE'
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {it.costingMethod || 'FIFO'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      KES {it.unitCost.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                      KES {it.sellingPrice.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      {it.quantities.available}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-300">
                      KES {it.valuations.available.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-purple-300">
                      KES {it.valuations.potentialRetail.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      {marginPct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
