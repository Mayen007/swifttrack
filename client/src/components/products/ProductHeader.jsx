// client/src/components/products/ProductHeader.jsx
import React from 'react';
import { Tag, Plus, Sparkles, RotateCcw, Percent, Archive } from 'lucide-react';

export function ProductHeader({
  loading,
  onRefresh,
  onCreateProduct,
  onOpenPromotions,
  showArchived,
  onToggleArchived,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold tracking-wider uppercase">
            <Sparkles className="w-3 h-3" />
            COMMERCE CORE ENGINE
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            MULTI-TIER PRICING & VARIANTS
          </span>
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 mt-1">
          <Tag className="w-5 h-5 text-amber-400" />
          Product Catalog & Multi-Tier Pricing Engine
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Enterprise catalog master with multi-attribute variants, regional branch overrides, bulk breaks, customer tiers, and scheduled promotions
        </p>
      </div>

      {/* Action Switchboard */}
      <div className="flex items-center flex-wrap gap-2 shrink-0">
        <button
          onClick={onToggleArchived}
          title="Toggle view between active and archived products"
          className={`px-3 py-1.5 rounded border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
            showArchived
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
              : 'border-[#222834] bg-[#181d28] hover:bg-[#202736] text-slate-300 hover:text-white'
          }`}
        >
          <Archive className="w-3.5 h-3.5 text-amber-400" />
          <span>{showArchived ? 'VIEW ACTIVE' : 'VIEW ARCHIVED'}</span>
        </button>

        <button
          onClick={onOpenPromotions}
          title="Manage scheduled promotions, campaigns, and discount vouchers"
          className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-purple-300 hover:text-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Percent className="w-3.5 h-3.5 text-purple-400" />
          <span>PROMOTIONS</span>
        </button>

        <button
          onClick={onCreateProduct}
          title="Create a new catalog product"
          className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>NEW PRODUCT</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={loading}
          title="Reload products from server"
          className="px-2.5 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
          <span>SYNC</span>
        </button>
      </div>
    </div>
  );
}
