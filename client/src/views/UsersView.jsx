// client/src/views/UsersView.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Users,
  UserPlus,
  Building2,
  Shield,
  ShieldCheck,
  Phone,
  Mail,
  X,
  CheckCircle2,
  RotateCcw,
  Search,
  Lock,
  Key,
  Edit3,
  AlertTriangle,
  Check,
  ExternalLink,
  Activity,
  Eye,
  Truck,
  FileText,
  Layers,
  ArrowRight,
  UserCheck,
  UserX,
} from 'lucide-react';

// Static comprehensive RBAC permission matrix for SwiftTrack Kenya
const RBAC_CAPABILITY_MATRIX = [
  {
    category: 'System & Architecture',
    capabilities: [
      { name: 'Company Settings & Tax Configuration', code: 'company:settings', roles: ['SUPER_ADMIN'] },
      { name: 'Provision Regional Hubs & Warehouses', code: 'branches:create', roles: ['SUPER_ADMIN'] },
      { name: 'View All Provincial Branch Hubs', code: 'branches:view:all', roles: ['SUPER_ADMIN'] },
      { name: 'Manage Assigned Branch Operations', code: 'branches:manage:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    category: 'Personnel & Security',
    capabilities: [
      { name: 'Enterprise Staff Provisioning (Global)', code: 'users:create:all', roles: ['SUPER_ADMIN'] },
      { name: 'Branch Station Staff Provisioning', code: 'users:create:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'Role-Based Access Control Audit', code: 'audit:view:all', roles: ['SUPER_ADMIN'] },
      { name: 'Branch Scoped Audit Trail Log', code: 'audit:view:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    category: 'Inventory & Depots',
    capabilities: [
      { name: 'Master Product Catalog Management', code: 'products:manage', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'Multi-Depot Stock Matrix (All Hubs)', code: 'inventory:view:all', roles: ['SUPER_ADMIN'] },
      { name: 'Station Stock Valuation & Ledger', code: 'inventory:view:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER'] },
      { name: 'Stock Adjustment Request', code: 'inventory:adjust:request', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER'] },
      { name: 'Stock Adjustment Approval & Write-Off', code: 'inventory:adjust:approve', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'Inter-Branch Transfer Authorization', code: 'inventory:transfer:approve', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    category: 'Retail POS & Sales',
    capabilities: [
      { name: 'POS Terminal Cashier Checkout', code: 'pos:sale:create', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'] },
      { name: 'Daraja M-Pesa STK Push / Card / Cash Processing', code: 'pos:payment:process', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'] },
      { name: 'Customer Return & Refund Request', code: 'refund:request', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'] },
      { name: 'Dual-Control Refund Approval & Restock', code: 'refund:approve', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'Managerial Discount Override (>10%)', code: 'discount:approve', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    category: 'Logistics & Fleet Dispatch',
    capabilities: [
      { name: 'Create Delivery Order & Manifest', code: 'delivery:create', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'] },
      { name: 'Assign Couriers & Fleet Vehicles', code: 'delivery:assign', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'] },
      { name: 'Update Any Branch Delivery Status', code: 'delivery:update:all', roles: ['SUPER_ADMIN', 'DISPATCHER'] },
      { name: 'Handheld Mobile Console Navigation', code: 'delivery:update:own', roles: ['SUPER_ADMIN', 'DRIVER'] },
      { name: 'Capture HTML5 Signature & SMS OTP POD', code: 'delivery:pod:submit', roles: ['SUPER_ADMIN', 'DRIVER'] },
    ],
  },
  {
    category: 'Financials & Fiscal Governance',
    capabilities: [
      { name: 'Consolidated Financials & P&L Statement', code: 'reports:financial:all', roles: ['SUPER_ADMIN'] },
      { name: 'Branch Financial & Daily Sales Reports', code: 'reports:financial:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'KRA 16% Output VAT Compliance Filing Schedule', code: 'reports:vat:view', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { name: 'Cashier Shift Float Reconciliation', code: 'reports:shift:own', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'] },
      { name: 'Branch Petty Cash Overhead Submission', code: 'expenses:create', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER', 'DRIVER'] },
      { name: 'Operating Expense Voucher Authorization', code: 'expenses:approve', roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
];

export function UsersView() {
  const { user, branches, isSuperAdmin, isBranchManager, quickSwitch } = useAuth();

  // State
  const [users, setUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'ACTIVE', 'SUSPENDED'

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMatrixDrawerOpen, setIsMatrixDrawerOpen] = useState(false);
  const [inspectingUser, setInspectingUser] = useState(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);

  // Form States - Create User
  const [createFormData, setCreateFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    role_id: '4', // default CASHIER
    branch_id: '1',
    password: 'Password123!',
    license_number: '',
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState('');

  // Form States - Edit User
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    phone: '',
    password: '',
    is_active: 1,
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Fetch users & roles
  const fetchUsersAndRoles = useCallback(async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([
        api.get('/api/users'),
        api.get('/api/users/roles').catch(() => []),
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setAvailableRoles(Array.isArray(rolesData) ? rolesData : []);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load personnel roster:', e);
      api.toast('Failed to load personnel roster: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsersAndRoles();
  }, [fetchUsersAndRoles]);

  // Handle Manual Refresh
  const handleManualRefresh = async () => {
    sound.playScan();
    await fetchUsersAndRoles();
    api.toast('Personnel directory re-synchronized', 'success');
  };

  // Open Create Modal
  const openCreateModal = () => {
    sound.playScan();
    setCreateError('');
    // Default branch: if Branch Manager, lock to their branch; if Super Admin, default branch 1
    const defBranch = isBranchManager ? String(user?.branch_id || 1) : '1';
    // Default role: if Branch Manager, default Cashier (id 4); if Super Admin, Cashier (id 4)
    const cashierRole = availableRoles.find((r) => r.name === 'CASHIER');
    setCreateFormData({
      full_name: '',
      username: '',
      email: '',
      phone: '+254 7',
      role_id: cashierRole ? String(cashierRole.id) : '4',
      branch_id: defBranch,
      password: 'Password123!',
      license_number: '',
    });
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (staff) => {
    sound.playScan();
    setSelectedUserForEdit(staff);
    setEditFormData({
      full_name: staff.full_name || '',
      phone: staff.phone || '',
      password: '',
      is_active: staff.is_active !== undefined ? staff.is_active : 1,
    });
    setEditError('');
    setIsEditModalOpen(true);
  };

  // Open User Inspector
  const openInspector = (staff) => {
    sound.playScan();
    setInspectingUser(staff);
  };

  // Submit Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (
      !createFormData.full_name.trim() ||
      !createFormData.username.trim() ||
      !createFormData.email.trim() ||
      !createFormData.password.trim() ||
      !createFormData.role_id
    ) {
      sound.playError();
      setCreateError('Full name, username, email, password, and security role are required.');
      return;
    }

    try {
      setIsSubmittingCreate(true);
      const selectedRoleObj = availableRoles.find((r) => String(r.id) === String(createFormData.role_id));
      const isDriverRole = selectedRoleObj?.name === 'DRIVER';

      const payload = {
        full_name: createFormData.full_name.trim(),
        username: createFormData.username.toLowerCase().trim(),
        email: createFormData.email.toLowerCase().trim(),
        phone: createFormData.phone.trim() || '+254 700 000 000',
        password: createFormData.password,
        role_id: Number(createFormData.role_id),
        branch_id: selectedRoleObj?.name === 'SUPER_ADMIN' ? null : Number(createFormData.branch_id),
        license_number: isDriverRole ? (createFormData.license_number.trim() || `DL-${createFormData.username.toUpperCase()}-01`) : undefined,
      };

      await api.post('/api/users', payload);
      sound.playSuccess();
      api.toast(`Account for ${payload.full_name} (${payload.username}) provisioned successfully`, 'success');

      setIsCreateModalOpen(false);
      await fetchUsersAndRoles();
    } catch (err) {
      console.error('Failed to create staff member:', err);
      sound.playError();
      setCreateError(err.message || 'Failed to provision staff member');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Submit Edit User
  const handleEditUser = async (e) => {
    e.preventDefault();
    setEditError('');

    if (!selectedUserForEdit) return;

    if (!editFormData.full_name.trim()) {
      sound.playError();
      setEditError('Full name cannot be blank.');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      const payload = {
        full_name: editFormData.full_name.trim(),
        phone: editFormData.phone.trim(),
        is_active: Number(editFormData.is_active),
      };
      if (editFormData.password && editFormData.password.trim().length >= 6) {
        payload.password = editFormData.password.trim();
      }

      await api.put(`/api/users/${selectedUserForEdit.id}`, payload);
      sound.playSuccess();
      api.toast(`User #${selectedUserForEdit.id} profile updated successfully`, 'success');

      setIsEditModalOpen(false);
      setSelectedUserForEdit(null);
      await fetchUsersAndRoles();
    } catch (err) {
      console.error('Failed to update user:', err);
      sound.playError();
      setEditError(err.message || 'Failed to update user record');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Check if current user can edit a given staff member
  const canEditUser = (staff) => {
    if (isSuperAdmin) return true;
    if (isBranchManager) {
      if (staff.branch_id !== user?.branch_id) return false;
      const role = staff.role_name || staff.role;
      if (['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(role)) return false;
      return true;
    }
    return false;
  };

  // Quick switch role handler
  const handleQuickSwitch = async (roleName, branchId) => {
    sound.playScan();
    try {
      await quickSwitch(roleName, branchId);
    } catch (e) {
      console.error(e);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const totalStaff = users.length;
    const activeStaff = users.filter((u) => u.is_active !== 0).length;
    const roleCounts = users.reduce((acc, u) => {
      const r = u.role_name || u.role || 'UNKNOWN';
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    const branchesRepresented = new Set(users.map((u) => u.branch_id).filter(Boolean)).size;

    return {
      totalStaff,
      activeStaff,
      suspendedStaff: totalStaff - activeStaff,
      activeRate: totalStaff > 0 ? Math.round((activeStaff / totalStaff) * 100) : 100,
      roleCounts,
      branchesRepresented,
    };
  }, [users]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && u.is_active === 0) return false;
      if (statusFilter === 'SUSPENDED' && u.is_active !== 0) return false;

      // Role filter
      const userRole = u.role_name || u.role;
      if (roleFilter !== 'ALL' && userRole !== roleFilter) return false;

      // Branch filter
      if (branchFilter !== 'ALL') {
        if (branchFilter === 'GLOBAL' && u.branch_id) return false;
        if (branchFilter !== 'GLOBAL' && String(u.branch_id) !== String(branchFilter)) return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.branch_name?.toLowerCase().includes(q) ||
        userRole?.toLowerCase().includes(q)
      );
    });
  }, [users, statusFilter, roleFilter, branchFilter, searchQuery]);

  // Available roles for creation (Branch Managers cannot create Super Admin or Branch Manager)
  const creatableRoles = useMemo(() => {
    if (isSuperAdmin) return availableRoles;
    return availableRoles.filter(
      (r) => !['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(r.name)
    );
  }, [availableRoles, isSuperAdmin]);

  // Helper for role badge styling
  const getRoleBadgeStyle = (roleName) => {
    switch (roleName) {
      case 'SUPER_ADMIN':
        return 'bg-purple-950/70 text-purple-300 border-purple-800/60';
      case 'BRANCH_MANAGER':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60';
      case 'DISPATCHER':
        return 'bg-blue-950/70 text-blue-300 border-blue-800/60';
      case 'CASHIER':
        return 'bg-amber-950/70 text-amber-300 border-amber-800/60';
      case 'DRIVER':
        return 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP COCKPIT HEADER */}
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

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              sound.playScan();
              setIsMatrixDrawerOpen(true);
            }}
            title="Inspect comprehensive RBAC capability privileges"
            className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>RBAC MATRIX</span>
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={loading}
            title="Re-synchronize personnel roster"
            className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span>SYNC ROSTER</span>
          </button>

          {(isSuperAdmin || isBranchManager) && (
            <button
              onClick={openCreateModal}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm shadow-blue-900/40 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>PROVISION STAFF</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MODULAR HARDWARE TELEMETRY STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Total Personnel */}
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

        {/* Metric 2: Security Roles */}
        <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
              RBAC TIERS
            </span>
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
              {availableRoles.length || 5}
            </span>
            <span className="font-mono text-xs text-slate-400">PRIVILEGE PROFILES</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">31 CAPABILITIES</span>
            <span className="text-purple-400 font-bold">STRICT ACCESS</span>
          </div>
        </div>

        {/* Metric 3: Branch Hub Stations */}
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

        {/* Metric 4: Cryptographic Security */}
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

      {/* 3. SEARCH & DUAL-AXIS FILTER SWITCHBOARD */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3 flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full lg:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter staff by name, @username, email, phone, hub..."
            className="w-full bg-[#181d28] border border-[#222834] rounded pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns & Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
          {/* Role Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
              ROLE:
            </span>
            <select
              value={roleFilter}
              onChange={(e) => {
                sound.playScan();
                setRoleFilter(e.target.value);
              }}
              className="bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">ALL ROLES ({users.length})</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN ({kpis.roleCounts['SUPER_ADMIN'] || 0})</option>
              <option value="BRANCH_MANAGER">BRANCH_MANAGER ({kpis.roleCounts['BRANCH_MANAGER'] || 0})</option>
              <option value="DISPATCHER">DISPATCHER ({kpis.roleCounts['DISPATCHER'] || 0})</option>
              <option value="CASHIER">CASHIER ({kpis.roleCounts['CASHIER'] || 0})</option>
              <option value="DRIVER">DRIVER ({kpis.roleCounts['DRIVER'] || 0})</option>
            </select>
          </div>

          {/* Branch Filter Dropdown (Visible to Super Admin) */}
          {isSuperAdmin && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
                HUB:
              </span>
              <select
                value={branchFilter}
                onChange={(e) => {
                  sound.playScan();
                  setBranchFilter(e.target.value);
                }}
                className="bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">ALL REGIONS</option>
                <option value="GLOBAL">HQ GLOBAL (NO BRANCH)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} - {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter Toggle */}
          <div className="flex items-center bg-[#181d28] border border-[#222834] rounded p-0.5 text-[11px] font-mono">
            <button
              onClick={() => {
                sound.playScan();
                setStatusFilter('ALL');
              }}
              className={`px-2 py-0.5 rounded transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => {
                sound.playScan();
                setStatusFilter('ACTIVE');
              }}
              className={`px-2 py-0.5 rounded transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ACTIVE
            </button>
            {kpis.suspendedStaff > 0 && (
              <button
                onClick={() => {
                  sound.playScan();
                  setStatusFilter('SUSPENDED');
                }}
                className={`px-2 py-0.5 rounded transition-colors ${
                  statusFilter === 'SUSPENDED'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SUSPENDED
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. HIGH-DENSITY PERSONNEL MATRIX TABLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
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
                  const isCurrentSessionUser = user?.username === u.username;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-[#181d28]/60 transition-colors ${
                        isCurrentSessionUser ? 'bg-blue-950/20' : ''
                      }`}
                    >
                      {/* 1. Identity & Name */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          {/* Initials Avatar */}
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
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
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

                      {/* 2. Security Role */}
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getRoleBadgeStyle(
                            roleName
                          )}`}
                        >
                          <Shield className="w-3 h-3" />
                          {roleDisplay}
                        </span>
                      </td>

                      {/* 3. Branch Hub */}
                      <td className="p-3">
                        {u.branch_id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-900/60 font-mono text-[10px] font-bold">
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

                      {/* 4. Contact Channels */}
                      <td className="p-3">
                        <div className="space-y-0.5 text-[11px]">
                          <div className="flex items-center gap-1 text-slate-300">
                            <Mail className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate max-w-[170px]">{u.email}</span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-400">
                            <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{u.phone || '—'}</span>
                          </div>
                        </div>
                      </td>

                      {/* 5. Last Activity & Hash */}
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

                      {/* 6. Account Status */}
                      <td className="p-3 text-center">
                        {isActive ? (
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

                      {/* 7. Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect Privileges */}
                          <button
                            onClick={() => openInspector(u)}
                            title="Inspect staff account profile and RBAC permissions"
                            className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                          </button>

                          {/* Edit / Manage */}
                          {canEdit && (
                            <button
                              onClick={() => openEditModal(u)}
                              title="Edit user details, credentials, or toggle active status"
                              className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            </button>
                          )}

                          {/* Quick Switch (demo mode) */}
                          <button
                            onClick={() => handleQuickSwitch(roleName, u.branch_id)}
                            title={`Instant switch demo persona to ${roleName} (${u.full_name})`}
                            className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer text-[10px] font-mono"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Governance Notice */}
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

      {/* ========================================================================= */}
      {/* MODAL 1: PROVISION NEW STAFF MEMBER */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28]">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                  PROVISION NEW STAFF ACCOUNT
                </h3>
              </div>
              <button
                onClick={() => {
                  sound.playScan();
                  setIsCreateModalOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateUser} className="p-4 space-y-4">
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
                      value={`${user?.branch_name || 'Assigned Branch'} (Local Tenant)`}
                      className="w-full bg-[#181d28]/60 border border-[#222834] rounded px-3 py-1.5 text-xs text-slate-400 font-mono cursor-not-allowed"
                    />
                  )}
                </div>
              </div>

              {/* Driver-specific license field */}
              {availableRoles.find((r) => String(r.id) === String(createFormData.role_id))?.name ===
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

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#222834] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.playScan();
                    setIsCreateModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300"
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
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT STAFF PROFILE & CREDENTIAL ACCESS */}
      {/* ========================================================================= */}
      {isEditModalOpen && selectedUserForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-md overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                  EDIT STAFF RECORD // #{selectedUserForEdit.id}
                </h3>
              </div>
              <button
                onClick={() => {
                  sound.playScan();
                  setIsEditModalOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditUser} className="p-4 space-y-4">
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
                  <span className="text-white font-bold">@{selectedUserForEdit.username}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase">ROLE TIERS</span>
                  <span className="text-blue-400 font-bold">{selectedUserForEdit.role_name || selectedUserForEdit.role}</span>
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
                    setIsEditModalOpen(false);
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
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RBAC CAPABILITY & PRIVILEGES REFERENCE MATRIX DRAWER */}
      {/* ========================================================================= */}
      {isMatrixDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28] shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                  ROLE-BASED ACCESS CONTROL (RBAC) CAPABILITY MATRIX
                </h3>
              </div>
              <button
                onClick={() => {
                  sound.playScan();
                  setIsMatrixDrawerOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Matrix Table */}
            <div className="p-4 overflow-y-auto space-y-6">
              <p className="text-xs text-slate-400">
                Below is the authoritative specification matrix mapping security roles to functional capabilities across SwiftTrack Kenya.
              </p>

              {RBAC_CAPABILITY_MATRIX.map((group) => (
                <div key={group.category} className="space-y-2">
                  <h4 className="font-mono text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {group.category}
                  </h4>
                  <div className="border border-[#222834] rounded overflow-hidden">
                    <table className="w-full text-left font-mono text-[11px]">
                      <thead className="bg-[#181d28] text-slate-400 border-b border-[#222834] uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Capability / Permission</th>
                          <th className="p-2.5 text-center">Super Admin</th>
                          <th className="p-2.5 text-center">Branch Mgr</th>
                          <th className="p-2.5 text-center">Dispatcher</th>
                          <th className="p-2.5 text-center">Cashier</th>
                          <th className="p-2.5 text-center">Driver</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222834]">
                        {group.capabilities.map((cap) => (
                          <tr key={cap.code} className="hover:bg-[#181d28]/50">
                            <td className="p-2.5">
                              <span className="font-sans font-medium text-white block">{cap.name}</span>
                              <span className="text-[9px] text-slate-400 font-mono">{cap.code}</span>
                            </td>
                            {['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER', 'DRIVER'].map(
                              (r) => {
                                const allowed = cap.roles.includes(r);
                                return (
                                  <td key={r} className="p-2.5 text-center">
                                    {allowed ? (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                        <Check className="w-3 h-3" />
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-800/40 text-slate-600">
                                        —
                                      </span>
                                    )}
                                  </td>
                                );
                              }
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#222834] bg-[#181d28] flex items-center justify-between shrink-0">
              <span className="font-mono text-[10px] text-slate-400">
                SWIFTTRACK KERNEL SECURITY POLICY: V2.6
              </span>
              <button
                onClick={() => {
                  sound.playScan();
                  setIsMatrixDrawerOpen(false);
                }}
                className="px-3 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] border border-[#222834] text-xs font-mono text-slate-200"
              >
                CLOSE MATRIX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: STAFF INSPECTOR DRAWER */}
      {/* ========================================================================= */}
      {inspectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28]">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                  STAFF DOSSIER // {inspectingUser.username.toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => {
                  sound.playScan();
                  setInspectingUser(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4 text-xs font-mono">
              {/* Profile Card */}
              <div className="bg-[#181d28] border border-[#222834] rounded p-3 flex items-start gap-3">
                <div className="w-12 h-12 rounded bg-[#12161f] border border-[#222834] text-white flex items-center justify-center font-bold text-sm text-blue-400 shrink-0">
                  {inspectingUser.full_name
                    ? inspectingUser.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'U'}
                </div>
                <div className="space-y-1 min-w-0">
                  <h4 className="font-bold text-white font-sans text-sm">{inspectingUser.full_name}</h4>
                  <div className="text-slate-400 text-[11px]">@{inspectingUser.username}</div>
                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeStyle(
                        inspectingUser.role_name || inspectingUser.role
                      )}`}
                    >
                      <Shield className="w-3 h-3" />
                      {inspectingUser.role_display_name || inspectingUser.role_name || inspectingUser.role}
                    </span>
                    {inspectingUser.is_active !== 0 ? (
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
                    {inspectingUser.branch_name || 'HQ Global Operations'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">BRANCH CODE:</span>
                  <span className="text-blue-400 font-bold">{inspectingUser.branch_code || 'GLOBAL'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">OFFICIAL EMAIL:</span>
                  <span className="text-purple-300">{inspectingUser.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">HOTLINE PHONE:</span>
                  <span className="text-emerald-300">{inspectingUser.phone || '—'}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#222834]">
                  <span className="text-slate-400">ENROLLED ON:</span>
                  <span className="text-slate-300">
                    {inspectingUser.created_at
                      ? new Date(inspectingUser.created_at).toLocaleString('en-KE', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : 'Initial Seed'}
                  </span>
                </div>
              </div>

              {/* Cryptographic Hash Security Notice */}
              <div className="p-2.5 rounded bg-[#181d28] border border-[#222834] flex items-start gap-2 text-[11px] text-slate-400">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-bold block">CRYPTOGRAPHIC PRIVILEGE BOUNDARY:</span>
                  All actions executed under @{inspectingUser.username} are cryptographically attributed with SHA-256 state signatures in the immutable audit ledger.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#222834] bg-[#181d28] flex items-center justify-end">
              <button
                onClick={() => {
                  sound.playScan();
                  setInspectingUser(null);
                }}
                className="px-3 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] border border-[#222834] text-xs font-mono text-slate-200"
              >
                CLOSE DOSSIER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
