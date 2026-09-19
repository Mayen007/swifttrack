// client/src/components/approvals/ApprovalRejectModal.jsx
import React from 'react';
import { X, ShieldAlert } from 'lucide-react';

export function ApprovalRejectModal({
  isOpen,
  item,
  type,
  reason,
  setReason,
  notes,
  setNotes,
  onClose,
  onSubmit,
}) {
  if (!isOpen || !item) return null;

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
          <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider font-bold">
            AUDIT REJECTION // MANAGEMENT DECISION
          </span>
          <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono mt-0.5">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Reject {type === 'REFUND' ? 'Refund' : 'Transfer'} #{item.refund_request_number || item.transfer_number}
          </h3>
        </div>

        <div className="space-y-3 text-xs font-mono">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Standard Rejection Rationale *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              {type === 'REFUND' ? (
                <>
                  <option value="Outside return policy guidelines">Outside return policy guidelines (7-day window exceeded)</option>
                  <option value="Product opened / damaged by customer">Product opened / seal broken / customer damage</option>
                  <option value="Original fiscal receipt or serial discrepancy">Original fiscal receipt or serial discrepancy</option>
                  <option value="Disputed by branch management">Disputed by branch management</option>
                  <option value="Administrative rejection">Administrative rejection</option>
                </>
              ) : (
                <>
                  <option value="Insufficient source inventory">Insufficient source inventory</option>
                  <option value="Logistics trunk capacity limitation">Logistics trunk capacity limitation</option>
                  <option value="Destination warehouse capacity reached">Destination warehouse capacity reached</option>
                  <option value="Duplicate transfer request">Duplicate transfer request</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Auditor Notes & Specifics (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 resize-none"
              placeholder="Additional justification recorded in permanent audit ledger..."
            />
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              onClick={onSubmit}
              className="flex-1 py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-rose-900/40 transition-colors cursor-pointer"
            >
              Confirm Rejection
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
