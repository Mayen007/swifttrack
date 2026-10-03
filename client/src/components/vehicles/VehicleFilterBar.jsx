import React from 'react';
import { Filter } from 'lucide-react';
import { VEHICLE_STATUS_OPTIONS, VEHICLE_TYPE_OPTIONS } from './constants.jsx';

export function VehicleFilterBar({
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  vehicles = []
}) {
  return (
    <div className="pt-3 border-t border-[#2a3447] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
      {/* Status Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 flex-nowrap sm:flex-wrap w-full md:w-auto">
        <span className="text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] mr-1 flex items-center gap-1 shrink-0">
          <Filter className="w-3.5 h-3.5" /> Status:
        </span>
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border shrink-0 whitespace-nowrap ${
            statusFilter === 'ALL'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#2a3447] hover:bg-slate-200 dark:hover:bg-slate-700/60'
          }`}
        >
          All ({vehicles?.length ?? 0})
        </button>
        {VEHICLE_STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setStatusFilter(opt.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border shrink-0 whitespace-nowrap ${
              statusFilter === opt.key
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#2a3447] hover:bg-slate-200 dark:hover:bg-slate-700/60'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Vehicle Type Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 flex-nowrap sm:flex-wrap w-full md:w-auto">
        <span className="text-slate-700 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] mr-1 shrink-0">Type:</span>
        <button
          onClick={() => setTypeFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border shrink-0 whitespace-nowrap ${
            typeFilter === 'ALL'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#2a3447] hover:bg-slate-200 dark:hover:bg-slate-700/60'
          }`}
        >
          All Types
        </button>
        {VEHICLE_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setTypeFilter(opt.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border shrink-0 whitespace-nowrap ${
              typeFilter === opt.key
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-[#2a3447] hover:bg-slate-200 dark:hover:bg-slate-700/60'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
