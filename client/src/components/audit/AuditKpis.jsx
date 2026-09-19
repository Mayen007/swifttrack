// client/src/components/audit/AuditKpis.jsx
import React from 'react';
import { FileCode, Activity, Globe, Lock } from 'lucide-react';

export function AuditKpis({ kpis }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Metric 1: Total Records */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
            AGGREGATE EVENTS
          </span>
          <FileCode className="w-4 h-4 text-blue-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
            {kpis.totalRecords}
          </span>
          <span className="font-mono text-xs text-slate-400">LOGGED</span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            100% APPEND-ONLY
          </span>
          <span className="text-slate-500">TAMPER-PROOF</span>
        </div>
      </div>

      {/* Metric 2: State Diffs */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
            STATE MUTATIONS
          </span>
          <Activity className="w-4 h-4 text-purple-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
            {kpis.diffRecords}
          </span>
          <span className="font-mono text-xs text-slate-400">WITH DIFFS</span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
          <span className="text-slate-400">BEFORE / AFTER</span>
          <span className="text-purple-400 font-bold">PRESERVED</span>
        </div>
      </div>

      {/* Metric 3: Unique Actors */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
            AUDITED ACTORS
          </span>
          <Globe className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
            {kpis.uniqueActors}
          </span>
          <span className="font-mono text-xs text-slate-400">OPERATORS</span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
          <span className="text-slate-400">ROLES AUDITED</span>
          <span className="text-emerald-400 font-mono">NON-REPUDIABLE</span>
        </div>
      </div>

      {/* Metric 4: Tamper Integrity */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
            TRIGGER ENFORCEMENT
          </span>
          <Lock className="w-4 h-4 text-amber-400" />
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-emerald-400 tracking-tight tabular-nums">
            ACTIVE
          </span>
          <span className="font-mono text-xs text-slate-400">TRIGGERS</span>
        </div>
        <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
          <span className="text-slate-400">MODIFICATION</span>
          <span className="text-amber-400 font-mono">BLOCKED AT SQL</span>
        </div>
      </div>
    </div>
  );
}
