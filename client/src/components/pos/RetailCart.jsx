import React from 'react';
import {
  PauseCircle,
  Trash2,
  UserCheck,
  X,
  AlertTriangle,
  ShoppingCart,
  Minus,
  Plus,
  Percent,
  Banknote,
  Smartphone,
  CreditCard,
  Split,
} from 'lucide-react';
import { api } from '../../services/api.js';

export function RetailCart({
  activeShift,
  selectedBranch,
  user,
  heldCarts,
  onOpenHeldCarts,
  onHoldCart,
  onClearCart,
  selectedCustomer,
  setSelectedCustomer,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerSearch,
  setCustomerSearch,
  customerDropdownOpen,
  setCustomerDropdownOpen,
  customerOptions,
  setMpesaPhone,
  items,
  onUpdateQty,
  totals,
  discountPercent,
  setDiscountPercent,
  onOpenCash,
  onOpenMpesa,
  onCompleteSale,
  onOpenSplit,
}) {
  return (
        <div className="w-full lg:w-96 flex flex-col bg-[#12161f] border border-[#222834] rounded p-4 shadow-xl">
          {/* Register Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <h2 className="text-xs font-bold text-white uppercase tracking-widest font-mono">
                REGISTER // {selectedBranch ? `${selectedBranch.code}` : (user?.branch_code || 'T-01')}
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (heldCarts.length > 0) {
                    onOpenHeldCarts();
                  } else {
                    onHoldCart();
                  }
                }}
                title={heldCarts.length > 0 ? 'View Held Carts' : 'Hold Active Cart'}
                className="px-2 py-1 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[10px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <PauseCircle className="w-3 h-3 text-amber-400" />
                <span>HOLD {heldCarts.length > 0 ? `(${heldCarts.length})` : ''}</span>
              </button>
              <button
                onClick={onClearCart}
                title="Clear Cart"
                className="px-2 py-1 rounded bg-[#161c28] hover:bg-rose-950/40 border border-[#222834] hover:border-rose-900/60 text-[10px] font-mono text-slate-300 hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>CLEAR</span>
              </button>
            </div>
          </div>

          {/* Customer CRM Data Instrument */}
          <div className="py-2.5 border-b border-[#222834] space-y-2 text-xs font-sans relative">
            {selectedCustomer ? (
              <div className={`p-2 rounded border ${
                selectedCustomer.status === 'BLOCKED' || selectedCustomer.status === 'SUSPENDED'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-bold text-white text-xs truncate max-w-[150px]">{selectedCustomer.full_name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/40 text-gray-300 border border-gray-700">
                      {selectedCustomer.customer_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase ${
                      selectedCustomer.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {selectedCustomer.status}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerName('');
                        setCustomerPhone('');
                      }}
                      className="p-0.5 text-gray-400 hover:text-white rounded"
                      title="Unlink Customer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                  <span>{selectedCustomer.phone}</span>
                  <span>{selectedCustomer.city || '—'}</span>
                </div>
                {(selectedCustomer.status === 'BLOCKED' || selectedCustomer.status === 'SUSPENDED') && (
                  <div className="mt-1.5 text-[10px] text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Checkout Blocked: Customer is {selectedCustomer.status}</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search existing customer or enter name..."
                    value={customerSearch || customerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerSearch(val);
                      setCustomerName(val);
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400 font-sans"
                  />

                  {customerDropdownOpen && customerOptions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {customerOptions.map((cust) => (
                        <div
                          key={cust.id}
                          onClick={() => {
                            setSelectedCustomer(cust);
                            setCustomerName(cust.full_name);
                            setCustomerPhone(cust.phone);
                            if (cust.phone) setMpesaPhone(cust.phone.replace(/[^0-9]/g, ''));
                            setCustomerDropdownOpen(false);
                            setCustomerSearch('');
                          }}
                          className="px-3 py-2 hover:bg-gray-800 cursor-pointer border-b border-gray-800/60 last:border-0 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-white text-xs">{cust.full_name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{cust.phone} • {cust.customer_number}</p>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            cust.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {cust.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Phone (e.g. +254...)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center text-[10px] text-gray-400 px-1 font-mono">
                    <span>{customerName ? 'Manual Customer' : 'Walk-in (Default)'}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Cart Item Matrix */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
            {items.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs font-mono">
                <ShoppingCart className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                <span>REGISTER EMPTY // SELECT ITEMS OR SCAN</span>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.product.id}
                  className="p-2.5 rounded bg-[#0c0e12] border border-[#222834] flex items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-white truncate">{item.product.name}</h5>
                    <div className="text-slate-400 font-mono text-[10px] tabular-nums mt-0.5">
                      {api.formatKES(item.product.price ?? item.product.selling_price ?? 0)} @ unit
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#141822] border border-[#222834] rounded px-1 py-0.5">
                    <button
                      onClick={() => onUpdateQty(item.product.id, item.quantity - 1)}
                      className="w-5 h-5 rounded hover:bg-[#222834] text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="font-mono font-bold text-white text-xs w-4 text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQty(item.product.id, item.quantity + 1)}
                      className="w-5 h-5 rounded hover:bg-[#222834] text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  <div className="text-right font-mono font-bold text-emerald-400 min-w-[70px] tabular-nums">
                    {api.formatKES((item.product.price ?? item.product.selling_price ?? 0) * item.quantity)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Calculation Summary Strip */}
          <div className="pt-3 border-t border-[#222834] space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>SUBTOTAL ({totals.itemCount} ITEMS):</span>
              <span className="text-white tabular-nums">{api.formatKES(totals.rawSubtotal)}</span>
            </div>

            {/* Discount Selector */}
            <div className="flex items-center justify-between text-slate-400 py-0.5">
              <span className="flex items-center gap-1">
                <Percent className="w-3 h-3 text-amber-400" /> DISCOUNT:
              </span>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiscountPercent(d)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer border ${
                      discountPercent === d
                        ? 'bg-amber-400 text-slate-950 font-bold border-amber-400'
                        : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-white'
                    }`}
                  >
                    {d}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between text-slate-400">
              <span>KRA VAT (16%):</span>
              <span className="text-white tabular-nums">{api.formatKES(totals.vatAmount)}</span>
            </div>

            {/* TOTAL DISPLAY INSTRUMENT */}
            <div className="pt-2 border-t border-[#222834] flex justify-between items-baseline bg-[#0c0e12] p-2.5 rounded border">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">TOTAL DUE</span>
              <span className="text-xl font-black text-emerald-400 font-mono tabular-nums">
                {api.formatKES(totals.grandTotal)}
              </span>
            </div>
          </div>

          {/* Tender Trigger Console (Cash, M-Pesa, Card, Bank, Split) */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (items.length === 0) return;
                onOpenCash()
              }}
              disabled={items.length === 0 || !activeShift}
              className="py-2.5 px-2 rounded bg-[#161c28] hover:bg-[#222b3d] disabled:opacity-40 text-white font-mono font-semibold text-xs flex items-center justify-center gap-1.5 border border-[#2b3548] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Banknote className="w-4 h-4 text-emerald-400" />
              <span>[1] CASH</span>
            </button>

            <button
              onClick={() => {
                if (items.length === 0) return;
                onOpenMpesa()
              }}
              disabled={items.length === 0 || !activeShift}
              className="py-2.5 px-2 rounded bg-[#10b981]/15 hover:bg-[#10b981]/25 disabled:opacity-40 text-emerald-300 font-mono font-bold text-xs flex items-center justify-center gap-1.5 border border-[#10b981]/40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>[2] M-PESA</span>
            </button>

            <button
              onClick={() => onCompleteSale('CARD', `CRD-${Date.now()}`)}
              disabled={items.length === 0 || !activeShift}
              className="py-2 px-2 rounded bg-[#161c28] hover:bg-[#202738] disabled:opacity-40 text-slate-200 font-mono text-[11px] flex items-center justify-center gap-1.5 border border-[#222834] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <CreditCard className="w-3.5 h-3.5 text-blue-400" />
              <span>[3] CARD</span>
            </button>

            <button
              onClick={() => {
                onOpenSplit()
              }}
              disabled={items.length === 0 || !activeShift}
              className="py-2 px-2 rounded bg-[#161c28] hover:bg-[#202738] disabled:opacity-40 text-slate-200 font-mono text-[11px] flex items-center justify-center gap-1.5 border border-[#222834] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Split className="w-3.5 h-3.5 text-amber-400" />
              <span>[4] SPLIT PAY</span>
            </button>
          </div>
        </div>
  );
}
