import React from 'react';
import {
  ShieldCheck,
  Users,
  Layers,
  AlertTriangle,
  RotateCcw,
  UserPlus,
  Shield,
  Building2,
  Lock,
} from 'lucide-react';

export function UserTelemetryCards({
  onOpenMatrix,
  onOpenFailedLogins,
  onManualRefresh,
  loading,
  isSuperAdmin,
  isBranchManager,
  onOpenCreate,
  kpis,
  availableRoles,
  branches,
}) {
  return (
    <>
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-bold tracking-wider uppercase">
              <ShieldCheck className="w-3 h-3" />
              ENTERPRISE RBAC ARCHITECTURE
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              BRANCH ISOLATION STRICT
            </span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 mt-1">
            <Users className="w-5 h-5 text-blue-400" />
            Personnel & Role-Based Access Control Directory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage enterprise team accounts, branch station assignments, cryptographic credentials, and security privilege scopes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={onOpenMatrix}
            title="Inspect comprehensive RBAC capability privileges"
            className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span><span className="hidden sm:inline">RBAC </span>MATRIX</span>
          </button>

          <button
            onClick={onOpenFailedLogins}
            title="Inspect failed login attempts and lockout security events"
            className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span><span className="hidden sm:inline">FAILED LOGINS </span>AUDIT</span>
          </button>

          <button
            onClick={onManualRefresh}
            disabled={loading}
            title="Re-synchronize personnel roster"
            className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 shrink-0 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span><span className="hidden sm:inline">SYNC </span>ROSTER</span>
          </button>

          {(isSuperAdmin || isBranchManager) && (
            <button
              onClick={onOpenCreate}
              className="w-full sm:w-auto px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-blue-900/40 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>PROVISION<span className="hidden sm:inline"> STAFF</span></span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
              ACTIVE PERSONNEL
            </span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
              {kpis.activeStaff}
            </span>
            <span className="font-mono text-xs text-slate-400">/ {kpis.totalStaff} ENROLLED</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {kpis.activeRate}% INTEGRITY
            </span>
            <span className="text-slate-500">{kpis.suspendedStaff} SUSPENDED</span>
          </div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
              RBAC TIERS
            </span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
              {availableRoles.length || 5}
            </span>
            <span className="font-mono text-xs text-slate-400">PRIVILEGE PROFILES</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">31 CAPABILITIES</span>
            <span className="text-emerald-400 font-bold">STRICT ACCESS</span>
          </div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
              PROVINCIAL STATIONS
            </span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
              {branches.length}
            </span>
            <span className="font-mono text-xs text-slate-400">REGIONAL NODES</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">TENANT CONTEXT</span>
            <span className="text-emerald-400 font-mono">ISOLATED</span>
          </div>
        </div>

        <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
              CREDENTIAL ENCRYPTION
            </span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
              SCRYPT-64
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">KEY DERIVATION</span>
            <span className="text-amber-400 font-mono">SALTED HASH</span>
          </div>
        </div>
      </div>
    </>
  );
}
