import React from 'react';
import {
  Truck,
  RefreshCw,
  Layers,
  Users,
  ShieldAlert,
  Search,
  X,
  Navigation,
  CheckCircle2
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function DispatchConsoleHeader({
  selectedBranch,
  lastSyncTime,
  loading,
  onRefresh,
  activeTab,
  onTabChange,
  filteredDeliveriesCount,
  driversCount,
  exceptionItemsCount,
  summary,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  priorityFilter,
  setPriorityFilter,
  driverFilter,
  setDriverFilter,
  drivers
}) {
  return (
    <div className="bg-[#12161f] border border-[#2a3447] rounded-xl p-3.5 sm:p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-500 dark:text-blue-400">
              <Truck className="w-4 h-4" />
            </span>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                Fleet Dispatch & Manifest Pipeline
                <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-[#181d28] border border-[#2a3447] text-slate-600 dark:text-slate-400">
                  DISPATCH CONSOLE
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                HUB: <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedBranch?.name || 'Distribution Hub'}</span>
                <span className="mx-2 text-slate-400 dark:text-[#2a3447]">|</span>
                TELEMETRY: <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% LIVE SYNC</span>
                {lastSyncTime && <span className="ml-1 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="flex bg-[#0b0e14] p-1 rounded-lg border border-[#2a3447] text-xs font-mono">
            <button
              onClick={() => {
                onTabChange('KANBAN');
                sound.playScan();
              }}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'KANBAN'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${activeTab === 'KANBAN' ? 'text-white' : 'text-blue-400'}`} />
              PIPELINE ({filteredDeliveriesCount})
            </button>

            <button
              onClick={() => {
                onTabChange('FLEET');
                sound.playScan();
              }}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'FLEET'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Users className={`w-3.5 h-3.5 ${activeTab === 'FLEET' ? 'text-white' : 'text-amber-400'}`} />
              COURIERS ({driversCount})
            </button>

            <button
              onClick={() => {
                onTabChange('EXCEPTIONS');
                sound.playScan();
              }}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'EXCEPTIONS'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <ShieldAlert className={`w-3.5 h-3.5 ${activeTab === 'EXCEPTIONS' ? 'text-white' : 'text-rose-400'}`} />
              EXCEPTIONS ({exceptionItemsCount})
            </button>
          </div>

          <button
            onClick={() => {
              onRefresh();
              sound.playScan();
            }}
            disabled={loading}
            className="h-8 px-3 rounded-lg bg-[#0b0e14] hover:bg-[#181d28] border border-[#2a3447] text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Reload pipeline data"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-[#2a3447] border border-[#2a3447] rounded-lg overflow-hidden mt-3">
        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider block">Total Active</span>
            <span className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.total_active ?? 0}
            </span>
          </div>
          <Truck className="w-4 h-4 text-slate-500" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono uppercase tracking-wider block font-semibold">Ready (Unassigned)</span>
            <span className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {summary.ready_count ?? 0}
            </span>
          </div>
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono uppercase tracking-wider block font-semibold">In Road Transit</span>
            <span className="text-lg font-mono font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
              {summary.in_transit_count ?? 0}
            </span>
          </div>
          <Navigation className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono uppercase tracking-wider block font-semibold">Delivered Today</span>
            <span className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {summary.delivered_count ?? 0}
            </span>
          </div>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono uppercase tracking-wider block font-semibold">Exceptions / Returns</span>
            <span className="text-lg font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {summary.failed_count ?? 0}
            </span>
          </div>
          <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400" />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-[#2a3447] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search manifest #, recipient, phone, destination, driver... [F2]"
            className="w-full pl-8 pr-8 py-1.5 bg-[#0c0e12] border border-[#2a3447] focus:border-blue-500/60 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-500 font-mono focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-[#0b0e14] p-0.5 rounded-lg border border-[#2a3447] text-[11px] font-mono">
            <span className="text-slate-400 uppercase text-[10px] px-1.5 hidden sm:inline font-bold">Priority:</span>
            {[
              { id: 'ALL', label: 'ALL' },
              { id: 'NORMAL', label: 'NORMAL' },
              { id: 'HIGH', label: 'HIGH' },
              { id: 'URGENT', label: 'URGENT' }
            ].map((prio) => (
              <button
                key={prio.id}
                onClick={() => {
                  setPriorityFilter(prio.id);
                  sound.playScan();
                }}
                className={`px-2 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                  priorityFilter === prio.id
                    ? prio.id === 'URGENT'
                      ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-400/50 dark:border-rose-500/50 shadow-xs'
                      : prio.id === 'HIGH'
                      ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400/50 dark:border-amber-500/50 shadow-xs'
                      : 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-400/50 dark:border-blue-500/50 shadow-xs'
                    : 'bg-transparent text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {prio.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={driverFilter}
              onChange={(e) => {
                setDriverFilter(e.target.value);
                sound.playScan();
              }}
              className="px-2.5 py-1.5 bg-[#0b0e14] border border-[#2a3447] rounded-lg text-[11px] font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">ALL DRIVERS ({drivers.length})</option>
              {drivers.map((drv) => (
                <option key={drv.id} value={drv.id}>
                  {drv.full_name} ({drv.status === 'AVAILABLE' ? 'AVAIL' : 'ON ROAD'})
                </option>
              ))}
            </select>

            {(priorityFilter !== 'ALL' || driverFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setPriorityFilter('ALL');
                  setDriverFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-2 py-1 rounded-lg bg-[#0b0e14] hover:bg-rose-500/20 border border-[#2a3447] hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-[10px] font-mono cursor-pointer transition-colors"
              >
                RESET
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
