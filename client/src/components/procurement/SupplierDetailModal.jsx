import React, { useState } from 'react';
import {
  Building2,
  X
} from 'lucide-react';

export function SupplierDetailModal({ supplier, onClose, onRefresh, productsList }) {
  const [subTab, setSubTab] = useState('scorecard'); // 'scorecard', 'contacts', 'products', 'history'
  const perf = supplier.performance || {};
  const history = supplier.history || [];
  const contacts = supplier.contacts || [];
  const products = supplier.products || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              {supplier.name}
              <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {supplier.code}
              </span>
            </h3>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              KRA PIN: {supplier.tax_pin || 'N/A'} • Payment Terms: {supplier.payment_terms}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="px-6 py-2 border-b border-slate-800 flex gap-2 bg-slate-900/40">
          {[
            { id: 'scorecard', label: 'Performance Scorecard' },
            { id: 'contacts', label: `Contacts (${contacts.length})` },
            { id: 'products', label: `Contracted Products (${products.length})` },
            { id: 'history', label: `Timeline (${history.length})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                subTab === t.id ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6 overflow-y-auto flex-1">
          {subTab === 'scorecard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Fulfillment Accuracy</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{perf.fulfillment_rate || 100}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Received vs Ordered</div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Quality Pass Rate</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{perf.quality_pass_rate || 100}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Goods in usable condition</div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Total Settled</div>
                  <div className="text-xl font-bold font-mono text-white mt-1 truncate">
                    KES {(perf.total_paid || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Disbursed via Bank/M-Pesa</div>
                </div>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="text-slate-300 font-bold font-sans">Banking & Settlement Profile:</div>
                <div className="text-slate-400">Bank: <span className="text-white">{supplier.bank_name || 'N/A'}</span></div>
                <div className="text-slate-400">Account: <span className="text-white">{supplier.bank_account_no || 'N/A'}</span></div>
                <div className="text-slate-400">M-Pesa Paybill: <span className="text-white">{supplier.mpesa_paybill || 'N/A'}</span></div>
                <div className="text-slate-400">Lead Time: <span className="text-white">{supplier.lead_time_days || 3} days</span></div>
              </div>
            </div>
          )}

          {subTab === 'contacts' && (
            <div className="space-y-3">
              {contacts.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">No contacts listed.</div>
              ) : (
                contacts.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-xs flex items-center gap-2">
                        {c.name}
                        {c.is_primary === 1 && (
                          <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] rounded font-mono">PRIMARY</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{c.role || 'Sales Rep'}</div>
                    </div>
                    <div className="text-right text-xs font-mono text-slate-300">
                      <div>{c.phone}</div>
                      <div className="text-slate-500 text-[10px]">{c.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {subTab === 'products' && (
            <div className="space-y-2">
              {products.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">No contracted products assigned.</div>
              ) : (
                products.map((p) => (
                  <div key={p.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-semibold text-white font-sans">{p.product_name}</div>
                      <div className="text-slate-500 text-[10px]">SKU: {p.sku} | Vendor SKU: {p.supplier_sku || 'N/A'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-amber-400 font-bold">KES {Number(p.agreed_cost).toLocaleString()}</div>
                      <div className="text-slate-500 text-[10px]">Min Qty: {p.min_order_quantity}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {subTab === 'history' && (
            <div className="space-y-2">
              {history.map((ev, i) => (
                <div key={i} className="p-2.5 bg-slate-900/40 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold">{ev.type}</span>
                    <span className="text-white font-sans">{ev.title}</span>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    {new Date(ev.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

