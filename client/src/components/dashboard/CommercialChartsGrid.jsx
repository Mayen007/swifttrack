import React from 'react';
import {
  BarChart2,
  CheckCircle2,
  Clock,
  AlertOctagon,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { SvgLineChart } from '../charts/SvgLineChart.jsx';
import { SvgDonutChart } from '../charts/SvgDonutChart.jsx';
import { SvgBarChart } from '../charts/SvgBarChart.jsx';

export function CommercialChartsGrid({
  chartData,
  chartDays,
  handleTimeRangeChange,
  shippedView,
  setShippedView,
  pendingView,
  setPendingView,
  deliverySuccessRate,
}) {
  return (
    <div className="space-y-6">
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
            <span>VISUAL TELEMETRY & BUSINESS INTELLIGENCE</span>
            <span>//</span>
            <span className="text-emerald-400 font-semibold">10 LIVE INSTRUMENTS</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white font-sans mt-0.5">
            Operational & Financial Analytics Dashboard
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Interactive multi-series charts tracking order velocity, revenue, fleet execution, and logistics exceptions.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded bg-[#0c0e12] border border-[#222834] self-start sm:self-auto">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => handleTimeRangeChange(d)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                chartDays === d
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c27]'
              }`}
            >
              {d}D Range
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  ORDER VOLUME TELEMETRY
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <span>1. Daily Orders Trend</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold tabular-nums">
                  {chartData?.totals?.orders || 0} TOTAL ORDERS
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  LINE CHART
                </span>
              </div>
            </div>

            <SvgLineChart
              data={chartData?.daily_orders_trend || []}
              dataKey="orders"
              labelKey="label"
              color="#38bdf8"
              gradientFrom="#38bdf8"
              unit="orders"
              height={220}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2532] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              POS Walk-in + Courier Dispatch orders
            </span>
            <span>Smooth Bezier Spline</span>
          </div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  FISCAL INFLOW VELOCITY
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <span>2. Revenue Trend</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold tabular-nums">
                  {api.formatKES(chartData?.totals?.revenue || 0)}
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  LINE CHART
                </span>
              </div>
            </div>

            <SvgLineChart
              data={chartData?.revenue_trend || []}
              dataKey="revenue"
              labelKey="label"
              color="#10b981"
              gradientFrom="#10b981"
              formatValue={(v) => api.formatKES(v)}
              unit=""
              height={220}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2532] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Gross Sales Inflow (KES)
            </span>
            <span>Daily Settlement</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  LIFECYCLE DISTRIBUTION
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <span>3. Order Status</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0c0e12] border border-[#222834] text-slate-300">
                  {chartData?.order_status?.length || 0} PHASES
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  DONUT CHART
                </span>
              </div>
            </div>

            <SvgDonutChart
              data={chartData?.order_status || []}
              centerValue={chartData?.totals?.all_orders}
              centerLabel="Total Orders"
              unit="orders"
              size={175}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2532] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Interactive Segment Hover</span>
            <span>All Branches</span>
          </div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  FLEET OUTCOMES & ACCURACY
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <span>6. Delivery Results</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                  {deliverySuccessRate}% SUCCESS
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  DONUT CHART
                </span>
              </div>
            </div>

            <SvgDonutChart
              data={chartData?.delivery_results || []}
              centerValue={`${deliverySuccessRate}%`}
              centerLabel="Delivery Rate"
              unit="jobs"
              size={175}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2532] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Proof of Delivery Verified
            </span>
            <span>GPS Tagged Trips</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  NETWORK REVENUE COMPARISON
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <span>4. Branch Performance</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0c0e12] border border-[#222834] text-slate-300">
                  {chartData?.branch_performance?.length || 0} HUBS
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  BAR CHART
                </span>
              </div>
            </div>

            <SvgBarChart
              data={chartData?.branch_performance || []}
              dataKey="revenue"
              labelKey="code"
              sublabelKey="name"
              formatValue={(v) => api.formatKES(v)}
              layout="vertical"
              color="#3b82f6"
              height={230}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2532] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>{chartData?.branch_performance?.map(b => b.name || b.code).join(' • ') || 'Active Network Branches'}</span>
            <span>Gross Sales (KES)</span>
          </div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  DRIVER & COURIER VELOCITY
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <span>5. Employee / Driver Performance</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold">
                  ACTIVE FLEET
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  BAR CHART
                </span>
              </div>
            </div>

            <SvgBarChart
              data={chartData?.driver_performance || []}
              dataKey="delivered"
              labelKey="name"
              sublabelKey="branchCode"
              unit="completed"
              layout="horizontal"
              color="#06b6d4"
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2532] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Completed Dispatches by Assigned Courier</span>
            <span>Trips Fulfilled</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  OUTBOUND FREIGHT VOLUME
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <span>7. Most Shipped Products / Package Types</span>
                </h3>
              </div>

              <div className="flex items-center gap-1 p-0.5 rounded bg-[#0c0e12] border border-[#222834]">
                <button
                  onClick={() => setShippedView('products')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-colors ${
                    shippedView === 'products'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  SKUs
                </button>
                <button
                  onClick={() => setShippedView('categories')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-colors ${
                    shippedView === 'categories'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Types
                </button>
              </div>
            </div>

            <SvgBarChart
              data={shippedView === 'products' ? (chartData?.most_shipped_products || []) : (chartData?.most_shipped_categories || [])}
              dataKey="units_shipped"
              labelKey={shippedView === 'products' ? 'name' : 'category_name'}
              sublabelKey={shippedView === 'products' ? 'category_name' : null}
              unit="units"
              layout="horizontal"
              color="#8b5cf6"
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2532] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Top Shipped Units from Warehouse</span>
            <span>Volume Ranked</span>
          </div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  DISPATCH BACKLOG & BOTTLENECKS
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <span>8. Pending Products / Package Types</span>
                </h3>
              </div>

              <div className="flex items-center gap-1 p-0.5 rounded bg-[#0c0e12] border border-[#222834]">
                <button
                  onClick={() => setPendingView('products')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-colors ${
                    pendingView === 'products'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  SKUs
                </button>
                <button
                  onClick={() => setPendingView('categories')}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer transition-colors ${
                    pendingView === 'categories'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Types
                </button>
              </div>
            </div>

            <SvgBarChart
              data={pendingView === 'products' ? (chartData?.pending_products || []) : (chartData?.pending_categories || [])}
              dataKey="pending_units"
              labelKey={pendingView === 'products' ? 'name' : 'category_name'}
              sublabelKey={pendingView === 'products' ? 'category_name' : null}
              unit="queued"
              layout="horizontal"
              color="#f59e0b"
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2532] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="text-amber-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              In Preparation & Transit Queues
            </span>
            <span>Units Waiting</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  CASH ON DELIVERY LIQUIDITY
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <span>9. COD Collected vs Outstanding</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                  {chartData?.cod_summary?.collectionRatePercent || 100}% COLLECTED
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  BAR CHART
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded bg-[#0c0e12] border border-[#1e2430]">
                <div className="text-[10px] font-mono uppercase text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  COD Collected
                </div>
                <div className="mt-1 text-base font-bold font-mono text-white tabular-nums">
                  {api.formatKES(chartData?.cod_summary?.collectedAmount || 0)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {chartData?.cod_summary?.collectedCount || 0} Orders Settled
                </div>
              </div>

              <div className="p-3 rounded bg-[#0c0e12] border border-[#1e2430]">
                <div className="text-[10px] font-mono uppercase text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  COD Outstanding
                </div>
                <div className="mt-1 text-base font-bold font-mono text-amber-400 tabular-nums">
                  {api.formatKES(chartData?.cod_summary?.outstandingAmount || 0)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {chartData?.cod_summary?.outstandingCount || 0} Orders in Field
                </div>
              </div>
            </div>

            <SvgBarChart
              data={chartData?.cod_summary?.comparisonData || []}
              dataKey="amount"
              labelKey="label"
              formatValue={(v) => api.formatKES(v)}
              layout="vertical"
              colorKey="color"
              height={180}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2532] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>M-Pesa & Cash on Delivery Clearance</span>
            <span>Total Vol: {api.formatKES(chartData?.cod_summary?.totalVolume || 0)}</span>
          </div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#222834] pb-3 mb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  EXCEPTION ROOT-CAUSE ANALYSIS
                </div>
                <h3 className="text-sm font-bold text-white font-sans mt-0.5 flex items-center gap-2">
                  <span>10. Failed Delivery Reasons</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                  PARETO VIEW
                </span>
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  BAR CHART
                </span>
              </div>
            </div>

            <SvgBarChart
              data={chartData?.failed_delivery_reasons || []}
              dataKey="count"
              labelKey="reason"
              unit="cases"
              layout="horizontal"
              color="#f43f5e"
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2532] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="text-rose-400 flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5" />
              Root Causes Tagged by Mobile Driver Portal
            </span>
            <span>Operational Risk Mitigation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
