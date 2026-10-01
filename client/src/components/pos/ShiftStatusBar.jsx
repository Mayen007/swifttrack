import React from 'react';
import { AlertTriangle, Coins, ArrowRightLeft, Printer, Lock, Unlock } from 'lucide-react';
import { api } from '../../services/api.js';

export function ShiftStatusBar({
  activeShift,
  onOpenMovement,
  onOpenExchange,
  onOpenReprint,
  onOpenCloseShift,
  onOpenOpenShift,
}) {
  return (
      <div className="w-full bg-[#12161f] border border-[#222834] rounded px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {activeShift ? (
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-white uppercase tracking-wider">
                SHIFT #{activeShift.shift_number}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-4 text-slate-400 border-l border-[#222834] pl-4">
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Drawer Cash</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {api.formatKES(activeShift.expected_cash)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Float</span>
                <span className="text-white tabular-nums">
                  {api.formatKES(activeShift.opening_float)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Shift Sales</span>
                <span className="text-white tabular-nums">
                  {api.formatKES(activeShift.total_sales_amount)} ({activeShift.total_sales_count})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold uppercase tracking-wider">
              NO ACTIVE SHIFT — REGISTER LOCKED
            </span>
            <span className="hidden sm:inline text-slate-400 text-[11px]">
              (Open shift with initial float to enable sales)
            </span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activeShift ? (
            <>
              <button
                onClick={() => onOpenMovement()}
                className="px-2.5 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Petty Cash Payout or Safe Drop"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">DRAWER MOVE</span>
              </button>

              <button
                onClick={() => onOpenExchange()}
                className="px-2.5 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Product Exchange"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden md:inline">EXCHANGE</span>
              </button>

              <button
                onClick={() => onOpenReprint()}
                className="px-2.5 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Reprint Customer Receipt"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden md:inline">REPRINT</span>
              </button>

              <button
                onClick={() => {
                  onOpenCloseShift()
                }}
                className="px-3 py-1.5 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-white text-[11px] font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Close Shift and Reconcile Cash Drawer"
              >
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>CLOSE SHIFT</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onOpenOpenShift()}
              className="px-3.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>OPEN REGISTER SHIFT</span>
            </button>
          )}
        </div>
      </div>

  );
}
