import React from 'react';
import { CreditCard, X, Check, ChevronRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api.js';
import { PAYMENT_STATUS_STEPS, getPaymentStatusBadge } from './constants.jsx';

export function PaymentDetailModal({
  isOpen,
  selectedIntent,
  detailTab,
  setDetailTab,
  onClose,
  onQueryStatus,
  onCancelIntent,
  onOpenRefund
}) {
  if (!isOpen || !selectedIntent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 select-none overflow-y-auto">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-3xl w-full shadow-2xl p-5 space-y-4 my-auto text-xs font-mono">
        <div className="flex items-center justify-between border-b border-[#222834] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white text-sm">{selectedIntent.intent_number}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPaymentStatusBadge(selectedIntent.status)}`}>
                  {selectedIntent.status}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-sans">
                Channel: <span className="text-slate-200 font-bold">{selectedIntent.payment_method}</span> | Branch: {selectedIntent.branch_name}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-[#0c0e12] border border-[#222834] rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            {PAYMENT_STATUS_STEPS.map((st, idx) => {
              const isCurrent = selectedIntent.status === st.key;
              const isCompleted =
                selectedIntent.status === 'SUCCESS' ||
                (st.key === 'PENDING' && ['PROCESSING', 'SUCCESS'].includes(selectedIntent.status));
              return (
                <div key={st.key} className="flex items-center gap-1.5">
                  <div
                    className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 border ${
                      isCurrent
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-[#161c28] text-slate-500 border-[#222834]'
                    }`}
                  >
                    {isCompleted && <Check className="w-3 h-3 text-emerald-400" />}
                    <span>{st.label}</span>
                  </div>
                  {idx < PAYMENT_STATUS_STEPS.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            {selectedIntent.status === 'PROCESSING' && (
              <button
                onClick={() => onQueryStatus(selectedIntent.id)}
                className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>QUERY STATUS</span>
              </button>
            )}
            {['PENDING', 'PROCESSING'].includes(selectedIntent.status) && (
              <button
                onClick={() => onCancelIntent(selectedIntent.id)}
                className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-bold cursor-pointer"
              >
                CANCEL
              </button>
            )}
            {selectedIntent.status === 'SUCCESS' && (
              <button
                onClick={() => onOpenRefund(selectedIntent)}
                className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-bold cursor-pointer"
              >
                REFUND
              </button>
            )}
          </div>
        </div>

        <div className="flex border-b border-[#222834] gap-2 pt-1">
          {[
            { key: 'details', label: 'Settlement Details' },
            { key: 'callbacks', label: `Provider Callbacks (${selectedIntent.callbacks?.length || 0})` },
            { key: 'timeline', label: `Audit Trail (${selectedIntent.audit_trail?.length || 0})` },
            { key: 'ledger', label: `Payments Ledger (${selectedIntent.payments?.length || 0})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setDetailTab(t.key)}
              className={`px-3 py-1.5 text-xs font-mono font-bold border-b-2 transition-colors cursor-pointer ${
                detailTab === t.key
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {detailTab === 'details' && (
          <div className="grid grid-cols-2 gap-3 bg-[#0c0e12] p-4 rounded border border-[#222834]">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Total Amount</span>
              <span className="text-base font-bold text-emerald-400">{api.formatKES(selectedIntent.amount)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Idempotency Key</span>
              <span className="text-slate-300 font-mono text-[11px] truncate block">
                {selectedIntent.idempotency_key || 'None assigned'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Provider Reference</span>
              <span className="text-slate-200 font-mono text-[11px] truncate block">
                {selectedIntent.provider_reference || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">External Receipt / Voucher</span>
              <span className="text-emerald-400 font-mono font-bold text-[11px] truncate block">
                {selectedIntent.external_reference || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Customer</span>
              <span className="text-slate-200 block truncate">
                {selectedIntent.customer_name || 'Walk-in'} ({selectedIntent.phone_number || 'N/A'})
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Created At</span>
              <span className="text-slate-400 font-mono text-[11px]">
                {new Date(selectedIntent.created_at).toLocaleString('en-KE')}
              </span>
            </div>
            {selectedIntent.failure_reason && (
              <div className="col-span-2 p-2 rounded bg-rose-950/30 border border-rose-800/40 text-rose-300">
                <span className="font-bold block">Failure / Exception Reason:</span>
                <span>{selectedIntent.failure_reason}</span>
              </div>
            )}
          </div>
        )}

        {detailTab === 'callbacks' && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(!selectedIntent.callbacks || selectedIntent.callbacks.length === 0) ? (
              <div className="p-8 text-center text-slate-500 font-mono">No provider webhook callbacks recorded yet.</div>
            ) : (
              selectedIntent.callbacks.map((cb) => (
                <div key={cb.id} className="bg-[#0c0e12] border border-[#222834] rounded p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400 font-bold">{cb.provider} Webhook Callback</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(cb.created_at).toLocaleTimeString('en-KE')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-sans">
                    Result: <span className="font-bold text-white">{cb.result_description || 'Accepted'}</span> (Code: {cb.result_code})
                  </div>
                  <pre className="p-2 rounded bg-[#161c28] text-[10px] font-mono text-emerald-300 overflow-x-auto max-h-32">
                    {cb.raw_payload}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {detailTab === 'timeline' && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(!selectedIntent.audit_trail || selectedIntent.audit_trail.length === 0) ? (
              <div className="p-8 text-center text-slate-500 font-mono">No audit trail entries recorded.</div>
            ) : (
              selectedIntent.audit_trail.map((item) => (
                <div key={item.id} className="bg-[#0c0e12] border border-[#222834] rounded p-2.5 flex items-start gap-3">
                  <div className="w-6 h-6 rounded bg-[#161c28] flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">
                        {item.from_status ? `${item.from_status} → ${item.to_status}` : item.to_status}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.created_at).toLocaleTimeString('en-KE')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans mt-0.5">{item.details}</p>
                    <span className="text-[9px] text-slate-500 block mt-1 font-mono">
                      ACTOR: {item.actor_type} ({item.actor_id})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {detailTab === 'ledger' && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(!selectedIntent.payments || selectedIntent.payments.length === 0) ? (
              <div className="p-8 text-center text-slate-500 font-mono">No completed ledger payments tied to this intent yet.</div>
            ) : (
              selectedIntent.payments.map((p) => (
                <div key={p.id} className="bg-[#0c0e12] border border-[#222834] rounded p-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">{p.payment_number}</span>
                    <span className="text-[11px] text-slate-400 font-sans">
                      Method: {p.payment_method} | Cashier: {p.cashier_name || 'System'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400 block">{api.formatKES(p.amount)}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getPaymentStatusBadge(p.status)}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
