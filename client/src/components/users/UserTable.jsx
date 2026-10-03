import React from 'react';
import {
  RotateCcw,
  Users,
  Shield,
  Building2,
  Mail,
  Phone,
  Lock,
  Unlock,
  History,
  KeyRound,
  LogOut,
  Eye,
  Edit3,
  ShieldCheck,
} from 'lucide-react';
import { getRoleBadgeStyle } from './constants.js';

export function UserTable({
  users,
  filteredUsers,
  loading,
  searchQuery,
  canEditUser,
  currentUser,
  adminActionLoading,
  onUnlockAccount,
  onOpenLoginHistory,
  onAdminResetPassword,
  onForceLogout,
  onOpenInspector,
  onOpenEdit,
  demoMode,
  onQuickSwitch,
}) {
  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden shadow-xl">
      {/* Mobile Card List View (< 768px) */}
      <div className="block md:hidden divide-y divide-[#222834]">
        {loading && users.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <RotateCcw className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
            <span>Synchronizing enterprise personnel roster...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Users className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <span className="block text-white font-bold text-sm">No Staff Records Match Filter</span>
            <span className="text-xs text-slate-500 mt-0.5 block">
              {searchQuery ? `No results for "${searchQuery}"` : 'No personnel provisioned under current criteria.'}
            </span>
          </div>
        ) : (
          filteredUsers.map((u) => {
            const roleName = u.role_name || u.role;
            const roleDisplay = u.role_display_name || roleName;
            const isActive = u.is_active !== 0;
            const canEdit = canEditUser(u);
            const isCurrentSessionUser = currentUser?.username === u.username;

            return (
              <div
                key={`mob-${u.id}`}
                className={`p-3.5 space-y-3 ${isCurrentSessionUser ? 'bg-blue-950/20' : ''}`}
              >
                {/* Header: User avatar, name, username, ID, and status badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded bg-[#181d28] border border-[#222834] text-white flex items-center justify-center font-bold text-xs shrink-0 text-slate-300">
                      {u.full_name
                        ? u.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                        : 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white font-sans text-sm flex items-center gap-1.5 truncate">
                        <span className="truncate">{u.full_name}</span>
                        {isCurrentSessionUser && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono font-bold shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 truncate">
                        <span>@{u.username}</span>
                        <span>•</span>
                        <span>ID: #{String(u.id).padStart(3, '0')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {u.is_locked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                        <Lock className="w-3 h-3 text-amber-400" />
                        LOCKED
                      </span>
                    ) : isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        SUSPENDED
                      </span>
                    )}
                  </div>
                </div>

                {/* Subheader: Role badge + Assigned Branch */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getRoleBadgeStyle(roleName)}`}>
                    <Shield className="w-3 h-3" />
                    {roleDisplay}
                  </span>

                  {u.branch_id ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono text-[10px]">
                      <span className="font-bold">{u.branch_code || 'HUB'}</span>
                      <span>—</span>
                      <span className="truncate max-w-[130px]">{u.branch_name}</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/60 font-mono text-[10px] italic">
                      <Building2 className="w-3 h-3" />
                      <span>HQ Global</span>
                    </div>
                  )}
                </div>

                {/* Contact & Last Activity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-[#0e1219] p-2.5 rounded border border-[#1e2433] text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 text-slate-300 truncate">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{u.phone || 'No phone'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 sm:col-span-2 pt-1 border-t border-[#1e2433] flex items-center justify-between">
                    <span>Last: {u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' }) : 'Active Session'}</span>
                    <span className="text-[9px] text-slate-500 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-amber-500/80" />
                      SCRYPT-64
                    </span>
                  </div>
                </div>

                {/* Mobile Action Buttons Bar */}
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  {Boolean(u.is_locked) && canEdit && (
                    <button
                      onClick={() => onUnlockAccount(u)}
                      disabled={adminActionLoading === u.id}
                      className="px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono flex items-center gap-1 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Unlock</span>
                    </button>
                  )}

                  <button
                    onClick={() => onOpenLoginHistory(u)}
                    title="Login History"
                    className="p-2 rounded bg-[#181d28] hover:bg-[#222938] text-blue-400 border border-[#222834] transition-colors cursor-pointer"
                  >
                    <History className="w-4 h-4" />
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => onAdminResetPassword(u)}
                      disabled={adminActionLoading === u.id}
                      title="Reset Password"
                      className="p-2 rounded bg-[#181d28] hover:bg-[#222938] text-amber-400 border border-[#222834] transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                  )}

                  {canEdit && (
                    <button
                      onClick={() => onForceLogout(u)}
                      disabled={adminActionLoading === u.id}
                      title="Force Logout"
                      className="p-2 rounded bg-[#181d28] hover:bg-[#222938] text-rose-400 border border-[#222834] transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => onOpenInspector(u)}
                    className="flex-1 py-1.5 px-3 rounded bg-[#181d28] hover:bg-[#222938] text-slate-200 hover:text-white border border-[#222834] text-xs font-mono font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>Dossier</span>
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => onOpenEdit(u)}
                      className="py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}

                  {demoMode && (
                    <button
                      onClick={() => onQuickSwitch(roleName, u.branch_id)}
                      title={`Instant switch to ${roleName}`}
                      className="p-2 rounded bg-[#181d28] hover:bg-[#222938] text-blue-400 border border-[#222834] cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop / Tablet Table View (>= 768px) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#181d28] text-slate-400 border-b border-[#222834] text-[10px] uppercase tracking-wider">
            <tr>
              <th className="p-3 font-semibold">Staff Identity & ID</th>
              <th className="p-3 font-semibold">Security Role</th>
              <th className="p-3 font-semibold">Assigned Branch Hub</th>
              <th className="p-3 font-semibold">Contact Channels</th>
              <th className="p-3 font-semibold">Last Activity & Encryption</th>
              <th className="p-3 font-semibold text-center">Status</th>
              <th className="p-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834]">
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  <RotateCcw className="w-5 h-5 text-blue-400 animate-spin mx-auto mb-2" />
                  <span>Synchronizing enterprise personnel roster...</span>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  <Users className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <span className="block text-white font-bold text-sm">No Staff Records Match Filter</span>
                  <span className="text-xs text-slate-500 mt-0.5 block">
                    {searchQuery ? `No results for "${searchQuery}"` : 'No personnel provisioned under current criteria.'}
                  </span>
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const roleName = u.role_name || u.role;
                const roleDisplay = u.role_display_name || roleName;
                const isActive = u.is_active !== 0;
                const canEdit = canEditUser(u);
                const isCurrentSessionUser = currentUser?.username === u.username;

                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-[#181d28]/60 transition-colors ${
                      isCurrentSessionUser ? 'bg-blue-950/20' : ''
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-[#181d28] border border-[#222834] text-white flex items-center justify-center font-bold text-[11px] shrink-0 text-slate-300">
                          {u.full_name
                            ? u.full_name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()
                            : 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-white font-sans text-xs flex items-center gap-1.5">
                            <span>{u.full_name}</span>
                            {isCurrentSessionUser && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <span>@{u.username}</span>
                            <span>•</span>
                            <span className="text-slate-400">ID: #{String(u.id).padStart(3, '0')}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-bold border ${getRoleBadgeStyle(
                          roleName
                        )}`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {roleDisplay}
                      </span>
                    </td>

                    <td className="p-3">
                      {u.branch_id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40 font-mono text-[10px] font-bold">
                            {u.branch_code || 'HUB'}
                          </span>
                          <span className="text-slate-300 text-xs font-sans">
                            {u.branch_name || `Branch #${u.branch_id}`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs font-sans italic text-slate-400">HQ Global (Mesh Admin)</span>
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="space-y-0.5 text-[11px]">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[170px]">{u.email}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{u.phone || '—'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 text-[11px]">
                      <div className="text-slate-300 font-mono">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString('en-KE', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : 'Active Session'}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Lock className="w-2.5 h-2.5 text-amber-500/80" />
                        <span>SCRYPT-64 SECURED</span>
                      </div>
                    </td>

                    <td className="p-3 text-center">
                      {u.is_locked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                          <Lock className="w-3 h-3 text-amber-400" />
                          LOCKED
                        </span>
                      ) : isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          SUSPENDED
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {Boolean(u.is_locked) && canEdit && (
                          <button
                            onClick={() => onUnlockAccount(u)}
                            disabled={adminActionLoading === u.id}
                            title="Unlock operator account and reset failed login attempts"
                            className="p-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onOpenLoginHistory(u)}
                          title="Audit operator login attempts and terminal history"
                          className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-blue-400" />
                        </button>

                        {canEdit && (
                          <button
                            onClick={() => onAdminResetPassword(u)}
                            disabled={adminActionLoading === u.id}
                            title="Admin password reset: issue temporary password with mandatory first-login change"
                            className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-amber-400 hover:text-amber-300 border border-[#222834] transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canEdit && (
                          <button
                            onClick={() => onForceLogout(u)}
                            disabled={adminActionLoading === u.id}
                            title="Force logout: terminate all active web sessions across all devices"
                            className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-rose-400 hover:text-rose-300 border border-[#222834] transition-colors cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onOpenInspector(u)}
                          title="Inspect staff account dossier, 2FA status, and RBAC permissions"
                          className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-400" />
                        </button>

                        {canEdit && (
                          <button
                            onClick={() => onOpenEdit(u)}
                            title="Edit user details, credentials, or toggle active status"
                            className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        )}

                        {demoMode && (
                          <button
                            onClick={() => onQuickSwitch(roleName, u.branch_id)}
                            title={`Instant switch demo persona to ${roleName} (${u.full_name})`}
                            className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer text-[10px] font-mono"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-[#141822] border-t border-[#222834] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-1.5 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>TENANT ISOLATION: OPERATORS RESTRICTED TO LOCAL STATION DOMAINS</span>
        </div>
        <div className="text-[10px] text-slate-400">
          SHOWING {filteredUsers.length} OF {users.length} REGISTERED OPERATORS
        </div>
      </div>
    </div>
  );
}
