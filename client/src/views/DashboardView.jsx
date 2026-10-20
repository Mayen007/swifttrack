import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { LayoutDashboard, Activity } from 'lucide-react';
import { CommercialBentoHeader, CommercialMetricStrip } from '../components/dashboard/CommercialBentoHeader.jsx';
import { CommercialQuickNav } from '../components/dashboard/CommercialQuickNav.jsx';
import { CommercialChartsGrid } from '../components/dashboard/CommercialChartsGrid.jsx';
import { CriticalInventoryGrid } from '../components/dashboard/CriticalInventoryGrid.jsx';

export function DashboardView({ onNavigate }) {
  const { user, selectedBranch, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [lowStock, setLowStock] = useState(null);
  const [branchPerformance, setBranchPerformance] = useState(null);
  const [loading, setLoading] = useState(true);

  const [chartData, setChartData] = useState(null);
  const [chartError, setChartError] = useState(null);
  const [chartDays, setChartDays] = useState(14);
  const [chartLoading, setChartLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shippedView, setShippedView] = useState('products');
  const [pendingView, setPendingView] = useState('products');

  const canViewFinancials = isSuperAdmin || user?.role === 'BRANCH_MANAGER' || user?.roleName === 'BRANCH_MANAGER';

  async function loadDashboardData() {
    setChartLoading(true);
    try {
      const activeBranchId = !isSuperAdmin && user?.branch_id ? user.branch_id : (selectedBranch?.id || null);
      const branchParam = activeBranchId ? `?branch_id=${activeBranchId}` : '';

      const [pnlData, stockData, branchesData, charts] = await Promise.all([
        canViewFinancials ? api.get(`/api/reports/pnl${branchParam}`).catch(() => null) : Promise.resolve(null),
        api.get(`/api/inventory${branchParam}`).catch(() => null),
        api.get('/api/branches').catch(() => null),
        canViewFinancials
          ? api.get(`/api/reports/dashboard-charts?days=${chartDays}${branchParam ? `&${branchParam.slice(1)}` : ''}`).catch(() => null)
          : Promise.resolve(null),
      ]);

      const inventory = Array.isArray(stockData) ? stockData : null;
      const driverPerformance = Array.isArray(charts?.driver_performance)
        ? charts.driver_performance
        : null;
      const lowItems = inventory
        ? inventory.filter((item) => Number(item.quantity_available ?? item.quantity_on_hand ?? 0) <= Number(item.min_stock_alert ?? 0))
        : [];
      setLowStock(inventory ? lowItems : null);

      const grossRevenue = pnlData?.gross_revenue ?? null;
      const totalOrders = charts?.totals?.all_orders ?? charts?.totals?.orders ?? null;
      const netIncome = pnlData?.net_income
        ?? (pnlData && grossRevenue != null && pnlData.cogs != null
          ? Number(grossRevenue) - Number(pnlData.cogs)
          : null);

      setStats({
        grossRevenue: grossRevenue == null ? null : Number(grossRevenue),
        ordersCount: totalOrders == null ? null : Number(totalOrders),
        lowStockCount: inventory ? lowItems.length : null,
        couriersInPeriod: driverPerformance?.length ?? null,
        netIncome,
      });

      setBranchPerformance(Array.isArray(branchesData) ? branchesData : null);

      setChartData(charts);
      setChartError(canViewFinancials && !charts ? 'Analytics are unavailable right now. Refresh to try again.' : null);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setChartLoading(false);
      setRefreshing(false);
    }
  }

  async function handleTimeRangeChange(days) {
    if (!canViewFinancials) return;
    setChartDays(days);
    setChartLoading(true);
    setChartError(null);
    try {
      const activeBranchId = !isSuperAdmin && user?.branch_id ? user.branch_id : (selectedBranch?.id || null);
      const branchParam = activeBranchId ? `?branch_id=${activeBranchId}` : '';
      const charts = await api.get(`/api/reports/dashboard-charts?days=${days}${branchParam ? `&${branchParam.slice(1)}` : ''}`);
      setChartData(charts);
    } catch (err) {
      console.error('Failed to update chart range:', err);
      setChartData(null);
      setChartError('Could not load analytics for that reporting period. Try again.');
    } finally {
      setChartLoading(false);
    }
  }

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedBranch, isSuperAdmin]);

  const completedDel = Number(chartData?.delivery_results?.find((r) => r.key === 'DELIVERED')?.count ?? 0);
  const totalDel = Number(chartData?.totals?.all_deliveries ?? 0);
  const deliverySuccessRate = totalDel > 0 ? Math.round((completedDel / totalDel) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#12161f] border border-[#222834] rounded-xl p-3 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider block font-bold">
              EXECUTIVE INTELLIGENCE & COMMERCIAL BI
            </span>
            <h2 className="text-base font-bold text-white font-mono uppercase tracking-wide">
              Executive Command Center
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate && onNavigate('control-tower')}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 bg-[#18202d] hover:bg-amber-500/10 text-slate-300 hover:text-amber-300 border border-[#2c3548] hover:border-amber-500/30 transition-all cursor-pointer"
            title="Switch to Operations Control Tower"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Operations Control Tower &rarr;</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pl-2 border-l border-slate-800">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">CONTEXT:</span>
            <span className="text-amber-400 font-bold">
              {selectedBranch ? `${selectedBranch.code} (${selectedBranch.name})` : 'HQ MASTER NETWORK'}
            </span>
          </div>
        </div>
      </div>

      <CommercialBentoHeader
        user={user}
        selectedBranch={selectedBranch}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        stats={stats}
        deliverySuccessRate={deliverySuccessRate}
      />

      <CommercialQuickNav onNavigate={onNavigate} />

      <CommercialMetricStrip stats={stats} loading={loading} />

      {chartError && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-xs text-rose-300" role="alert">
          {chartError}
        </div>
      )}

      <CommercialChartsGrid
        chartData={chartData}
        chartDays={chartDays}
        handleTimeRangeChange={handleTimeRangeChange}
        shippedView={shippedView}
        setShippedView={setShippedView}
        pendingView={pendingView}
        setPendingView={setPendingView}
        deliverySuccessRate={deliverySuccessRate}
        chartLoading={chartLoading}
      />

      <CriticalInventoryGrid
        lowStock={lowStock}
        branchPerformance={branchPerformance}
        loading={loading}
        onNavigate={onNavigate}
      />
    </div>
  );
}
