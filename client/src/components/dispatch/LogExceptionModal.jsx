import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function LogExceptionModal({
  isOpen,
  failDelivery,
  failureReason,
  setFailureReason,
  failureNotes,
  setFailureNotes,
  initiateReturn,
  setInitiateReturn,
  onClose,
  onSubmit
}) {
  if (!isOpen || !failDelivery) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
      <div className="bg-[#12161f] border border-rose-500/40 rounded p-6 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider block font-bold">
            INCIDENT REPORT // EXCEPTION HANDLING
          </span>
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Log Exception for #{failDelivery.delivery_number}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            Destination: {failDelivery.delivery_address} ({failDelivery.recipient_name})
          </p>
        </div>

        <div className="space-y-3.5 text-xs font-mono">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Primary Failure Reason *
            </label>
            <select
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="Customer Unreachable / Phone Off">Customer Unreachable / Phone Off</option>
              <option value="Incorrect / Incomplete Address">Incorrect / Incomplete Address</option>
              <option value="Recipient Rejected / Cancelled Order">Recipient Rejected / Cancelled Order</option>
              <option value="Vehicle Mechanical Breakdown">Vehicle Mechanical Breakdown</option>
              <option value="Road Inaccessible / Adverse Weather">Road Inaccessible / Adverse Weather</option>
              <option value="Cash / Payment Dispute at Doorstep">Cash / Payment Dispute at Doorstep</option>
              <option value="Other Logistics Exception">Other Logistics Exception</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Incident Notes & Specifics
            </label>
            <textarea
              value={failureNotes}
              onChange={(e) => setFailureNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 resize-none"
              placeholder="Provide details on driver attempts, customer interactions, or road conditions..."
            />
          </div>

          <div className="p-3 rounded bg-[#0c0e12] border border-[#222834] flex items-center gap-2.5">
            <input
              type="checkbox"
              id="initiate_return_cb"
              checked={initiateReturn}
              onChange={(e) => setInitiateReturn(e.target.checked)}
              className="w-4 h-4 rounded border-[#222834] text-rose-600 focus:ring-rose-500 cursor-pointer"
            />
            <label htmlFor="initiate_return_cb" className="text-[11px] text-slate-300 font-mono cursor-pointer">
              Initiate Return-to-Branch Inventory (Status: RETURN_TO_BRANCH)
            </label>
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              onClick={onSubmit}
              className="flex-1 py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-rose-900/30 transition-colors cursor-pointer"
            >
              Confirm Exception Log
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
