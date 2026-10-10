// client/src/components/drivers/EditDriverModal.jsx
import React, { useMemo } from 'react';
import {
  User,
  X,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Calendar,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Building,
  Truck,
  Heart,
  Save,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function EditDriverModal({
  isOpen,
  driver,
  onClose,
  editTab,
  setEditTab,
  editForm,
  setEditForm,
  onSubmit,
  actionLoading,
  branches = [],
  vehicles = []
}) {
  if (!isOpen || !driver) return null;

  // Calculate simulated license compliance based on currently typed expiry date
  const compliancePreview = useMemo(() => {
    if (!editForm.license_expiry_date) {
      return {
        status: 'UNVERIFIED',
        badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
        label: 'No Expiry Date Specified',
        daysLeft: 0,
        icon: AlertTriangle
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(editForm.license_expiry_date);
    expiry.setHours(0, 0, 0, 0);

    const diffMs = expiry.getTime() - today.getTime();
    const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return {
        status: 'EXPIRED',
        badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        label: `EXPIRED (${Math.abs(daysLeft)} days ago)`,
        daysLeft,
        icon: XCircle,
        advice: 'Vehicle operation suspended until renewal is filed.'
      };
    } else if (daysLeft <= 30) {
      return {
        status: 'EXPIRING_SOON',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        label: `EXPIRING SOON (${daysLeft} days remaining)`,
        daysLeft,
        icon: AlertTriangle,
        advice: 'NTSA renewal is recommended immediately to prevent downtime.'
      };
    } else {
      return {
        status: 'VALID',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        label: `VALID (${daysLeft} days remaining)`,
        daysLeft,
        icon: ShieldCheck,
        advice: 'Fully compliant with national traffic safety standards.'
      };
    }
  }, [editForm.license_expiry_date]);

  // Quick renewal action helper
  const handleQuickRenewal = (years) => {
    sound.playClick();
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    const newExpiryDate = d.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    setEditForm((prev) => ({
      ...prev,
      license_expiry_date: newExpiryDate,
      ntsa_verified: 1,
      ntsa_verification_date: todayStr
    }));
  };

  const ComplianceIcon = compliancePreview.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#12161f] rounded-2xl border border-[#222834] shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col text-white">
        {/* Modal Header */}
        <div className="p-5 bg-[#181d28] border-b border-[#222834] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">
                  Edit Driver Profile: {driver.full_name}
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {driver.employee_code}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Update driving license expiry, NTSA compliance, contacts & fleet assignment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#222834] bg-[#141822] px-5 gap-4">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setEditTab('license');
            }}
            className={`py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              editTab === 'license'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>1. Driving License & NTSA Compliance</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setEditTab('personal');
            }}
            className={`py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              editTab === 'personal'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>2. Profile & Contacts</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setEditTab('depot_fleet');
            }}
            className={`py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              editTab === 'depot_fleet'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>3. Depot & Fleet Assignment</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={onSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: DRIVING LICENSE & NTSA COMPLIANCE */}
          {editTab === 'license' && (
            <div className="space-y-4">
              {/* Dynamic Compliance Live Status Banner */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${compliancePreview.badgeClass}`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-black/30 shrink-0">
                    <ComplianceIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs uppercase tracking-wide">
                        License Status:
                      </span>
                      <span className="font-mono font-extrabold text-sm">
                        {compliancePreview.label}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {compliancePreview.advice}
                    </p>
                  </div>
                </div>

                {/* Quick renewal buttons for instant 1-click renewal */}
                <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuickRenewal(1)}
                    className="flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/20 transition-all cursor-pointer shadow-xs"
                    title="Quickly set expiry date to 1 year from today"
                  >
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>+1 Year Renewal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickRenewal(3)}
                    className="flex-1 sm:flex-none px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/20 transition-all cursor-pointer shadow-xs"
                    title="Quickly set expiry date to 3 years from today"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-300" />
                    <span>+3 Years Renewal</span>
                  </button>
                </div>
              </div>

              {/* License Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Driving License Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="DL-NRB-12345X"
                    value={editForm.license_number}
                    onChange={(e) =>
                      setEditForm({ ...editForm, license_number: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white font-mono uppercase placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Authorized Vehicle Classes *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B, C1, CE"
                    value={editForm.license_classes}
                    onChange={(e) =>
                      setEditForm({ ...editForm, license_classes: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white font-mono placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Comma-separated: A2 (Bikes), B (Vans/Cars), C1 (Medium Trucks), CE (Heavy Articulated)
                  </span>
                </div>
              </div>

              {/* Dates Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    License Issue Date
                  </label>
                  <input
                    type="date"
                    value={editForm.license_issue_date || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, license_issue_date: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1 flex items-center justify-between">
                    <span>License Expiry Date *</span>
                    <span className="text-[10px] font-normal text-slate-400">
                      Must be future date for active fleet
                    </span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editForm.license_expiry_date || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, license_expiry_date: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-amber-500/60 rounded-lg text-sm text-white font-mono focus:ring-2 focus:ring-amber-500/50 focus:border-amber-400 focus:outline-hidden cursor-pointer"
                  />
                </div>
              </div>

              {/* NTSA Verification Switch */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-[#222834] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-white block">
                      National Transport & Safety Authority (NTSA) Verification
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Driver license and endorsements verified against official NTSA TIMS portal.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.ntsa_verified)}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          ntsa_verified: e.target.checked ? 1 : 0,
                          ntsa_verification_date: e.target.checked
                            ? editForm.ntsa_verification_date || new Date().toISOString().split('T')[0]
                            : ''
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                  <span className="text-xs font-mono font-bold text-slate-300 min-w-[70px]">
                    {editForm.ntsa_verified ? 'VERIFIED' : 'UNVERIFIED'}
                  </span>
                </div>
              </div>

              {/* Statutory IDs Grid */}
              <div className="pt-2 border-t border-[#222834]">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                  Government Identity & Statutory Registrations
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      National ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 29831422"
                      value={editForm.national_id || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, national_id: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950/60 border border-slate-750 border-slate-700/80 rounded-lg text-xs text-white font-mono placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      KRA PIN
                    </label>
                    <input
                      type="text"
                      placeholder="A001234567Z"
                      value={editForm.kra_pin || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, kra_pin: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950/60 border border-slate-700/80 rounded-lg text-xs text-white font-mono uppercase placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      NSSF Number
                    </label>
                    <input
                      type="text"
                      placeholder="NSSF-..."
                      value={editForm.nssf_number || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, nssf_number: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950/60 border border-slate-700/80 rounded-lg text-xs text-white font-mono placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      NHIF / SHA
                    </label>
                    <input
                      type="text"
                      placeholder="NHIF-..."
                      value={editForm.nhif_number || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, nhif_number: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950/60 border border-slate-700/80 rounded-lg text-xs text-white font-mono placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE & CONTACTS */}
          {editTab === 'personal' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.full_name || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, full_name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Primary Phone *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+254 712 345 678"
                    value={editForm.phone || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Alternative Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+254 733 987 654"
                    value={editForm.alt_phone || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, alt_phone: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="driver@swifttrack.co.ke"
                    value={editForm.email || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Residential Address
                  </label>
                  <input
                    type="text"
                    placeholder="Estate, Street / Court, House No."
                    value={editForm.residential_address || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, residential_address: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    City / Town
                  </label>
                  <input
                    type="text"
                    placeholder="Nairobi"
                    value={editForm.city || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, city: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Employment Type
                  </label>
                  <select
                    value={editForm.employment_type || 'FULL_TIME'}
                    onChange={(e) =>
                      setEditForm({ ...editForm, employment_type: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="FULL_TIME">Permanent Full-Time</option>
                    <option value="CONTRACTOR">Contractor / 3PL</option>
                    <option value="CASUAL">Casual / On-Call</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Date of Hire
                  </label>
                  <input
                    type="date"
                    value={editForm.hire_date || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, hire_date: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={editForm.blood_group || 'O+'}
                    onChange={(e) =>
                      setEditForm({ ...editForm, blood_group: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="O+">O Positive (O+)</option>
                    <option value="O-">O Negative (O-)</option>
                    <option value="A+">A Positive (A+)</option>
                    <option value="A-">A Negative (A-)</option>
                    <option value="B+">B Positive (B+)</option>
                    <option value="B-">B Negative (B-)</option>
                    <option value="AB+">AB Positive (AB+)</option>
                    <option value="AB-">AB Negative (AB-)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Operational Notes & Endorsements
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional certifications, dangerous goods handling, regional road familiarity..."
                  value={editForm.notes || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* TAB 3: DEPOT, FLEET & EMERGENCY */}
          {editTab === 'depot_fleet' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assigned Depot Branch *
                  </label>
                  <select
                    value={editForm.branch_id || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, branch_id: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        [{b.code}] {b.name} ({b.city})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Shifting depot synchronizes both fleet roster and user branch identity.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assigned Fleet Vehicle
                  </label>
                  <select
                    value={editForm.vehicle_id || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, vehicle_id: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="">— Unassigned (Standby / Spare) —</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration_number} ({v.model || v.vehicle_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Emergency Contact Dossier */}
              <div className="pt-3 border-t border-[#222834]">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400" />
                  <span>Next of Kin & Emergency Medical Contact</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mary Wanjiku"
                      value={editForm.emergency_contact_name || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, emergency_contact_name: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950/60 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+254 711 222 333"
                      value={editForm.emergency_contact_phone || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, emergency_contact_phone: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950/60 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Relationship
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Spouse / Brother / Kin"
                      value={editForm.emergency_contact_relation || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, emergency_contact_relation: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950/60 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-[#222834] flex items-center justify-between">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>All changes logged in audit ledger & synced to mobile drivers app.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{actionLoading ? 'Saving Changes...' : 'Save Driver Details'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
