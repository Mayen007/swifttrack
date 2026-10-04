import React from 'react';
import {
  MapPin,
  Phone,
  Navigation,
  PenTool,
  AlertTriangle,
  MessageSquare,
  Package,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../../services/api.js';

export function ActiveRunCard({
  delivery,
  index,
  isExpanded,
  onToggleExpand,
  onStartRun,
  onOpenPod,
  onOpenProblem
}) {
  const isInTransit = delivery.status === 'IN_TRANSIT';
  const hasItems = delivery.items && delivery.items.length > 0;

  return (
    <div
      className={`bg-[#12161f] border rounded transition-colors overflow-hidden ${
        isInTransit ? 'border-cyan-500/50' : 'border-[#222834] hover:border-slate-700'
      }`}
    >
      <div className="p-3.5 bg-[#0c0e12] border-b border-[#222834] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono font-bold text-slate-400 flex items-center justify-center">
            #{index + 1}
          </span>
          <span className="text-xs font-mono font-bold text-blue-400">
            {delivery.delivery_number}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            ({delivery.order_number || 'ORD'})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
              delivery.priority === 'URGENT'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                : delivery.priority === 'HIGH'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-[#181d28] text-slate-400 border border-[#222834]'
            }`}
          >
            {delivery.priority || 'NORMAL'}
          </span>

          <span
            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${
              isInTransit
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isInTransit ? 'bg-cyan-400 animate-ping' : 'bg-indigo-400'}`} />
            {delivery.status?.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-1.5">
              <span>{delivery.recipient_name}</span>
              {delivery.total_amount && (
                <span className="text-xs text-emerald-400 font-mono font-bold tabular-nums">
                  • {api.formatKES(delivery.total_amount)}
                </span>
              )}
            </h3>
            <div className="flex items-start gap-1.5 text-xs text-slate-300 mt-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                {delivery.delivery_address}
                {delivery.delivery_city ? `, ${delivery.delivery_city}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1 sm:pt-0">
            {delivery.recipient_phone && (
              <a
                href={`tel:${delivery.recipient_phone}`}
                className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-emerald-600/20 text-emerald-400 border border-[#222834] hover:border-emerald-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
                title="Direct Call"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
            )}

            {delivery.recipient_phone && (
              <a
                href={`https://wa.me/${delivery.recipient_phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-green-600/20 text-green-400 border border-[#222834] hover:border-green-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
                title="WhatsApp Message"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            )}

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                [delivery.delivery_address, delivery.delivery_city].filter(Boolean).join(', ')
              )}`}
              target="_blank"
              rel="noreferrer"
              className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-blue-600/20 text-blue-400 border border-[#222834] hover:border-blue-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
              title="Open in Google Maps"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>GPS Map</span>
            </a>
          </div>
        </div>

        {delivery.special_instructions && (
          <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[10px] uppercase block tracking-wider text-amber-400">
                SPECIAL DISPATCH INSTRUCTIONS:
              </span>
              <span>{delivery.special_instructions}</span>
            </div>
          </div>
        )}

        {hasItems && (
          <div className="border-t border-[#222834] pt-2">
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Package className="w-3 h-3 text-slate-500" />
              <span>Manifest Cargo ({delivery.items.length} item{delivery.items.length !== 1 ? 's' : ''})</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {isExpanded && (
              <div className="mt-2 bg-[#0c0e12] border border-[#222834] rounded p-2.5 space-y-1.5 text-xs font-mono">
                {delivery.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-slate-300">
                    <span>{it.quantity}x {it.product_name || 'Item'}</span>
                    <span className="text-slate-500 font-mono text-[10px]">{it.sku}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-[#222834]">
          {!isInTransit ? (
            <button
              onClick={() => onStartRun(delivery)}
              className="w-full py-2.5 px-4 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-bold font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-cyan-900/30"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Depart Hub // Initiate Road Transit</span>
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => onOpenPod(delivery)}
                className="flex-1 py-3 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                <PenTool className="w-4 h-4" />
                <span>Capture Signature & Complete POD</span>
              </button>

              <button
                onClick={() => onOpenProblem(delivery)}
                className="py-3 px-3 rounded bg-[#0c0e12] hover:bg-rose-500/20 text-rose-400 border border-[#222834] hover:border-rose-500/40 text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                title="Report road problem or undeliverable address"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Report Issue</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
