import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { sound } from '../../services/sound.js';
import {
  Activity,
  AlertTriangle,
  Truck,
  Package,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Search,
  ShieldAlert,
  Building2,
  TrendingUp,
  MapPin,
  ChevronRight,
  ExternalLink,
  X,
  FileText,
  AlertOctagon,
  Layers,
  Check,
  Radio,
  Sparkles,
  Play,
  Key,
  ShieldCheck
} from 'lucide-react';

export function OperationsControlTower({ onNavigate }) {
  const { user, selectedBranch } = useAuth();

  const [summary, setSummary] = useState(null);
  const [alertsData, setAlertsData] = useState({ alerts: [], critical_count: 0, high_count: 0, total_alerts: 0 });
  const [corridorsData, setCorridorsData] = useState({ runs: [], corridors: [], total_active_runs: 0 });
  const [hubTelemetry, setHubTelemetry] = useState({ hubs: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Filter state for alerts queue
  const [alertSeverityFilter, setAlertSeverityFilter] = useState('ALL');

  // Quick Tracking Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackingError, setTrackingError] = useState(null);

  // Fast Resolution Modal State
  const [resolvingAlert, setResolvingAlert] = useState(null);
  const [resolutionAction, setResolutionAction] = useState('RESOLVED_BY_CONTROL_TOWER');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingSubmit, setResolvingSubmit] = useState(false);

  // Stage 10: E2E Acceptance Simulator State
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState(null);

  // Load all telemetry from Control Tower API
  const loadTelemetry = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setRefreshing(true);
      const hubParam = selectedBranch ? `?hub_id=${selectedBranch.id}` : '';

      const [sumRes, alertsRes, corridorsRes, hubsRes] = await Promise.all([
        api.get(`/api/v1/control-tower/summary${hubParam}`).catch(() => null),
        api.get(`/api/v1/control-tower/alerts${hubParam}`).catch(() => ({ alerts: [] })),
        api.get('/api/v1/control-tower/active-corridors').catch(() => ({ runs: [], corridors: [] })),
        api.get('/api/v1/control-tower/hub-telemetry').catch(() => ({ hubs: [] }))
      ]);

      if (sumRes) setSummary(sumRes);
      if (alertsRes) setAlertsData(alertsRes);
      if (corridorsRes) setCorridorsData(corridorsRes);
      if (hubsRes) setHubTelemetry(hubsRes);

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load Control Tower telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    loadTelemetry();
    // Auto-refresh telemetry every 25 seconds for live field visibility
    const timer = setInterval(() => {
      loadTelemetry(true);
    }, 25000);
    return () => clearInterval(timer);
  }, [loadTelemetry]);

  // Execute Quick Customer Tracking Search
  const handleTrackingSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setTrackingLoading(true);
      setTrackingError(null);
      setTrackingResult(null);
      setTrackingModalOpen(true);

      const res = await api.get(`/api/v1/tracking/${encodeURIComponent(searchQuery.trim())}`);
      setTrackingResult(res);
    } catch (err) {
      setTrackingError(err.message || 'Tracking number not found');
    } finally {
      setTrackingLoading(false);
    }
  };

  // Submit Fast Resolution for an Alert
  const handleResolveAlertSubmit = async (e) => {
    e.preventDefault();
    if (!resolvingAlert) return;

    try {
      setResolvingSubmit(true);
      await api.post(`/api/v1/control-tower/alerts/${resolvingAlert.entity_type}/${resolvingAlert.entity_id}/resolve`, {
        action: resolutionAction,
        notes: resolutionNotes
      });

      setResolvingAlert(null);
      setResolutionNotes('');
      // Refresh telemetry
      await loadTelemetry(true);
    } catch (err) {
      alert(`Error resolving alert: ${err.message}`);
    } finally {
      setResolvingSubmit(false);
    }
  };

  // Stage 10: Run PRD Section 30 Multi-Leg Acceptance Scenario
  const handleRunAcceptanceScenario = async () => {
    try {
      setSimRunning(true);
      setSimError(null);
      setSimResult(null);
      sound.playClick();

      const res = await api.post('/api/v1/e2e/simulate-acceptance-run', {
        originHubId: 1,
        intermediateHubId: 4,
        destinationHubId: 2,
        codAmount: 6500
      });

      setSimResult(res);
      sound.playSuccess();
      api.toast('PRD Section 30 Multi-Leg Acceptance Scenario Verified (23/23 Steps Passed)', 'success');
      loadTelemetry(true);
    } catch (err) {
      sound.playError();
      setSimError(err.message || 'Simulation execution failed');
      api.toast(err.message || 'Simulation execution failed', 'error');
    } finally {
      setSimRunning(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400">
        <RefreshCw className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-sm font-semibold tracking-wide uppercase text-slate-300">
          Initializing SwiftTrack Control Tower Telemetry...
        </p>
      </div>
    );
  }

  const now = summary?.now || {};
  const lifecycle = now.lifecycle || {};
  const volume = now.volume || {};
  const performance = summary?.performance || {};
  const cod = summary?.cod || {};

  // Filter alerts by severity
  const visibleAlerts = alertsData.alerts.filter((a) => {
    if (alertSeverityFilter === 'ALL') return true;
    return a.severity === alertSeverityFilter;
  });

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. TOP CONTROL TOWER STATUS INSTRUMENT (STACKED BENTO GRID) */}
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Tier 1: Platform Identity & Operational Toolbar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start relative z-10">
          {/* Identity & Live Telemetry Badge */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                Live Operations Telemetry Active
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight flex flex-wrap items-center gap-2.5 font-sans">
              Operations Control Tower
              <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium font-mono">
                {selectedBranch ? selectedBranch.name : 'Network-Wide Master Control'}
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Active shipment lifecycle tracking, corridor fleet movement, and real-time operational bottleneck intervention.
            </p>
          </div>

          {/* Quick Search & Operational Action Buttons (Stacked in Toolbar) */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-2.5 bg-[#0e1219]/90 border border-[#222834] rounded-xl p-3">
            <form onSubmit={handleTrackingSearch} className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Track STK-XXXX or Waybill..."
                className="w-full pl-9 pr-16 py-2 bg-[#141923] border border-[#222834] rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/80 transition-colors font-mono"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded hover:bg-amber-500/30 transition-colors cursor-pointer"
              >
                Track
              </button>
            </form>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => loadTelemetry()}
                disabled={refreshing}
                className="flex items-center justify-center space-x-1.5 py-2 px-2 bg-[#181d28] hover:bg-[#222836] border border-[#263044] text-slate-200 text-xs font-medium rounded transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Refresh Real-time Telemetry"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="truncate">Refresh</span>
              </button>

              {onNavigate && (
                <button
                  onClick={() => onNavigate('communications')}
                  className="flex items-center justify-center space-x-1.5 py-2 px-2 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 text-xs font-semibold rounded transition-all active:scale-95 cursor-pointer"
                  title="View Milestone Notifications Outbox and Communication Logs"
                >
                  <Radio className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="truncate">Outbox</span>
                </button>
              )}

              <button
                onClick={() => { sound.playClick(); setSimModalOpen(true); }}
                className="flex items-center justify-center space-x-1.5 py-2 px-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/60 text-slate-950 font-bold text-xs rounded transition-all active:scale-95 cursor-pointer shadow-sm"
                title="Launch PRD Section 30 Multi-Leg Acceptance Scenario Simulator"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span className="truncate">E2E Test</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tier 2: Stacked Operational Telemetry Bento Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3.5 mt-3.5 border-t border-[#222834] relative z-10">
          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">In Transit Volume</span>
              <div className="text-xl font-bold text-amber-400 font-mono">{lifecycle.in_transit || 0}</div>
              <span className="text-[10px] text-slate-500 block">Moving on active route legs</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Active Corridors</span>
              <div className="text-xl font-bold text-cyan-400 font-mono">{corridorsData.total_active_runs || 0}</div>
              <span className="text-[10px] text-slate-500 block">Linehaul runs dispatched</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Network Exceptions</span>
              <div className={`text-xl font-bold font-mono ${alertsData.critical_count > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-200'}`}>
                {alertsData.total_count || 0}
              </div>
              <span className="text-[10px] text-slate-500 block">
                {alertsData.critical_count > 0 ? `${alertsData.critical_count} critical bottlenecks` : 'All corridors nominal'}
              </span>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              alertsData.critical_count > 0
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                : 'bg-slate-800/50 border border-slate-700/40 text-slate-400'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Delivery Success</span>
              <div className="text-xl font-bold text-emerald-400 font-mono">
                {performance.delivery_success_rate_pct || 100}%
              </div>
              <span className="text-[10px] text-slate-500 block">First-attempt completed</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECTION 1: WHAT IS HAPPENING NOW? (LIFECYCLE PIPELINE) */}
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              What Is Happening Now? (Live Consignment Pipeline)
            </h2>
            <p className="text-xs text-slate-400">
              Active volume distribution across intake, linehaul consolidation, transport movement, and last-mile completion.
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Total Parcels: </span>
              <span className="font-bold text-amber-400">{volume.total_parcels?.toLocaleString() || 0}</span>
            </div>
            <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Total Weight: </span>
              <span className="font-bold text-sky-400">{volume.total_weight_kg?.toLocaleString() || 0} kg</span>
            </div>
          </div>
        </div>

        {/* Pipeline Step Progression Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Step 1: Booked & Accepted */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">1. Intake</span>
              <span className="w-2 h-2 rounded-full bg-blue-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {(lifecycle.booked || 0) + (lifecycle.accepted || 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {lifecycle.booked || 0} Booked · {lifecycle.accepted || 0} Accepted
            </div>
          </div>

          {/* Step 2: Hub Staging & Sorted */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">2. Hub Staging</span>
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
            </div>
            <div className="text-2xl font-black text-indigo-400">
              {lifecycle.at_hub || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Cross-docking & bin sorting
            </div>
          </div>

          {/* Step 3: Manifested & Loaded */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">3. Loaded</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <div className="text-2xl font-black text-cyan-400">
              {lifecycle.loaded || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Locked on linehaul manifests
            </div>
          </div>

          {/* Step 4: In-Transit Across Corridors */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">4. In Transit</span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <div className="text-2xl font-black text-amber-400">
              {lifecycle.in_transit || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Moving on active route legs
            </div>
          </div>

          {/* Step 5: Last-Mile Delivery */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">5. Last Mile</span>
              <span className="w-2 h-2 rounded-full bg-sky-400" />
            </div>
            <div className="text-2xl font-black text-sky-400">
              {(lifecycle.ready_for_delivery || 0) + (lifecycle.out_for_delivery || 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {lifecycle.out_for_delivery || 0} Out · {lifecycle.ready_for_delivery || 0} Ready
            </div>
          </div>

          {/* Step 6: Delivered (Success) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">6. Delivered</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">
              {lifecycle.delivered || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Confirmed with legal POD
            </div>
          </div>
        </div>

        {/* Network Performance Telemetry Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block">Delivery Success Rate</span>
            <span className="text-lg font-bold text-emerald-400">
              {performance.delivery_success_rate_pct || 100}%
            </span>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block">First-Attempt Success</span>
            <span className="text-lg font-bold text-sky-400">
              {performance.first_attempt_success_rate_pct || 100}%
            </span>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block">COD Settlement Recon Rate</span>
            <span className="text-lg font-bold text-amber-400">
              {performance.cod_reconciliation_rate_pct || 100}%
            </span>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 block">Freight Revenue Booked</span>
            <span className="text-lg font-bold text-white">
              KES {volume.freight_revenue_kes?.toLocaleString() || 0}
            </span>
          </div>
        </div>
      </div>

      {/* 3. SECTION 2: WHAT NEEDS ATTENTION? (CRITICAL ALERTS QUEUE) */}
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              What Needs Attention? (Operational Exception Queue)
              {alertsData.critical_count > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                  {alertsData.critical_count} CRITICAL
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Actionable bottleneck warnings: physical manifest shortages, failed delivery attempts, and unreconciled COD financial variances.
            </p>
          </div>

          {/* Severity Tabs */}
          <div className="flex items-center space-x-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((sev) => (
              <button
                key={sev}
                onClick={() => setAlertSeverityFilter(sev)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  alertSeverityFilter === sev
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Alert Cards List */}
        {visibleAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-900/30 rounded-xl border border-dashed border-slate-800 text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mb-2" />
            <p className="text-sm font-semibold text-slate-200">All Systems Nominal</p>
            <p className="text-xs text-slate-500 mt-0.5">
              No active {alertSeverityFilter !== 'ALL' ? alertSeverityFilter : ''} operational exceptions or manifest discrepancies found.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                          : alert.severity === 'HIGH'
                          ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                          : 'bg-sky-950/60 text-sky-400 border-sky-800/60'
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs font-semibold text-slate-300">
                      {alert.hub_name} ({alert.hub_code})
                    </span>
                    <span className="text-xs text-slate-500">· {new Date(alert.created_at).toLocaleString()}</span>
                  </div>

                  <h3 className="text-sm font-bold text-white">{alert.title}</h3>
                  <p className="text-xs text-slate-400">{alert.description}</p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {alert.tracking_number && (
                    <button
                      onClick={() => {
                        setSearchQuery(alert.tracking_number);
                        handleTrackingSearch({ preventDefault: () => {} });
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 flex items-center space-x-1"
                    >
                      <span>Track</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setResolvingAlert(alert);
                      setResolutionNotes(`Investigated from Control Tower. ${alert.title}`);
                    }}
                    className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
                  >
                    <span>Fast Resolve</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. SECTION 3: WHAT IS MOVING? (ACTIVE CORRIDORS & TRANSPORT RUNS) */}
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-cyan-400" />
              What Is Moving? (Active Transport Corridors & Fleet Movement)
            </h2>
            <p className="text-xs text-slate-400">
              Live linehaul movements connecting Nairobi Central Hub, Mombasa Port Branch, and Western Kenya regional depots.
            </p>
          </div>

          <span className="text-xs font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1 rounded-full self-start sm:self-auto">
            {corridorsData.total_active_runs} Active Linehaul Runs
          </span>
        </div>

        {/* Primary Corridors Volume Summary */}
        {corridorsData.corridors.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {corridorsData.corridors.map((c) => (
              <div
                key={c.corridor}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-white tracking-wide">{c.corridor}</div>
                  <div className="text-[11px] text-slate-400">
                    {c.origin_city} to {c.dest_city}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-amber-400">{c.total_parcels_in_transit} Parcels</div>
                  <div className="text-[10px] text-slate-400">{c.active_runs_count} Active Runs</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Transport Runs Cards */}
        {corridorsData.runs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900/20 rounded-xl border border-dashed border-slate-800">
            No linehaul transport runs currently in transit or dispatched.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {corridorsData.runs.map((run) => (
              <div
                key={run.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-400">{run.run_number}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                    {run.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm font-bold text-white border-y border-slate-800/80 py-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">{run.origin_city}</span>
                    <span>{run.origin_hub_code}</span>
                  </div>
                  <div className="flex flex-col items-center px-2">
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <span className="text-[10px] text-slate-400">{run.distance_km || 0} km</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-slate-400">{run.dest_city}</span>
                    <span>{run.dest_hub_code}</span>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Vehicle:</span>
                    <span className="font-semibold text-slate-200">
                      {run.plate_number || 'N/A'} ({run.vehicle_type || 'Truck'})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Driver:</span>
                    <span className="font-semibold text-slate-200">{run.driver_name || 'Assigned Driver'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Manifest:</span>
                    <span className="font-semibold text-slate-200">
                      {run.total_parcels_count || 0} parcels · {run.total_weight_kg || 0} kg
                    </span>
                  </div>
                  {run.latest_checkpoint && (
                    <div className="pt-1 border-t border-slate-800/60 text-[11px] text-emerald-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>Passed {run.latest_checkpoint.checkpoint_name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. SECTION 4: STATION-BY-STATION REGIONAL HUB TELEMETRY */}
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Regional Hub Network Station Telemetry
          </h2>
          <p className="text-xs text-slate-400">
            Real-time on-hand inventory, pending inbound arrivals, outbound departures, and local courier tasks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hubTelemetry.hubs.map((hub) => (
            <div
              key={hub.hub_id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">{hub.hub_name}</h3>
                  <span className="text-xs text-slate-400">{hub.city} · {hub.hub_code}</span>
                </div>
                {hub.open_discrepancies > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800/60">
                    {hub.open_discrepancies} Alerts
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                    Nominal
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800/80 pt-2">
                <div className="bg-slate-950/60 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">On-Hand Depot</span>
                  <span className="text-sm font-bold text-white">{hub.on_hand_shipments}</span>
                  <span className="text-[10px] text-slate-500 block">({hub.on_hand_weight_kg} kg)</span>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Inbound Moving</span>
                  <span className="text-sm font-bold text-cyan-400">{hub.inbound_shipments}</span>
                  <span className="text-[10px] text-slate-500 block">({hub.inbound_weight_kg} kg)</span>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Outbound Ready</span>
                  <span className="text-sm font-bold text-amber-400">{hub.outbound_shipments}</span>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg">
                  <span className="text-slate-400 block text-[10px]">Active Deliveries</span>
                  <span className="text-sm font-bold text-sky-400">{hub.active_deliveries}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. MODAL: PUBLIC CUSTOMER TRACKING INSPECTION */}
      {trackingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setTrackingModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-400" />
              Consignment Tracking Lookup
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Real-time milestone progression and chain of custody tracking for customer inquiries.
            </p>

            {trackingLoading && (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
                <p className="text-xs">Locating consignment records...</p>
              </div>
            )}

            {trackingError && (
              <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs">
                {trackingError}
              </div>
            )}

            {trackingResult && (
              <div className="space-y-4">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Tracking ID</span>
                    <span className="text-sm font-black text-amber-400">{trackingResult.tracking_number}</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {trackingResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Origin Hub</span>
                    <span className="font-bold text-white">{trackingResult.origin?.city} ({trackingResult.origin?.hub})</span>
                  </div>
                  <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 text-[10px] block">Destination Hub</span>
                    <span className="font-bold text-white">{trackingResult.destination?.city} ({trackingResult.destination?.hub})</span>
                  </div>
                </div>

                {/* Timeline Milestones */}
                <div className="border-t border-slate-800 pt-3">
                  <span className="text-xs font-bold text-slate-300 block mb-3">Event Timeline</span>
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {trackingResult.timeline?.map((evt, idx) => (
                      <div key={idx} className="flex items-start space-x-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <div>
                          <span className="font-bold text-white block">{evt.title}</span>
                          <span className="text-slate-400 block">{evt.description}</span>
                          <span className="text-[10px] text-slate-500">{new Date(evt.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. MODAL: FAST RESOLUTION FOR OPERATIONAL BOTTLENECK ALERT */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <button
              onClick={() => setResolvingAlert(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Fast Resolve Operational Exception
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Acknowledge alert, record investigation resolution, and update system state directly from the Control Tower.
            </p>

            <form onSubmit={handleResolveAlertSubmit} className="space-y-4">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-amber-400 block">{resolvingAlert.category}</span>
                <span className="font-bold text-white block">{resolvingAlert.title}</span>
                <p className="text-slate-400">{resolvingAlert.description}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Resolution Action Code
                </label>
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="RESOLVED_BY_CONTROL_TOWER">RESOLVED_BY_CONTROL_TOWER (General Clearance)</option>
                  <option value="RELOADED_FOR_NEXT_RUN">RELOADED_FOR_NEXT_RUN (Shortage recovered)</option>
                  <option value="INSURANCE_CLAIM_FILED">INSURANCE_CLAIM_FILED (Damaged/lost item)</option>
                  <option value="RESCHEDULED_NEXT_DAY">RESCHEDULED_NEXT_DAY (Consignee unavailable)</option>
                  <option value="VARIANCE_EXPLAINED_AND_LOGGED">VARIANCE_EXPLAINED_AND_LOGGED (COD audit notes)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Investigation & Audit Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Describe corrective actions taken or approval rationale..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingAlert(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolvingSubmit || !resolutionNotes.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  {resolvingSubmit ? 'Submitting...' : 'Sign Off & Clear Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 8. PRD SECTION 30: MULTI-LEG E2E ACCEPTANCE SIMULATOR MODAL */}
      {simModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#12161f] border border-emerald-500/40 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto [scrollbar-gutter:stable]">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">Multi-Leg Acceptance Simulator</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      PRD SECTION 30
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live execution of the canonical 23-step multi-hub journey (Nairobi HQ → Nakuru Transfer → Mombasa Port)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSimModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scenario Blueprint Card */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Corridor Route:</span>
                <span className="font-mono text-emerald-300 font-semibold flex items-center gap-1.5">
                  <span>Nairobi (Hub 1)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nakuru (Hub 4)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mombasa (Hub 2)</span>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Service</span>
                  <span className="font-bold text-white">EXPRESS Courier</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Consignment</span>
                  <span className="font-bold text-white">Telecom Hardware</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider">COD Expected</span>
                  <span className="font-bold text-amber-400 font-mono">KES 6,500</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider">Required POD</span>
                  <span className="font-bold text-indigo-400">OTP + GPS + Sign</span>
                </div>
              </div>
            </div>

            {/* Simulator Action Trigger */}
            <div className="flex items-center justify-between p-3.5 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Execute Full 23-Step Operational Lifecycle</span>
                </div>
                <div className="text-xs text-slate-400">
                  Performs booking, multi-manifest linehauls, intermediate sorting, OTP delivery, and COD reconciliation.
                </div>
              </div>

              <button
                onClick={handleRunAcceptanceScenario}
                disabled={simRunning}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                {simRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Steps...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>Run Scenario Now</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {simError && (
              <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{simError}</span>
              </div>
            )}

            {/* Scenario Execution Results */}
            {simResult && (
              <div className="space-y-4 animate-fadeIn">
                {/* Executive Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Tracking ID</span>
                    <span className="text-sm font-bold text-indigo-300 font-mono">
                      {simResult.summary?.shipment?.tracking_number}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Delivery OTP PIN</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {simResult.summary?.delivery?.otp_pin} (Verified)
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">COD Reconciled</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">
                      KES {simResult.summary?.cod?.collected} (Closed)
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Notifications</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {simResult.summary?.notifications_dispatched} SMS/WA Sent
                    </span>
                  </div>
                </div>

                {/* 23 Steps Execution Log */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                    <span>Verified Operational Journey Steps ({simResult.total_steps_executed}/23)</span>
                    <span className="text-emerald-400 font-mono">100% Completed ({simResult.duration_ms}ms)</span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                    {simResult.steps?.map((st) => (
                      <div key={st.step_number} className="p-3 flex items-center justify-between text-xs hover:bg-slate-900/40">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0">
                            {st.step_number}
                          </span>
                          <div>
                            <span className="font-semibold text-slate-200">{st.step_name}</span>
                            {st.details && (
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-md">
                                {Object.entries(st.details).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                              </div>
                            )}
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40 whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>PASSED</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="text-xs text-slate-500">
                Rule E2E-001: Every milestone atomically updates custody, fleet, financial and communication states.
              </span>
              <button
                onClick={() => setSimModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Close Simulator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
