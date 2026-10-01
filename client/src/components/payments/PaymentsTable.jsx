import React from 'react';
import { Eye, RefreshCw, X, Undo2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { getPaymentStatusBadge, renderPaymentMethodBadge } from './constants.jsx';

export function PaymentsTable({
  filteredIntents,
  onViewIntent,
  onQueryStatus,
  onCancelIntent,
  onOpenRefund
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="bg-[#0c0e12] border-b border-[#222834] text-slate-400 uppercase text-[10px]">
              <th className="p-3">Intent Number</th>
              <th className="p-3">Date</th>
              <th className="p-3">Method</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Linked Order</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3">Provider Ref / Receipt</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834]">
            {filteredIntents.length === 0 ? (
              <tr>
                <td colSpan="9" className="p-12 text-center text-slate-500 font-mono text-xs">
                  No payment intents found matching filters.
                </td>
              </tr>
            ) : (
              filteredIntents.map((it) => (
                <tr key={it.id} className="hover:bg-[#161c28]/60 transition-colors">
                  <td className="p-3">
                    <span
                      onClick={() => onViewIntent(it)}
                      className="font-bold text-white hover:text-amber-300 cursor-pointer block truncate"
                    >
                      {it.intent_number}
                    </span>
                    {it.idempotency_key && (
                      <span className="text-[9px] text-slate-500 block truncate font-mono">
                        IDEMP: {it.idempotency_key.substring(0, 16)}...
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-400 whitespace-nowrap text-[11px]">
                    {new Date(it.created_at).toLocaleDateString('en-KE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="p-3">{renderPaymentMethodBadge(it.payment_method)}</td>
                  <td className="p-3">
                    <span className="font-medium text-slate-200 block truncate max-w-[130px]">
                      {it.customer_name || 'Walk-in'}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">{it.phone_number}</span>
                  </td>
                  <td className="p-3">
                    {it.order_number ? (
                      <span className="text-amber-300 font-semibold">{it.order_number}</span>
                    ) : it.sale_number ? (
                      <span className="text-blue-300">{it.sale_number}</span>
                    ) : (
                      <span className="text-slate-600">&mdash;</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">
                    {api.formatKES(it.amount)}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${getPaymentStatusBadge(
                        it.status
                      )}`}
                    >
                      {it.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 text-[11px] truncate max-w-[160px]">
                    {it.external_reference ? (
                      <span className="text-emerald-400 font-bold block truncate">
                        RC: {it.external_reference}
                      </span>
                    ) : it.provider_reference ? (
                      <span className="text-slate-400 block truncate">
                        {it.provider_reference.substring(0, 18)}...
                      </span>
                    ) : (
                      <span className="text-slate-600">&mdash;</span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onViewIntent(it)}
                        className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 hover:text-white border border-[#222834] cursor-pointer"
                        title="View Intent & Audit Trail"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {it.status === 'PROCESSING' && (
                        <button
                          onClick={() => onQueryStatus(it.id)}
                          className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-amber-400 hover:text-amber-300 border border-[#222834] cursor-pointer"
                          title="Query Provider Status"
                        >
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        </button>
                      )}

                      {['PENDING', 'PROCESSING'].includes(it.status) && (
                        <button
                          onClick={() => onCancelIntent(it.id)}
                          className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-rose-400 hover:text-rose-300 border border-[#222834] cursor-pointer"
                          title="Cancel Intent"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {it.status === 'SUCCESS' && (
                        <button
                          onClick={() => onOpenRefund(it)}
                          className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-rose-400 hover:text-rose-300 border border-[#222834] cursor-pointer"
                          title="Refund Payment"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
