import React from 'react';
import { CreditCard, X, Zap, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.js';

export function InitiatePaymentModal({
  isOpen,
  onClose,
  onSubmit,
  formMethod,
  setFormMethod,
  formAmount,
  setFormAmount,
  formCustomerId,
  setFormCustomerId,
  formPhone,
  setFormPhone,
  formCardRef,
  setFormCardRef,
  formLast4,
  setFormLast4,
  formCashTendered,
  setFormCashTendered,
  formBankName,
  setFormBankName,
  formBankVoucher,
  setFormBankVoucher,
  formSubmitting,
  customersList
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 select-none overflow-y-auto">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-md w-full shadow-2xl p-5 space-y-4 my-auto text-xs font-mono">
        <div className="flex items-center justify-between border-b border-[#222834] pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm">INITIATE PAYMENT // GATEWAY</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-slate-400 text-[10px] uppercase block mb-1">Payment Method</label>
            <div className="grid grid-cols-4 gap-1.5">
              {['MPESA', 'CARD', 'CASH', 'BANK'].map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setFormMethod(m)}
                  className={`p-2 rounded text-center font-bold border transition-colors cursor-pointer ${
                    formMethod === m
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow'
                      : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase block mb-1">Amount (KES)</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 2500"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-emerald-400 font-bold text-base focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase block mb-1">Customer (Optional)</label>
            <select
              value={formCustomerId}
              onChange={(e) => {
                setFormCustomerId(e.target.value);
                const found = customersList.find((c) => String(c.id) === e.target.value);
                if (found && found.phone) setFormPhone(found.phone);
              }}
              className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 focus:border-amber-400 focus:outline-none text-xs"
            >
              <option value="">-- Walk-in Customer --</option>
              {customersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.phone || 'No phone'})
                </option>
              ))}
            </select>
          </div>

          {formMethod === 'MPESA' && (
            <div>
              <label className="text-slate-400 text-[10px] uppercase block mb-1">
                Customer M-Pesa Phone (2547XXXXXXXX or 07XXXXXXXX)
              </label>
              <input
                type="text"
                required
                placeholder="0712345678"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
              />
              <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1.5 font-medium">
                <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Lipa Na M-Pesa Online STK push will be triggered immediately.</span>
              </span>
            </div>
          )}

          {formMethod === 'CARD' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 text-[10px] uppercase block mb-1">Card Auth Reference</label>
                <input
                  type="text"
                  placeholder="AUTH-9912"
                  value={formCardRef}
                  onChange={(e) => setFormCardRef(e.target.value)}
                  className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 text-[10px] uppercase block mb-1">Last 4 Digits</label>
                <input
                  type="text"
                  maxLength="4"
                  placeholder="4242"
                  value={formLast4}
                  onChange={(e) => setFormLast4(e.target.value)}
                  className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {formMethod === 'CASH' && (
            <div>
              <label className="text-slate-400 text-[10px] uppercase block mb-1">Cash Tendered (KES)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Amount handed by customer"
                value={formCashTendered}
                onChange={(e) => setFormCashTendered(e.target.value)}
                className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
              />
              {Number(formCashTendered) > Number(formAmount) && (
                <span className="text-[11px] text-amber-400 font-bold block mt-1">
                  Change Due: {api.formatKES(Number(formCashTendered) - Number(formAmount))}
                </span>
              )}
            </div>
          )}

          {formMethod === 'BANK' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 text-[10px] uppercase block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formBankName}
                  onChange={(e) => setFormBankName(e.target.value)}
                  className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 text-[10px] uppercase block mb-1">Deposit Slip / Voucher</label>
                <input
                  type="text"
                  placeholder="VCH-12849"
                  value={formBankVoucher}
                  onChange={(e) => setFormBankVoucher(e.target.value)}
                  className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2 border-t border-[#222834]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 font-bold cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{formMethod === 'MPESA' ? 'DISPATCH STK PUSH' : 'CONFIRM & SETTLE'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
