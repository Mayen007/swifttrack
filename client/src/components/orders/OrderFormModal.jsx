import React from 'react';
import { Search, X, ShoppingBag, Plus, Trash2, Phone } from 'lucide-react';
import { api } from '../../services/api.js';

export function OrderFormModal({
  isOpen,
  onClose,
  formMode,
  editingOrderId,
  catalogProducts,
  formCustomerId,
  setFormCustomerId,
  formCustomerSearch,
  setFormCustomerSearch,
  formCustomerOptions,
  setFormCustomerOptions,
  formCustomerDropdown,
  setFormCustomerDropdown,
  formSelectedCustomer,
  setFormSelectedCustomer,
  formDeliveryAddress,
  setFormDeliveryAddress,
  formDeliveryCity,
  setFormDeliveryCity,
  formRecipientName,
  setFormRecipientName,
  formRecipientPhone,
  setFormRecipientPhone,
  formDeliveryFee,
  setFormDeliveryFee,
  formSpecialInstructions,
  setFormSpecialInstructions,
  formItems,
  setFormItems,
  formSubmitting,
  formSubtotal,
  formTotal,
  onSubmitOrder,
}) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 select-none overflow-y-auto">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-2xl w-full shadow-2xl relative my-auto animate-in fade-in duration-150 text-xs font-mono">
            <div className="p-4 border-b border-[#222834] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase">
                  {formMode === 'create' ? 'CREATE NEW ORDER' : `EDIT ORDER #${editingOrderId}`}
                </h3>
              </div>
              <button onClick={() => onClose()} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Customer Selector */}
              <div className="space-y-1 relative">
                <label className="text-[10px] uppercase text-slate-400 block font-bold">1. CUSTOMER PROFILE *</label>
                {formSelectedCustomer ? (
                  <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">{formSelectedCustomer.full_name}</span>
                      <span className="text-slate-400 ml-2 font-mono text-[11px]">{formSelectedCustomer.phone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormSelectedCustomer(null);
                        setFormCustomerId('');
                        setFormCustomerSearch('');
                      }}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Search existing customer by name, phone, or number..."
                      value={formCustomerSearch}
                      onChange={(e) => {
                        setFormCustomerSearch(e.target.value);
                        setFormCustomerDropdown(true);
                      }}
                      onFocus={() => setFormCustomerDropdown(true)}
                      className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400"
                    />
                    {formCustomerDropdown && formCustomerOptions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-gray-900 border border-gray-700 rounded shadow-2xl max-h-40 overflow-y-auto">
                        {formCustomerOptions.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setFormSelectedCustomer(c);
                              setFormCustomerId(c.id);
                              setFormDeliveryAddress(c.address || '');
                              setFormDeliveryCity(c.city || '');
                              setFormRecipientName(c.full_name);
                              setFormRecipientPhone(c.phone);
                              setFormCustomerDropdown(false);
                            }}
                            className="p-2 hover:bg-gray-800 cursor-pointer border-b border-gray-800 text-xs flex justify-between"
                          >
                            <span className="font-bold text-white">{c.full_name}</span>
                            <span className="text-slate-400">{c.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Delivery Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded bg-[#0c0e12] border border-[#222834]">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={formDeliveryAddress}
                    onChange={(e) => setFormDeliveryAddress(e.target.value)}
                    placeholder="Street, Building, Unit"
                    className="w-full p-1.5 rounded bg-[#161c28] border border-[#222834] text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block mb-1">Delivery City</label>
                  <input
                    type="text"
                    value={formDeliveryCity}
                    onChange={(e) => setFormDeliveryCity(e.target.value)}
                    className="w-full p-1.5 rounded bg-[#161c28] border border-[#222834] text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block mb-1">Delivery Fee (KES)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formDeliveryFee}
                    onChange={(e) => setFormDeliveryFee(e.target.value)}
                    className="w-full p-1.5 rounded bg-[#161c28] border border-[#222834] text-emerald-400 font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block mb-1">Recipient Phone</label>
                  <input
                    type="text"
                    value={formRecipientPhone}
                    onChange={(e) => setFormRecipientPhone(e.target.value)}
                    placeholder="+254..."
                    className="w-full p-1.5 rounded bg-[#161c28] border border-[#222834] text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase text-slate-400 font-bold block">2. ORDER ITEMS</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (catalogProducts.length > 0) {
                        setFormItems([
                          ...formItems,
                          { product_id: catalogProducts[0].id, quantity: 1, unit_price: catalogProducts[0].selling_price },
                        ]);
                      }
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> ADD ITEM
                  </button>
                </div>

                <div className="space-y-2">
                  {formItems.map((it, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-[#0c0e12] border border-[#222834] flex items-center gap-2">
                      <select
                        value={it.product_id}
                        onChange={(e) => {
                          const pId = Number(e.target.value);
                          const p = catalogProducts.find((prod) => prod.id === pId);
                          setFormItems(
                            formItems.map((item, i) =>
                              i === idx ? { ...item, product_id: pId, unit_price: p?.selling_price || item.unit_price } : item
                            )
                          );
                        }}
                        className="flex-1 p-1.5 rounded bg-[#161c28] border border-[#222834] text-white text-xs"
                      >
                        {catalogProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({api.formatKES(p.selling_price)})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => {
                          const q = Math.max(1, Number(e.target.value) || 1);
                          setFormItems(formItems.map((item, i) => (i === idx ? { ...item, quantity: q } : item)));
                        }}
                        className="w-16 p-1.5 rounded bg-[#161c28] border border-[#222834] text-white text-center font-bold text-xs"
                      />

                      <span className="w-24 text-right font-bold text-emerald-400 tabular-nums">
                        {api.formatKES((Number(it.unit_price) || 0) * (Number(it.quantity) || 1))}
                      </span>

                      {formItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 rounded bg-[#0c0e12] border border-[#222834] flex justify-between items-baseline font-bold text-sm">
                <span className="text-slate-400">TOTAL DUE (INCL. DELIVERY):</span>
                <span className="text-emerald-400 text-base tabular-nums">{api.formatKES(formTotal)}</span>
              </div>
            </div>

            <div className="p-4 border-t border-[#222834] flex justify-end gap-2 bg-[#0c0e12]">
              <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 cursor-pointer"
              >
                CANCEL
              </button>

              {formMode === 'create' ? (
                <>
                  <button
                    type="button"
                    disabled={formSubmitting}
                    onClick={() => onSubmitOrder('DRAFT')}
                    className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    SAVE AS DRAFT
                  </button>
                  <button
                    type="button"
                    disabled={formSubmitting}
                    onClick={() => onSubmitOrder('CONFIRMED')}
                    className="px-4 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                  >
                    CONFIRM & RESERVE INVENTORY
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={() => onSubmitOrder()}
                  className="px-4 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  SAVE CHANGES
                </button>
              )}
            </div>
          </div>
        </div>
  );
}
