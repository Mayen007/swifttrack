import React from 'react';
import { Sparkles } from 'lucide-react';

export function LoginDemoPersonas({ demoPersonas, onSelectPersona, demoPassword }) {
  return (
    <div className="mt-6 pt-5 border-t border-[#1e2536] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>DEMO ACCOUNT SWITCHER</span>
        </div>
        <span className="text-[9px] font-mono text-slate-500">Demo only</span>
      </div>

      <div className="rounded-md border border-amber-400/20 bg-amber-400/5 px-2.5 py-2 text-[10px] text-slate-300">
        Shared demo password <code className="ml-1 font-mono font-bold text-amber-300">{demoPassword}</code>
        <span className="mt-1 block text-slate-500">For freshly seeded demo accounts; passwords may differ if changed.</span>
      </div>

      <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
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
            <span className="text-[9px] text-slate-300 font-mono block truncate mt-0.5">{p.username}</span>
            <span className="text-[9px] text-slate-500 font-mono block truncate">{p.branch}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
