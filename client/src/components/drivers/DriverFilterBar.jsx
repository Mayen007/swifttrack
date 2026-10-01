import React from 'react';
import { Search } from 'lucide-react';
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
  isSuperAdmin
}) {
  return (
      <div className="bg-[#12161f] p-3 rounded-xl border border-[#2a3447] flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, code, phone, license..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-[#0c0e12] border border-slate-300 dark:border-[#2a3447] rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-all"
          />
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Branch Filter */}
          {isSuperAdmin && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#0c0e12] border border-slate-300 dark:border-[#2a3447] rounded-lg text-xs text-slate-800 dark:text-slate-300 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-[#0c0e12] border border-slate-300 dark:border-[#2a3447] rounded-lg text-xs text-slate-800 dark:text-slate-300 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
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
            className="px-3 py-1.5 bg-slate-50 dark:bg-[#0c0e12] border border-slate-300 dark:border-[#2a3447] rounded-lg text-xs text-slate-800 dark:text-slate-300 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Compliance</option>
            {COMPLIANCE_STATUS_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
  );
}
