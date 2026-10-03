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
      <div className="w-full bg-[#12161f] border border-[#222834] rounded px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        {activeShift ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs font-mono w-full sm:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-white uppercase tracking-wider">
                  SHIFT #{activeShift.shift_number}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  ACTIVE
                </span>
              </div>

              {/* Mobile Drawer Cash quick badge */}
              <div className="sm:hidden text-right">
                <span className="text-[10px] uppercase text-slate-500 mr-1.5">Cash:</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {api.formatKES(activeShift.expected_cash)}
                </span>
              </div>
            </div>

            {/* Desktop Metrics */}
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

            {/* Mobile secondary metrics row */}
            <div className="flex sm:hidden items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-[#222834]/80">
              <div>
                <span className="text-slate-500 uppercase text-[9px] mr-1">Float:</span>
                <span className="text-slate-200">{api.formatKES(activeShift.opening_float)}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[9px] mr-1">Sales:</span>
                <span className="text-white font-bold">{api.formatKES(activeShift.total_sales_amount)}</span>
                <span className="text-slate-500 ml-1">({activeShift.total_sales_count})</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold uppercase tracking-wider text-[11px] sm:text-xs">
              NO ACTIVE SHIFT — REGISTER LOCKED
            </span>
            <span className="hidden md:inline text-slate-400 text-[11px]">
              (Open shift with initial float to enable sales)
            </span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 justify-end w-full sm:w-auto">
          {activeShift ? (
            <>
              <button
                onClick={() => onOpenMovement()}
                className="flex-1 sm:flex-none px-2.5 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] font-mono text-slate-200 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Petty Cash Payout or Safe Drop"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden xs:inline sm:hidden md:inline">DRAWER MOVE</span>
                <span className="inline xs:hidden sm:inline md:hidden">MOVE</span>
              </button>

              <button
                onClick={() => onOpenExchange()}
                className="flex-1 sm:flex-none px-2.5 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] font-mono text-slate-200 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Product Exchange"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="hidden xs:inline sm:hidden md:inline">EXCHANGE</span>
                <span className="inline xs:hidden sm:inline md:hidden">EXCH</span>
              </button>

              <button
                onClick={() => onOpenReprint()}
                className="flex-1 sm:flex-none px-2.5 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] font-mono text-slate-200 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Reprint Customer Receipt"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="hidden xs:inline sm:hidden md:inline">REPRINT</span>
                <span className="inline xs:hidden sm:inline md:hidden">PRINT</span>
              </button>

              <button
                onClick={() => {
                  onOpenCloseShift()
                }}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-white text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                title="Close Shift and Reconcile Cash Drawer"
              >
                <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>CLOSE SHIFT</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onOpenOpenShift()}
              className="w-full sm:w-auto px-3.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>OPEN REGISTER SHIFT</span>
            </button>
          )}
        </div>
      </div>

  );
}
