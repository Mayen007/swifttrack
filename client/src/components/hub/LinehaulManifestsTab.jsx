import React from 'react';

export function LinehaulManifestsTab({
  manifests,
  manifestStatusFilter,
  setManifestStatusFilter
}) {
  const filteredManifests = manifests.filter(
    (m) => manifestStatusFilter === 'ALL' || m.status === manifestStatusFilter
  );

  return (
    <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#222834]">
        <div>
          <h3 className="font-bold text-white text-sm font-mono uppercase tracking-wider flex items-center gap-2">
            <span>Linehaul Manifest Ledger</span>
            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {manifests.length} Total
            </span>
          </h3>
          <p className="text-xs text-slate-400">Lock, seal, and dispatch multi-shipment transport payloads (Rule BR-005)</p>
        </div>

        <div className="flex items-center gap-1 bg-[#0b0e14] p-0.5 rounded-lg border border-[#1e2433] text-xs font-mono">
          {['ALL', 'DISPATCHED', 'LOCKED', 'DRAFT', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setManifestStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                manifestStatusFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredManifests.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500 col-span-2">
            No linehaul manifests matching "{manifestStatusFilter}".
          </p>
        ) : (
          filteredManifests.map((m) => (
            <div key={m.id} className="bg-[#181d28] border border-[#222834] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white text-sm">{m.manifest_number}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {m.status}
                </span>
              </div>

              <div className="text-xs text-slate-300 flex items-center justify-between">
                <span>Origin: Hub #{m.origin_hub_id}</span>
                <span>&rarr;</span>
                <span>Dest: Hub #{m.destination_hub_id}</span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-[#222834]">
                <span>Total Consignments: {m.total_shipments || 0}</span>
                <span>Total Weight: {m.total_weight_kg || 0} kg</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
