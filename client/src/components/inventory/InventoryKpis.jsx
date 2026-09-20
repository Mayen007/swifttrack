// client/src/components/inventory/InventoryKpis.jsx
import React from 'react';
import { Package, CheckCircle2, Clock, Truck, ShieldAlert, AlertTriangle } from 'lucide-react';

export function InventoryKpis({ totals = {} }) {
  const {
    onHand = 0,
    available = 0,
    reserved = 0,
    inTransit = 0,
    damaged = 0,
    expired = 0,
  } = totals;

  const cards = [
    {
      label: 'ON HAND (TOTAL)',
      value: onHand,
      sub: 'Physical On-Site Floor',
      icon: Package,
      color: 'text-slate-300',
      border: 'border-slate-700/60',
      bg: 'bg-slate-800/30',
    },
    {
      label: 'AVAILABLE (SELLABLE)',
      value: available,
      sub: 'Pickable For Orders/POS',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/5',
    },
    {
      label: 'RESERVED (HELD)',
      value: reserved,
      sub: 'Committed to Orders',
      icon: Clock,
      color: 'text-amber-400',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/5',
    },
    {
      label: 'IN TRANSIT',
      value: inTransit,
      sub: 'Inter-Branch / Outbound',
      icon: Truck,
      color: 'text-blue-400',
      border: 'border-blue-500/30',
      bg: 'bg-blue-500/5',
    },
    {
      label: 'DAMAGED (QUARANTINE)',
      value: damaged,
      sub: 'Segregated Non-Sellable',
      icon: ShieldAlert,
      color: 'text-rose-400',
      border: 'border-rose-500/30',
      bg: 'bg-rose-500/5',
      badge: damaged > 0 ? 'HOLD' : 'CLEAN',
    },
    {
      label: 'EXPIRED (PERISHED)',
      value: expired,
      sub: 'Awaiting Disposal',
      icon: AlertTriangle,
      color: 'text-red-400',
      border: 'border-red-500/30',
      bg: 'bg-red-500/5',
      badge: expired > 0 ? 'ACTION REQ' : 'CLEAN',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono">
      {cards.map((c, idx) => {
        const Icon = c.icon;
        return (
          <div
            key={idx}
            className={`p-3 rounded border ${c.border} ${c.bg} bg-[#12161f] flex flex-col justify-between transition-all`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                {c.label}
              </span>
              <Icon className={`w-3.5 h-3.5 ${c.color}`} />
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-xl font-bold tracking-tight ${c.color}`}>
                {(Number(c.value) || 0).toLocaleString()}
              </span>
              {c.badge && (
                <span
                  className={`text-[8px] px-1 py-0.5 rounded font-bold ${
                    c.value > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {c.badge}
                </span>
              )}
            </div>

            <span className="text-[10px] text-slate-500 mt-0.5 truncate">
              {c.sub}
            </span>
          </div>
        );
      })}
    </div>
  );
}
