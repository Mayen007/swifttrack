import React from 'react';
import { Search, ScanBarcode, Plus } from 'lucide-react';
import { api } from '../../services/api.js';

export function RetailCatalog({
  searchInputRef,
  searchQuery,
  setSearchQuery,
  onBarcodeScan,
  selectedCategory,
  setSelectedCategory,
  productsCount,
  categories,
  filteredProducts,
  onAddItem,
}) {
  return (
          <div className="flex-1 flex flex-col bg-[#12161f] border border-[#222834] rounded p-4 overflow-hidden">
          {/* Top Control Bar: Search & Barcode Trigger */}
          <div className="flex flex-wrap items-center gap-2.5 pb-3 border-b border-[#222834]">
            <div className="flex-1 relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search catalog by name, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-14 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-400 text-xs focus:outline-none focus:border-amber-400 font-sans transition-colors"
              />
              <span className="absolute right-2.5 top-2 text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#141822]">
                F2
              </span>
            </div>

            <button
              onClick={onBarcodeScan}
              className="px-3 py-2 rounded bg-[#161c28] hover:bg-[#1f2738] border border-[#2b3548] text-amber-300 text-xs font-mono font-medium flex items-center gap-2 transition-colors cursor-pointer"
              title="Trigger Barcode Scan"
            >
              <ScanBarcode className="w-4 h-4 text-amber-400" />
              <span>SCAN_BARCODE</span>
            </button>
          </div>

          {/* Category Segmented Selector */}
          <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto no-scrollbar border-b border-[#1b212c]">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1 rounded text-xs font-medium font-mono whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === ''
                  ? 'bg-[#222834] text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
              }`}
            >
              ALL ({productsCount})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded text-xs font-medium font-mono uppercase whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#222834] text-amber-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Instrument Grid */}
          <div className="flex-1 overflow-y-auto pt-3 pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 auto-rows-max">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => onAddItem(product, 1)}
                className="p-3 rounded bg-[#0c0e12] hover:bg-[#141822] border border-[#222834] hover:border-[#3b475e] transition-colors cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap truncate">
                      {product.sku}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[80px] shrink-0 text-right">
                      {product.category || product.category_name || 'General'}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white mt-1.5 group-hover:text-amber-300 transition-colors line-clamp-2">
                    {product.name}
                  </h4>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#1b212c] flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
                    {api.formatKES(product.price ?? product.selling_price ?? 0)}
                  </span>
                  <span className="w-5 h-5 rounded bg-[#161c28] group-hover:bg-amber-400 text-slate-400 group-hover:text-slate-950 flex items-center justify-center transition-colors">
                    <Plus className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

  );
}
