import React, { useEffect, useState } from 'react';
import { ArrowRight, PackageCheck, Route, Truck } from 'lucide-react';
import { api } from '../../services/api.js';

export function LinehaulRunsTab({
  shipments = [],
  runs = [],
  currentHubId,
  drivers = [],
  vehicles = [],
  error,
  loading,
  onManualSort,
  onDispatchShipment,
  onDispatchRun,
  onRefresh
}) {
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [dispatchingRunId, setDispatchingRunId] = useState(null);
  const [runDriverId, setRunDriverId] = useState('');
  const [runVehicleId, setRunVehicleId] = useState('');
  const [receivingRun, setReceivingRun] = useState(null);
  const [receivedShipmentIds, setReceivedShipmentIds] = useState([]);
  const [receivingError, setReceivingError] = useState('');
  const [receiving, setReceiving] = useState(false);
  const runColumns = [
    { id: 'READY', label: 'Ready to dispatch', statuses: ['PLANNED'] },
    { id: 'IN_TRANSIT', label: 'In transit', statuses: ['LOADED', 'IN_TRANSIT'] },
    { id: 'ARRIVED', label: 'Arrived · receive', statuses: ['ARRIVED'] },
  ];

  useEffect(() => {
    setDriverId(drivers.find((driver) => driver.status === 'AVAILABLE')?.id?.toString() || '');
    setVehicleId(vehicles.find((vehicle) => vehicle.status === 'AVAILABLE')?.id?.toString() || '');
  }, [drivers, vehicles, selectedShipment]);

  useEffect(() => {
    setRunDriverId(drivers.find((driver) => driver.status === 'AVAILABLE')?.id?.toString() || '');
    setRunVehicleId(vehicles.find((vehicle) => vehicle.status === 'AVAILABLE')?.id?.toString() || '');
  }, [drivers, vehicles, dispatchingRunId]);

  const openReceiving = async (run) => {
    setReceiving(true);
    setReceivingError('');
    try {
      if (run.status === 'IN_TRANSIT') {
        await api.post(`/api/transport/runs/${run.id}/arrive`, {});
      }
      const detail = await api.get(`/api/transport/runs/${run.id}`);
      if (!Array.isArray(detail?.manifest?.items)) {
        throw new Error('This run has no readable manifest items to reconcile.');
      }
      setReceivingRun(detail);
      setReceivedShipmentIds([]);
    } catch (error) {
      setReceivingError(error.message);
    } finally {
      setReceiving(false);
    }
  };

  const submitReceiving = async () => {
    if (!receivingRun) return;
    setReceiving(true);
    setReceivingError('');
    try {
      await api.post(`/api/transport/runs/${receivingRun.id}/receive`, {
        received_shipment_ids: receivedShipmentIds,
      });
      setReceivingRun(null);
      await onRefresh();
    } catch (error) {
      setReceivingError(error.message);
    } finally {
      setReceiving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-[#2a3447] bg-[#12161f] p-4">
        <div className="flex items-center justify-between border-b border-[#2a3447] pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Parcels awaiting dispatch</h2>
            <p className="mt-1 text-xs text-slate-400">One station queue: confirm sorting, assign a driver, and dispatch.</p>
          </div>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 font-mono text-[10px] font-bold text-amber-200">
            {shipments.length} WAITING
          </span>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-200">
            Dispatch queue could not be loaded: {error}
          </p>
        ) : shipments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#30394a] px-5 py-8 text-center">
            <PackageCheck className="mx-auto mb-2 h-7 w-7 text-slate-500" />
            <p className="text-sm font-semibold text-slate-200">No parcels waiting at this station</p>
            <p className="mt-1 text-xs text-slate-400">New bookings will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shipments.map((shipment) => {
              const isSorted = ['SORTED', 'READY_FOR_DISPATCH'].includes(shipment.status);
              const isLocalDelivery = Number(shipment.leg_destination) === Number(shipment.current_hub_id);
              return (
                <article key={`${shipment.id}-${shipment.leg_id}`} className="rounded-lg border border-[#2a3447] bg-[#0c0e12] p-3.5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">{shipment.tracking_number}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          isSorted
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                            : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                        }`}>
                          {isSorted ? 'SORTED' : 'SORT REQUIRED'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300">{shipment.recipient_name} · {shipment.recipient_phone}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span>Hub #{shipment.current_hub_id}</span>
                        <ArrowRight className="h-3 w-3 text-cyan-400" />
                        <span>{isLocalDelivery ? 'Recipient delivery' : `Hub #${shipment.leg_destination}`}</span>
                        <span className="text-slate-600">·</span>
                        <span>{isLocalDelivery ? 'Local delivery' : 'Linehaul'}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {!isSorted ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => onManualSort(shipment)}
                          className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-400/20 disabled:opacity-50"
                        >
                          Confirm sort
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedShipment(shipment)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"
                        >
                          Assign driver & dispatch
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedShipment?.id === shipment.id && (
                    <div className="mt-3 grid gap-2 border-t border-[#222834] pt-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                      <select
                        aria-label="Select dispatch driver"
                        value={driverId}
                        onChange={(event) => setDriverId(event.target.value)}
                        className="min-w-0 rounded-lg border border-[#30394a] bg-[#12161f] px-3 py-2 text-xs text-white"
                      >
                        <option value="">Choose available driver</option>
                        {drivers.filter((driver) => driver.status === 'AVAILABLE').map((driver) => (
                          <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Select dispatch vehicle"
                        value={vehicleId}
                        onChange={(event) => setVehicleId(event.target.value)}
                        className="min-w-0 rounded-lg border border-[#30394a] bg-[#12161f] px-3 py-2 text-xs text-white"
                      >
                        <option value="">Choose available vehicle</option>
                        {vehicles.filter((vehicle) => vehicle.status === 'AVAILABLE').map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.registration_number} · {vehicle.vehicle_type}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={loading || !driverId || !vehicleId}
                        onClick={() => onDispatchShipment(shipment, driverId, vehicleId)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Confirm dispatch
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedShipment(null)}
                        className="rounded-lg border border-[#30394a] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06]"
                      >
                        Cancel
                      </button>
                      {(drivers.filter((driver) => driver.status === 'AVAILABLE').length === 0
                        || vehicles.filter((vehicle) => vehicle.status === 'AVAILABLE').length === 0) && (
                        <p className="text-xs text-amber-200 sm:col-span-4">
                          This hub needs an available driver and vehicle before dispatch.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-[#2a3447] bg-[#12161f] p-4">
        <div className="flex items-center justify-between border-b border-[#2a3447] pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
              <Route className="h-4 w-4 text-cyan-300" /> Linehaul runs & receiving
            </h2>
            <p className="mt-1 text-xs text-slate-400">Dispatch planned runs and reconcile parcels at their destination hub.</p>
          </div>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] font-bold text-cyan-300">
            {runs.length} RUNS
          </span>
        </div>
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {runColumns.map((column) => {
            const columnRuns = runs.filter((run) => column.statuses.includes(run.status));
            return (
              <section key={column.id} className="flex max-h-[820px] min-h-[460px] flex-col overflow-hidden rounded-lg border border-[#222834] bg-[#0c0e12]">
                <header className="flex items-center justify-between border-b border-[#222834] border-t-2 border-t-cyan-500/50 bg-[#0b0e14] p-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">{column.label}</h3>
                  <span className="rounded border border-[#222834] bg-[#181d28] px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                    {columnRuns.length}
                  </span>
                </header>
                <div className="flex max-h-[720px] min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
                  {columnRuns.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded border border-dashed border-[#222834] p-5 text-center text-[10px] font-mono uppercase tracking-wider text-slate-600">
                      No runs in this stage
                    </div>
                  ) : columnRuns.map((run) => (
              <article key={run.id} className="rounded-lg border border-[#2a3447] bg-[#0c0e12] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-white">{run.run_number}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{run.manifest_number}</p>
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
                  <span><Truck className="mr-1 inline h-3 w-3" />{run.driver_name || 'Driver unassigned'}</span>
                </div>
                {Number(run.origin_hub_id) === Number(currentHubId)
                  && run.status === 'PLANNED'
                  && run.manifest_status === 'DRAFT' && (
                  <div className="mt-3 border-t border-[#222834] pt-3">
                    {dispatchingRunId === run.id ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          aria-label="Select planned-run driver"
                          value={runDriverId}
                          onChange={(event) => setRunDriverId(event.target.value)}
                          className="min-w-0 rounded-lg border border-[#30394a] bg-[#12161f] px-3 py-2 text-xs text-white"
                        >
                          <option value="">Choose available driver</option>
                          {drivers.filter((driver) => driver.status === 'AVAILABLE').map((driver) => (
                            <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                          ))}
                        </select>
                        <select
                          aria-label="Select planned-run vehicle"
                          value={runVehicleId}
                          onChange={(event) => setRunVehicleId(event.target.value)}
                          className="min-w-0 rounded-lg border border-[#30394a] bg-[#12161f] px-3 py-2 text-xs text-white"
                        >
                          <option value="">Choose available vehicle</option>
                          {vehicles.filter((vehicle) => vehicle.status === 'AVAILABLE').map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.registration_number} · {vehicle.vehicle_type}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!runDriverId || !runVehicleId}
                          onClick={() => onDispatchRun(run, runDriverId, runVehicleId)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
                        >
                          Confirm dispatch
                        </button>
                        <button
                          type="button"
                          onClick={() => setDispatchingRunId(null)}
                          className="rounded-lg border border-[#30394a] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] sm:col-span-2"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDispatchingRunId(run.id)}
                        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"
                      >
                        Assign driver & dispatch planned run
                      </button>
                    )}
                  </div>
                )}
                {Number(run.destination_hub_id) === Number(currentHubId)
                  && ['IN_TRANSIT', 'ARRIVED'].includes(run.status) && (
                  <button
                    type="button"
                    disabled={receiving}
                    onClick={() => openReceiving(run)}
                    className="mt-3 w-full rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50"
                  >
                    {run.status === 'IN_TRANSIT' ? 'Confirm arrival & receive' : 'Reconcile arrived manifest'}
                  </button>
                )}
              </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {receivingRun && (
        <section className="space-y-3 rounded-xl border border-cyan-500/25 bg-[#12161f] p-4">
          <div>
            <h2 className="text-sm font-bold text-white">Receive {receivingRun.run_number}</h2>
            <p className="mt-1 text-xs text-slate-400">Confirm each parcel physically received. Unchecked parcels are recorded as shortages.</p>
          </div>
          <div className="divide-y divide-[#2a3447] rounded-lg border border-[#2a3447]">
            {receivingRun.manifest.items.map((item) => {
              const checked = receivedShipmentIds.includes(item.shipment_id);
              return (
                <label key={item.shipment_id} className="flex cursor-pointer items-center gap-3 p-3 hover:bg-white/[0.03]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setReceivedShipmentIds((current) => (
                      checked
                        ? current.filter((id) => id !== item.shipment_id)
                        : [...current, item.shipment_id]
                    ))}
                    className="h-4 w-4 accent-cyan-500"
                  />
                  <span>
                    <span className="block font-mono text-xs font-bold text-white">{item.tracking_number}</span>
                    <span className="block text-[11px] text-slate-400">{item.recipient_name || 'Parcel'} · {item.shipment_status}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {receivingError && <p role="alert" className="text-xs text-rose-300">{receivingError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={receiving}
              onClick={() => setReceivingRun(null)}
              className="rounded-lg border border-[#30394a] px-3 py-2 text-xs font-semibold text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={receiving}
              onClick={submitReceiving}
              className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-600 disabled:opacity-50"
            >
              {receiving ? 'Saving…' : 'Complete receiving'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
