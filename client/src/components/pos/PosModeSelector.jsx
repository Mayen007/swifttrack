import React from 'react';
import { Package, ShoppingCart } from 'lucide-react';

export function PosModeSelector({
  posMode,
  setPosMode,
}) {
  return (
      <div className="flex items-center gap-2 border-b border-[#2a3447] pb-2 shrink-0">
        <button
          type="button"
          onClick={() => setPosMode('PARCEL')}
          className={`px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            posMode === 'PARCEL'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-1 ring-blue-400 border border-blue-400'
              : 'bg-[#121622] text-slate-300 dark:text-slate-400 hover:text-white border border-[#2a3447] hover:border-blue-500/40'
          }`}
        >
          <Package className={`w-4 h-4 ${posMode === 'PARCEL' ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`} />
          <span>PARCEL COUNTER INTAKE & WAYBILLS</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase border transition-all ${
              posMode === 'PARCEL'
                ? 'bg-blue-700/80 text-white border-blue-300/60 shadow-xs'
                : 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/50 dark:border-blue-400/60'
            }`}
          >
            LOGISTICS
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPosMode('RETAIL')}
          className={`px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            posMode === 'RETAIL'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/25 font-black border border-amber-300'
              : 'bg-[#121622] text-slate-300 dark:text-slate-400 hover:text-white border border-[#2a3447] hover:border-amber-500/40'
          }`}
        >
          <ShoppingCart className={`w-4 h-4 ${posMode === 'RETAIL' ? 'text-slate-950' : 'text-amber-500 dark:text-amber-400'}`} />
          <span>RETAIL POS & PACKAGING SUPPLIES</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase border transition-all ${
              posMode === 'RETAIL'
                ? 'bg-amber-500/30 text-amber-950 border-amber-600/50 shadow-xs'
                : 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/50 dark:border-amber-400/60'
            }`}
          >
            RETAIL
          </span>
        </button>
      </div>
  );
}
