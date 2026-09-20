// client/src/components/inventory/InventoryReorderAlertsView.jsx
import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowDownCircle, ShoppingCart, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../../services/api.js';

export function InventoryReorderAlertsView({ branchId, warehouseId, onInitiateReceiving }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, [branchId, warehouseId]);

  async function loadAlerts() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (branchId) params.append('branch_id', branchId);
      if (warehouseId) params.append('warehouse_id', warehouseId);

      const res = await api.get(`/api/v1/inventory/reorder-alerts?${params.toString()}`);
      setData(res);
    } catch (err) {
      console.error('Error loading reorder alerts:', err);
      api.toast('Failed to load reorder alerts: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-12 flex flex-col items-center justify-center space-y-3 font-mono">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400">Scanning inventory thresholds & computing replenishment deficits...</span>
      </div>
    );
  }

  const alerts = data?.alerts || [];

  return (
    <div className="space-y-4 font-mono text-xs animate-in fade-in duration-150">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#12161f] border border-[#222834] rounded p-3">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
            <span>Replenishment Alerts</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-white mt-1">{data?.totalAlerts || 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Products below safety threshold</div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-3">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
            <span>Critical Out-of-Stock</span>
            <ArrowDownCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg font-bold text-rose-400 mt-1">{data?.criticalCount || 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Stock = 0 units available</div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-3">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
            <span>Low Stock Warning</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-300 mt-1">{data?.lowStockCount || 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Available &le; Reorder Threshold</div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-3">
          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
            <span>Est. Purchase Requisition</span>
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 mt-1">
            KES {(data?.totalEstimatedReorderCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">To restore optimal stock</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-3 bg-[#12161f] border border-[#222834] rounded p-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white text-xs uppercase">Automated Reorder Replenishment Queue</span>
        </div>
        <button
          onClick={loadAlerts}
          className="p-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#222834] text-slate-300 hover:text-white cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Alerts Table */}
      <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
        {alerts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <h4 className="font-bold text-white uppercase text-sm">All Inventory Levels Healthy</h4>
            <p className="text-slate-500 text-xs mt-1">No products currently below their reorder threshold.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#222834] bg-[#0e121a] text-slate-400 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Product / SKU</th>
                  <th className="py-2.5 px-3">Hub & Warehouse</th>
                  <th className="py-2.5 px-3 text-center">Urgency</th>
                  <th className="py-2.5 px-3 text-right">Available</th>
                  <th className="py-2.5 px-3 text-right">Threshold</th>
                  <th className="py-2.5 px-3 text-right text-rose-400">Deficit</th>
                  <th className="py-2.5 px-3 text-right text-emerald-400">Suggested Order</th>
                  <th className="py-2.5 px-3 text-right">Est. Cost</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2430]">
                {alerts.map(a => (
                  <tr key={`${a.productId}-${a.warehouseName}`} className="hover:bg-[#181d28]/60">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{a.productName}</div>
                      <div className="text-[10px] text-slate-500 flex gap-2 mt-0.5">
                        <span>{a.sku}</span>
                        <span>•</span>
                        <span>{a.categoryName || 'General'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-200">{a.warehouseName}</div>
                      <div className="text-[10px] text-slate-500">{a.branchName}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        a.urgency === 'CRITICAL_OUT_OF_STOCK'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {a.urgency === 'CRITICAL_OUT_OF_STOCK' ? 'OUT OF STOCK' : 'LOW STOCK'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      {a.quantityAvailable}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {a.reorderThreshold}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                      -{a.deficit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                      +{a.suggestedReorderQty}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      KES {a.estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onInitiateReceiving && onInitiateReceiving(a)}
                        className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>PO GRN</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
