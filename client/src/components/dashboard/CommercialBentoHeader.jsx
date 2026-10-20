import React from 'react';
import {
  Calendar,
  DollarSign,
  Package,
  Truck,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api.js';

export function CommercialBentoHeader({
  user,
  selectedBranch,
  refreshing,
  onRefresh,
  stats,
  deliverySuccessRate
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden select-none">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start relative z-10">
        <div className="lg:col-span-8 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <span>OPERATIONS OVERVIEW</span>
            <span>//</span>
            <span className="text-amber-400 font-bold">{selectedBranch ? selectedBranch.code : 'HQ-ALL'}</span>
            <span>•</span>
            <span className="text-slate-400">STATION:</span>
            <span className="text-slate-200 font-medium">{selectedBranch ? selectedBranch.name : 'Enterprise Network'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans">
            SwiftTrack Logistics & Commerce Console
          </h1>
          <p className="text-xs text-slate-400 font-sans">
            Active session: <span className="text-slate-200 font-medium">{user?.full_name || user?.username}</span> • Role: <span className="text-slate-200 font-medium">{user?.role || 'OPERATOR'}</span>
          </p>
        </div>

        <div className="lg:col-span-4 flex flex-wrap items-center justify-start lg:justify-end gap-2.5">
          <button
            onClick={onRefresh}
            title="Refresh dashboard data"
            className="px-3 py-2 rounded-xl bg-[#0c0e12] hover:bg-[#18202d] border border-[#222834] hover:border-[#38455e] text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span>SYNC</span>
          </button>

          <div className="px-3 py-2 rounded-xl bg-[#0c0e12] border border-[#222834] text-xs font-mono text-slate-300 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="tabular-nums">
              {new Date().toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3.5 mt-3.5 border-t border-[#222834] relative z-10">
        <div className="bg-[#0c0e12]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Gross Revenue</span>
            <div className="text-lg font-bold text-emerald-400 font-mono">
              {stats?.grossRevenue == null ? '—' : `KES ${stats.grossRevenue.toLocaleString()}`}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#0c0e12]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Total Orders</span>
            <div className="text-lg font-bold text-white font-mono">
              {stats?.ordersCount ?? '—'}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/40 flex items-center justify-center text-slate-300">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#0c0e12]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Couriers in Period</span>
            <div className="text-lg font-bold text-cyan-400 font-mono">
              {stats?.couriersInPeriod ?? '—'}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Truck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-[#0c0e12]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Fulfillment</span>
            <div className="text-lg font-bold text-amber-400 font-mono">
              {deliverySuccessRate == null ? '—' : `${deliverySuccessRate}%`}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommercialMetricStrip({ stats, loading }) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#222834]">
        <div className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <span className="truncate">GROSS REVENUE</span>
          </div>
          <div className="mt-2 text-xl xl:text-2xl font-bold font-mono tabular-nums text-white tracking-tight truncate" title={stats?.grossRevenue == null ? 'Revenue data unavailable' : api.formatKES(stats.grossRevenue)}>
            {stats?.grossRevenue == null
              ? '—'
              : stats.grossRevenue >= 1000000
                ? api.formatCompactKES(stats.grossRevenue)
                : api.formatKES(stats.grossRevenue)}
          </div>
          <div className="mt-1.5 text-[11px] font-mono text-slate-400 flex items-center gap-1.5 truncate">
            <span className="truncate">All recorded sales</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <span className="truncate">TOTAL ORDERS</span>
            <span className="text-slate-400 shrink-0">POS + DISPATCH</span>
          </div>
          <div className="mt-2 text-xl xl:text-2xl font-bold font-mono tabular-nums text-white tracking-tight truncate">
            {stats?.ordersCount ?? '—'}
          </div>
          <div className="mt-1.5 text-[11px] font-mono text-slate-400 truncate">
            {stats?.ordersCount > 0 && stats.grossRevenue != null
              ? `Average revenue per order: ${api.formatKES(stats.grossRevenue / stats.ordersCount)}`
              : stats?.ordersCount === 0
                ? 'No orders in the selected period'
                : 'Order data unavailable'}
          </div>
        </div>

        <div className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <span className="truncate">STOCK DEFICITS</span>
            <span className={stats?.lowStockCount > 0 ? 'text-amber-400 font-bold shrink-0' : 'text-slate-400 shrink-0'}>
              {stats?.lowStockCount == null ? 'UNAVAILABLE' : stats.lowStockCount > 0 ? 'ACTION' : 'CLEAR'}
            </span>
          </div>
          <div className="mt-2 text-xl xl:text-2xl font-bold font-mono tabular-nums text-amber-400 tracking-tight truncate">
            {stats?.lowStockCount ?? '—'} <span className="text-xs font-normal text-slate-400">SKUs</span>
          </div>
          <div className="mt-1.5 text-[11px] font-mono text-slate-400 truncate">
            {stats?.lowStockCount == null ? 'Inventory data unavailable' : 'Below regional safety threshold'}
          </div>
        </div>

        <div className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <span className="truncate">ACTIVE COURIERS</span>
            <span className="text-slate-400 shrink-0">SELECTED PERIOD</span>
          </div>
          <div className="mt-2 text-xl xl:text-2xl font-bold font-mono tabular-nums text-white tracking-tight truncate">
            {stats?.couriersInPeriod ?? '—'} <span className="text-xs font-normal text-slate-400">COURIERS</span>
          </div>
          <div className="mt-1.5 text-[11px] font-mono text-slate-400 truncate">
            {stats?.couriersInPeriod == null ? 'Courier data unavailable' : 'With delivery activity in the reporting period'}
          </div>
        </div>
      </div>
    </div>
  );
}
