import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { sound } from '../../services/sound.js';
import { getProcurementStatusBadge } from './constants.jsx';

export function PurchaseOrdersTab({
  orders,
  searchQuery,
  isManagerOrAdmin,
  onViewPO,
  onReceivePO
}) {
  const filteredOrders = orders.filter(po =>
    !searchQuery ||
    po.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    po.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-amber-400" />
          Purchase Orders Master Ledger
        </h2>
        <div className="text-xs text-slate-400 font-mono">
          Showing {orders.length} orders
        </div>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">PO Number</th>
              <th className="py-3 px-4">Supplier</th>
              <th className="py-3 px-4">Branch / Warehouse</th>
              <th className="py-3 px-4">Receiving Progress</th>
              <th className="py-3 px-4">Total (KES)</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {orders.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-500 text-xs font-sans">
                  No purchase orders found. Click "Create PO" to raise an order with a supplier.
                </td>
              </tr>
            ) : (
              filteredOrders.map((po) => {
                const ordered = po.total_ordered_qty || 1;
                const received = po.total_received_qty || 0;
                const pct = Math.min(100, Math.round((received / ordered) * 100));

                return (
                  <tr key={po.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {po.po_number}
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                        Issued: {new Date(po.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-sans">
                      <div className="font-medium text-white">{po.supplier_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{po.supplier_code}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-sans">
                      <div>{po.branch_name}</div>
                      <div className="text-[11px] text-slate-500">{po.warehouse_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
                        <span>{received} / {ordered} items</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-indigo-500' : 'bg-slate-700'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      {getProcurementStatusBadge(po.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-sans">
                        <button
                          onClick={() => {
                            sound.playClick();
                            onViewPO(po);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                        >
                          View
                        </button>

                        {isManagerOrAdmin && ['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                          <button
                            onClick={() => {
                              sound.playClick();
                              onReceivePO(po);
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition-colors"
                          >
                            Receive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
