// client/src/components/branches/BranchFilters.jsx
import React from 'react';
import { Search, X } from 'lucide-react';
import { sound } from '../../services/sound.js';

export function BranchFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  totalHubs,
  activeHubs,
  lastSyncTime,
}) {
  const inactiveCount = totalHubs - activeHubs;

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-3 flex flex-col md:flex-row items-center justify-between gap-3">
      {/* Search input */}
      <div className="relative w-full md:w-96">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by hub code, facility name, city, address..."
          className="w-full bg-[#181d28] border border-[#222834] rounded pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter chips & sync telemetry */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
        <div className="flex items-center bg-[#181d28] border border-[#222834] rounded p-0.5 text-[11px] font-mono">
          <button
            onClick={() => {
              sound.playScan();
              setStatusFilter('ALL');
            }}
            className={`px-2.5 py-1 rounded transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ALL HUBS ({totalHubs})
          </button>
          <button
            onClick={() => {
              sound.playScan();
              setStatusFilter('ACTIVE');
            }}
            className={`px-2.5 py-1 rounded transition-colors ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ACTIVE ({activeHubs})
          </button>
          {inactiveCount > 0 && (
            <button
              onClick={() => {
                sound.playScan();
                setStatusFilter('INACTIVE');
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'INACTIVE'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              OFFLINE ({inactiveCount})
            </button>
          )}
        </div>

        {lastSyncTime && (
          <span className="hidden lg:inline-flex items-center gap-1 font-mono text-[10px] text-slate-400 pl-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            SYNC: {lastSyncTime} EAT
          </span>
        )}
      </div>
    </div>
  );
}
