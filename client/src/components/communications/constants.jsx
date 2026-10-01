import React from 'react';
import {
  Phone,
  MessageSquare,
  Mail,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';

export const getEventBadge = (eventType) => {
  switch (eventType) {
    case 'BOOKED':
      return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-900/40 text-blue-300 border border-blue-700/50">BOOKED</span>;
    case 'ACCEPTED':
      return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-900/40 text-indigo-300 border border-indigo-700/50">ACCEPTED</span>;
    case 'DISPATCHED':
      return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-900/40 text-cyan-300 border border-cyan-700/50">DISPATCHED</span>;
    case 'OUT_FOR_DELIVERY':
      return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-900/40 text-amber-300 border border-amber-700/50 animate-pulse">OUT FOR DELIVERY</span>;
    case 'DELIVERED':
      return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">DELIVERED</span>;
    case 'DELIVERY_FAILED':
      return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-900/40 text-rose-300 border border-rose-700/50">FAILED ATTEMPT</span>;
    case 'EXCEPTION':
      return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-900/40 text-red-300 border border-red-700/50">EXCEPTION</span>;
    default:
      return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">{eventType}</span>;
  }
};

export const getChannelBadge = (channel) => {
  switch (channel) {
    case 'SMS':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
          <Phone className="w-3 h-3" /> SMS
        </span>
      );
    case 'WHATSAPP':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-950/60 text-green-400 border border-green-800/40">
          <MessageSquare className="w-3 h-3" /> WhatsApp
        </span>
      );
    case 'EMAIL':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-950/60 text-blue-400 border border-blue-800/40">
          <Mail className="w-3 h-3" /> Email
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{channel}</span>;
  }
};

export const getStatusBadge = (status, retryCount, maxRetries) => {
  switch (status) {
    case 'SENT':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" /> Sent
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
          <Clock className="w-3 h-3" /> Pending
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertTriangle className="w-3 h-3" /> Failed ({retryCount}/{maxRetries})
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{status}</span>;
  }
};
