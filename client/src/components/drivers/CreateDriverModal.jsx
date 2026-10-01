import React from 'react';
import { User, X, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';

export function CreateDriverModal({
  isOpen,
  onClose,
  createTab,
  setCreateTab,
  createForm,
  setCreateForm,
  onSubmit,
  actionLoading,
  branches,
  vehicles = []
}) {
  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-[#12161f] rounded-2xl border border-[#222834] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col text-white">
            <div className="p-5 bg-[#181d28] border-b border-[#222834] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Onboard Fleet Driver</h3>
                  <p className="text-xs text-slate-500">Government identity, NTSA driving license & depot assignment</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-[#222834] bg-[#141822] px-5 gap-4">
              <button
                type="button"
                onClick={() => setCreateTab('basic')}
                className={`py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  createTab === 'basic' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                1. Profile & Contacts
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('id_license')}
                className={`py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  createTab === 'id_license' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                2. Government ID & NTSA License
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('depot_vehicle')}
                className={`py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  createTab === 'depot_vehicle' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                3. Depot & Vehicle Assignment
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
              {createTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mwangi Kamau"
                        value={createForm.full_name}
                        onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Phone *</label>
                      <input
                        type="text"
                        required
                        placeholder="+254 712 345 678"
                        value={createForm.phone}
                        onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="driver@swifttrack.co.ke"
                        value={createForm.email}
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Alternate Phone</label>
                      <input
                        type="text"
                        placeholder="+254 733 999 888"
                        value={createForm.alt_phone}
                        onChange={(e) => setCreateForm({ ...createForm, alt_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Type</label>
                      <select
                        value={createForm.employment_type}
                        onChange={(e) => setCreateForm({ ...createForm, employment_type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      >
                        <option value="FULL_TIME">Full Time</option>
                        <option value="CONTRACTOR">Contractor</option>
                        <option value="CASUAL">Casual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group</label>
                      <select
                        value={createForm.blood_group}
                        onChange={(e) => setCreateForm({ ...createForm, blood_group: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      >
                        <option value="O+">O+</option>
                        <option value="A+">A+</option>
                        <option value="B+">B+</option>
                        <option value="AB+">AB+</option>
                        <option value="O-">O-</option>
                        <option value="A-">A-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={createForm.city}
                        onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-[#181d28] border border-[#222834] rounded-xl space-y-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Emergency Contact</span>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <input
                          type="text"
                          placeholder="Contact Name"
                          value={createForm.emergency_contact_name}
                          onChange={(e) => setCreateForm({ ...createForm, emergency_contact_name: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Phone Number"
                          value={createForm.emergency_contact_phone}
                          onChange={(e) => setCreateForm({ ...createForm, emergency_contact_phone: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Relationship (e.g. Spouse)"
                          value={createForm.emergency_contact_relation}
                          onChange={(e) => setCreateForm({ ...createForm, emergency_contact_relation: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {createTab === 'id_license' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">National ID Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ID-28938102"
                        value={createForm.national_id}
                        onChange={(e) => setCreateForm({ ...createForm, national_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">KRA PIN Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. A00198234K"
                        value={createForm.kra_pin}
                        onChange={(e) => setCreateForm({ ...createForm, kra_pin: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NSSF Number</label>
                      <input
                        type="text"
                        placeholder="NSSF-XXXXX"
                        value={createForm.nssf_number}
                        onChange={(e) => setCreateForm({ ...createForm, nssf_number: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NHIF / SHA Number</label>
                      <input
                        type="text"
                        placeholder="NHIF-XXXXX"
                        value={createForm.nhif_number}
                        onChange={(e) => setCreateForm({ ...createForm, nhif_number: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50/40 border border-blue-200/80 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      NTSA Driving License Governance
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">License Number *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. DL-NRB-88219"
                          value={createForm.license_number}
                          onChange={(e) => setCreateForm({ ...createForm, license_number: e.target.value })}
                          className="w-full px-3 py-1.5 border border-[#222834] rounded bg-[#0c0e12] text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Authorized License Classes *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. A2, B, C1, CE"
                          value={createForm.license_classes}
                          onChange={(e) => setCreateForm({ ...createForm, license_classes: e.target.value })}
                          className="w-full px-3 py-1.5 border border-[#222834] rounded bg-[#0c0e12] text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">License Issue Date</label>
                        <input
                          type="date"
                          value={createForm.license_issue_date}
                          onChange={(e) => setCreateForm({ ...createForm, license_issue_date: e.target.value })}
                          className="w-full px-3 py-1.5 border border-[#222834] rounded bg-[#0c0e12] text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">License Expiry Date *</label>
                        <input
                          type="date"
                          required
                          value={createForm.license_expiry_date}
                          onChange={(e) => setCreateForm({ ...createForm, license_expiry_date: e.target.value })}
                          className="w-full px-3 py-1.5 border border-[#222834] rounded bg-[#0c0e12] text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {createTab === 'depot_vehicle' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Branch Depot *</label>
                      <select
                        required
                        value={createForm.branch_id}
                        onChange={(e) => setCreateForm({ ...createForm, branch_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      >
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Vehicle Pairing</label>
                      <select
                        value={createForm.vehicle_id}
                        onChange={(e) => setCreateForm({ ...createForm, vehicle_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      >
                        <option value="">No Vehicle (Assign Later)</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.registration_number} — {v.model || v.vehicle_type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-[#181d28] border border-[#222834] rounded-xl space-y-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Driver Mobile Portal Account</span>
                    <p className="text-xs text-slate-500">
                      A staff account with DRIVER role is automatically created with temporary password <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">Driver@SwiftTrack2026!</code> allowing immediate login to the Courier Driver Portal.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Notes</label>
                    <textarea
                      rows="3"
                      placeholder="Special endorsements, routes, experience, certifications..."
                      value={createForm.notes}
                      onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-[#222834] text-slate-400 hover:text-white rounded-lg text-sm bg-[#181d28] hover:bg-[#1f2534] font-medium"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {createTab !== 'basic' && (
                    <button
                      type="button"
                      onClick={() => setCreateTab(createTab === 'depot_vehicle' ? 'id_license' : 'basic')}
                      className="px-3.5 py-2 border border-[#222834] text-slate-400 hover:text-white rounded-lg text-sm bg-[#181d28] hover:bg-[#1f2534] font-medium"
                    >
                      Back
                    </button>
                  )}

                  {createTab !== 'depot_vehicle' ? (
                    <button
                      type="button"
                      onClick={() => setCreateTab(createTab === 'basic' ? 'id_license' : 'depot_vehicle')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-semibold"
                    >
                      Next Step
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-semibold shadow-xs flex items-center gap-2"
                    >
                      {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>Save & Provision Driver</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
  );
}
