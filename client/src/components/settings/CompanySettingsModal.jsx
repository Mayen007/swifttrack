// client/src/components/settings/CompanySettingsModal.jsx
// Enterprise Organization & Tax Settings Modal
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';
import {
  Building2,
  Receipt,
  FileText,
  ShieldCheck,
  Percent,
  Phone,
  Mail,
  MapPin,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';

export function CompanySettingsModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    company_name: '',
    registration_number: '',
    kra_pin: '',
    vat_rate: '16.00',
    currency: 'KES',
    phone: '',
    email: '',
    address: '',
    city: 'Nairobi',
    country: 'Kenya',
    receipt_header: '',
    receipt_footer: '',
    etims_enabled: true,
    etims_branch_code: '00',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadCompany() {
      setLoading(true);
      setStatusMsg(null);
      try {
        const res = await api.get('/api/v1/company');
        if (isMounted && res) {
          setFormData({
            company_name: res.company_name || '',
            registration_number: res.registration_number || '',
            kra_pin: res.kra_pin || '',
            vat_rate: res.vat_rate !== undefined ? String(res.vat_rate) : '16.00',
            currency: res.currency || 'KES',
            phone: res.phone || '',
            email: res.email || '',
            address: res.address || '',
            city: res.city || 'Nairobi',
            country: res.country || 'Kenya',
            receipt_header: res.receipt_header || '',
            receipt_footer: res.receipt_footer || '',
            etims_enabled: Boolean(res.etims_enabled),
            etims_branch_code: res.etims_branch_code || '00',
          });
        }
      } catch (err) {
        if (isMounted) {
          setStatusMsg({ type: 'error', text: 'Failed to load company settings: ' + err.message });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCompany();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const payload = {
        ...formData,
        vat_rate: parseFloat(formData.vat_rate) || 16.0,
      };

      const res = await api.put('/api/v1/company', payload);
      sound.playSuccess();
      setStatusMsg({ type: 'success', text: 'Enterprise settings & tax configuration saved successfully!' });
      if (res?.company) {
        setFormData((prev) => ({
          ...prev,
          company_name: res.company.company_name || prev.company_name,
          registration_number: res.company.registration_number || prev.registration_number,
          kra_pin: res.company.kra_pin || prev.kra_pin,
          vat_rate: String(res.company.vat_rate ?? prev.vat_rate),
          phone: res.company.phone || prev.phone,
          email: res.company.email || prev.email,
          address: res.company.address || prev.address,
        }));
      }
    } catch (err) {
      sound.playAlert();
      setStatusMsg({ type: 'error', text: 'Error saving settings: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-2xl w-full shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#222834] flex items-center justify-between bg-[#161b26]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Organization & Fiscal Settings
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SUPER_ADMIN
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Manage company identity, KRA tax parameters, receipts, and eTIMS defaults
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#202736] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            className={`px-5 py-2.5 text-xs font-mono flex items-center gap-2 border-b ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Modal Body */}
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Loading company configuration...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Section 1: Legal Identity */}
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-2.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                Legal Entity & Corporate Identity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Company Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Registration / Certificate No.</label>
                  <input
                    type="text"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Taxation & eTIMS Compliance */}
            <div className="pt-2 border-t border-[#222834]">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-2.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                KRA Fiscal & Tax Configuration
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">KRA PIN *</label>
                  <input
                    type="text"
                    required
                    value={formData.kra_pin}
                    onChange={(e) => setFormData({ ...formData, kra_pin: e.target.value.toUpperCase() })}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">VAT Rate (%) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      value={formData.vat_rate}
                      onChange={(e) => setFormData({ ...formData, vat_rate: e.target.value })}
                      className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 pl-7"
                    />
                    <Percent className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Operational Currency</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center bg-[#181d28] p-2.5 rounded border border-[#222834]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.etims_enabled}
                    onChange={(e) => setFormData({ ...formData, etims_enabled: e.target.checked })}
                    className="rounded bg-[#12161f] border-[#222834] text-emerald-500 focus:ring-0"
                  />
                  <span className="text-xs text-slate-200 font-medium">Enable Kenya KRA eTIMS Transmission</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">eTIMS Main Branch Code:</span>
                  <input
                    type="text"
                    value={formData.etims_branch_code}
                    onChange={(e) => setFormData({ ...formData, etims_branch_code: e.target.value })}
                    className="w-20 bg-[#12161f] border border-[#222834] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Official Contact & Address */}
            <div className="pt-2 border-t border-[#222834]">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-2.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                Headquarters Contact & Invoicing Address
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Official Telephone / Mobile *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Corporate Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Physical / Postal Address *</label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">City / Region *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Country</label>
                  <input
                    type="text"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Receipts & Invoicing Formatting */}
            <div className="pt-2 border-t border-[#222834]">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-2.5">
                <Receipt className="w-3.5 h-3.5 text-purple-400" />
                POS Receipt & Waybill Print Headers
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Receipt / Invoice Header Note</label>
                  <input
                    type="text"
                    value={formData.receipt_header}
                    onChange={(e) => setFormData({ ...formData, receipt_header: e.target.value })}
                    placeholder="e.g. Official Tax Invoice & Consignment Manifest"
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Receipt Footer Disclaimer / Terms</label>
                  <textarea
                    rows={2}
                    value={formData.receipt_footer}
                    onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                    placeholder="e.g. All consignments handled under standard carrier terms and conditions."
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-[#222834] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300 transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 shadow-sm shadow-amber-900/40 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'SAVING...' : 'SAVE SETTINGS'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
