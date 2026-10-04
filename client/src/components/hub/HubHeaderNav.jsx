import React from 'react';
import {
  Building2,
  RefreshCw,
  ScanBarcode,
  Layers,
  ArrowRightLeft,
  FileCheck2,
  AlertTriangle,
  Globe,
  Truck
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function HubHeaderNav({
  selectedBranch,
  currentHubId,
  loading,
  onSync,
  activeTab,
  onTabChange,
  manifestsCount = 0,
  discrepanciesCount = 0,
  crossBorderCount = 0,
  awaitingCount = 0
}) {
  const tabs = [
    { id: 'RECEIVING', label: 'Inbound', icon: ScanBarcode },
    { id: 'SORT', label: 'Sortation', icon: Layers },
    { id: 'HANDOFFS', label: 'Handoffs', icon: ArrowRightLeft },
    { id: 'MANIFESTS', label: 'Manifests', icon: FileCheck2, count: manifestsCount },
    { id: 'DISCREPANCIES', label: 'Discrepancies', icon: AlertTriangle, count: discrepanciesCount, alert: discrepanciesCount > 0 },
    { id: 'CROSS_BORDER', label: 'Cross-Border', icon: Globe, count: crossBorderCount },
    { id: 'TRANSSHIPMENT', label: 'Transshipment', icon: Truck, count: awaitingCount },
  ];

  return (
    <div className="bg-[#121622] border border-[#222834] p-3 sm:p-3.5 rounded-xl space-y-2.5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight font-mono">
                {selectedBranch?.name || 'Distribution Hub'}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Station #{currentHubId}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onSync}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg bg-[#181d28] hover:bg-[#202738] border border-[#222834] text-xs font-mono font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Sync station telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">SYNC TELEMETRY</span>
            <span className="sm:hidden">SYNC</span>
          </button>
        </div>
      </div>

      <div className="bg-[#0b0e14] p-1 rounded-lg border border-[#1e2433] flex items-center gap-1 overflow-x-auto no-scrollbar text-xs font-mono">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                sound.playClick();
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold leading-none ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : tab.alert
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
