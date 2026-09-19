// client/src/components/branches/BranchCreateModal.jsx
import React from 'react';
import { Building2, X, AlertTriangle, Server, RotateCcw, Check } from 'lucide-react';

export function BranchCreateModal({
  isOpen,
  formData,
  setFormData,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28]">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
              PROVISION NEW REGIONAL LOGISTICS HUB
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={onSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Informational callout */}
          <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2">
            <Server className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold font-mono">AUTOMATIC PROVISIONING:</span> Provisioning a new hub will instantly register its default storage depot <span className="font-mono text-white">W-[CODE]-01</span> and initialize branch tenant isolation for inventory, POS, and staff.
            </div>
          </div>

          {/* Code and Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                Hub Code (3-4 chars) *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                  })
                }
                placeholder="e.g. KSM"
                className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white uppercase font-mono focus:outline-none focus:border-blue-500"
              />
              <span className="text-[9px] text-slate-400 mt-0.5 block font-mono">
                Used as SKU & depot prefix
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                Hub Facility Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. Kisumu Western Distribution Hub"
                className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* City and Address */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                City / County *
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="e.g. Kisumu"
                className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                Physical Facility Address *
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="e.g. Kenyatta Highway, Mega City Zone 3, Gate B"
                className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Phone and Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                Dispatch Hotline *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+254 57 202 1234"
                className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                Official Hub Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="hub.ksm@swifttrack.co.ke"
                className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-[#222834] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300 cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm shadow-blue-950/50 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>PROVISIONING...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>CONFIRM & PROVISION</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
