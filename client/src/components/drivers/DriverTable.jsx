import React from 'react';
import {
  RefreshCw, User, Phone, MapPin, CreditCard,
  ShieldCheck, AlertTriangle, XCircle, Star, Eye, Car, Truck, Activity, Edit2
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function DriverTable({
  drivers = [],
  loading,
  onOpenDetail,
  onOpenEdit,
  onOpenStatus,
  onOpenVehicle,
  onOpenIncident,
  isCompact = false
}) {
  const cellPadding = isCompact ? 'py-1.5 px-3' : 'py-2 px-3';

  return (
    <div className="bg-[#12161f] rounded-xl border border-[#222834] overflow-hidden shadow-sm">
      <div className="overflow-x-auto max-h-[calc(100vh-275px)] overflow-y-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[1180px]">
          {/* Dedicated column allocations ensuring zero element collisions & instant readability */}
          <colgroup>
            <col style={{ width: '21%', minWidth: '210px' }} />
            <col style={{ width: '14%', minWidth: '150px' }} />
            <col style={{ width: '15%', minWidth: '160px' }} />
            <col style={{ width: '24%', minWidth: '250px' }} />
            <col style={{ width: '12%', minWidth: '130px' }} />
            <col style={{ width: '12%', minWidth: '120px' }} />
            <col style={{ width: '180px', minWidth: '180px' }} />
          </colgroup>

          <thead className="sticky top-0 z-10 bg-[#161c28] border-b border-[#222834] text-[10px] font-bold uppercase tracking-wider text-slate-400 shadow-xs">
            <tr>
              <th className="py-2.5 px-3 min-w-[220px]">Driver & ID</th>
              <th className="py-2.5 px-3 min-w-[150px]">Contact & Depot</th>
              <th className="py-2.5 px-3 min-w-[160px]">Assigned Vehicle</th>
              <th className="py-2.5 px-3 min-w-[250px] text-blue-400/90">NTSA License & Expiry</th>
              <th className="py-2.5 px-3 min-w-[130px]">Duty Status</th>
              <th className="py-2.5 px-3 min-w-[125px]">Scorecard</th>
              <th className="py-2.5 px-3 min-w-[150px] w-[150px] text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#1b212c]">
            {loading ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                  <span className="text-xs">Loading driver fleet roster...</span>
                </td>
              </tr>
            ) : drivers.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  <Truck className="w-7 h-7 mx-auto mb-2 text-slate-500" />
                  <p className="font-semibold text-slate-300 text-sm">No drivers found matching criteria</p>
                  <p className="text-xs text-slate-500 mt-0.5">Adjust search/filters or onboard a new fleet driver</p>
                </td>
              </tr>
            ) : (
              drivers.map(drv => {
                const isExpiringSoon = drv.compliance?.status === 'EXPIRING_SOON';
                const isExpired = drv.compliance?.status === 'EXPIRED';

                return (
                  <tr
                    key={drv.id}
                    className="hover:bg-white/[0.025] transition-colors group cursor-pointer"
                    onClick={() => onOpenDetail(drv)}
                  >
                    {/* Driver Profile */}
                    <td className={`${cellPadding} min-w-[220px]`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`${isCompact ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-xs'} shrink-0 rounded-full bg-slate-800 border border-[#222834] text-white flex items-center justify-center font-bold font-mono`}>
                          {drv.avatar_url ? (
                            <img src={drv.avatar_url} alt={drv.full_name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            drv.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'DR'
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white flex items-center gap-1.5 leading-snug whitespace-nowrap">
                            <span className="group-hover:text-blue-400 transition-colors">{drv.full_name}</span>
                            <span className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-mono text-slate-400 bg-slate-900 border border-[#222834]">
                              {drv.employee_code || `DRV-${String(drv.id).padStart(4, '0')}`}
                            </span>
                          </div>
                          {!isCompact && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 leading-none whitespace-nowrap">
                              <span>ID: <strong className="font-mono text-slate-300 font-normal">{drv.national_id || '—'}</strong></span>
                              <span className="text-slate-600">·</span>
                              <span>KRA: <strong className="font-mono text-slate-300 font-normal">{drv.kra_pin || '—'}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact & Depot */}
                    <td className={`${cellPadding} min-w-[150px]`}>
                      <div className="text-slate-200 font-mono text-xs flex items-center gap-1.5 whitespace-nowrap">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{drv.phone || '—'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 whitespace-nowrap" title={drv.branch_name}>
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{drv.branch_name || 'Depot'}</span>
                      </div>
                    </td>

                    {/* Assigned Vehicle */}
                    <td className={`${cellPadding} min-w-[160px]`}>
                      {drv.vehicle_reg ? (
                        <div>
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="p-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                              <Truck className="w-3 h-3" />
                            </span>
                            <span className="font-mono font-bold text-white text-xs">
                              {drv.vehicle_reg}
                            </span>
                          </div>
                          {!isCompact && (
                            <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap" title={drv.vehicle_model || drv.vehicle_type}>
                              {drv.vehicle_model || drv.vehicle_type || 'Fleet Vehicle'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 bg-slate-900/80 border border-[#222834] whitespace-nowrap">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* NTSA License & Expiry */}
                    <td className={`${cellPadding} min-w-[250px]`}>
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-white tracking-wide">
                          {drv.license_number || 'No License on file'}
                        </span>
                        {drv.license_classes && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900 text-slate-300 font-mono border border-slate-700">
                            Class {drv.license_classes}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                          isExpired
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : isExpiringSoon
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {isExpired ? (
                            <XCircle className="w-2.5 h-2.5 shrink-0" />
                          ) : isExpiringSoon ? (
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                          ) : (
                            <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                          )}
                          <span>
                            {isExpired
                              ? `Expired (${Math.abs(drv.compliance?.days_left || 0)}d ago)`
                              : isExpiringSoon
                              ? `Expires in ${drv.compliance?.days_left}d`
                              : `Valid (${drv.compliance?.days_left ? `${drv.compliance.days_left}d` : 'Current'})`}
                          </span>
                        </span>

                        {drv.license_expiry_date && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Exp: {new Date(drv.license_expiry_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        )}

                        {(isExpired || isExpiringSoon) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenEdit) onOpenEdit(drv, 'license');
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors cursor-pointer"
                            title="Quickly renew driving license"
                          >
                            Renew
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Duty Status */}
                    <td className={`${cellPadding} min-w-[130px]`}>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
                        drv.status === 'AVAILABLE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : drv.status === 'ON_DELIVERY'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : drv.status === 'SUSPENDED'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-slate-900 text-slate-400 border-[#222834]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          drv.status === 'AVAILABLE' ? 'bg-emerald-500 animate-pulse' :
                          drv.status === 'ON_DELIVERY' ? 'bg-blue-500 animate-pulse' :
                          drv.status === 'SUSPENDED' ? 'bg-rose-500' : 'bg-slate-500'
                        }`} />
                        <span>{drv.status?.replace('_', ' ') || 'OFF DUTY'}</span>
                      </span>
                    </td>

                    {/* Scorecard */}
                    <td className={`${cellPadding} min-w-[125px]`}>
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-200 whitespace-nowrap">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                        <span className="tabular-nums font-bold">{(Number(drv.rating) || 5.0).toFixed(1)}</span>
                        <span className="text-slate-600 mx-0.5">·</span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          {drv.completed_deliveries_count || 0} jobs
                        </span>
                      </div>
                      <div className="text-[10px] mt-0.5 whitespace-nowrap">
                        {drv.active_deliveries_count > 0 ? (
                          <span className="text-blue-400 font-semibold">{drv.active_deliveries_count} in transit</span>
                        ) : (
                          <span className="text-slate-500">Standby</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className={`${cellPadding} min-w-[180px] w-[180px] text-right`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenDetail(drv)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-[#222834] text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="View Scorecard & Compliance Dossier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onOpenEdit && onOpenEdit(drv)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-[#222834] text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                          title="Edit Driver Details & License"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onOpenStatus(drv)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-[#222834] text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                          title="Update Operational Status"
                        >
                          <Activity className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onOpenVehicle(drv)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-[#222834] text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Assign Vehicle"
                        >
                          <Truck className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onOpenIncident(drv)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-[#222834] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Log Safety Incident"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
