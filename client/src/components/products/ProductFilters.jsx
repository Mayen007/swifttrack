// client/src/components/products/ProductFilters.jsx
import React from 'react';
import { Search, Filter, X, Tag } from 'lucide-react';

export function ProductFilters({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  brandFilter,
  setBrandFilter,
  taxFilter,
  setTaxFilter,
  categories = [],
  brands = [],
  onResetFilters,
}) {
  const hasActiveFilters =
    Boolean(searchQuery) ||
    categoryFilter !== 'ALL' ||
    brandFilter !== 'ALL' ||
    taxFilter !== 'ALL';

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-3 space-y-3">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by SKU, Barcode, Product Name, or Description..."
            className="w-full bg-[#181d28] border border-[#222834] rounded pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 font-mono transition-colors"
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

        {/* Category Dropdown */}
        <div className="flex items-center gap-1.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#181d28] border border-[#222834] rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500/60 cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Brand Dropdown */}
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="bg-[#181d28] border border-[#222834] rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500/60 cursor-pointer"
          >
            <option value="ALL">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Tax Category Filter */}
          <select
            value={taxFilter}
            onChange={(e) => setTaxFilter(e.target.value)}
            className="bg-[#181d28] border border-[#222834] rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500/60 cursor-pointer"
          >
            <option value="ALL">All Tax Rates</option>
            <option value="STANDARD_16">Standard (16% VAT)</option>
            <option value="ZERO_RATED_0">Zero-Rated (0%)</option>
            <option value="EXEMPT">Exempt</option>
          </select>

          {/* Reset Filters */}
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
      </div>
    </div>
  );
}
