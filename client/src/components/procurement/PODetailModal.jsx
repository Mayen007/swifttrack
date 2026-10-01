import React from 'react';
import {
  ShoppingBag,
  Send,
  Check,
  X
} from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function PODetailModal({ po, onClose, onRefresh, isManagerOrAdmin }) {
  const items = po.items || [];
  const receipts = po.receipts || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-base flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              {po.po_number}
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {po.status}
              </span>
            </h3>
            <div className="text-xs text-slate-400 font-sans mt-0.5">
              Supplier: {po.supplier_name} • Destination: {po.warehouse_name} ({po.branch_name})
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Header controls if APPROVED or DRAFT */}
          {isManagerOrAdmin && po.status === 'APPROVED' && (
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center justify-between">
              <div className="text-xs text-sky-300 font-sans">
                This PO is approved. Transmit formal order details to the vendor.
              </div>
              <button
                onClick={async () => {
                  sound.playClick();
                  await api.post(`/api/v1/procurement/orders/${po.id}/send`);
                  onRefresh();
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Send to Vendor
              </button>
            </div>
          )}

          {isManagerOrAdmin && po.status === 'DRAFT' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
              <div className="text-xs text-amber-300 font-sans">
                Review line items and authorize procurement order.
              </div>
              <button
                onClick={async () => {
                  sound.playClick();
                  await api.post(`/api/v1/procurement/orders/${po.id}/approve`);
                  onRefresh();
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Approve PO
              </button>
            </div>
          )}

          {/* Line items table */}
          <div>
            <div className="text-xs font-mono text-slate-400 mb-2">Order Line Items:</div>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-3 font-sans">Product</th>
                    <th className="py-2.5 px-3">Ordered</th>
                    <th className="py-2.5 px-3">Received</th>
                    <th className="py-2.5 px-3">Unit Cost</th>
                    <th className="py-2.5 px-3">Total (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3 font-sans text-white font-medium">
                        {it.product_name}
                        <div className="text-[10px] text-slate-500 font-mono">{it.sku}</div>
                      </td>
                      <td className="py-2.5 px-3 text-white font-bold">{it.ordered_quantity}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">{it.received_quantity}</td>
                      <td className="py-2.5 px-3 text-slate-300">{Number(it.unit_cost).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-white font-bold">{Number(it.total_cost).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inbound GRN History */}
          <div>
            <div className="text-xs font-mono text-slate-400 mb-2">Inbound Goods Receipts (GRNs):</div>
            {receipts.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                No inbound receipts logged yet.
              </div>
            ) : (
              <div className="space-y-2">
                {receipts.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">{r.receipt_number}</span>
                      <span className="text-slate-400 font-sans">Received by {r.received_by_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-bold">{r.total_items} items</span>
                      <span className="text-slate-500 text-[10px] ml-2">({new Date(r.created_at).toLocaleDateString()})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

