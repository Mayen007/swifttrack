import React from 'react';

export function getProcurementStatusBadge(status) {
  switch (status) {
    case 'DRAFT':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">DRAFT</span>;
    case 'SUBMITTED':
    case 'PENDING_APPROVAL':
    case 'PENDING':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDING</span>;
    case 'APPROVED':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">APPROVED</span>;
    case 'SENT_TO_SUPPLIER':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">SENT TO VENDOR</span>;
    case 'PARTIALLY_RECEIVED':
    case 'PARTIALLY_PAID':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">PARTIAL</span>;
    case 'FULLY_RECEIVED':
    case 'PAID':
    case 'CLOSED':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">COMPLETED</span>;
    case 'REJECTED':
    case 'CANCELLED':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">{status}</span>;
    case 'CONVERTED_TO_PO':
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">PO CONVERTED</span>;
    default:
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">{status}</span>;
  }
}
