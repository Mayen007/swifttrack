import React from 'react';
import {
  Truck,
  MapPin,
  Phone,
  User,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { api } from '../../services/api.js';

export function DispatchKanbanBoard({
  columns,
  filteredDeliveries,
  onInspectDelivery,
  onUpdatePriority,
  onOpenAssignModal,
  onAdvanceStatus,
  onOpenFailModal
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3.5 items-start">
      {columns.map((col) => {
        const colItems = filteredDeliveries.filter((d) => {
          if (col.id === 'DELIVERED') {
            return d.status === 'DELIVERED' || d.status === 'COMPLETED';
          }
          if (col.id === 'READY_FOR_DISPATCH') {
            return d.status === 'READY_FOR_DISPATCH' || d.status === 'PENDING_ASSIGNMENT';
          }
          return d.status === col.id;
        });

        return (
          <div
            key={col.id}
            className="bg-[#12161f] border border-[#222834] rounded flex flex-col max-h-[820px] overflow-hidden"
          >
            <div className={`p-3 border-b border-[#222834] bg-[#0c0e12] border-t-2 ${col.accentColor}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-500">{col.code}</span>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                    {col.label}
                  </h3>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono font-bold text-slate-300 tabular-nums">
                  {colItems.length}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-mono truncate">{col.description}</p>
            </div>

            <div className="p-2.5 space-y-2.5 overflow-y-auto min-h-[460px] max-h-[720px]">
              {colItems.length === 0 ? (
                <div className="border border-dashed border-[#222834] rounded p-8 text-center">
                  <Truck className="w-5 h-5 text-slate-600 mx-auto mb-2 opacity-50" />
                  <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
                    Queue Empty
                  </span>
                  <span className="text-[10px] text-slate-600 block mt-0.5 font-mono">
                    No manifests in {col.code}
                  </span>
                </div>
              ) : (
                colItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#0c0e12] border border-[#222834] hover:border-slate-700 rounded p-3 transition-colors space-y-2.5 relative group"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        onClick={() => onInspectDelivery(item)}
                        className="text-[11px] font-mono font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                        title="Inspect Manifest Details"
                      >
                        <span>{item.delivery_number}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </button>

                      <div className="flex items-center gap-1">
                        <span
                          onClick={() => {
                            const nextPrio = item.priority === 'NORMAL' ? 'HIGH' : item.priority === 'HIGH' ? 'URGENT' : 'NORMAL';
                            onUpdatePriority(item, nextPrio);
                          }}
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase cursor-pointer transition-colors ${
                            item.priority === 'URGENT'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                              : item.priority === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-[#181d28] text-slate-400 border border-[#222834] hover:border-slate-600'
                          }`}
                          title="Click to cycle priority"
                        >
                          {item.priority || 'NORMAL'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-100 truncate min-w-0">{item.recipient_name}</h4>
                        {item.total_amount && (
                          <span className="text-[11px] font-mono font-semibold text-slate-300 tabular-nums shrink-0">
                            {api.formatKES(item.total_amount)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                        <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate" title={`${item.delivery_address}, ${item.delivery_city || ''}`}>
                          {item.delivery_address} {item.delivery_city ? `(${item.delivery_city})` : ''}
                        </span>
                      </div>

                      {item.recipient_phone && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-mono">
                          <Phone className="w-2.5 h-2.5 text-slate-500" />
                          <a
                            href={`tel:${item.recipient_phone}`}
                            className="hover:text-slate-200 transition-colors"
                            title="Call recipient"
                          >
                            {item.recipient_phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {item.special_instructions && (
                      <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-mono flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{item.special_instructions}</span>
                      </div>
                    )}

                    {item.driver_name ? (
                      <div className="pt-2 border-t border-[#222834] flex items-center justify-between text-[10px] font-mono">
                        <div className="flex items-center gap-1 text-slate-300">
                          <User className="w-3 h-3 text-indigo-400" />
                          <span className="truncate max-w-[95px] font-semibold">{item.driver_name}</span>
                        </div>
                        <span className="text-slate-500 truncate max-w-[100px]">
                          {item.vehicle_reg || item.vehicle_details || 'Boda Boda'}
                        </span>
                      </div>
                    ) : null}

                    <div className="pt-1.5 flex flex-col gap-1.5">
                      {item.status === 'READY_FOR_DISPATCH' && (
                        <button
                          onClick={() => onOpenAssignModal(item)}
                          className="w-full py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <User className="w-3 h-3" />
                          <span>Assign Courier</span>
                        </button>
                      )}

                      {item.status === 'ASSIGNED' && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => onAdvanceStatus(item, 'PICKED_UP')}
                            className="flex-1 py-1.5 px-2 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white text-xs font-semibold font-mono border border-indigo-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <span>Mark Picked</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onOpenAssignModal(item)}
                            className="px-2 py-1.5 rounded bg-[#181d28] hover:bg-slate-700 text-slate-400 hover:text-white border border-[#222834] text-[10px] font-mono cursor-pointer"
                            title="Reassign Courier"
                          >
                            Reassign
                          </button>
                        </div>
                      )}

                      {item.status === 'PICKED_UP' && (
                        <button
                          onClick={() => onAdvanceStatus(item, 'IN_TRANSIT')}
                          className="w-full py-1.5 px-3 rounded bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-black text-xs font-semibold font-mono border border-amber-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Start Road Transit</span>
                        </button>
                      )}

                      {item.status === 'IN_TRANSIT' && (
                        <div className="space-y-1.5">
                          <button
                            onClick={() => onAdvanceStatus(item, 'DELIVERED')}
                            className="w-full py-1.5 px-3 rounded bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white text-xs font-bold font-mono border border-emerald-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verify Delivery (POD)</span>
                          </button>

                          <button
                            onClick={() => onOpenFailModal(item)}
                            className="w-full py-1 px-2 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-mono transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Log Delivery Issue</span>
                          </button>
                        </div>
                      )}

                      {(item.status === 'DELIVERED' || item.status === 'COMPLETED') && (
                        <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[10px] font-mono text-emerald-400">
                          <span className="flex items-center gap-1 font-bold">
                            <ShieldCheck className="w-3 h-3" />
                            POD CONFIRMED
                          </span>
                          <span className="text-slate-500">
                            {item.delivered_at ? new Date(item.delivered_at).toLocaleTimeString('en-KE') : 'VERIFIED'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
