import React from 'react';
import { X, AlertCircle, AlertTriangle } from 'lucide-react';

export function LogIncidentModal({
  isOpen,
  selectedDriver,
  onClose,
  incidentForm,
  setIncidentForm,
  onSubmit,
  actionLoading
}) {
  if (!isOpen || !selectedDriver) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#12161f] rounded-2xl border border-[#222834] shadow-2xl w-full max-w-lg overflow-hidden text-white">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span>Log Safety / Traffic Incident</span>
              </div>
              <button onClick={onClose}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={onSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Incident Type *</label>
                  <select
                    value={incidentForm.incident_type}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incident_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    <option value="TRAFFIC_VIOLATION">Traffic Violation</option>
                    <option value="ACCIDENT">Accident</option>
                    <option value="CUSTOMER_COMPLAINT">Customer Complaint</option>
                    <option value="VEHICLE_BREAKDOWN">Vehicle Breakdown</option>
                    <option value="DELAY">Unscheduled Delay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Severity Rating *</label>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Incident Description *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Detail the circumstances, location, and nature of the incident..."
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Corrective Action Taken</label>
                <input
                  type="text"
                  placeholder="e.g. Warning letter, speed governor check, retraining..."
                  value={incidentForm.action_taken}
                  onChange={(e) => setIncidentForm({ ...incidentForm, action_taken: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-[#222834] text-slate-400 hover:text-white rounded-lg text-sm bg-[#181d28] hover:bg-[#1f2534] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700"
                >
                  {actionLoading ? 'Logging...' : 'Save Incident Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
