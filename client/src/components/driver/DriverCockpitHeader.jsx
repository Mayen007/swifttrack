import React from 'react';
import {
  Bike,
  RotateCcw,
  Package,
  Navigation,
  CheckCircle2,
  Radio
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function DriverCockpitHeader({
  user,
  gpsCoords,
  activeTab,
  setActiveTab,
  activeCount,
  inTransitCount,
  completedTodayCount,
  loading,
  onRefresh
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-amber-400">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                Courier Execution Terminal
              </h1>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                ONLINE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              COURIER: <span className="text-slate-200 font-semibold">{user?.full_name || user?.username || 'Courier One'}</span>
              <span className="mx-2 text-[#222834]">|</span>
              GPS: <span className="text-slate-300 font-mono tabular-nums">{gpsCoords.latitude}, {gpsCoords.longitude}</span>
              <span className="ml-1 text-slate-500 text-[10px]">({gpsCoords.accuracy})</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[#0c0e12] p-0.5 rounded border border-[#222834] text-xs font-mono">
            <button
              onClick={() => {
                setActiveTab('ACTIVE');
                sound.playScan();
              }}
              className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ACTIVE'
                  ? 'bg-[#181d28] text-white border border-[#222834]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>ACTIVE RUNS</span>
              <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 text-[10px] tabular-nums">
                {activeCount}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('HISTORY');
                sound.playScan();
              }}
              className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'HISTORY'
                  ? 'bg-[#181d28] text-white border border-[#222834]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>POD HISTORY</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] tabular-nums">
                {completedTodayCount}
              </span>
            </button>
          </div>

          <button
            onClick={() => {
              onRefresh();
              sound.playScan();
            }}
            disabled={loading}
            className="h-8 w-8 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh assigned runs"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Assigned Manifests</span>
            <span className="text-lg font-mono font-bold text-slate-100 tabular-nums">{activeCount}</span>
          </div>
          <Package className="w-4 h-4 text-slate-600" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider block">En Route / Transit</span>
            <span className="text-lg font-mono font-bold text-cyan-400 tabular-nums">{inTransitCount}</span>
          </div>
          <Navigation className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block">Completed (POD)</span>
            <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">{completedTodayCount}</span>
          </div>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>

        <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider block">Route Status</span>
            <span className="text-xs font-mono font-bold text-amber-300">
              {activeCount > 0 ? (inTransitCount > 0 ? 'ON ROAD' : 'READY TO DEPART') : 'IDLE / HUB'}
            </span>
          </div>
          <Radio className={`w-3.5 h-3.5 ${inTransitCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
        </div>
      </div>
    </div>
  );
}
