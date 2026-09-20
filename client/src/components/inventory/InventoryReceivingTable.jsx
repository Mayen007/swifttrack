// client/src/components/inventory/InventoryReceivingTable.jsx
import React, { useState } from 'react';
import { Truck, ChevronDown, ChevronRight, Hash, Calendar, DollarSign, Package } from 'lucide-react';

export function InventoryReceivingTable({ loading, receipts = [] }) {
  const [expandedId, setExpandedId] = useState(null);

  if (loading && receipts.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono text-xs bg-[#12161f] border border-[#222834] rounded">
        Loading Goods Received Notes...
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono text-xs bg-[#12161f] border border-[#222834] rounded">
        No inbound goods receipts found. Use "Receive Stock" to log delivery notes and supplier invoices.
      </div>
    );
  }

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden font-mono text-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#181d28] border-b border-[#222834] text-[11px] text-slate-400">
              <th className="p-2.5 w-8"></th>
              <th className="p-2.5">GRN #</th>
              <th className="p-2.5">Warehouse / Hub</th>
              <th className="p-2.5">Invoice / Waybill</th>
              <th className="p-2.5 text-right">Items Count</th>
              <th className="p-2.5 text-right">Total Cost (KES)</th>
              <th className="p-2.5">Received By</th>
              <th className="p-2.5">Date</th>
              <th className="p-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1c222e]">
            {receipts.map((r) => {
              const isExpanded = expandedId === r.id;
              return (
                <React.Fragment key={r.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    className="hover:bg-[#161b26] cursor-pointer transition-colors"
                  >
                    <td className="p-2.5 text-slate-500">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </td>
                    <td className="p-2.5 font-bold text-emerald-400">{r.receipt_number}</td>
                    <td className="p-2.5 text-slate-200">
                      <div>{r.warehouse_name}</div>
                      <div className="text-[10px] text-slate-500">{r.branch_name}</div>
                    </td>
                    <td className="p-2.5 text-slate-400">
                      <div>{r.supplier_invoice_no || '—'}</div>
                      {r.delivery_note_no && <div className="text-[10px] text-slate-500">DN: {r.delivery_note_no}</div>}
                    </td>
                    <td className="p-2.5 text-right font-bold text-white">{r.total_items}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-300">
                      {Number(r.total_cost || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-slate-300">{r.received_by_name || 'System User'}</td>
                    <td className="p-2.5 text-slate-400 text-[10px]">
                      {new Date(r.created_at).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        {r.status}
                      </span>
                    </td>
                  </tr>

                  {isExpanded && r.items && (
                    <tr className="bg-[#0e1118]">
                      <td colSpan="9" className="p-3 pl-10 border-t border-[#1c222e]">
                        <div className="space-y-1.5">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                            Goods Received Note Line Items
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {r.items.map((it, idx) => (
                              <div key={idx} className="p-2 rounded bg-[#141923] border border-[#222834] flex items-center justify-between">
                                <div>
                                  <div className="font-bold text-white">{it.product_name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">SKU: {it.sku}</div>
                                  {it.condition === 'DAMAGED' && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                      QUARANTINED AS DAMAGED
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-emerald-400">+{it.quantity_received} {it.unit}</div>
                                  <div className="text-[10px] text-slate-400">@ KES {it.unit_cost}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
