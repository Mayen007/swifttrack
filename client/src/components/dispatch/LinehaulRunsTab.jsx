import React from 'react';
import { ArrowRight, Truck } from 'lucide-react';

export function LinehaulRunsTab({ runs, error }) {
  return (
    <section className="space-y-3 rounded-xl border border-[#2a3447] bg-[#12161f] p-4">
      <div className="flex items-center justify-between border-b border-[#2a3447] pb-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Linehaul runs</h2>
          <p className="mt-1 text-xs text-slate-400">Inter-hub transport, separate from last-mile courier dispatch.</p>
        </div>
        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] font-bold text-cyan-300">
          {runs.length} RUNS
        </span>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-200">
          Linehaul runs could not be loaded: {error}
        </p>
      ) : runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#30394a] px-5 py-10 text-center">
          <Truck className="mx-auto mb-3 h-7 w-7 text-slate-500" />
          <p className="text-sm font-semibold text-slate-200">No linehaul runs at this station</p>
          <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-400">
            Sort an inter-hub parcel in Hub Operations, then choose “Assign to Run” in Transshipment.
            That creates the run and manifest or adds the parcel to an eligible draft run.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {runs.map((run) => (
            <article key={run.id} className="rounded-lg border border-[#2a3447] bg-[#0c0e12] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold text-white">{run.run_number}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{run.manifest_number || 'Manifest pending'}</p>
                </div>
                <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-200">
                  {run.status}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-300">
                <span>Hub #{run.origin_hub_id}</span>
                <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
                <span>Hub #{run.destination_hub_id}</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-[#222834] pt-2 text-[11px] text-slate-400">
                <span>{run.total_shipments_count || 0} consignments</span>
                <span>{run.total_weight_kg || 0} kg</span>
                <span>{run.driver_name || 'Driver unassigned'}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
