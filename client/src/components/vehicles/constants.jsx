import React from 'react';
import { Bike, Car, Truck } from 'lucide-react';

export const VEHICLE_STATUS_OPTIONS = [
  { key: 'AVAILABLE', label: 'Available', color: 'emerald' },
  { key: 'IN_TRANSIT', label: 'In Transit', color: 'blue' },
  { key: 'UNDER_MAINTENANCE', label: 'In Maintenance', color: 'amber' },
  { key: 'OUT_OF_SERVICE', label: 'Out of Service', color: 'rose' },
  { key: 'RESERVED', label: 'Reserved', color: 'cyan' }
];

export const VEHICLE_TYPE_OPTIONS = [
  { key: 'MOTORCYCLE', label: 'Motorcycle', icon: Bike },
  { key: 'VAN', label: 'Van', icon: Car },
  { key: 'TRUCK', label: 'Truck', icon: Truck },
  { key: 'PICKUP', label: 'Pickup', icon: Truck },
  { key: 'TUKTUK', label: 'Tuk-Tuk', icon: Bike },
  { key: 'LORRY', label: 'Heavy Lorry', icon: Truck }
];

export const SERVICE_TYPE_OPTIONS = [
  { key: 'PREVENTIVE_SCHEDULED', label: 'Preventive Scheduled Service' },
  { key: 'OIL_CHANGE', label: 'Routine Oil & Filter Change' },
  { key: 'TIRE_REPLACEMENT', label: 'Tire Replacement & Balancing' },
  { key: 'BRAKE_OVERHAUL', label: 'Brake Pads & System Overhaul' },
  { key: 'INSPECTION_NTSA', label: 'NTSA Annual Inspection Prep' },
  { key: 'REPAIR_CORRECTIVE', label: 'Corrective Mechanical Repair' },
  { key: 'ACCIDENT_REPAIR', label: 'Accident & Bodywork Repair' }
];

export function renderStatusBadge(status) {
  const opt = VEHICLE_STATUS_OPTIONS.find(o => o.key === status) || { label: status, color: 'slate' };
  const colorClasses = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-500/30',
    rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/30',
    cyan: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-400 border-cyan-300 dark:border-cyan-500/30',
    slate: 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-500/30'
  }[opt.color];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold border ${colorClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${opt.color === 'blue' || opt.color === 'emerald' ? 'animate-pulse' : ''} bg-current`} />
      {opt.label}
    </span>
  );
}

export function renderVehicleTypeIcon(type) {
  switch (type) {
    case 'MOTORCYCLE':
      return <Bike className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
    case 'VAN':
      return <Car className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    case 'PICKUP':
      return <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
    case 'LORRY':
    case 'TRUCK':
      return <Truck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />;
    case 'TUKTUK':
      return <Bike className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
    default:
      return <Truck className="w-5 h-5 text-slate-600 dark:text-slate-400" />;
  }
}
