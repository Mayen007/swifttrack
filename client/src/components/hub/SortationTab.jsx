import React from 'react';
import { Layers } from 'lucide-react';

export function SortationTab({
  onManualSort,
  onOpenManifests,
  sortingShipmentId,
  sortedItem,
  awaitingShipments
}) {
  const pendingSort = awaitingShipments.filter((shipment) =>
    ['ACCEPTED', 'AT_ORIGIN_HUB', 'AT_HUB'].includes(shipment.status)
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
        <p className="text-sm font-semibold text-blue-200">Dispatcher-owned hub sortation</p>
        <p className="mt-1 text-xs text-slate-400">
          Review each received consignment’s next destination, then confirm its staging route. No scanner is required.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl flex flex-col justify-center items-center text-center space-y-4">
          {sortedItem ? (
            <div className="space-y-3 animate-fade-in">
              <span className="inline-block p-4 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Layers className="w-10 h-10" />
              </span>
              <p className="text-xs text-slate-400 font-mono">Tracking: {sortedItem.barcode}</p>
              <div className="p-4 bg-[#181d28] border border-[#222834] rounded-xl">
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Assigned staging route</p>
                <p className="text-xl font-bold text-blue-400 mt-1">{sortedItem.allocatedBay}</p>
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400">
                Manual sort confirmed
              </span>
              <p className="text-[10px] text-slate-500">
                Confirmed by {sortedItem.confirmedBy} · {sortedItem.confirmedAt}
              </p>
              <p className="max-w-md text-xs leading-relaxed text-slate-400">
                This parcel is routed to another hub. It will not appear in last-mile Dispatch yet.
                Add it to an outbound linehaul manifest next.
              </p>
              <button
                type="button"
                onClick={onOpenManifests}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 cursor-pointer"
              >
                Open outbound manifests
              </button>
            </div>
          ) : (
            <div className="text-slate-500 space-y-2">
              <Layers className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-xs">Select a received consignment below to confirm its route</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white text-sm">Awaiting sortation</h3>
            <p className="mt-1 text-xs text-slate-400">Check the next hub or delivery route and record your manual confirmation.</p>
          </div>
          <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-300">
            {pendingSort.length}
          </span>
        </div>
        {pendingSort.length === 0 ? (
          <p className="py-5 text-center text-xs text-slate-500">No consignments are waiting to be sorted.</p>
        ) : (
          <div className="divide-y divide-[#222834]">
            {pendingSort.map((shipment) => (
              <div key={`${shipment.id}-${shipment.leg_id}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-bold text-white">{shipment.tracking_number}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {shipment.waybill_number} · Hub #{shipment.leg_destination || shipment.destination_hub_id} · {shipment.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onManualSort(shipment)}
                  disabled={sortingShipmentId === shipment.id}
                  className="shrink-0 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {sortingShipmentId === shipment.id ? 'Confirming…' : 'Confirm manual sort'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
