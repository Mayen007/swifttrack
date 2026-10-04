import React from 'react';
import {
  RefreshCw, User, Phone, Mail, MapPin, CreditCard,
  ShieldCheck, AlertTriangle, XCircle, Star, Eye, Car, AlertCircle, Truck, Activity
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function DriverTable({
  drivers,
  loading,
  onOpenDetail,
  onOpenStatus,
  onOpenVehicle,
  onOpenIncident
}) {
  return (
      <div className="bg-[#12161f] rounded-xl border border-[#2a3447] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-800 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-[#181d28] border-b border-[#2a3447] text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">Driver Profile</th>
                <th className="py-3 px-4">Contact & Depot</th>
                <th className="py-3 px-4">Assigned Vehicle</th>
                <th className="py-3 px-4">NTSA License & Expiry</th>
                <th className="py-3 px-4">Duty Status</th>
                <th className="py-3 px-4">Scorecard & Jobs</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#1b212c]">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading driver fleet roster...</span>
                  </td>
                </tr>
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="font-medium text-slate-700 dark:text-slate-300">No drivers found matching criteria</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Adjust filters or onboard new drivers above</p>
                  </td>
                </tr>
              ) : (
                drivers.map(drv => {
                  const isExpiringSoon = drv.compliance?.status === 'EXPIRING_SOON';
                  const isExpired = drv.compliance?.status === 'EXPIRED';

                  return (
                    <tr key={drv.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      {/* Driver Profile */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#181d28] border border-slate-300 dark:border-[#2a3447] text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                            {drv.avatar_url ? (
                              <img src={drv.avatar_url} alt={drv.full_name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              drv.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'DR'
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{drv.full_name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 dark:bg-[#181d28] text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-[#2a3447]">
                                {drv.employee_code || `DRV-${String(drv.id).padStart(4, '0')}`}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>ID: {drv.national_id || 'N/A'}</span>
                              <span>•</span>
                              <span>KRA: {drv.kra_pin || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Depot */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 dark:text-slate-200 font-medium text-xs flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>{drv.phone}</span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>{drv.branch_name}{drv.city ? ` (${drv.city})` : ''}</span>
                        </div>
                      </td>

                      {/* Assigned Vehicle */}
                      <td className="py-3.5 px-4">
                        {drv.vehicle_reg ? (
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                              <Truck className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white text-xs font-mono">{drv.vehicle_reg}</div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400">{drv.vehicle_model || drv.vehicle_type || 'Fleet Vehicle'}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-[#181d28] text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-[#2a3447]">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* NTSA License & Expiry */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <span>{drv.license_number}</span>
                          <span className="text-[10px] font-normal text-slate-500 font-sans">({drv.license_classes || 'B, C1'})</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            isExpired
                              ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/20'
                              : isExpiringSoon
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-500/20'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/20'
                          }`}>
                            {isExpired ? (
                              <XCircle className="w-3 h-3 text-rose-500" />
                            ) : isExpiringSoon ? (
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                            ) : (
                              <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            )}
                            <span>{drv.compliance?.message || 'Valid'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Operational Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          drv.status === 'AVAILABLE'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/20'
                            : drv.status === 'ON_DELIVERY'
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/20'
                            : drv.status === 'SUSPENDED'
                            ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/20'
                            : 'bg-slate-100 dark:bg-[#181d28] text-slate-700 dark:text-slate-400 border-slate-300 dark:border-[#2a3447]'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            drv.status === 'AVAILABLE' ? 'bg-emerald-600 animate-pulse' :
                            drv.status === 'ON_DELIVERY' ? 'bg-blue-600 animate-pulse' :
                            drv.status === 'SUSPENDED' ? 'bg-rose-600' : 'bg-slate-400'
                          }`} />
                          <span>{drv.status.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Scorecard & Active Jobs */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{drv.rating ? drv.rating.toFixed(1) : '5.0'}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          <span>{drv.completed_deliveries_count || 0} completed</span>
                          {drv.active_deliveries_count > 0 && (
                            <span className="ml-1 text-blue-600 dark:text-blue-400 font-semibold">({drv.active_deliveries_count} active)</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenDetail(drv)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#181d28] dark:hover:bg-[#1f2534] border border-slate-300 dark:border-[#2a3447] text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                            title="View Scorecard & Deep Dive"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onOpenStatus(drv)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#181d28] dark:hover:bg-[#1f2534] border border-slate-300 dark:border-[#2a3447] text-slate-700 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                            title="Update Duty Status"
                          >
                            <Activity className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onOpenVehicle(drv)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#181d28] dark:hover:bg-[#1f2534] border border-slate-300 dark:border-[#2a3447] text-slate-700 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                            title="Assign Vehicle"
                          >
                            <Truck className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onOpenIncident(drv)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#181d28] dark:hover:bg-[#1f2534] border border-slate-300 dark:border-[#2a3447] text-slate-700 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
                            title="Log Safety Incident"
                          >
                            <AlertTriangle className="w-4 h-4" />
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
