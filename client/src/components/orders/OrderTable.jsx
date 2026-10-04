import React from 'react';
import { Truck, Eye, Edit, FileText, Printer } from 'lucide-react';
import { api } from '../../services/api.js';
import { getStatusBadge } from './constants.js';

export function OrderTable({
  orders,
  onViewDetails,
  onOpenEdit,
  onOpenInvoice,
  onOpenReceipt,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="bg-[#0c0e12] border-b border-[#222834] text-slate-400 uppercase text-[10px]">
              <th className="p-3">Order Number</th>
              <th className="p-3">Date</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Destination</th>
              <th className="p-3 text-center">Items</th>
              <th className="p-3 text-right">Delivery Fee</th>
              <th className="p-3 text-right">Total Amount</th>
              <th className="p-3 text-center">Allocation</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834]">
            {orders.length === 0 ? (
              <tr>
                <td colSpan="10" className="p-12 text-center text-slate-500 font-mono text-xs">
                  No orders match the selected filters.
                </td>
              </tr>
            ) : (
              orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-[#161c28]/60 transition-colors">
                  <td className="p-3">
                    <span
                      className="font-bold text-white hover:text-amber-300 cursor-pointer block truncate"
                      onClick={() => onViewDetails(ord)}
                    >
                      {ord.order_number}
                    </span>
                    {ord.delivery_number && (
                      <span className="text-[10px] text-indigo-400 flex items-center gap-1 font-sans mt-0.5">
                        <Truck className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span>{ord.delivery_number}</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-400 whitespace-nowrap text-[11px]">
                    {new Date(ord.created_at).toLocaleDateString('en-KE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-slate-200 block truncate max-w-[140px]">
                      {ord.customer_name || 'Walk-in'}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">{ord.customer_phone}</span>
                  </td>
                  <td className="p-3 text-slate-300 text-[11px] truncate max-w-[130px]">
                    {ord.delivery_city || '—'}
                  </td>
                  <td className="p-3 text-center tabular-nums text-slate-300">
                    {ord.items_count || 1}
                  </td>
                  <td className="p-3 text-right tabular-nums text-slate-400">
                    {ord.delivery_fee ? api.formatKES(ord.delivery_fee) : '—'}
                  </td>
                  <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">
                    {api.formatKES(ord.total_amount)}
                  </td>
                  <td className="p-3 text-center">
                    {ord.inventory_allocated ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        ALLOCATED
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        UNALLOCATED
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${getStatusBadge(
                        ord.status
                      )}`}
                    >
                      {ord.status}
                    </span>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onViewDetails(ord)}
                        className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 hover:text-white border border-[#222834] cursor-pointer"
                        title="View Order Lifecycle"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {['DRAFT', 'CONFIRMED'].includes(ord.status) && (
                        <button
                          onClick={() => onOpenEdit(ord)}
                          className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-amber-400 hover:text-amber-300 border border-[#222834] cursor-pointer"
                          title="Edit Order before fulfillment"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => onOpenInvoice(ord)}
                        className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-blue-400 hover:text-blue-300 border border-[#222834] cursor-pointer"
                        title="Commercial Tax Invoice"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onOpenReceipt(ord)}
                        className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-emerald-400 hover:text-emerald-300 border border-[#222834] cursor-pointer"
                        title="Thermal Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
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
