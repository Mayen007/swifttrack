import React, { useEffect, useMemo, useState } from 'react';

export function LinehaulManifestsTab({
  manifests,
  runs,
  currentHubId,
  shipment,
  assigningShipment,
  onAssignShipment,
  onCancelShipmentAssignment,
  manifestStatusFilter,
  setManifestStatusFilter
}) {
  const [selectedRunId, setSelectedRunId] = useState('');
  const eligibleRuns = useMemo(() => (runs || []).filter((run) => (
    String(run.origin_hub_id) === String(currentHubId)
    && String(run.destination_hub_id) === String(shipment?.leg_destination || shipment?.destination_hub_id)
    && ['PLANNED', 'READY_FOR_LOADING', 'LOADING'].includes(run.status)
    && run.manifest_status === 'DRAFT'
  )), [currentHubId, runs, shipment]);
  const filteredManifests = manifests.filter(
    (m) => manifestStatusFilter === 'ALL' || m.status === manifestStatusFilter
  );

  useEffect(() => {
    setSelectedRunId(eligibleRuns[0]?.id ? String(eligibleRuns[0].id) : '');
  }, [eligibleRuns]);

  return (
    <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-4 shadow-sm">
      {shipment && (
        <section className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">Outbound assignment</p>
              <p className="mt-1 text-sm font-bold text-white">{shipment.tracking_number}</p>
              <p className="text-xs text-slate-400">
                Hub #{currentHubId} → Hub #{shipment.leg_destination || shipment.destination_hub_id}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:min-w-72 sm:flex-row">
              {eligibleRuns.length > 0 && (
                <>
                  <select
                    value={selectedRunId}
                    onChange={(event) => setSelectedRunId(event.target.value)}
                    aria-label="Select outbound transport run"
                    className="min-w-0 flex-1 rounded-lg border border-[#30394a] bg-[#0b0e14] px-3 py-2 text-xs text-white"
                  >
                    {eligibleRuns.map((run) => (
                      <option key={run.id} value={run.id}>
                        {run.run_number} · {run.manifest_number || 'Draft manifest'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={assigningShipment || !selectedRunId}
                    onClick={() => onAssignShipment(selectedRunId)}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {assigningShipment ? 'Assigning…' : 'Add to run'}
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={assigningShipment}
                onClick={() => onAssignShipment(null, true)}
                className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {assigningShipment ? 'Creating…' : 'Create run & assign'}
              </button>
              <button
                type="button"
                disabled={assigningShipment}
                onClick={onCancelShipmentAssignment}
                className="rounded-lg border border-[#30394a] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#222834] pb-3">
          <div>
            <h3 className="font-bold text-white text-sm font-mono uppercase tracking-wider">Transport Runs</h3>
            <p className="text-xs text-slate-400">Linehaul movements scheduled from this station</p>
          </div>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300">
            {(runs || []).length} Total
          </span>
        </div>
        {(runs || []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#30394a] p-6 text-center text-xs text-slate-500">
            No transport runs yet. Assign a sorted parcel above to create the first run and its manifest.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {runs.map((run) => (
              <article key={run.id} className="rounded-xl border border-[#222834] bg-[#181d28] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-bold text-white">{run.run_number}</span>
                  <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                    {run.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  Hub #{run.origin_hub_id} → Hub #{run.destination_hub_id}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {run.manifest_number || 'No manifest'} · {run.total_shipments_count || 0} consignments · {run.total_weight_kg || 0} kg
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

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
