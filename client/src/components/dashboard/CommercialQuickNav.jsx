import React from 'react';
import { Receipt, Truck, Package, BarChart2 } from 'lucide-react';

export function CommercialQuickNav({ onNavigate }) {
  if (!onNavigate) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      <button
        onClick={() => onNavigate('pos')}
        className="p-3 bg-[#141822] hover:bg-[#1b2230] border border-[#222834] hover:border-[#38455e] rounded text-left transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-400 transition-colors">
            [1] POS TERMINAL
          </span>
          <Receipt className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
        </div>
        <div className="mt-1 text-xs font-semibold text-white">Fast Walk-in Sale</div>
      </button>

      <button
        onClick={() => onNavigate('dispatch')}
        className="p-3 bg-[#141822] hover:bg-[#1b2230] border border-[#222834] hover:border-[#38455e] rounded text-left transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-400 transition-colors">
            [2] FLEET DISPATCH
          </span>
          <Truck className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
        </div>
        <div className="mt-1 text-xs font-semibold text-white">Allocate Trips & POD</div>
      </button>

      <button
        onClick={() => onNavigate('inventory')}
        className="p-3 bg-[#141822] hover:bg-[#1b2230] border border-[#222834] hover:border-[#38455e] rounded text-left transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-400 transition-colors">
            [3] INVENTORY MGR
          </span>
          <Package className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
        </div>
        <div className="mt-1 text-xs font-semibold text-white">Reorder & Stock Balance</div>
      </button>

      <button
        onClick={() => onNavigate('reports')}
        className="p-3 bg-[#141822] hover:bg-[#1b2230] border border-[#222834] hover:border-[#38455e] rounded text-left transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-400 transition-colors">
            [4] AUDIT & REPORTS
          </span>
          <BarChart2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
        </div>
        <div className="mt-1 text-xs font-semibold text-white">P&L and KRA Schedule</div>
      </button>
    </div>
  );
}
