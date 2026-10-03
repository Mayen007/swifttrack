import React, { useEffect } from 'react';
import { UserPlus, Phone, X, RotateCcw, Key, AlertTriangle, Check } from 'lucide-react';
import { sound } from '../../services/sound.js';

export function CreateUserModal({
  isOpen,
  onClose,
  createFormData,
  setCreateFormData,
  createError,
  isSubmittingCreate,
  creatableRoles,
  branches,
  isSuperAdmin,
  currentUser,
  onSubmit,
}) {
  // Allow dismissing modal with Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        sound.playScan();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sound.playScan();
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-modal-title"
    >
      <div
        className="bg-[#12161f] border border-[#222834] rounded-lg w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28] shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-400" />
            <h3 id="create-user-modal-title" className="font-bold text-sm text-white font-mono uppercase tracking-wider">
              PROVISION NEW STAFF ACCOUNT
            </h3>
          </div>
          <button
            onClick={() => {
              sound.playScan();
              onClose();
            }}
            aria-label="Close provision modal"
            title="Close"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#222834] border border-transparent hover:border-slate-700/60 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 space-y-4 overflow-y-auto flex-1 overscroll-contain">
            {createError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {/* Full Name & Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={createFormData.full_name}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, full_name: e.target.value })
                  }
                  placeholder="e.g. Kipchumba Koech"
                  className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Username (System Handle) *
                </label>
                <input
                  type="text"
                  required
                  value={createFormData.username}
                  onChange={(e) =>
                    setCreateFormData({
                      ...createFormData,
                      username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''),
                    })
                  }
                  placeholder="e.g. kkoech"
                  className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Official Email *
                </label>
                <input
                  type="email"
                  required
                  value={createFormData.email}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, email: e.target.value })
                  }
                  placeholder="koech@swifttrack.co.ke"
                  className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Mobile Phone Hotline *
                </label>
                <input
                  type="text"
                  required
                  value={createFormData.phone}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, phone: e.target.value })
                  }
                  placeholder="+254 712 345 678"
                  className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Role Selection & Branch Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Assigned Security Role *
                </label>
                <select
                  value={createFormData.role_id}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, role_id: e.target.value })
                  }
                  className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                >
                  {creatableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.display_name} ({r.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Regional Station Hub *
                </label>
                {isSuperAdmin ? (
                  <select
                    value={createFormData.branch_id}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, branch_id: e.target.value })
                    }
                    className="w-full bg-[#181d28] border border-[#222834] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    readOnly
                    value={`${currentUser?.branch_name || 'Assigned Branch'} (Local Tenant)`}
                    className="w-full bg-[#181d28]/60 border border-[#222834] rounded px-3 py-1.5 text-xs text-slate-400 font-mono cursor-not-allowed"
                  />
                )}
              </div>
            </div>

            {/* Driver-specific license field */}
            {creatableRoles.find((r) => String(r.id) === String(createFormData.role_id))?.name ===
              'DRIVER' && (
              <div className="p-2.5 rounded bg-cyan-950/30 border border-cyan-800/40 space-y-1 font-mono">
                <label className="block text-[10px] uppercase text-cyan-300">
                  NTSA Driving License Number
                </label>
                <input
                  type="text"
                  value={createFormData.license_number}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, license_number: e.target.value })
                  }
                  placeholder={`DL-${createFormData.username.toUpperCase() || 'DRIVER'}-01`}
                  className="w-full bg-[#12161f] border border-[#222834] rounded px-3 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[9px] text-cyan-400/80 block">
                  Automatically initializes driver roster profile and mobile dispatch capability
                </span>
              </div>
            )}

            {/* Password Initial Credential */}
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                Initial Account Password *
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={createFormData.password}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, password: e.target.value })
                  }
                  className="w-full bg-[#181d28] border border-[#222834] rounded pl-9 pr-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <span className="text-[9px] text-slate-400 mt-1 block font-mono">
                Encrypted using Scrypt-64 key derivation function with company-wide cryptographic salt
              </span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="p-3 border-t border-[#222834] bg-[#181d28] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                sound.playScan();
                onClose();
              }}
              className="px-3 py-1.5 rounded border border-[#222834] bg-[#12161f] hover:bg-[#202736] text-xs font-mono text-slate-300 cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmittingCreate}
              className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm shadow-blue-950/50 cursor-pointer disabled:opacity-50"
            >
              {isSubmittingCreate ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>PROVISIONING...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>PROVISION ACCOUNT</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
