import React from 'react';
import { ShieldCheck, X, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.js';

export function PaymentReconciliationModal({
  isOpen,
  onClose,
  onRunReconciliation,
  reconciling,
  reconciliationResults
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 select-none overflow-y-auto">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-lg w-full shadow-2xl p-5 space-y-4 my-auto text-xs font-mono">
        <div className="flex items-center justify-between border-b border-[#222834] pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-white text-sm">PAYMENT RECONCILIATION ENGINE</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-400 text-[11px] font-sans">
          Evaluates payments ledger against recorded intents and provider verification references.
        </p>

        <button
          onClick={onRunReconciliation}
          disabled={reconciling}
          className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {reconciling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
          <span>RUN AUTOMATED RECONCILIATION</span>
        </button>

        {reconciliationResults && (
          <div className="space-y-3 pt-2 border-t border-[#222834]">
            <div className="grid grid-cols-3 gap-2 bg-[#0c0e12] p-3 rounded border border-[#222834]">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Evaluated</span>
                <span className="text-base font-bold text-white">{reconciliationResults.total_evaluated}</span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-500 block uppercase">Matched</span>
                <span className="text-base font-bold text-emerald-400">{reconciliationResults.matched_count}</span>
              </div>
              <div>
                <span className="text-[10px] text-amber-500 block uppercase">Discrepancies</span>
                <span className="text-base font-bold text-amber-400">{reconciliationResults.discrepancies_count}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase mb-1">Reconciled Volume</span>
              <span className="text-base font-bold text-emerald-300 font-mono">
                {api.formatKES(reconciliationResults.reconciled_volume)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
