// client/src/components/products/ProductKpis.jsx
import React from 'react';
import { Package, Layers, AlertTriangle, Percent } from 'lucide-react';

export function ProductKpis({ stats }) {
  const {
    totalProducts = 0,
    totalVariants = 0,
    lowStockCount = 0,
    activePromotionsCount = 0,
  } = stats || {};

  const cards = [
    {
      label: 'TOTAL MASTER SKUS',
      value: totalProducts,
      sub: 'Base Catalog Records',
      icon: Package,
      iconColor: 'text-blue-400',
      borderColor: 'border-blue-500/20',
      bgGlow: 'bg-blue-500/5',
    },
    {
      label: 'ACTIVE VARIANTS',
      value: totalVariants,
      sub: 'Multi-Attribute SKUs',
      icon: Layers,
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-500/20',
      bgGlow: 'bg-amber-500/5',
    },
    {
      label: 'REORDER ALERTS',
      value: lowStockCount,
      sub: 'At / Below Threshold',
      icon: AlertTriangle,
      iconColor: lowStockCount > 0 ? 'text-rose-400' : 'text-slate-400',
      borderColor: lowStockCount > 0 ? 'border-rose-500/30' : 'border-slate-800',
      bgGlow: lowStockCount > 0 ? 'bg-rose-500/10' : 'bg-slate-900/40',
      badge: lowStockCount > 0 ? 'ATTENTION' : 'NOMINAL',
      badgeColor: lowStockCount > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400',
    },
    {
      label: 'ACTIVE CAMPAIGNS',
      value: activePromotionsCount,
      sub: 'Scheduled Promotions',
      icon: Percent,
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-500/20',
      bgGlow: 'bg-purple-500/5',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-3 rounded border ${card.borderColor} ${card.bgGlow} bg-[#12161f] flex flex-col justify-between transition-all`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                {card.label}
              </span>
              <Icon className={`w-4 h-4 ${card.iconColor}`} />
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-white tracking-tight">
                {card.value}
              </span>
              {card.badge && (
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${card.badgeColor}`}>
                  {card.badge}
                </span>
              )}
            </div>

            <span className="text-[11px] text-slate-500 mt-1 font-mono">
              {card.sub}
            </span>
          </div>
        );
      })}
    </div>
  );
}
