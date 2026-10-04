import React from 'react';
import {
  RefreshCw,
  Zap,
  Send,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit3,
  ShieldCheck
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function CommunicationsHeader({
  stats,
  loading,
  actionLoading,
  canManage,
  onRefresh,
  onProcessQueue,
  onOpenTest,
  activeTab,
  setActiveTab,
  outboxCount,
  templatesCount
}) {
  return (
    <div className="space-y-6">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start relative z-10">
          <div className="lg:col-span-7 xl:col-span-7 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
              </span>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/40">
                Automated Communications Engine Active
              </span>
              <span className="text-xs text-slate-400 font-mono">
                SMS • WhatsApp • Email Relay
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight flex flex-wrap items-center gap-2.5 font-sans">
              Communications Dispatch Engine
              <span className="text-xs px-2.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-medium font-mono">
                Automated Event Triggers
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Multi-channel transactional outbox with guaranteed zero-blocking dispatch, template interpolation, and milestone lifecycle hooks.
            </p>
          </div>

          <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-2.5 bg-[#0e1219]/90 border border-[#222834] rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono pb-1 border-b border-[#222834]">
              <span>QUEUE CONTROLS</span>
              <span className="text-emerald-400 font-semibold">Automated SLA Worker Active</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => {
                  sound.playClick();
                  onRefresh();
                }}
                disabled={loading}
                className="flex items-center justify-center space-x-1.5 py-2 px-2.5 bg-[#181d28] hover:bg-[#222836] border border-[#263044] text-slate-200 text-xs font-medium rounded transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Refresh Outbox Telemetry"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
                <span className="truncate">Refresh</span>
              </button>

              {canManage && (
                <>
                  <button
                    onClick={onProcessQueue}
                    disabled={actionLoading}
                    className="flex items-center justify-center space-x-1.5 py-2 px-2.5 bg-[#181d28] hover:bg-[#222836] border border-amber-500/30 text-amber-300 text-xs font-semibold rounded transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    title="Sweep and dispatch all pending outbox records now"
                  >
                    <Zap className={`w-3.5 h-3.5 text-amber-400 ${actionLoading ? 'animate-spin' : ''}`} />
                    <span className="truncate">Process</span>
                  </button>

                  <button
                    onClick={() => {
                      sound.playClick();
                      onOpenTest();
                    }}
                    className="flex items-center justify-center space-x-1.5 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/60 text-white font-bold text-xs rounded transition-all active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span className="truncate">Test Send</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3.5 mt-3.5 border-t border-[#222834] relative z-10">
          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Total Queued</span>
              <div className="text-xl font-bold text-white font-mono">{stats.total_notifications}</div>
              <span className="text-[10px] text-slate-500 block font-mono">Milestones</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Delivery SLA</span>
              <div className="text-xl font-bold text-emerald-400 font-mono">{stats.delivery_rate_pct}%</div>
              <span className="text-[10px] text-emerald-500/80 block font-mono">&gt;98.5% Target</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Delivered</span>
              <div className="text-xl font-bold text-white font-mono">{stats.sent_count}</div>
              <span className="text-[10px] text-slate-500 block font-mono">Carrier ACK</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Pending Outbox</span>
              <div className={`text-xl font-bold font-mono ${stats.pending_count > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
                {stats.pending_count}
              </div>
              <span className="text-[10px] text-slate-500 block font-mono">Worker cycle</span>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stats.pending_count > 0 ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-800/50 border border-slate-700/40 text-slate-400'}`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between col-span-2 sm:col-span-1">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Failed / Retrying</span>
              <div className={`text-xl font-bold font-mono ${stats.failed_count > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
                {stats.failed_count}
              </div>
              <span className="text-[10px] text-slate-500 block font-mono">Backoff retry</span>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stats.failed_count > 0 ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400' : 'bg-slate-800/50 border border-slate-700/40 text-slate-400'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('outbox');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'outbox'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Transactional Outbox & Logs</span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
            {outboxCount}
          </span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('templates');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'templates'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>Milestone Templates</span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
            {templatesCount}
          </span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('gateways');
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'gateways'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Gateway Adapters</span>
        </button>
      </div>
    </div>
  );
}
