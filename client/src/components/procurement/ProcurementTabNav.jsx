import React from 'react';
import { Search } from 'lucide-react';
import { sound } from '../../services/sound.js';

export function ProcurementTabNav({
  tabs,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange
}) {
  return (
    <div className="px-6 py-2.5 border-b border-slate-800/80 bg-[#12161f]/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                sound.playClick();
                onTabChange(tab.id);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive
                      ? 'bg-amber-500/30 text-amber-200'
                      : tab.highlight && tab.count > 0
                      ? 'bg-amber-500/20 text-amber-300 font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-56 pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
