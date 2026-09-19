// client/src/components/branches/BranchEditModal.jsx
import React from 'react';
import { Edit3, X, AlertTriangle, RotateCcw, Check } from 'lucide-react';

export function BranchEditModal({
  isOpen,
  hub,
  formData,
  setFormData,
  isSubmitting,
  error,
  isSuperAdmin,
  onClose,
  onSubmit,
}) {
  if (!isOpen || !hub) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28]">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
              EDIT HUB PROFILE // {hub.code}
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

          {/* Hub Code Read-only & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                Hub Code (Permanent)
              </label>
              <input
                type="text"
                readOnly
                value={hub.code}
                className="w-full bg-[#181d28]/60 border border-[#222834] rounded px-3 py-1.5 text-xs text-slate-400 uppercase font-mono cursor-not-allowed"
              />
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
                className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status Toggle (Super Admin Only) */}
          {isSuperAdmin && (
            <div className="p-3 bg-[#181d28] border border-[#222834] rounded flex items-center justify-between">
              <div>
                <span className="block font-mono text-xs font-bold text-white">
                  NODE OPERATIONAL STATUS
                </span>
                <span className="text-[10px] text-slate-400">
                  Inactive nodes cannot accept fresh POS orders or courier dispatches
                </span>
              </div>
              <select
                value={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: Number(e.target.value) })
                }
                className="bg-[#12161f] border border-[#222834] rounded px-3 py-1 text-xs font-mono text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value={1}>ACTIVE / ONLINE</option>
                <option value={0}>OFFLINE / SUSPENDED</option>
              </select>
            </div>
          )}

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
                  <span>SAVING...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>SAVE PROFILE</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
