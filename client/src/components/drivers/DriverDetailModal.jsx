import React from 'react';
import {
  X, User, ShieldCheck, AlertTriangle, XCircle, Award,
  Phone, Mail, MapPin, CreditCard, FileText, Calendar,
  TrendingUp, CheckCircle2, Clock, Star, Car, AlertCircle, Plus, Truck
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function DriverDetailModal({
  isOpen,
  selectedDriver,
  onClose,
  detailTab,
  setDetailTab,
  driverScorecard,
  driverDeliveries,
  driverIncidents,
  driverHistory,
  onOpenStatus,
  onOpenVehicle,
  onOpenIncident
}) {
  if (!isOpen || !selectedDriver) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#12161f] rounded-2xl border border-[#222834] shadow-2xl w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col text-white">
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 text-white flex items-center justify-center font-bold text-xl shadow-inner">
                  {selectedDriver.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'DR'}
                </div>
                <div>
                  <div className="text-[11px] font-mono text-slate-400 mb-1 flex items-center gap-1.5">
                    <span className="text-slate-500 uppercase tracking-wider">Fleet Drivers</span>
                    <span className="text-slate-600">›</span>
                    <span className="text-blue-400 font-semibold">{selectedDriver.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold tracking-tight">{selectedDriver.full_name}</h2>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {selectedDriver.employee_code}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedDriver.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      selectedDriver.status === 'ON_DELIVERY' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {selectedDriver.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                    <span>Depot: {selectedDriver.branch_name}</span>
                    <span>•</span>
                    <span>License: {selectedDriver.license_number}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{selectedDriver.rating ? selectedDriver.rating.toFixed(1) : '5.0'} / 5.0</span>
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-[#222834] bg-[#141822] px-6 gap-6">
              <button
                type="button"
                onClick={() => setDetailTab('overview')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'overview' ? 'border-blue-500 text-blue-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Overview & Compliance</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('scorecard')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'scorecard' ? 'border-blue-500 text-blue-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>Performance Scorecard</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('deliveries')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'deliveries' ? 'border-blue-500 text-blue-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Delivery Runs ({driverDeliveries.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('incidents')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'incidents' ? 'border-blue-500 text-blue-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Status & Incidents ({driverIncidents.length})</span>
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: Overview & Compliance */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  {/* Compliance Banner */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    selectedDriver.compliance?.status === 'VALID'
                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                      : selectedDriver.compliance?.status === 'EXPIRING_SOON'
                      ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                      : 'bg-rose-50/50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-6 h-6" />
                      <div>
                        <div className="font-bold text-sm">
                          License Compliance: {selectedDriver.compliance?.status?.replace('_', ' ')}
                        </div>
                        <div className="text-xs opacity-90">{selectedDriver.compliance?.message}</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-sm">
                      {selectedDriver.compliance?.days_left > 0 ? `${selectedDriver.compliance?.days_left} days left` : 'Expired'}
                    </span>
                  </div>

                  {/* 2 Column Details */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-[#181d28] p-4 rounded-xl border border-[#222834] space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Government Identity</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500">National ID:</span>
                        <span className="font-semibold text-slate-900 font-mono">{selectedDriver.national_id || 'Not recorded'}</span>
                        <span className="text-slate-500">KRA PIN:</span>
                        <span className="font-semibold text-slate-900 font-mono">{selectedDriver.kra_pin || 'Not recorded'}</span>
                        <span className="text-slate-500">NSSF Number:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.nssf_number || 'Not recorded'}</span>
                        <span className="text-slate-500">NHIF / SHA:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.nhif_number || 'Not recorded'}</span>
                      </div>
                    </div>

                    <div className="bg-[#181d28] p-4 rounded-xl border border-[#222834] space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">NTSA License Record</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500">License Number:</span>
                        <span className="font-semibold text-slate-900 font-mono">{selectedDriver.license_number}</span>
                        <span className="text-slate-500">Allowed Classes:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.license_classes || 'B, C1'}</span>
                        <span className="text-slate-500">Issue Date:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.license_issue_date || 'N/A'}</span>
                        <span className="text-slate-500">Expiry Date:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.license_expiry_date || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Emergency */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-[#181d28] p-4 rounded-xl border border-[#222834] space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact & Residential</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500">Primary Phone:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.phone}</span>
                        <span className="text-slate-500">Alt Phone:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.alt_phone || 'None'}</span>
                        <span className="text-slate-500">Email:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.email || 'None'}</span>
                        <span className="text-slate-500">Address:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.residential_address || 'Nairobi'}</span>
                      </div>
                    </div>

                    <div className="bg-[#181d28] p-4 rounded-xl border border-[#222834] space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Emergency Contact</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500">Contact Name:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.emergency_contact_name || 'Not recorded'}</span>
                        <span className="text-slate-500">Emergency Phone:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.emergency_contact_phone || 'Not recorded'}</span>
                        <span className="text-slate-500">Relationship:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.emergency_contact_relation || 'Next of Kin'}</span>
                        <span className="text-slate-500">Blood Group:</span>
                        <span className="font-semibold text-slate-900 font-mono">{selectedDriver.blood_group || 'O+'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Performance Scorecard */}
              {detailTab === 'scorecard' && (
                <div className="space-y-6">
                  {driverScorecard ? (
                    <>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 bg-[#181d28] border border-[#222834] rounded-xl text-center">
                          <div className="text-2xl font-bold text-blue-400">{driverScorecard.metrics.success_rate_pct}%</div>
                          <div className="text-xs text-slate-400 font-medium mt-1">Delivery Success Rate</div>
                        </div>

                        <div className="p-4 bg-[#181d28] border border-[#222834] rounded-xl text-center">
                          <div className="text-2xl font-bold text-emerald-400">{driverScorecard.metrics.on_time_rate_pct}%</div>
                          <div className="text-xs text-slate-400 font-medium mt-1">On-Time Arrival Rate</div>
                        </div>

                        <div className="p-4 bg-[#181d28] border border-[#222834] rounded-xl text-center">
                          <div className="text-2xl font-bold text-amber-400">{driverScorecard.metrics.avg_turnaround_minutes}m</div>
                          <div className="text-xs text-slate-400 font-medium mt-1">Avg Turnaround Time</div>
                        </div>

                        <div className="p-4 bg-[#181d28] border border-[#222834] rounded-xl text-center">
                          <div className="text-2xl font-bold text-white tracking-tight">{driverScorecard.metrics.incident_count}</div>
                          <div className="text-xs text-slate-600 font-medium mt-1">Safety Incidents</div>
                        </div>
                      </div>

                      {/* Drop volumes */}
                      <div className="bg-[#181d28] p-4 rounded-xl border border-[#222834] space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Historical Job Tally</h4>
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-lg font-bold text-slate-900">{driverScorecard.metrics.total_assigned}</div>
                            <div className="text-xs text-slate-500">Total Assigned</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-emerald-600">{driverScorecard.metrics.total_completed}</div>
                            <div className="text-xs text-slate-500">Delivered</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-rose-600">{driverScorecard.metrics.total_failed}</div>
                            <div className="text-xs text-slate-500">Failed / Returned</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-blue-600">{driverScorecard.metrics.total_active}</div>
                            <div className="text-xs text-slate-500">Active Transit</div>
                          </div>
                        </div>
                      </div>

                      {/* Priority breakdown */}
                      <div className="bg-[#181d28] p-4 rounded-xl border border-[#222834] space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Priority Distribution</h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 bg-[#141822] rounded-lg border border-[#222834]">
                            <span className="text-xs font-semibold text-rose-600">Urgent Runs</span>
                            <div className="text-lg font-bold text-slate-900">{driverScorecard.priority_breakdown?.urgent || 0}</div>
                          </div>
                          <div className="p-3 bg-[#141822] rounded-lg border border-[#222834]">
                            <span className="text-xs font-semibold text-amber-600">High Priority</span>
                            <div className="text-lg font-bold text-slate-900">{driverScorecard.priority_breakdown?.high || 0}</div>
                          </div>
                          <div className="p-3 bg-[#141822] rounded-lg border border-[#222834]">
                            <span className="text-xs font-semibold text-slate-600">Standard Normal</span>
                            <div className="text-lg font-bold text-slate-900">{driverScorecard.priority_breakdown?.normal || 0}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 text-slate-400">Loading scorecard telemetry...</div>
                  )}
                </div>
              )}

              {/* TAB 3: Delivery History */}
              {detailTab === 'deliveries' && (
                <div className="space-y-4">
                  {driverDeliveries.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p>No delivery runs logged for this driver yet.</p>
                    </div>
                  ) : (
                    <div className="border border-[#222834] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-[#181d28] border-b border-[#222834] font-semibold uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="py-2.5 px-3">Delivery #</th>
                            <th className="py-2.5 px-3">Customer & Address</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Turnaround</th>
                            <th className="py-2.5 px-3">POD Verification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1b212c]">
                          {driverDeliveries.map(del => (
                            <tr key={del.delivery_id} className="hover:bg-white/[0.02]">
                              <td className="py-2.5 px-3 font-mono font-semibold text-white">
                                {del.delivery_number}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-white">{del.customer_name}</div>
                                <div className="text-[11px] text-slate-400">{del.delivery_address}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  del.delivery_status === 'DELIVERED'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-[#181d28] text-slate-400 border border-[#222834]'
                                }`}>
                                  {del.delivery_status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div>{del.turnaround_minutes ? `${del.turnaround_minutes} mins` : 'In transit'}</div>
                                {del.is_on_time !== null && (
                                  <span className={`text-[10px] font-semibold flex items-center gap-1 ${del.is_on_time ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {del.is_on_time ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                    <span>{del.is_on_time ? 'On Time' : 'Delayed'}</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="text-[11px] font-medium text-slate-200">{del.recipient_name || 'Direct'}</div>
                                <div className="text-[10px] text-slate-400">
                                  {del.has_signature ? 'Signature verified' : 'No signature'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Status & Incidents */}
              {detailTab === 'incidents' && (
                <div className="space-y-6">
                  {/* Incidents Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Safety & Incident Logs</h4>
                      <button
                        onClick={() => onOpenIncident()}
                        className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded border border-rose-200 flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Log New Incident</span>
                      </button>
                    </div>

                    {driverIncidents.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs">
                        Clean safety record. No incidents logged.
                      </div>
                    ) : (
                      <div className="border border-[#222834] rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-[#181d28] border-b border-[#222834] font-semibold uppercase text-slate-400">
                            <tr>
                              <th className="py-2.5 px-3">Type & Severity</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Description</th>
                              <th className="py-2.5 px-3">Action Taken</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1b212c]">
                            {driverIncidents.map(inc => (
                              <tr key={inc.id} className="hover:bg-white/[0.02]">
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-white">{inc.incident_type}</div>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    inc.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                    inc.severity === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                    inc.severity === 'MEDIUM' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                    'bg-[#181d28] text-slate-400 border border-[#222834]'
                                  }`}>
                                    {inc.severity}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                                  {new Date(inc.incident_date).toLocaleDateString()}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">{inc.description}</td>
                                <td className="py-2.5 px-3 text-slate-500">{inc.action_taken || 'None'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Status Timeline */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Status Transition Timeline</h4>
                    <div className="space-y-2">
                      {driverHistory.map((hist, i) => (
                        <div key={hist.id || i} className="p-2.5 rounded-lg border border-[#222834] bg-[#141822] text-xs flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-800">{hist.from_status || 'INITIAL'} &rarr; {hist.to_status}</span>
                            {hist.reason && <p className="text-[11px] text-slate-500 mt-0.5">{hist.reason}</p>}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(hist.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
