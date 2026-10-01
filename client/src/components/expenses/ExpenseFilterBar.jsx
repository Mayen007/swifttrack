import React from 'react';
import { Search, X } from 'lucide-react';
import { sound } from '../../services/sound.js';

export function ExpenseFilterBar({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedMethod,
  setSelectedMethod,
  selectedStatus,
  setSelectedStatus,
  searchInputRef,
  onReset
}) {
  const isFiltered = searchQuery || selectedCategory !== 'ALL' || selectedMethod !== 'ALL' || selectedStatus !== 'ALL';

  return (
    <div className="pt-2 border-t border-[#222834] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search voucher #, merchant, description, staff... [F2]"
          className="w-full pl-8 pr-8 py-1.5 bg-[#0c0e12] border border-[#222834] focus:border-emerald-500/60 rounded text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-2">
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            sound.playScan();
          }}
          className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="ALL">ALL CATEGORIES</option>
          <option value="Fuel">FUEL</option>
          <option value="Maintenance">FLEET MAINTENANCE</option>
          <option value="Packaging">PACKAGING & BOXES</option>
          <option value="Utilities">UTILITIES & POWER</option>
          <option value="Sundry">SUNDRY & WELFARE</option>
        </select>

        <select
          value={selectedMethod}
          onChange={(e) => {
            setSelectedMethod(e.target.value);
            sound.playScan();
          }}
          className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="ALL">ALL TENDERS</option>
          <option value="CASH">PETTY CASH</option>
          <option value="MPESA">M-PESA PAYBILL</option>
          <option value="CARD">CORPORATE CARD</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            sound.playScan();
          }}
          className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="ALL">ALL STATUSES</option>
          <option value="APPROVED">APPROVED / CLEARED</option>
          <option value="PENDING_APPROVAL">PENDING APPROVAL</option>
        </select>

        {isFiltered && (
          <button
            onClick={onReset}
            className="px-2 py-1.5 rounded bg-[#181d28] hover:bg-rose-500/20 border border-[#222834] hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-[10px] font-mono cursor-pointer transition-colors"
          >
            RESET
          </button>
        )}
      </div>
    </div>
  );
}
