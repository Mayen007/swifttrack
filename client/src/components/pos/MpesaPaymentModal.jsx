import React from 'react';
import { Smartphone, X, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.js';

export function MpesaPaymentModal({
  isOpen,
  onClose,
  totals,
  mpesaStep,
  mpesaPhone,
  setMpesaPhone,
  onInitiate,
  countdown,
}) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => onClose()}
              aria-label="Close modal"
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center">
              <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                M-Pesa STK Express Push
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                AMOUNT: <strong className="text-emerald-400 tabular-nums">{api.formatKES(totals.grandTotal)}</strong>
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {mpesaStep === 'idle' && (
                <>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                      Customer Safaricom Number
                    </label>
                    <input
                      type="text"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      placeholder="2547XXXXXXXX"
                      className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                      Target: Safaricom M-Pesa Daraja Gateway
                    </span>
                  </div>

                  <button
                    onClick={onInitiate}
                    className="w-full py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs transition-colors cursor-pointer"
                  >
                    SEND STK PROMPT
                  </button>
                </>
              )}

              {mpesaStep === 'pushing' && (
                <div className="py-6 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-mono text-emerald-400">Connecting Daraja Gateway...</p>
                </div>
              )}

              {mpesaStep === 'awaiting_pin' && (
                <div className="py-4 text-center space-y-3 font-mono">
                  <div className="text-xs text-slate-300 bg-[#0c0e12] border border-[#222834] p-3 rounded">
                    <p className="font-semibold text-white">Prompt transmitted to {mpesaPhone}</p>
                    <p className="text-slate-400 text-[11px] mt-1">Awaiting 4-digit PIN authentication on device...</p>
                  </div>
                  <div className="text-xs text-amber-400 animate-pulse tabular-nums">
                    CALLBACK TIMER: {countdown}s
                  </div>
                </div>
              )}

              {mpesaStep === 'success' && (
                <div className="py-4 text-center space-y-2 font-mono">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Payment Confirmed</h4>
                  <p className="text-[11px] text-slate-400">Rendering receipt ledger...</p>
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
