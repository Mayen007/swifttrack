import React from 'react';
import { Truck, Search, Layers } from 'lucide-react';

export function TransshipmentTab({
  currentHubId,
  awaitingShipments,
  transshipmentSearch,
  setTransshipmentSearch,
  onAttachToManifest
}) {
  const filteredShipments = awaitingShipments.filter((shp) => {
    if (transshipmentSearch.trim()) {
      const q = transshipmentSearch.toLowerCase();
      const trk = (shp.tracking_number || '').toLowerCase().includes(q);
      const way = (shp.waybill_number || '').toLowerCase().includes(q);
      const dest = String(shp.destination_hub_id || '').includes(q);
      if (!trk && !way && !dest) return false;
    }
    return true;
  });

  return (
    <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-3.5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#222834]">
        <div>
          <h3 className="font-bold text-white text-sm font-mono uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-400" />
            <span>Station #{currentHubId} Transshipment Queue</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {awaitingShipments.length} Awaiting
            </span>
          </h3>
          <p className="text-xs text-slate-400">Consignments in transit awaiting outbound linehaul assignment</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#0b0e14] border border-[#1e2433] px-2.5 py-1.5 rounded-lg text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter tracking # or dest..."
              value={transshipmentSearch}
              onChange={(e) => setTransshipmentSearch(e.target.value)}
              className="bg-transparent text-white text-xs font-mono focus:outline-none w-44"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#12161f] border border-[#222834] rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#181d28] text-slate-400 font-semibold border-b border-[#222834]">
            <tr>
              <th className="py-2.5 px-3">Tracking / Waybill</th>
              <th className="py-2.5 px-3">Initial Origin &rarr; Current Hub</th>
              <th className="py-2.5 px-3">Final Destination</th>
              <th className="py-2.5 px-3">Active Leg #</th>
              <th className="py-2.5 px-3">Payload (Parcels & Weight)</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834] text-slate-300">
            {filteredShipments.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-10 text-center text-slate-500">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
                  {transshipmentSearch.trim()
                    ? `No transshipment consignments matching "${transshipmentSearch}".`
                    : 'All intermediate transit consignments are currently attached to outbound manifests.'}
                </td>
              </tr>
            ) : (
              filteredShipments.map((shp) => (
                <tr key={shp.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-3">
                    <div className="font-mono font-bold text-white">{shp.tracking_number}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{shp.waybill_number || `WAY-${shp.id}`}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-slate-200">
                      Hub #{shp.origin_hub_id} &rarr; Hub #{shp.leg_destination || shp.destination_hub_id}
                    </div>
                    <div className="text-[10px] text-blue-400 font-mono">Current: Hub #{shp.current_hub_id || currentHubId}</div>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-300">
                    Hub #{shp.destination_hub_id}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                    Leg {shp.leg_sequence || 2}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="text-white">{shp.total_parcels || 1} pkg ({shp.actual_weight_kg || 0} kg)</div>
                    <div className="text-[10px] text-slate-500 font-mono">Chargeable: {shp.chargeable_weight_kg || 0} kg</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {shp.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={onAttachToManifest}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-[11px] font-bold text-white shadow cursor-pointer"
                    >
                      Attach to Manifest
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
