import React from 'react';
import { Smartphone, CreditCard, Banknote, Building2 } from 'lucide-react';

export const PAYMENT_STATUS_STEPS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'SUCCESS', label: 'Success' },
];

export const ALTERNATIVE_PAYMENT_STATES = [
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
  'REFUNDED'
];

export const getPaymentStatusBadge = (status) => {
  switch (status) {
    case 'PENDING':
      return 'bg-slate-700/40 text-slate-300 border-slate-600/50';
    case 'PROCESSING':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse';
    case 'SUCCESS':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    case 'FAILED':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'TIMEOUT':
      return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'CANCELLED':
      return 'bg-slate-600/20 text-slate-400 border-slate-600/40';
    case 'REFUNDED':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    default:
      return 'bg-gray-800 text-gray-300 border-gray-700';
  }
};

export const renderPaymentMethodBadge = (method) => {
  switch (method) {
    case 'MPESA':
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold flex items-center gap-1">
          <Smartphone className="w-3 h-3" /> M-PESA
        </span>
      );
    case 'CARD':
      return (
        <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/40 text-blue-400 font-mono text-[10px] font-bold flex items-center gap-1">
          <CreditCard className="w-3 h-3" /> CARD
        </span>
      );
    case 'CASH':
      return (
        <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-400 font-mono text-[10px] font-bold flex items-center gap-1">
          <Banknote className="w-3 h-3" /> CASH
        </span>
      );
    case 'BANK':
      return (
        <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/40 text-indigo-400 font-mono text-[10px] font-bold flex items-center gap-1">
          <Building2 className="w-3 h-3" /> BANK
        </span>
      );
    default:
      return <span className="text-slate-400">{method}</span>;
  }
};
