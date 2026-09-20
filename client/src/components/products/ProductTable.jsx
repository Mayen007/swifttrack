// client/src/components/products/ProductTable.jsx
import React from 'react';
import { Layers, Sliders, Edit, Archive, RotateCcw, Barcode, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function ProductTable({
  loading,
  products = [],
  onOpenVariants,
  onOpenPricing,
  onEditProduct,
  onToggleArchive,
}) {
  if (loading) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-8 flex flex-col items-center justify-center space-y-3">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-400">Loading catalog inventory & pricing...</span>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded p-12 text-center">
        <Barcode className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-200 uppercase font-mono">No Products Found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          No catalog products match your search or filter criteria.
        </p>
      </div>
    );
  }

  const formatKes = (val) =>
    `KES ${(Number(val) || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#222834] bg-[#0e121a] text-slate-400 font-mono text-[10px] uppercase tracking-wider">
              <th className="py-2.5 px-3">SKU / Barcode</th>
              <th className="py-2.5 px-3">Product Name & Brand</th>
              <th className="py-2.5 px-3">Unit</th>
              <th className="py-2.5 px-3 text-right">Cost Price</th>
              <th className="py-2.5 px-3 text-right">Retail Price</th>
              <th className="py-2.5 px-3 text-right">Wholesale Price</th>
              <th className="py-2.5 px-3 text-center">Tax / VAT</th>
              <th className="py-2.5 px-3 text-center">Variants</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2430]">
            {products.map((p) => {
              const isArchived = Boolean(p.is_archived);
              return (
                <tr
                  key={p.id}
                  className={`hover:bg-[#181d28]/70 transition-colors ${
                    isArchived ? 'opacity-60 bg-slate-900/40' : ''
                  }`}
                >
                  {/* SKU & Barcode */}
                  <td className="py-3 px-3">
                    <div className="font-mono font-bold text-slate-200">{p.sku}</div>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 mt-0.5">
                      <Barcode className="w-3 h-3 text-slate-500" />
                      <span>{p.barcode || 'N/A'}</span>
                    </div>
                  </td>

                  {/* Name, Category & Brand */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-white text-xs">{p.name}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        {p.category}
                      </span>
                      {p.brand_name && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          {p.brand_name}
                        </span>
                      )}
                      {p.reorder_threshold > 0 && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Min: {p.reorder_threshold}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Unit of Measure */}
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1a2130] border border-[#2b3548] text-slate-300">
                      {p.unit_of_measure || 'UNIT'}
                    </span>
                  </td>

                  {/* Cost Price */}
                  <td className="py-3 px-3 text-right font-mono text-slate-400">
                    {formatKes(p.cost_price)}
                  </td>

                  {/* Selling Price */}
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                    {formatKes(p.selling_price)}
                  </td>

                  {/* Wholesale Price */}
                  <td className="py-3 px-3 text-right font-mono text-amber-400">
                    {formatKes(p.wholesale_price || p.selling_price)}
                  </td>

                  {/* Tax Category */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        p.tax_category === 'ZERO_RATED_0'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : p.tax_category === 'EXEMPT'
                          ? 'bg-slate-700/40 text-slate-300 border border-slate-600'
                          : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {p.tax_category === 'ZERO_RATED_0'
                        ? '0% ZERO'
                        : p.tax_category === 'EXEMPT'
                        ? 'EXEMPT'
                        : '16% VAT'}
                    </span>
                  </td>

                  {/* Variants Count & Quick Link */}
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => onOpenVariants(p)}
                      title="Manage product variants"
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Layers className="w-3 h-3" />
                      <span>{p.variant_count || 0} VARIANTS</span>
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => onOpenPricing(p)}
                        title="Pricing Engine & Overrides"
                        className="p-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onEditProduct(p)}
                        title="Edit Master Product Details"
                        className="p-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onToggleArchive(p)}
                        title={isArchived ? 'Restore Product to Active Catalog' : 'Archive Product (Soft-Delete)'}
                        className={`p-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] transition-colors cursor-pointer ${
                          isArchived ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-rose-400'
                        }`}
                      >
                        {isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
