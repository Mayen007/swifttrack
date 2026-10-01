import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { Activity, BarChart2 } from 'lucide-react';
import { OperationsControlTower } from '../components/dashboard/OperationsControlTower.jsx';
import { CommercialBentoHeader, CommercialMetricStrip } from '../components/dashboard/CommercialBentoHeader.jsx';
import { CommercialQuickNav } from '../components/dashboard/CommercialQuickNav.jsx';
import { CommercialChartsGrid } from '../components/dashboard/CommercialChartsGrid.jsx';
import { CriticalInventoryGrid } from '../components/dashboard/CriticalInventoryGrid.jsx';

export function DashboardView({ onNavigate }) {
  const { user, selectedBranch, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('control_tower');
  const [stats, setStats] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [branchPerformance, setBranchPerformance] = useState([]);
  const [, setLoading] = useState(true);

  const [chartData, setChartData] = useState(null);
  const [chartDays, setChartDays] = useState(14);
  const [, setChartLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shippedView, setShippedView] = useState('products');
  const [pendingView, setPendingView] = useState('products');

  async function loadDashboardData() {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';

      const [pnlData, stockData, branchesData, charts] = await Promise.all([
        api.get(`/api/reports/pnl${branchParam}`).catch(() => null),
        api.get(`/api/inventory${branchParam}`).catch(() => []),
        api.get('/api/branches').catch(() => []),
        api.get(`/api/reports/dashboard-charts?days=${chartDays}${branchParam ? `&${branchParam.slice(1)}` : ''}`).catch(() => null),
      ]);

      const inventory = Array.isArray(stockData) ? stockData : [];
      const lowItems = inventory.filter((item) => Number(item.quantity_available ?? item.quantity_on_hand ?? 0) <= Number(item.min_stock_alert ?? 0));
      setLowStock(lowItems);

      const totalSales = Number(pnlData?.gross_revenue ?? charts?.totals?.revenue ?? 0);
      const totalOrders = Number(charts?.totals?.orders ?? charts?.totals?.all_orders ?? 0);
      const cogs = Number(pnlData?.cogs ?? 0);
      const netIncome = Number(pnlData?.net_income ?? (totalSales - cogs));
      const activeFleet = Array.isArray(charts?.driver_performance) && charts.driver_performance.length > 0
        ? charts.driver_performance.length
        : (selectedBranch ? 2 : 6);

      setStats({
        todaySales: totalSales,
        mtdSales: totalSales,
        ordersCount: totalOrders,
        lowStockCount: lowItems.length,
        activeFleet,
        netIncome,
      });

      if (Array.isArray(branchesData)) {
        setBranchPerformance(branchesData);
      }

      setChartData(charts);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setChartLoading(false);
      setRefreshing(false);
    }
  }

  async function handleTimeRangeChange(days) {
    setChartDays(days);
    try {
      setChartLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const charts = await api.get(`/api/reports/dashboard-charts?days=${days}${branchParam ? `&${branchParam.slice(1)}` : ''}`);
      setChartData(charts);
    } catch (err) {
      console.error('Failed to update chart range:', err);
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

  const completedDel = chartData?.delivery_results?.find((r) => r.key === 'DELIVERED')?.count || 0;
  const totalDel = chartData?.totals?.all_deliveries || 1;
  const deliverySuccessRate = Math.round((completedDel / totalDel) * 100) || 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#12161f] border border-[#222834] rounded-xl p-2 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('control_tower')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'control_tower'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#18202d] border border-transparent'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>OPERATIONS CONTROL TOWER</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </button>

          <button
            onClick={() => setActiveTab('commercial_bi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'commercial_bi'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#18202d] border border-transparent'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
            <span>FINANCIAL & RETAIL BI</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400 px-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">HUB CONTEXT:</span>
          <span className="text-amber-400 font-bold">
            {selectedBranch ? `${selectedBranch.code} (${selectedBranch.name})` : 'HQ MASTER NETWORK'}
          </span>
        </div>
      </div>

      {activeTab === 'control_tower' ? (
        <OperationsControlTower onNavigate={onNavigate} />
      ) : (
        <>
          <CommercialBentoHeader
            user={user}
            selectedBranch={selectedBranch}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            stats={stats}
            deliverySuccessRate={deliverySuccessRate}
          />

          <CommercialQuickNav onNavigate={onNavigate} />

          <CommercialMetricStrip stats={stats} />

          <CommercialChartsGrid
            chartData={chartData}
            chartDays={chartDays}
            handleTimeRangeChange={handleTimeRangeChange}
            shippedView={shippedView}
            setShippedView={setShippedView}
            pendingView={pendingView}
            setPendingView={setPendingView}
            deliverySuccessRate={deliverySuccessRate}
          />

          <CriticalInventoryGrid
            lowStock={lowStock}
            branchPerformance={branchPerformance}
            onNavigate={onNavigate}
          />
        </>
      )}
    </div>
  );
}
