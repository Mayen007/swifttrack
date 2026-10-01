import React from 'react';
import { Sparkles } from 'lucide-react';

export function LoginDemoPersonas({ demoPersonas, onSelectPersona }) {
  return (
    <div className="mt-6 pt-5 border-t border-[#1e2536] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>DEMO PERSONA PRE-FILL</span>
        </div>
        <span className="text-[9px] font-mono text-slate-500">Click to instantly test</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {demoPersonas.map((p) => (
          <button
            key={p.username}
            type="button"
            onClick={() => onSelectPersona(p.username, p.role, p.branchId)}
            className="p-2 rounded-lg bg-[#141a27] hover:bg-[#1a2233] border border-[#222a3b] hover:border-amber-400/40 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold font-mono ${p.color}`}>{p.label}</span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono block truncate mt-0.5">{p.branch}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
