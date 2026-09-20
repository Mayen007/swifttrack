// client/src/components/inventory/InventoryFilters.jsx
import React from 'react';
import { Search, X, Layers, ArrowRightLeft, FileText, Filter, DollarSign, AlertCircle } from 'lucide-react';

export function InventoryFilters({
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  selectedWarehouseId,
  setSelectedWarehouseId,
  selectedCategory,
  setSelectedCategory,
  stateFilter,
  setStateFilter,
  warehouses = [],
  categories = [],
  onResetFilters,
}) {
  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedWarehouseId !== '' ||
    selectedCategory !== 'ALL' ||
    stateFilter !== 'ALL';

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-3 space-y-3 font-mono text-xs">
      {/* Top Bar: View Mode Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-[#0c0e12] p-1 rounded border border-[#222834]">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'matrix' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            STOCK MATRIX
          </button>
          <button
            onClick={() => setActiveTab('receiving')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'receiving' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            RECEIVING (GRN)
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'transfers' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            TRANSFERS
          </button>
          <button
            onClick={() => setActiveTab('stocktake')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'stocktake' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            STOCKTAKE
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'movements' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            MOVEMENT HISTORY
          </button>
          <button
            onClick={() => setActiveTab('valuation')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'valuation' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            VALUATION & COGS
          </button>
          <button
            onClick={() => setActiveTab('reorder')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'reorder' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            REORDER ALERTS
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'transfers'
                ? 'Search by Transfer # or Route...'
                : activeTab === 'receiving'
                ? 'Search by GRN #, Invoice, or Delivery Note...'
                : activeTab === 'movements'
                ? 'Search by SKU, Product, or Reference...'
                : 'Search by SKU, Barcode, or Product Name...'
            }
            className="w-full bg-[#181d28] border border-[#222834] rounded pl-8 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
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
      </div>

      {/* Second Bar: Warehouse, Category & State Filter */}
      {activeTab !== 'stocktake' && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1e2430]">
          {/* Warehouse Selector */}
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="bg-[#181d28] border border-[#222834] rounded px-2.5 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer max-w-[220px] truncate"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.branch_name ? `${w.branch_name} - ${w.name}` : w.name}
              </option>
            ))}
          </select>

          {/* Category & State filter on matrix */}
          {activeTab === 'matrix' && (
            <>
              {/* Category Selector */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#181d28] border border-[#222834] rounded px-2.5 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* State Filter Selector */}
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="bg-[#181d28] border border-[#222834] rounded px-2.5 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All States</option>
                <option value="LOW_STOCK">Low Stock (At Reorder Threshold)</option>
                <option value="DAMAGED">Damaged / Quarantine Only</option>
                <option value="EXPIRED">Expired Stock Only</option>
                <option value="RESERVED">Reserved for Orders</option>
                <option value="IN_TRANSIT">In-Transit Freight</option>
              </select>
            </>
          )}

          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              title="Reset all search queries and filters"
              className="p-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
