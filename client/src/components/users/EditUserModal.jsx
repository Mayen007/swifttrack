import React from 'react';
import { Phone, X, RotateCcw, Edit3, AlertTriangle, Check } from 'lucide-react';
import { sound } from '../../services/sound.js';

export function EditUserModal({
  isOpen,
  onClose,
  user,
  editFormData,
  setEditFormData,
  editError,
  isSubmittingEdit,
  onSubmit,
}) {
  if (!isOpen || !user) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-md overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                  EDIT STAFF RECORD // #{user.id}
                </h3>
              </div>
              <button
                onClick={() => {
                  sound.playScan();
                  onClose();
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={onSubmit} className="p-4 space-y-4">
              {editError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Username & Role Read-only info */}
              <div className="bg-[#181d28] border border-[#222834] rounded p-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">USERNAME</span>
                  <span className="text-white font-bold">@{user.username}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">ROLE TIERS</span>
                  <span className="text-blue-400 font-bold">{user.role_name || user.role}</span>
                </div>
              </div>

              {/* Full Legal Name */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.full_name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, full_name: e.target.value })
                  }
                  className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Telephone Contact *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.phone}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, phone: e.target.value })
                  }
                  className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Password Reset (Optional) */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Reset Password (Leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  value={editFormData.password}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, password: e.target.value })
                  }
                  placeholder="Min 6 characters..."
                  className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Active / Suspended Account Status */}
              <div className="p-3 bg-[#181d28] border border-[#222834] rounded flex items-center justify-between">
                <div>
                  <span className="block font-mono text-xs font-bold text-white">
                    ACCOUNT ACCESS STATUS
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Suspended accounts are revoked from login & POS checkout
                  </span>
                </div>
                <select
                  value={editFormData.is_active}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, is_active: Number(e.target.value) })
                  }
                  className="bg-[#12161f] border border-[#222834] rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                >
                  <option value={1}>ACTIVE / AUTHORIZED</option>
                  <option value={0}>SUSPENDED / BLOCKED</option>
                </select>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[#222834] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.playScan();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm shadow-blue-950/50 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEdit ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>SAVING...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>SAVE CHANGES</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
  );
}
