// client/src/components/audit/AuditFilters.jsx
import React from 'react';
import { Search, X } from 'lucide-react';
import { sound } from '../../services/sound.js';

export function AuditFilters({
  searchQuery,
  setSearchQuery,
  actionFilter,
  setActionFilter,
  resourceFilter,
  setResourceFilter,
  timeFilter,
  setTimeFilter,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-3 flex flex-col lg:flex-row items-center justify-between gap-3">
      {/* Search Input */}
      <div className="relative w-full lg:w-80">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search action, resource, operator, reason, IP..."
          className="w-full bg-[#181d28] border border-[#222834] rounded pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdowns & Filters */}
      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
        {/* Action Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
            ACTION:
          </span>
          <select
            value={actionFilter}
            onChange={(e) => {
              sound.playScan();
              setActionFilter(e.target.value);
            }}
            className="bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">ALL ACTIONS</option>
            <option value="POS_SALE">POS_SALE</option>
            <option value="APPROVE_REFUND">APPROVE_REFUND</option>
            <option value="REJECT_REFUND">REJECT_REFUND</option>
            <option value="ASSIGN_DRIVER">ASSIGN_DRIVER</option>
            <option value="COMPLETE_DELIVERY_POD">COMPLETE_DELIVERY_POD</option>
            <option value="ADJUST_STOCK">ADJUST_STOCK</option>
            <option value="TRANSFER_STOCK_DISPATCH">TRANSFER_STOCK_DISPATCH</option>
            <option value="APPROVE_TRANSFER">APPROVE_TRANSFER</option>
            <option value="SUBMIT_EXPENSE">SUBMIT_EXPENSE</option>
            <option value="APPROVE_EXPENSE">APPROVE_EXPENSE</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
          </select>
        </div>

        {/* Resource Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
            RESOURCE:
          </span>
          <select
            value={resourceFilter}
            onChange={(e) => {
              sound.playScan();
              setResourceFilter(e.target.value);
            }}
            className="bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">ALL RESOURCES</option>
            <option value="ORDER">ORDER</option>
            <option value="INVENTORY">INVENTORY</option>
            <option value="USER">USER</option>
            <option value="BRANCH">BRANCH</option>
            <option value="WAREHOUSE">WAREHOUSE</option>
            <option value="EXPENSE">EXPENSE</option>
            <option value="REFUND">REFUND</option>
            <option value="DELIVERY">DELIVERY</option>
          </select>
        </div>

        {/* Time Filter Preset */}
        <div className="flex items-center bg-[#181d28] border border-[#222834] rounded p-0.5 text-[11px] font-mono">
          <button
            onClick={() => {
              sound.playScan();
              setTimeFilter('ALL');
            }}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              timeFilter === 'ALL'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => {
              sound.playScan();
              setTimeFilter('TODAY');
            }}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              timeFilter === 'TODAY'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            TODAY
          </button>
          <button
            onClick={() => {
              sound.playScan();
              setTimeFilter('WEEK');
            }}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              timeFilter === 'WEEK'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            7 DAYS
          </button>
        </div>
      </div>
    </div>
  );
}
