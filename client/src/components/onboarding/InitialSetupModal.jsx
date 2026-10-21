// client/src/components/onboarding/InitialSetupModal.jsx
// Enterprise Initial Organization Setup & Onboarding Wizard for Super Admin
import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Compass,
  X
} from 'lucide-react';

export function InitialSetupModal({ isOpen, onClose, onComplete, onStartTour }) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const [step, setStep] = useState(1); // 1 = Organization Details, 2 = First Branch, 3 = Complete
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [orgData, setOrgData] = useState({
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
    etims_enabled: true,
    etims_branch_code: '00',
  });

  const [branchData, setBranchData] = useState({
    code: 'NRB-HQ',
    name: 'Nairobi Central Distribution Hub',
    city: 'Nairobi',
    address: 'Enterprise Road, Industrial Area',
    phone: '+254 711 000 001',
    email: 'hub.nairobi@swifttrack.co.ke',
  });

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadCurrentSettings() {
      try {
        setLoading(true);
        const res = await api.get('/api/v1/company');
        if (isMounted && res) {
          setOrgData({
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
            etims_enabled: Boolean(res.etims_enabled),
            etims_branch_code: res.etims_branch_code || '00',
          });
        }
      } catch (err) {
        console.warn('Could not load company settings for wizard:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCurrentSettings();
    return () => { isMounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveOrganization = async (e) => {
    e.preventDefault();
    if (!orgData.company_name?.trim() || !orgData.kra_pin?.trim()) {
      setErrorMsg('Organization name and KRA PIN are required.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      await api.put('/api/v1/company', {
        ...orgData,
        vat_rate: parseFloat(orgData.vat_rate) || 16.0,
      });

      sound.playSuccess();
      setStep(2);
    } catch (err) {
      sound.playAlert();
      setErrorMsg(err.message || 'Failed to save organization settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFirstBranch = async (e) => {
    e.preventDefault();
    if (!branchData.code?.trim() || !branchData.name?.trim()) {
      setErrorMsg('Branch code and name are required.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      await api.post('/api/branches', branchData);
      sound.playSuccess();
      setStep(3);
    } catch (err) {
      sound.playAlert();
      setErrorMsg(err.message || 'Failed to create branch.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinishAndStartTour = () => {
    try {
      localStorage.setItem('swifttrack_initial_setup_completed_v1', 'true');
    } catch {}
    onComplete?.();
    onStartTour?.();
  };

  const handleSkipBranch = () => setStep(3);

  // Theme-aware class helpers
  const modal = isLight
    ? 'bg-white border-slate-200 shadow-[0_25px_70px_rgba(0,0,0,0.18)]'
    : 'bg-[#10141d] border-[#232c3d] shadow-[0_25px_70px_rgba(0,0,0,0.8)]';

  const header = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131924] border-[#1f2736]';
  const headerTitle = isLight ? 'text-slate-900' : 'text-white';
  const closeBtn = isLight
    ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
    : 'text-slate-400 hover:text-white hover:bg-[#1c2333]';

  const progressBar = isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0e131d] border-[#1c2332]';
  const progressDivider = isLight ? 'bg-slate-300' : 'bg-[#222b3b]';
  const stepInactive = isLight ? 'text-slate-400' : 'text-slate-500';
  const stepCircleInactive = isLight
    ? 'border-slate-300 bg-slate-100 text-slate-400'
    : 'border-slate-600 bg-slate-800 text-slate-500';

  const body = isLight ? 'bg-white' : '';
  const bodyText = isLight ? 'text-slate-700' : 'text-slate-300';
  const label = isLight ? 'text-slate-600' : 'text-slate-300';

  const input = isLight
    ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
    : 'bg-[#151a24] border-[#232c3d] text-white placeholder:text-slate-600 focus:border-amber-400';

  const inputBlue = isLight
    ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30'
    : 'bg-[#151a24] border-[#232c3d] text-white placeholder:text-slate-600 focus:border-blue-400';

  const divider = isLight ? 'border-slate-200' : 'border-[#1f2736]';
  const footerHint = isLight ? 'text-slate-400' : 'text-slate-500';

  const backBtn = isLight
    ? 'text-slate-500 hover:text-slate-900'
    : 'text-slate-400 hover:text-white';
  const skipBtn = isLight
    ? 'text-slate-500 hover:text-slate-800'
    : 'text-slate-400 hover:text-slate-200';

  const summaryCard = isLight
    ? 'bg-slate-50 border-slate-200'
    : 'bg-[#141b27] border-[#20293b]';
  const summaryLabel = isLight ? 'text-slate-500' : 'text-slate-400';
  const summaryValue = isLight ? 'text-slate-900' : 'text-white';

  const workspacBtn = isLight
    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900'
    : 'bg-[#181f2c] hover:bg-[#222b3d] text-slate-300 hover:text-white';

  const stepActive = (current) => current === step;
  const stepDone = (current) => step > current;

  const stepClass = (n) => {
    if (stepDone(n)) return 'text-emerald-500';
    if (stepActive(n)) return isLight ? 'text-amber-600 font-bold' : 'text-amber-400 font-bold';
    return stepInactive;
  };

  const stepCircleClass = (n) => {
    if (stepDone(n)) return 'border-emerald-500 bg-emerald-500/10 text-emerald-500';
    if (stepActive(n)) return isLight
      ? 'border-amber-500 bg-amber-500/10 text-amber-600'
      : 'border-amber-400 bg-amber-400/20 text-amber-400';
    return stepCircleInactive;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`${modal} border rounded-2xl max-w-2xl w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200`}>
        {/* Gradient ribbon */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-500" />

        {/* Header */}
        <div className={`px-6 py-5 border-b ${header} flex items-center justify-between`}>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-amber-500 uppercase">
                  ENTERPRISE ONBOARDING
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30">
                  STEP {step} OF 3
                </span>
              </div>
              <h2 className={`text-base sm:text-lg font-bold tracking-tight ${headerTitle}`}>
                {step === 1 && 'Configure Organization Profile & Tax Details'}
                {step === 2 && 'Provision Primary Operating Hub'}
                {step === 3 && 'Organization Ready for Operation'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close setup modal"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${closeBtn}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step progress tracker */}
        <div className={`px-6 py-2.5 border-b ${progressBar} flex items-center justify-between text-xs font-mono`}>
          <div className={`flex items-center gap-2 ${stepClass(1)}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${stepCircleClass(1)}`}>
              {stepDone(1) ? '✓' : '1'}
            </span>
            <span>1. Organization Details</span>
          </div>

          <div className={`h-px w-8 ${progressDivider}`} />

          <div className={`flex items-center gap-2 ${stepClass(2)}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${stepCircleClass(2)}`}>
              {stepDone(2) ? '✓' : '2'}
            </span>
            <span>2. Primary Hub</span>
          </div>

          <div className={`h-px w-8 ${progressDivider}`} />

          <div className={`flex items-center gap-2 ${stepClass(3)}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${stepCircleClass(3)}`}>
              3
            </span>
            <span>3. System Tour</span>
          </div>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-500/10 border-b border-rose-500/30 text-rose-500 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className={`text-xs font-mono ${footerHint}`}>Loading setup state...</p>
          </div>
        ) : (
          <div className={`p-6 ${body}`}>
            {/* STEP 1: Organization Details */}
            {step === 1 && (
              <form onSubmit={handleSaveOrganization} className="space-y-4">
                <p className={`text-xs leading-relaxed ${bodyText}`}>
                  Establish your organization's legal identity, official contacts, and KRA eTIMS tax configuration. These settings govern invoice generation, receipt headers, and parcel waybills.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Company / Organization Legal Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SwiftTrack Kenya Logistics Ltd"
                      value={orgData.company_name}
                      onChange={(e) => setOrgData({ ...orgData, company_name: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors ${input}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>KRA PIN / Tax ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. P051234567Z"
                      value={orgData.kra_pin}
                      onChange={(e) => setOrgData({ ...orgData, kra_pin: e.target.value.toUpperCase() })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none transition-colors ${input}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Registration / Certificate No.</label>
                    <input
                      type="text"
                      placeholder="e.g. CPR/2026/88921"
                      value={orgData.registration_number}
                      onChange={(e) => setOrgData({ ...orgData, registration_number: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none transition-colors ${input}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Official Contact Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. info@swifttrack.co.ke"
                      value={orgData.email}
                      onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors ${input}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Official Contact Phone *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. +254 700 123 456"
                      value={orgData.phone}
                      onChange={(e) => setOrgData({ ...orgData, phone: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none transition-colors ${input}`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Headquarters Physical Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Enterprise Road, Industrial Area, Plot 42"
                      value={orgData.address}
                      onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors ${input}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>City</label>
                    <input
                      type="text"
                      value={orgData.city}
                      onChange={(e) => setOrgData({ ...orgData, city: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors ${input}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Operating Currency</label>
                    <input
                      type="text"
                      value={orgData.currency}
                      onChange={(e) => setOrgData({ ...orgData, currency: e.target.value.toUpperCase() })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none transition-colors ${input}`}
                    />
                  </div>
                </div>

                <div className={`pt-4 flex items-center justify-between border-t ${divider}`}>
                  <span className={`text-[11px] font-mono ${footerHint}`}>* Required enterprise fields</span>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <span>{saving ? 'Saving...' : 'Save & Continue'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: First Hub */}
            {step === 2 && (
              <form onSubmit={handleCreateFirstBranch} className="space-y-4">
                <p className={`text-xs leading-relaxed ${bodyText}`}>
                  Every parcel, manifest, and POS register belongs to an operating hub. Set up your central headquarters hub now to start processing waybills and dispatches.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Hub Identifier Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. NRB-HQ"
                      value={branchData.code}
                      onChange={(e) => setBranchData({ ...branchData, code: e.target.value.toUpperCase() })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none transition-colors ${inputBlue}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Hub City *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nairobi"
                      value={branchData.city}
                      onChange={(e) => setBranchData({ ...branchData, city: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors ${inputBlue}`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Hub Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nairobi Central Distribution Hub"
                      value={branchData.name}
                      onChange={(e) => setBranchData({ ...branchData, name: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors ${inputBlue}`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Hub Street Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Enterprise Road, Industrial Area"
                      value={branchData.address}
                      onChange={(e) => setBranchData({ ...branchData, address: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors ${inputBlue}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Hub Phone</label>
                    <input
                      type="text"
                      value={branchData.phone}
                      onChange={(e) => setBranchData({ ...branchData, phone: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none transition-colors ${inputBlue}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-mono mb-1 ${label}`}>Hub Email</label>
                    <input
                      type="email"
                      value={branchData.email}
                      onChange={(e) => setBranchData({ ...branchData, email: e.target.value })}
                      className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors ${inputBlue}`}
                    />
                  </div>
                </div>

                <div className={`pt-4 flex items-center justify-between border-t ${divider}`}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={`px-3 py-2 rounded-lg text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors ${backBtn}`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Org Details</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSkipBranch}
                      className={`px-3 py-2 rounded-lg text-xs font-mono cursor-pointer transition-colors ${skipBtn}`}
                    >
                      I'll create hubs later
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <span>{saving ? 'Creating Hub...' : 'Create Hub & Next'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 3: Complete */}
            {step === 3 && (
              <div className="py-6 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className={`text-lg font-bold tracking-tight ${headerTitle}`}>
                    Organization Setup Complete
                  </h3>
                  <p className={`text-xs leading-relaxed ${bodyText}`}>
                    Your organization identity and initial configuration are verified. Let's take a quick guided tour of SwiftTrack so you can see where everything lives.
                  </p>
                </div>

                <div className={`p-4 rounded-xl border text-left max-w-md mx-auto space-y-2 ${summaryCard}`}>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className={summaryLabel}>Organization:</span>
                    <span className={`font-bold ${summaryValue}`}>{orgData.company_name || 'Configured'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className={summaryLabel}>KRA PIN:</span>
                    <span className="text-emerald-500 font-bold">{orgData.kra_pin}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className={summaryLabel}>Currency / VAT:</span>
                    <span className="text-amber-500 font-bold">{orgData.currency} @ {orgData.vat_rate}%</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleFinishAndStartTour}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold font-mono flex items-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Start System Tour</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem('swifttrack_initial_setup_completed_v1', 'true');
                      } catch {}
                      onComplete?.();
                      onClose();
                    }}
                    className={`px-4 py-3 rounded-xl text-xs font-mono cursor-pointer transition-colors ${workspacBtn}`}
                  >
                    Go directly to Workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
