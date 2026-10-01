import React from 'react';
import {
  Building2,
  Plus,
  Award,
  Phone,
  Mail
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function SuppliersTab({
  suppliers,
  searchQuery,
  isManagerOrAdmin,
  onAddSupplier,
  onViewSupplier
}) {
  const filteredSuppliers = suppliers.filter(s =>
    !searchQuery ||
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.tax_pin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Building2 className="w-4 h-4 text-amber-400" />
          Verified Supplier Directory & Governance
        </h2>
        {isManagerOrAdmin && (
          <button
            onClick={() => {
              sound.playClick();
              onAddSupplier();
            }}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Supplier
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-8 text-center text-slate-500 text-xs font-sans">
            No suppliers found. Click "Add Supplier" to onboard a new vendor.
          </div>
        ) : (
          filteredSuppliers.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-white text-sm">{s.name}</h3>
                    <div className="text-[11px] font-mono text-amber-400 mt-0.5">{s.code}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <Award className="w-3.5 h-3.5" /> {s.rating || 5.0}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-300 font-sans">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{s.phone}</span>
                  </div>
                  {s.email && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span>{s.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                    <span className="text-slate-500">KRA PIN:</span>
                    <span className="text-white">{s.tax_pin || 'NOT_REGISTERED'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-500">TERMS</div>
                  <div className="text-white font-medium">{s.payment_terms}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">ORDERS</div>
                  <div className="text-white font-medium">{s.total_orders || 0}</div>
                </div>
                <div>
                  <button
                    onClick={() => {
                      sound.playClick();
                      onViewSupplier(s);
                    }}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-sans font-medium text-xs border border-slate-700 transition-colors"
                  >
                    Profile & Scorecard
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
