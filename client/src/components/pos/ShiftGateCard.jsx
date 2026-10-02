import React from 'react';
import { Lock, Unlock, Clock, AlertTriangle } from 'lucide-react';

export function ShiftGateCard({ onOpenShift }) {
  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="relative inline-flex items-center justify-center mx-auto">
          <span className="absolute w-24 h-24 rounded-full bg-amber-400/10 animate-ping opacity-60" />
          <span className="absolute w-20 h-20 rounded-full bg-amber-400/10 animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-[#1a1f2e] border-2 border-amber-500/50 flex items-center justify-center shadow-xl shadow-amber-500/10">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white tracking-tight font-mono uppercase">Register is Locked</h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
            Open your shift with a starting float to begin booking parcels and processing counter sales.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs font-mono text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold uppercase tracking-wider">NO ACTIVE SHIFT — REGISTER LOCKED</span>
        </div>
        <button
          type="button"
          onClick={onOpenShift}
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold font-mono text-sm uppercase tracking-wider shadow-lg shadow-amber-400/25 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <Unlock className="w-4 h-4" />
          <span>OPEN REGISTER SHIFT</span>
        </button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-500">
          <Clock className="w-3 h-3" />
          <span>Enter your opening float to unlock sales and parcel intake</span>
        </div>
      </div>
    </div>
  );
}
