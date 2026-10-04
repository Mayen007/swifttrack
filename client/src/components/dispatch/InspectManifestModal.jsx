import React from 'react';
import { X, Phone, MapPin } from 'lucide-react';
import { api } from '../../services/api.js';

export function InspectManifestModal({
  inspectDelivery,
  onClose
}) {
  if (!inspectDelivery) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
      <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-lg w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider font-bold">
              MANIFEST LEDGER // {inspectDelivery.delivery_number}
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5">
            Order #{inspectDelivery.order_number || 'N/A'}
          </h3>
        </div>

        <div className="bg-[#0c0e12] border border-[#222834] rounded p-3 space-y-2 text-xs font-mono">
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Delivery Status:</span>
            <span className="font-bold text-blue-400 uppercase">{inspectDelivery.status}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Priority Level:</span>
            <span className="font-bold text-slate-200">{inspectDelivery.priority || 'NORMAL'}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Recipient Name:</span>
            <span className="font-semibold text-slate-200">{inspectDelivery.recipient_name}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Recipient Phone:</span>
            <span className="text-slate-300">{inspectDelivery.recipient_phone}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Delivery Address:</span>
            <span className="text-slate-200 max-w-xs text-right truncate">
              {inspectDelivery.delivery_address}, {inspectDelivery.delivery_city}
            </span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Assigned Courier:</span>
            <span className="text-indigo-400 font-semibold">{inspectDelivery.driver_name || 'Unassigned'}</span>
          </div>
          <div className="flex justify-between border-b border-[#222834] pb-1.5">
            <span className="text-slate-500">Vehicle Allocated:</span>
            <span className="text-slate-300">
              {inspectDelivery.vehicle_reg || inspectDelivery.vehicle_details || 'Boda Boda'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Total Invoice Value:</span>
            <span className="text-emerald-400 font-bold tabular-nums">
              {inspectDelivery.total_amount ? api.formatKES(inspectDelivery.total_amount) : 'KSh 0.00'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {inspectDelivery.recipient_phone && (
            <a
              href={`tel:${inspectDelivery.recipient_phone}`}
              className="flex-1 py-2 rounded bg-[#181d28] hover:bg-[#222834] text-slate-200 text-xs font-mono font-semibold text-center border border-[#222834] flex items-center justify-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              Call Recipient
            </a>
          )}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              [inspectDelivery.delivery_address, inspectDelivery.delivery_city].filter(Boolean).join(', ')
            )}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2 rounded bg-[#181d28] hover:bg-[#222834] text-slate-200 text-xs font-mono font-semibold text-center border border-[#222834] flex items-center justify-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            Google Maps
          </a>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded bg-[#0c0e12] hover:bg-[#181d28] text-slate-400 hover:text-slate-200 border border-[#222834] text-xs font-mono cursor-pointer"
        >
          Close Inspector
        </button>
      </div>
    </div>
  );
}
