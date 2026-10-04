import React, { useEffect } from 'react';
import { Shield, X, Lock, Unlock, KeyRound, Eye, LogOut, History, Smartphone } from 'lucide-react';
import { sound } from '../../services/sound.js';
import { getRoleBadgeStyle } from './constants.js';

export function StaffInspectorDrawer({
  isOpen,
  onClose,
  user,
  canEdit,
  adminActionLoading,
  onUnlockAccount,
  onAdminResetPassword,
  onForceLogout,
  onOpenLoginHistory,
}) {
  // Allow dismissing with the Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-dossier-title"
    >
      <div
        className="bg-[#12161f] border border-[#222834] rounded-lg w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with clean X close button */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 id="staff-dossier-title" className="font-bold text-sm text-white font-mono uppercase tracking-wider truncate">
                STAFF PROFILE: {user.username.toUpperCase()}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Operator Security Profile & Credentials
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose()}
            aria-label="Close dossier"
            title="Close"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#222834] border border-transparent hover:border-slate-700/60 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 text-xs font-mono overflow-y-auto flex-1 overscroll-contain">
          {/* Profile Card */}
          <div className="bg-[#181d28] border border-[#222834] rounded p-3 flex items-start gap-3">
            <div className="w-12 h-12 rounded bg-[#12161f] border border-[#222834] text-white flex items-center justify-center font-bold text-sm text-blue-400 shrink-0">
              {user.full_name
                ? user.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                : 'U'}
            </div>
            <div className="space-y-1 min-w-0">
              <h4 className="font-bold text-white font-sans text-sm">{user.full_name}</h4>
              <div className="text-slate-400 text-[11px]">@{user.username}</div>
              <div className="flex items-center gap-2 pt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeStyle(
                    user.role_name || user.role
                  )}`}
                >
                  <Shield className="w-3 h-3" />
                  {user.role_display_name || user.role_name || user.role}
                </span>
                {user.is_active !== 0 ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ACTIVE
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    SUSPENDED
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Station Context */}
          <div className="bg-[#181d28] border border-[#222834] rounded p-3 space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">ASSIGNED STATION:</span>
              <span className="font-bold text-white">
                {user.branch_name || 'HQ Global Operations'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">BRANCH CODE:</span>
              <span className="text-blue-400 font-bold">{user.branch_code || 'GLOBAL'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">OFFICIAL EMAIL:</span>
              <span className="text-slate-200">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">HOTLINE PHONE:</span>
              <span className="text-emerald-300">{user.phone || '—'}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[#222834]">
              <span className="text-slate-400">ENROLLED ON:</span>
              <span className="text-slate-300">
                {user.created_at
                  ? new Date(user.created_at).toLocaleString('en-KE', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'Initial Seed'}
              </span>
            </div>
          </div>

          {/* Authentication & Security Dossier */}
          <div className="bg-[#181d28] border border-[#222834] rounded p-3 space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">2FA TOTP PROTECTION:</span>
              {user.two_factor_enabled ? (
                <span className="text-blue-400 font-bold flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                  RFC 6238 TOTP ACTIVE
                </span>
              ) : (
                <span className="text-slate-500 font-mono">NOT CONFIGURED</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">PASSWORD ROTATION:</span>
              <span className="text-slate-300">
                {user.password_changed_at
                  ? new Date(user.password_changed_at).toLocaleString('en-KE', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'Initial Password'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">FIRST-LOGIN CHANGE:</span>
              {user.must_change_password ? (
                <span className="text-amber-400 font-bold font-mono">
                  MANDATORY (PENDING FIRST LOGIN)
                </span>
              ) : (
                <span className="text-emerald-400 font-mono">COMPLETED / VERIFIED</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">FAILED ATTEMPTS:</span>
              <span className="font-mono font-bold text-slate-300">
                {user.failed_login_attempts || 0} / 5
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">LOCKOUT STATUS:</span>
              {user.is_locked ? (
                <span className="text-rose-400 font-bold font-mono animate-pulse flex items-center gap-1">
                  <Lock className="w-3 h-3 text-rose-400" />
                  LOCKED (UNTIL {user.locked_until})
                </span>
              ) : (
                <span className="text-emerald-400 font-mono">CLEARED / AUTHORIZED</span>
              )}
            </div>
          </div>

          {/* Quick Security Actions for this operator */}
          {canEdit && (
            <div className="p-2.5 rounded bg-[#181d28] border border-[#222834] space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                ADMINISTRATIVE SECURITY ACTIONS
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Boolean(user.is_locked) && (
                  <button
                    onClick={() => onUnlockAccount(user)}
                    disabled={adminActionLoading === user.id}
                    className="px-2 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unlock Account</span>
                  </button>
                )}
                <button
                  onClick={() => onOpenLoginHistory(user)}
                  disabled={adminActionLoading === user.id}
                  className="px-2 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] text-blue-400 border border-[#222834] font-mono flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Login History</span>
                </button>
                <button
                  onClick={() => onAdminResetPassword(user)}
                  disabled={adminActionLoading === user.id}
                  className="px-2 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] text-amber-400 border border-[#222834] font-mono flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Reset Password</span>
                </button>
                <button
                  onClick={() => onForceLogout(user)}
                  disabled={adminActionLoading === user.id}
                  className="px-2 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] text-rose-400 border border-[#222834] font-mono flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Force Logout</span>
                </button>
              </div>
            </div>
          )}

          {/* Cryptographic Hash Security Notice */}
          <div className="p-2.5 rounded bg-[#181d28] border border-[#222834] flex items-start gap-2 text-[11px] text-slate-400">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-white font-bold block">CRYPTOGRAPHIC PRIVILEGE BOUNDARY:</span>
              All actions executed under @{user.username} are cryptographically attributed with SHA-256 state signatures in the immutable audit ledger.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
