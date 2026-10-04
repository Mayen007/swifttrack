import React from 'react';
import { Search, X, SlidersHorizontal, LayoutGrid, List } from 'lucide-react';
import { DRIVER_STATUS_OPTIONS, COMPLIANCE_STATUS_OPTIONS } from './constants.js';

export function DriverFilterBar({
  searchQuery,
  setSearchQuery,
  handleSearchSubmit,
  statusFilter,
  setStatusFilter,
  complianceFilter,
  setComplianceFilter,
  branchFilter,
  setBranchFilter,
  branches,
  isSuperAdmin,
  totalDrivers,
  isCompact,
  setIsCompact
}) {
  const hasActiveFilters = Boolean(
    searchQuery || statusFilter !== 'ALL' || complianceFilter !== 'ALL' || branchFilter
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setComplianceFilter('ALL');
    setBranchFilter('');
  };

  return (
    <div className="bg-[#12161f] p-2 sm:p-2.5 rounded-xl border border-[#222834] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
      {/* Search Input & Total Count */}
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, code, phone, license..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-[#0c0e12] border border-[#222834] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {typeof totalDrivers === 'number' && (
          <span className="hidden sm:inline-flex items-center px-2 py-1 rounded text-[11px] font-mono text-slate-400 bg-slate-900 border border-[#222834] whitespace-nowrap">
            {totalDrivers} {totalDrivers === 1 ? 'driver' : 'drivers'}
          </span>
        )}
      </div>

      {/* Filters & Density Controls */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Branch Filter */}
        {isSuperAdmin && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded-lg text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer max-w-[140px] truncate"
            title="Filter by Depot"
          >
            <option value="">All Depots</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded-lg text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
          title="Filter by Duty Status"
        >
          <option value="ALL">All Statuses</option>
          {DRIVER_STATUS_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>

        {/* Compliance Filter */}
        <select
          value={complianceFilter}
          onChange={(e) => setComplianceFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded-lg text-xs text-slate-200 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
          title="Filter by DL Compliance"
        >
          <option value="ALL">All Compliance</option>
          {COMPLIANCE_STATUS_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-2 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex items-center gap-1 cursor-pointer"
            title="Reset active filters"
          >
            <X className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}

        {/* View Density Toggle Button */}
        {setIsCompact && (
          <button
            type="button"
            onClick={() => setIsCompact(!isCompact)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
              isCompact
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-[#0c0e12] border-[#222834] text-slate-400 hover:text-slate-200'
            }`}
            title={isCompact ? 'Switch to Comfortable Spacing' : 'Switch to Compact Spacing'}
          >
            {isCompact ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline text-[11px] font-medium">
              {isCompact ? 'Compact' : 'Comfortable'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
