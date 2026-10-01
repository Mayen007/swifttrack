export const STATE_MACHINE_STEPS = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PAID', label: 'Paid' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'PACKED', label: 'Packed' },
  { key: 'READY_FOR_DISPATCH', label: 'Ready' },
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'DELIVERED', label: 'Delivered' },
];

export const ALTERNATIVE_STATES = [
  'CANCELLED',
  'FAILED_DELIVERY',
  'RETURNED',
  'PARTIALLY_RETURNED',
  'REFUNDED',
];

export const PIPELINE_STATUS_FILTERS = [
  'ALL',
  'DRAFT',
  'CONFIRMED',
  'PAID',
  'PROCESSING',
  'PACKED',
  'READY_FOR_DISPATCH',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
  'FAILED_DELIVERY',
  'RETURNED',
  'PARTIALLY_RETURNED',
  'REFUNDED',
];

export const getStatusBadge = (status) => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-700/40 text-slate-300 border-slate-600/50';
    case 'CONFIRMED':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    case 'PAID':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    case 'PROCESSING':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    case 'PACKED':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40';
    case 'READY_FOR_DISPATCH':
      return 'bg-blue-600/20 text-blue-300 border-blue-600/40';
    case 'DISPATCHED':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
    case 'IN_TRANSIT':
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 animate-pulse';
    case 'DELIVERED':
      return 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50';
    case 'CANCELLED':
      return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
    case 'FAILED_DELIVERY':
      return 'bg-red-500/20 text-red-400 border-red-500/40';
    case 'RETURNED':
      return 'bg-amber-600/20 text-amber-300 border-amber-600/40';
    case 'PARTIALLY_RETURNED':
      return 'bg-orange-500/20 text-orange-300 border-orange-400/40';
    case 'REFUNDED':
      return 'bg-rose-600/20 text-rose-300 border-rose-600/40';
    default:
      return 'bg-gray-800 text-gray-300 border-gray-700';
  }
};
