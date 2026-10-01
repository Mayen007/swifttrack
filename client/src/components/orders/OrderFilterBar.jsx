import React from 'react';
import { Filter, Search } from 'lucide-react';
import { PIPELINE_STATUS_FILTERS } from './constants.js';

export function OrderFilterBar({
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  searchInputRef,
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-[#1b212c]">
        <span className="text-[10px] font-mono text-slate-500 uppercase mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" /> PIPELINE:
        </span>
        {PIPELINE_STATUS_FILTERS.map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer border ${
              statusFilter === st
                ? 'bg-amber-400 text-slate-950 font-bold border-amber-400'
                : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-white'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search orders by order number, customer name, phone, or delivery number... (Press F2)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-14 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-500 text-xs font-sans focus:outline-none focus:border-amber-400"
        />
        <span className="absolute right-2.5 top-2 text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#141822]">
          F2
        </span>
      </div>
    </>
  );
}
