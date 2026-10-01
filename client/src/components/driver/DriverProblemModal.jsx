import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

export function DriverProblemModal({
  isOpen,
  onClose,
  problemDelivery,
  problemReason,
  setProblemReason,
  problemNotes,
  setProblemNotes,
  onSubmit
}) {
  if (!isOpen || !problemDelivery) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 overflow-y-auto overscroll-contain">
      <div className="bg-[#12161f] border border-rose-500/40 rounded p-6 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 my-auto max-h-[92vh] overflow-y-auto overscroll-contain">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider block font-bold">
            INCIDENT DISPATCH REPORT
          </span>
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Report Problem for #{problemDelivery.delivery_number}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            Destination: {problemDelivery.delivery_address} ({problemDelivery.recipient_name})
          </p>
        </div>

        <div className="space-y-3 text-xs font-mono">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Failure / Road Disruption Cause *
            </label>
            <select
              value={problemReason}
              onChange={(e) => setProblemReason(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="Customer Phone Switched Off / Unreachable">Customer Phone Switched Off / Unreachable</option>
              <option value="Customer Not at Delivery Address">Customer Not at Delivery Address</option>
              <option value="Address Incomplete or Undeliverable">Address Incomplete or Undeliverable</option>
              <option value="Customer Refused Delivery / Cancelled">Customer Refused Delivery / Cancelled</option>
              <option value="Vehicle Mechanical Breakdown / Puncture">Vehicle Mechanical Breakdown / Puncture</option>
              <option value="Adverse Weather / Road Blockage">Adverse Weather / Road Blockage</option>
              <option value="Cash / Payment Dispute">Cash / Payment Dispute</option>
              <option value="Other Courier Incident">Other Courier Incident</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Courier Field Incident Notes
            </label>
            <textarea
              value={problemNotes}
              onChange={(e) => setProblemNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 resize-none"
              placeholder="Describe attempts to contact customer, specific landmark reached, or vehicle issue..."
            />
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              onClick={onSubmit}
              className="flex-1 py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-rose-900/30 transition-colors cursor-pointer"
            >
              Alert Dispatch HQ
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
