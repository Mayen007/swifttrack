// client/src/components/branches/BranchInspectorModal.jsx
import React from 'react';
import {
  Layers,
  X,
  MapPin,
  Phone,
  Mail,
  Warehouse,
  Plus,
  RotateCcw,
  Check,
  Lock,
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function BranchInspectorModal({
  hub,
  warehouses = [],
  canEdit,
  isAddingWarehouse,
  setIsAddingWarehouse,
  warehouseFormData,
  setWarehouseFormData,
  isSubmittingWarehouse,
  warehouseError,
  onClose,
  onAddWarehouse,
}) {
  if (!hub) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28] shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
              FACILITY SPECIFICATIONS // HUB: {hub.code}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Hub Metadata Matrix */}
          <div className="bg-[#181d28] border border-[#222834] rounded p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
            <div>
              <span className="block text-slate-400 text-[10px] uppercase">HUB NODE ID</span>
              <span className="font-bold text-white">#{hub.id}</span>
            </div>
            <div>
              <span className="block text-slate-400 text-[10px] uppercase">NODE CODE</span>
              <span className="font-bold text-blue-400">{hub.code}</span>
            </div>
            <div>
              <span className="block text-slate-400 text-[10px] uppercase">CITY LOCATION</span>
              <span className="font-bold text-white">{hub.city}</span>
            </div>
            <div>
              <span className="block text-slate-400 text-[10px] uppercase">OPERATIONAL STATUS</span>
              <span
                className={`font-bold ${
                  hub.is_active !== 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {hub.is_active !== 0 ? 'ONLINE' : 'SUSPENDED'}
              </span>
            </div>
          </div>

          {/* Physical Address & Contact specs */}
          <div className="bg-[#181d28] border border-[#222834] rounded p-3 space-y-2 font-mono text-[11px]">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white">{hub.address}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-slate-300 pt-2 border-t border-[#222834]">
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{hub.phone}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>{hub.email}</span>
              </div>
            </div>
          </div>

          {/* Connected Storage Depots Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-blue-400" />
                REGISTERED STORAGE DEPOTS & BAYS ({warehouses.length})
              </h4>

              {canEdit && !isAddingWarehouse && (
                <button
                  onClick={() => {
                    sound.playScan();
                    setIsAddingWarehouse(true);
                  }}
                  className="px-2.5 py-1 rounded bg-[#181d28] hover:bg-[#222836] border border-[#222834] text-[11px] font-mono font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ADD DEPOT BAY</span>
                </button>
              )}
            </div>

            {/* Inline Add Warehouse Form */}
            {isAddingWarehouse && (
              <form
                onSubmit={onAddWarehouse}
                className="p-3 bg-[#151923] border border-blue-500/40 rounded space-y-3 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-400">
                    PROVISION STORAGE DEPOT / FACILITY
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingWarehouse(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {warehouseError && (
                  <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-mono">
                    {warehouseError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Depot Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={warehouseFormData.code}
                      onChange={(e) =>
                        setWarehouseFormData({
                          ...warehouseFormData,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder={`W-${hub.code}-02`}
                      className="w-full bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs text-white uppercase font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Depot Facility Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={warehouseFormData.name}
                      onChange={(e) =>
                        setWarehouseFormData({
                          ...warehouseFormData,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g. Cold Chain Pharmaceutical Bay"
                      className="w-full bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                    Location / Bay Description
                  </label>
                  <input
                    type="text"
                    value={warehouseFormData.location_desc}
                    onChange={(e) =>
                      setWarehouseFormData({
                        ...warehouseFormData,
                        location_desc: e.target.value,
                      })
                    }
                    placeholder="e.g. Zone C, Loading Bay 4-8"
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222834]">
                  <button
                    type="button"
                    onClick={() => setIsAddingWarehouse(false)}
                    className="px-2.5 py-1 rounded bg-[#181d28] text-slate-300 text-[11px] font-mono cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingWarehouse}
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingWarehouse ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>SAVING...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>SAVE FACILITY</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Depots List Table */}
            <div className="border border-[#222834] rounded overflow-hidden">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-[#181d28] text-slate-400 border-b border-[#222834] uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5">Depot Facility</th>
                    <th className="p-2.5">Bay / Location Description</th>
                    <th className="p-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222834]">
                  {warehouses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                        No warehouse facilities registered under this hub.
                      </td>
                    </tr>
                  ) : (
                    warehouses.map((wh) => (
                      <tr key={wh.id} className="hover:bg-[#181d28]/50 transition-colors">
                        <td className="p-2.5 font-bold text-blue-400">{wh.code}</td>
                        <td className="p-2.5 font-sans font-medium text-white">{wh.name}</td>
                        <td className="p-2.5 text-slate-400">
                          {wh.location_desc || 'Primary Depot Staging Area'}
                        </td>
                        <td className="p-2.5 text-right">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ACTIVE
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tenant Isolation Guarantee box */}
          <div className="p-3 rounded bg-[#181d28] border border-[#222834] flex items-start gap-2 text-slate-400 text-[11px]">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-white font-mono">TENANT ISOLATION POLICY:</strong> In accordance with SwiftTrack architectural specifications, all POS orders, local stock balances, and assigned staff are strictly bounded to Hub Node #{hub.id} ({hub.code}). Inter-branch movements require formal dual-control transfer manifests.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-[#222834] bg-[#181d28] flex items-center justify-between shrink-0">
          <span className="font-mono text-[10px] text-slate-400">
            PROVINCIAL CONTEXT: {hub.city.toUpperCase()}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] border border-[#222834] text-xs font-mono text-slate-200 cursor-pointer"
          >
            CLOSE INSPECTOR
          </button>
        </div>
      </div>
    </div>
  );
}
