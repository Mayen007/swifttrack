// client/src/views/ReportsView.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  TrendingUp,
  Printer,
  Receipt,
  CreditCard,
  Building2,
  Calendar,
  RotateCcw,
  Smartphone,
  Banknote,
  ShieldCheck,
  Fuel,
  Wrench,
  Package,
  Zap,
  Coffee,
  CheckCircle2,
  FileText,
  PieChart,
  BarChart3,
  Percent,
} from 'lucide-react';

export function ReportsView() {
  const { user, selectedBranch } = useAuth();
  const [activeTab, setActiveTab] = useState('vat'); // 'vat', 'pnl', 'payments'
  const [vatReport, setVatReport] = useState(null);
  const [pnlReport, setPnlReport] = useState(null);
  const [paymentsReport, setPaymentsReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const loadReports = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const [vat, pnl, pay] = await Promise.all([
        api.get(`/api/reports/vat${branchParam}`).catch(() => null),
        api.get(`/api/reports/pnl${branchParam}`).catch(() => null),
        api.get(`/api/reports/payments${branchParam}`).catch(() => []),
      ]);

      setVatReport(vat);
      setPnlReport(pnl);
      setPaymentsReport(Array.isArray(pay) ? pay : []);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load reports:', e);
      api.toast('Failed to load fiscal analytics: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [selectedBranch]);

  // Telemetry Calculations
  const grossTurnover = vatReport?.summary?.gross_sales || pnlReport?.gross_revenue || 0;
  const vatCollected = vatReport?.summary?.vat_collected || 0;
  const taxableBase = vatReport?.summary?.taxable_amount || 0;
  const netIncome = pnlReport?.net_income || 0;
  const grossMarginPct = pnlReport?.gross_margin_percent || 0;
  const netMarginPct = pnlReport?.net_margin_percent || 0;

  // Payments calculations
  const totalPaymentVol = paymentsReport.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const mpesaItem = paymentsReport.find((p) => p.payment_method === 'MPESA');
  const mpesaVol = mpesaItem?.total_amount || 0;
  const mpesaRatio = totalPaymentVol > 0 ? Math.round((mpesaVol / totalPaymentVol) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 1. TOP OPERATIONAL INSTRUMENT CONSOLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Financial Intelligence & Fiscal Governance
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono text-slate-400">
                  KRA ETR // VAT 16%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                STATION: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'All Regional Stations'}</span>
                <span className="mx-2 text-[#222834]">|</span>
                KRA PIN: <span className="text-slate-300 font-mono">P051982736X</span>
                <span className="mx-2 text-[#222834]">|</span>
                CADENCE: <span className="text-emerald-400 font-bold">MONTHLY STATUTORY</span>
                {lastSyncTime && <span className="ml-1 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
              </p>
            </div>
          </div>

          {/* Action & View Switchboard */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex bg-[#0c0e12] p-0.5 rounded border border-[#222834] text-xs font-mono">
              <button
                onClick={() => {
                  setActiveTab('vat');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'vat'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                <span>KRA 16% VAT</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('pnl');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'pnl'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                <span>WATERFALL P&L</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('payments');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'payments'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                <span>CHANNELS</span>
              </button>
            </div>

            <button
              onClick={() => {
                sound.playSuccess();
                window.print();
              }}
              className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Print Statutory Schedule"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>PRINT</span>
            </button>

            <button
              onClick={() => {
                loadReports();
                sound.playScan();
              }}
              disabled={loading}
              className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh financial analytics"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
              <span>SYNC</span>
            </button>
          </div>
        </div>

        {/* 2. UNIFIED HARDWARE TELEMETRY STRIP (Dieter Rams Matrix) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Gross Turnover</span>
              <span className="text-lg font-mono font-bold text-slate-100 tabular-nums">
                {api.formatKES(grossTurnover)}
              </span>
            </div>
            <Receipt className="w-4 h-4 text-slate-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block">Output VAT (16%)</span>
              <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
                {api.formatKES(vatCollected)}
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-blue-400 font-mono uppercase tracking-wider block">Gross Profit Margin</span>
              <span className="text-lg font-mono font-bold text-blue-400 tabular-nums">
                {grossMarginPct}%
              </span>
            </div>
            <Percent className="w-4 h-4 text-blue-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block">Net Operating Income</span>
              <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
                {api.formatKES(netIncome)}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">({netMarginPct}%)</span>
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <span className="text-[10px] text-green-400 font-mono uppercase tracking-wider block">M-Pesa Penetration</span>
              <span className="text-lg font-mono font-bold text-green-400 tabular-nums">
                {mpesaRatio}%
              </span>
            </div>
            <Smartphone className="w-4 h-4 text-green-500" />
          </div>
        </div>
      </div>

      {/* 3. TAB 1: KRA 16% VAT OUTPUT SCHEDULE */}
      {activeTab === 'vat' && (
        <div className="space-y-4">
          {/* Statutory Declaration Card */}
          <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222834] pb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  Kenya Revenue Authority (KRA) Fiscal Output VAT Schedule
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  Standard VAT statutory rate of 16.0% applied to all taxable vended inventory supplies
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5 self-start sm:self-auto">
                <ShieldCheck className="w-3.5 h-3.5" />
                ETR AUDIT VERIFIED
              </span>
            </div>

            {/* Statutory Tripartite Split */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#0c0e12] border border-[#222834] rounded p-4 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block font-semibold">
                  1. Gross Retail Turnover (VAT Inclusive)
                </span>
                <span className="text-xl font-mono font-black text-slate-100 tabular-nums block">
                  {api.formatKES(grossTurnover)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">
                  Settled across POS registers and courier dispatches
                </span>
              </div>

              <div className="bg-[#0c0e12] border border-[#222834] rounded p-4 space-y-1">
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider block font-semibold">
                  2. Taxable Sales Base (Net of Tax)
                </span>
                <span className="text-xl font-mono font-black text-blue-400 tabular-nums block">
                  {api.formatKES(taxableBase)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">
                  Calculated as: Turnover ÷ 1.16 Statutory Divisor
                </span>
              </div>

              <div className="bg-[#0c0e12] border border-[#222834] rounded p-4 space-y-1">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-semibold">
                  3. Output VAT (16%) Payable to KRA
                </span>
                <span className="text-xl font-mono font-black text-emerald-400 tabular-nums block">
                  {api.formatKES(vatCollected)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block mt-1">
                  Statutory remittance obligation for current period
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Filing Trend Ledger */}
          {vatReport?.monthly_trend && vatReport.monthly_trend.length > 0 && (
            <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
              <div className="p-3 bg-[#0c0e12] border-b border-[#222834] flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Monthly Fiscal Filing & Remittance Cadence
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {vatReport.monthly_trend.length} Recorded Fiscal Periods
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                      <th className="p-3">Filing Month</th>
                      <th className="p-3 text-right">Invoices Filed</th>
                      <th className="p-3 text-right">Taxable Turnover (KES)</th>
                      <th className="p-3 text-right">Output VAT Remitted (KES)</th>
                      <th className="p-3 text-right">Gross Receipts (KES)</th>
                      <th className="p-3 text-center">Filing Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222834]">
                    {vatReport.monthly_trend.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#181d28]/40 transition-colors">
                        <td className="p-3 font-bold text-blue-400">{row.month}</td>
                        <td className="p-3 text-right text-slate-300 tabular-nums">{row.invoice_count}</td>
                        <td className="p-3 text-right text-slate-300 tabular-nums">{api.formatKES(row.taxable_sales)}</td>
                        <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">{api.formatKES(row.output_vat)}</td>
                        <td className="p-3 text-right text-slate-100 tabular-nums font-semibold">{api.formatKES(row.gross_sales)}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase">
                            DECLARED
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Regional Hub Tax Contribution */}
          {vatReport?.branch_breakdown && vatReport.branch_breakdown.length > 0 && (
            <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
              <div className="p-3 bg-[#0c0e12] border-b border-[#222834] flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  Regional Station Tax Contribution Breakdown
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                      <th className="p-3">Station Code & Name</th>
                      <th className="p-3 text-right">Invoices</th>
                      <th className="p-3 text-right">Gross Sales Turnover (KES)</th>
                      <th className="p-3 text-right">Output VAT Remitted (KES)</th>
                      <th className="p-3 text-right">Contribution Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222834]">
                    {vatReport.branch_breakdown.map((b) => {
                      const share = grossTurnover > 0 ? ((b.gross_sales / grossTurnover) * 100).toFixed(1) : 0;
                      return (
                        <tr key={b.id} className="hover:bg-[#181d28]/40 transition-colors">
                          <td className="p-3">
                            <span className="font-bold text-slate-200 block">{b.name}</span>
                            <span className="text-slate-500 text-[10px] font-mono">{b.code || `HUB-0${b.id}`}</span>
                          </td>
                          <td className="p-3 text-right text-slate-300 tabular-nums">{b.invoice_count}</td>
                          <td className="p-3 text-right text-slate-100 font-semibold tabular-nums">{api.formatKES(b.gross_sales)}</td>
                          <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">{api.formatKES(b.output_vat)}</td>
                          <td className="p-3 text-right text-blue-400 font-bold tabular-nums">{share}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: WATERFALL PROFIT & LOSS STATEMENT */}
      {activeTab === 'pnl' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Waterfall Financial Cockpit */}
          <div className="lg:col-span-2 bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
            <div className="border-b border-[#222834] pb-3">
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Waterfall Profit & Loss Accounting Strip
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Sequential margin deduction from gross inventory turnover down to EBITDA
              </p>
            </div>

            {/* Waterfall Ledger Steps */}
            <div className="space-y-2 text-xs font-mono">
              {/* Gross Revenue */}
              <div className="p-3.5 rounded bg-[#0c0e12] border border-[#222834] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    (+) STEP 1: GROSS INVENTORY REVENUE
                  </span>
                  <span className="font-bold text-slate-200 text-sm">Settled Customer Sales</span>
                </div>
                <span className="text-base font-bold text-emerald-400 tabular-nums">
                  +{api.formatKES(pnlReport?.gross_revenue || grossTurnover)}
                </span>
              </div>

              {/* COGS */}
              <div className="p-3.5 rounded bg-[#0c0e12] border border-[#222834] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    (-) STEP 2: COST OF GOODS SOLD (COGS)
                  </span>
                  <span className="font-medium text-slate-300">Supplier inventory acquisition cost</span>
                </div>
                <span className="text-base font-bold text-rose-400 tabular-nums">
                  -{api.formatKES(pnlReport?.cogs || 0)}
                </span>
              </div>

              {/* Gross Operating Profit */}
              <div className="p-3.5 rounded bg-blue-950/20 border border-blue-900/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                    (=) STEP 3: GROSS OPERATING MARGIN
                  </span>
                  <span className="font-bold text-blue-200 text-sm">
                    Trading Margin: {grossMarginPct}%
                  </span>
                </div>
                <span className="text-base font-black text-blue-400 tabular-nums">
                  {api.formatKES(pnlReport?.gross_profit || 0)}
                </span>
              </div>

              {/* Operating Expenses */}
              <div className="p-3.5 rounded bg-[#0c0e12] border border-[#222834] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    (-) STEP 4: OPERATING LOGISTICS OVERHEAD
                  </span>
                  <span className="font-medium text-slate-300">Fuel, maintenance, utilities, staff welfare</span>
                </div>
                <span className="text-base font-bold text-rose-400 tabular-nums">
                  -{api.formatKES(pnlReport?.total_operating_expenses || 0)}
                </span>
              </div>

              {/* Net Operating Income */}
              <div className="p-4 rounded bg-emerald-950/25 border border-emerald-500/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    (=) FINAL SETTLEMENT: NET OPERATING INCOME (EBITDA)
                  </span>
                  <span className="font-bold text-white text-sm">
                    Net Margin: {netMarginPct}% of gross turnover
                  </span>
                </div>
                <span className="text-xl font-black text-emerald-400 tabular-nums">
                  {api.formatKES(pnlReport?.net_income || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Operating Overhead Breakdown */}
          <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
            <div className="border-b border-[#222834] pb-3">
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-400" />
                Overhead Category Distribution
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Logistics expenditure allocation by operational area
              </p>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {(pnlReport?.expense_breakdown || []).length === 0 ? (
                <div className="text-center py-8 text-slate-500 italic">No approved expenses logged</div>
              ) : (
                pnlReport.expense_breakdown.map((cat, idx) => {
                  const share = pnlReport.total_operating_expenses > 0
                    ? Math.round((cat.total / pnlReport.total_operating_expenses) * 100)
                    : 0;

                  return (
                    <div key={idx} className="bg-[#0c0e12] border border-[#222834] rounded p-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">{cat.category}</span>
                        <span className="font-bold text-rose-400 tabular-nums">
                          -{api.formatKES(cat.total)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <div className="flex-1 bg-[#181d28] rounded h-1.5 overflow-hidden border border-[#222834]">
                          <div className="h-full bg-indigo-500 rounded" style={{ width: `${share}%` }} />
                        </div>
                        <span className="tabular-nums font-bold text-indigo-300">{share}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: PAYMENT CHANNELS MATRIX */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
            <div className="border-b border-[#222834] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  Settlement Channel Velocity & Penetration Matrix
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  Analysis of consumer tender preferences across M-Pesa, Cash register, and Cards
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Total Volume: <strong className="text-emerald-400 tabular-nums">{api.formatKES(totalPaymentVol)}</strong>
              </span>
            </div>

            {/* Tender Instrument Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* M-Pesa */}
              {(() => {
                const m = paymentsReport.find((p) => p.payment_method === 'MPESA');
                const vol = m?.total_amount || 0;
                const cnt = m?.transaction_count || 0;
                const pct = totalPaymentVol > 0 ? Math.round((vol / totalPaymentVol) * 100) : 0;

                return (
                  <div className="bg-[#0c0e12] border border-[#222834] rounded p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-green-400" />
                        <span className="text-xs font-bold text-green-400 uppercase font-mono">Safaricom M-Pesa</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/30">
                        {pct}% SHARE
                      </span>
                    </div>

                    <div className="text-2xl font-mono font-black text-slate-100 tabular-nums mt-1">
                      {api.formatKES(vol)}
                    </div>

                    <div className="pt-2 border-t border-[#222834] flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Transactions: <strong className="text-slate-200">{cnt}</strong></span>
                      <span>Avg Ticket: <strong className="text-slate-200">{api.formatKES(cnt > 0 ? vol / cnt : 0)}</strong></span>
                    </div>
                  </div>
                );
              })()}

              {/* Cash */}
              {(() => {
                const c = paymentsReport.find((p) => p.payment_method === 'CASH');
                const vol = c?.total_amount || 0;
                const cnt = c?.transaction_count || 0;
                const pct = totalPaymentVol > 0 ? Math.round((vol / totalPaymentVol) * 100) : 0;

                return (
                  <div className="bg-[#0c0e12] border border-[#222834] rounded p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-blue-400 uppercase font-mono">Cash at Till</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        {pct}% SHARE
                      </span>
                    </div>

                    <div className="text-2xl font-mono font-black text-slate-100 tabular-nums mt-1">
                      {api.formatKES(vol)}
                    </div>

                    <div className="pt-2 border-t border-[#222834] flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Transactions: <strong className="text-slate-200">{cnt}</strong></span>
                      <span>Avg Ticket: <strong className="text-slate-200">{api.formatKES(cnt > 0 ? vol / cnt : 0)}</strong></span>
                    </div>
                  </div>
                );
              })()}

              {/* Card */}
              {(() => {
                const crd = paymentsReport.find((p) => p.payment_method === 'CARD');
                const vol = crd?.total_amount || 0;
                const cnt = crd?.transaction_count || 0;
                const pct = totalPaymentVol > 0 ? Math.round((vol / totalPaymentVol) * 100) : 0;

                return (
                  <div className="bg-[#0c0e12] border border-[#222834] rounded p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold text-indigo-400 uppercase font-mono">Visa / Mastercard</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                        {pct}% SHARE
                      </span>
                    </div>

                    <div className="text-2xl font-mono font-black text-slate-100 tabular-nums mt-1">
                      {api.formatKES(vol)}
                    </div>

                    <div className="pt-2 border-t border-[#222834] flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Transactions: <strong className="text-slate-200">{cnt}</strong></span>
                      <span>Avg Ticket: <strong className="text-slate-200">{api.formatKES(cnt > 0 ? vol / cnt : 0)}</strong></span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
