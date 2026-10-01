import React from 'react';
import {
  Clock,
  FileText,
  Award,
  TrendingUp,
  Receipt,
  CheckCircle2
} from 'lucide-react';

export function ProcurementTelemetry({ telemetry }) {
  return (
    <div className="px-6 py-3.5 border-b border-slate-800/60 bg-[#0e1118]/60 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Active POs</div>
        <div className="text-xl font-bold font-mono text-white mt-1">{telemetry.active_pos || 0}</div>
        <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" /> In fulfillment pipeline
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Pending PR Approvals</div>
        <div className="text-xl font-bold font-mono text-amber-400 mt-1">{telemetry.pending_prs || 0}</div>
        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
          <FileText className="w-3 h-3" /> Awaiting sign-off
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Active Suppliers</div>
        <div className="text-xl font-bold font-mono text-white mt-1">{telemetry.active_suppliers || 0}</div>
        <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
          <Award className="w-3 h-3" /> Verified KRA PIN vendors
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">PO Commitments</div>
        <div className="text-lg font-bold font-mono text-white mt-1 truncate">
          KES {(telemetry.total_po_spend || 0).toLocaleString()}
        </div>
        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
          <TrendingUp className="w-3 h-3" /> Total PO value
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Open Payables</div>
        <div className="text-lg font-bold font-mono text-rose-400 mt-1 truncate">
          KES {(telemetry.open_payable_amount || 0).toLocaleString()}
        </div>
        <div className="text-[10px] text-rose-400/80 flex items-center gap-1 mt-0.5">
          <Receipt className="w-3 h-3" /> Unsettled invoices
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Quality Pass Rate</div>
        <div className="text-xl font-bold font-mono text-emerald-400 mt-1">98.4%</div>
        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Inbound inspection
        </div>
      </div>
    </div>
  );
}
