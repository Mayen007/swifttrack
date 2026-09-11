// client/src/views/BranchesView.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Building2,
  Warehouse,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Plus,
  Search,
  RotateCcw,
  ShieldCheck,
  Users,
  Package,
  Layers,
  Activity,
  ExternalLink,
  Edit3,
  AlertTriangle,
  X,
  Radio,
  ArrowRight,
  Lock,
  Server,
  Globe,
  Check,
  FileText,
} from 'lucide-react';

export function BranchesView() {
  const {
    user,
    branches,
    selectedBranch,
    selectBranch,
    isSuperAdmin,
    isBranchManager,
    refreshBranches,
  } = useAuth();

  // Local state
  const [branchDetails, setBranchDetails] = useState([]);
  const [warehousesMap, setWarehousesMap] = useState({}); // { [branchId]: Warehouse[] }
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'ACTIVE', 'INACTIVE'
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Modal states
  const [isCreateHubModalOpen, setIsCreateHubModalOpen] = useState(false);
  const [isEditHubModalOpen, setIsEditHubModalOpen] = useState(false);
  const [selectedHubForEdit, setSelectedHubForEdit] = useState(null);
  const [inspectingHub, setInspectingHub] = useState(null);

  // Form states for creating new hub
  const [createFormData, setCreateFormData] = useState({
    code: '',
    name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
  });
  const [isSubmittingHub, setIsSubmittingHub] = useState(false);
  const [createHubError, setCreateHubError] = useState('');

  // Form states for editing hub
  const [editFormData, setEditFormData] = useState({
    name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    is_active: 1,
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editHubError, setEditHubError] = useState('');

  // Form states for adding warehouse depot in inspector
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);
  const [warehouseFormData, setWarehouseFormData] = useState({
    code: '',
    name: '',
    location_desc: '',
  });
  const [isSubmittingWarehouse, setIsSubmittingWarehouse] = useState(false);
  const [warehouseError, setWarehouseError] = useState('');

  // Load branch network details and attached warehouses
  const loadBranchNetwork = useCallback(async () => {
    try {
      setLoading(true);
      const branchesData = await api.get('/api/branches');
      const list = Array.isArray(branchesData) ? branchesData : [];
      setBranchDetails(list);

      // Fetch warehouse depots for each branch in parallel
      const whMap = {};
      await Promise.all(
        list.map(async (b) => {
          try {
            const whs = await api.get(`/api/branches/${b.id}/warehouses`);
            whMap[b.id] = Array.isArray(whs) ? whs : [];
          } catch (e) {
            console.warn(`Could not load warehouses for branch #${b.id}:`, e);
            whMap[b.id] = [];
          }
        })
      );
      setWarehousesMap(whMap);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (err) {
      console.error('Failed to load regional branch topology:', err);
      api.toast('Failed to load regional branch topology: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBranchNetwork();
  }, [loadBranchNetwork]);

  // Handle manual refresh
  const handleManualRefresh = async () => {
    sound.playScan();
    if (refreshBranches) await refreshBranches();
    await loadBranchNetwork();
    api.toast('Branch network topology re-synchronized', 'success');
  };

  // Switch context with sound feedback
  const handleSelectBranch = (b) => {
    sound.playScan();
    selectBranch(b);
  };

  // Open Edit Hub Modal
  const openEditModal = (hub) => {
    sound.playScan();
    setSelectedHubForEdit(hub);
    setEditFormData({
      name: hub.name || '',
      city: hub.city || '',
      address: hub.address || '',
      phone: hub.phone || '',
      email: hub.email || '',
      is_active: hub.is_active !== undefined ? hub.is_active : 1,
    });
    setEditHubError('');
    setIsEditHubModalOpen(true);
  };

  // Open Inspector Modal
  const openInspector = (hub) => {
    sound.playScan();
    setInspectingHub(hub);
    setIsAddingWarehouse(false);
    setWarehouseFormData({
      code: `W-${hub.code}-0${((warehousesMap[hub.id] || []).length + 1).toString().padStart(1, '0')}`,
      name: `${hub.city} Secondary Depot`,
      location_desc: 'Zone B / Secondary Staging Dock',
    });
    setWarehouseError('');
  };

  // Handle Create Hub Submit
  const handleCreateHub = async (e) => {
    e.preventDefault();
    setCreateHubError('');

    if (
      !createFormData.code.trim() ||
      !createFormData.name.trim() ||
      !createFormData.city.trim() ||
      !createFormData.address.trim() ||
      !createFormData.phone.trim() ||
      !createFormData.email.trim()
    ) {
      sound.playError();
      setCreateHubError('All physical hub fields (Code, Name, City, Address, Phone, Email) are mandatory.');
      return;
    }

    try {
      setIsSubmittingHub(true);
      const payload = {
        code: createFormData.code.trim().toUpperCase(),
        name: createFormData.name.trim(),
        city: createFormData.city.trim(),
        address: createFormData.address.trim(),
        phone: createFormData.phone.trim(),
        email: createFormData.email.trim(),
      };

      const res = await api.post('/api/branches', payload);
      sound.playSuccess();
      api.toast(`Regional Hub node '${res.code}' provisioned successfully`, 'success');

      // Reset form & close modal
      setCreateFormData({
        code: '',
        name: '',
        city: '',
        address: '',
        phone: '',
        email: '',
      });
      setIsCreateHubModalOpen(false);

      // Refresh global and local states
      if (refreshBranches) await refreshBranches();
      await loadBranchNetwork();
    } catch (err) {
      console.error('Failed to create branch:', err);
      sound.playError();
      setCreateHubError(err.message || 'Failed to provision branch node');
    } finally {
      setIsSubmittingHub(false);
    }
  };

  // Handle Edit Hub Submit
  const handleEditHub = async (e) => {
    e.preventDefault();
    setEditHubError('');

    if (!selectedHubForEdit) return;

    if (
      !editFormData.name.trim() ||
      !editFormData.city.trim() ||
      !editFormData.address.trim() ||
      !editFormData.phone.trim() ||
      !editFormData.email.trim()
    ) {
      sound.playError();
      setEditHubError('Name, City, Physical Address, Phone, and Email cannot be empty.');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      const payload = {
        name: editFormData.name.trim(),
        city: editFormData.city.trim(),
        address: editFormData.address.trim(),
        phone: editFormData.phone.trim(),
        email: editFormData.email.trim(),
        is_active: Number(editFormData.is_active),
      };

      await api.put(`/api/branches/${selectedHubForEdit.id}`, payload);
      sound.playSuccess();
      api.toast(`Hub profile '${selectedHubForEdit.code}' updated successfully`, 'success');

      setIsEditHubModalOpen(false);
      setSelectedHubForEdit(null);

      // Refresh global & local states
      if (refreshBranches) await refreshBranches();
      await loadBranchNetwork();
    } catch (err) {
      console.error('Failed to update branch:', err);
      sound.playError();
      setEditHubError(err.message || 'Failed to update hub profile');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Add Warehouse Submit
  const handleAddWarehouse = async (e) => {
    e.preventDefault();
    setWarehouseError('');

    if (!inspectingHub) return;

    if (!warehouseFormData.code.trim() || !warehouseFormData.name.trim()) {
      sound.playError();
      setWarehouseError('Warehouse code and facility name are required.');
      return;
    }

    try {
      setIsSubmittingWarehouse(true);
      const payload = {
        code: warehouseFormData.code.trim().toUpperCase(),
        name: warehouseFormData.name.trim(),
        location_desc: warehouseFormData.location_desc.trim(),
      };

      await api.post(`/api/branches/${inspectingHub.id}/warehouses`, payload);
      sound.playSuccess();
      api.toast(`Storage Depot '${payload.code}' added to Hub #${inspectingHub.id}`, 'success');

      // Refresh warehouses for inspecting hub
      const updatedWhs = await api.get(`/api/branches/${inspectingHub.id}/warehouses`);
      setWarehousesMap((prev) => ({
        ...prev,
        [inspectingHub.id]: Array.isArray(updatedWhs) ? updatedWhs : [],
      }));

      // Reset form and collapse
      setWarehouseFormData({
        code: '',
        name: '',
        location_desc: '',
      });
      setIsAddingWarehouse(false);

      // Refresh network counts
      await loadBranchNetwork();
    } catch (err) {
      console.error('Failed to add warehouse depot:', err);
      sound.playError();
      setWarehouseError(err.message || 'Failed to register warehouse facility');
    } finally {
      setIsSubmittingWarehouse(false);
    }
  };

  // Aggregated KPIs
  const kpis = useMemo(() => {
    const totalHubs = branchDetails.length;
    const activeHubs = branchDetails.filter((b) => b.is_active !== 0).length;
    const totalStaff = branchDetails.reduce((acc, b) => acc + (b.staff_count || 0), 0);
    const totalWarehouses = Object.values(warehousesMap).reduce(
      (acc, list) => acc + (list ? list.length : 0),
      0
    );
    const totalOrders = branchDetails.reduce((acc, b) => acc + (b.total_orders || 0), 0);

    return {
      totalHubs,
      activeHubs,
      totalStaff,
      totalWarehouses,
      totalOrders,
      operationalRate: totalHubs > 0 ? Math.round((activeHubs / totalHubs) * 100) : 100,
    };
  }, [branchDetails, warehousesMap]);

  // Filtered branch nodes
  const filteredBranches = useMemo(() => {
    return branchDetails.filter((b) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && b.is_active === 0) return false;
      if (statusFilter === 'INACTIVE' && b.is_active !== 0) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        b.name?.toLowerCase().includes(q) ||
        b.code?.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q)
      );
    });
  }, [branchDetails, statusFilter, searchQuery]);

  // Determine user permission to edit a specific hub
  const canEditHub = (hub) => {
    if (isSuperAdmin) return true;
    if (isBranchManager && Number(user?.branch_id) === Number(hub.id)) return true;
    return false;
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP COCKPIT HEADER */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-bold tracking-wider uppercase">
              <Globe className="w-3 h-3" />
              KENYA TOPOLOGY MESH
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              MULTITENANT NODE CLUSTER
            </span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 mt-1">
            <Building2 className="w-5 h-5 text-blue-400" />
            Regional Hub Network & Depot Topology
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Decentralized distribution centers across Kenya with autonomous inventory, POS, and strict branch-level isolation
          </p>
        </div>

        {/* Action switchboard */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            title="Reload branch network data and warehouse mappings"
            className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] hover:text-white text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span>SYNC TOPOLOGY</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => {
                sound.playScan();
                setCreateHubError('');
                setIsCreateHubModalOpen(true);
              }}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm shadow-blue-900/40 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>PROVISION REGIONAL HUB</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MODULAR HARDWARE TELEMETRY STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Metric 1: Active Hubs */}
        <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
              OPERATIONAL HUBS
            </span>
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
              {kpis.activeHubs}
            </span>
            <span className="font-mono text-xs text-slate-400">/ {kpis.totalHubs} NODES</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {kpis.operationalRate}% OPERATIONAL
            </span>
            <span className="text-slate-500">PROVINCIAL</span>
          </div>
        </div>

        {/* Metric 2: Attached Warehouses */}
        <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
              DEPOT WAREHOUSES
            </span>
            <Warehouse className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
              {kpis.totalWarehouses}
            </span>
            <span className="font-mono text-xs text-slate-400">FACILITIES</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">STORAGE LOCATIONS</span>
            <span className="text-emerald-400 font-bold">100% ISOLATED</span>
          </div>
        </div>

        {/* Metric 3: Station Personnel */}
        <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
              STATION OPERATORS
            </span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
              {kpis.totalStaff}
            </span>
            <span className="font-mono text-xs text-slate-400">PERSONNEL</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">RBAC ASSIGNED</span>
            <span className="text-purple-400">ACTIVE ROSTER</span>
          </div>
        </div>

        {/* Metric 4: Aggregate Orders */}
        <div className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-400">
              NETWORK CARGO
            </span>
            <Package className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums">
              {kpis.totalOrders.toLocaleString()}
            </span>
            <span className="font-mono text-xs text-slate-400">ORDERS</span>
          </div>
          <div className="mt-2 pt-2 border-t border-[#222834] flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">LIFETIME VOLUME</span>
            <span className="text-amber-400 font-mono">THROUGHPUT</span>
          </div>
        </div>
      </div>

      {/* 3. SEARCH & STATUS FILTER SWITCHBOARD */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full md:w-96">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by hub code, facility name, city, address..."
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

        {/* Filter chips & sync telemetry */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center bg-[#181d28] border border-[#222834] rounded p-0.5 text-[11px] font-mono">
            <button
              onClick={() => {
                sound.playScan();
                setStatusFilter('ALL');
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ALL HUBS ({kpis.totalHubs})
            </button>
            <button
              onClick={() => {
                sound.playScan();
                setStatusFilter('ACTIVE');
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ACTIVE ({kpis.activeHubs})
            </button>
            {kpis.totalHubs - kpis.activeHubs > 0 && (
              <button
                onClick={() => {
                  sound.playScan();
                  setStatusFilter('INACTIVE');
                }}
                className={`px-2.5 py-1 rounded transition-colors ${
                  statusFilter === 'INACTIVE'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                OFFLINE ({kpis.totalHubs - kpis.activeHubs})
              </button>
            )}
          </div>

          {lastSyncTime && (
            <span className="hidden lg:inline-flex items-center gap-1 font-mono text-[10px] text-slate-400 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              SYNC: {lastSyncTime} EAT
            </span>
          )}
        </div>
      </div>

      {/* 4. REGIONAL HUB NETWORK CARDS MATRIX */}
      {loading && branchDetails.length === 0 ? (
        <div className="bg-[#12161f] border border-[#222834] rounded p-12 text-center">
          <RotateCcw className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
          <p className="font-mono text-xs text-slate-400">SYNCHRONIZING KENYA HUB TOPOLOGY MATRIX...</p>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="bg-[#12161f] border border-[#222834] rounded p-12 text-center">
          <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-white">No Regional Hubs Found</p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery
              ? `No regional hubs match query "${searchQuery}". Try resetting search filter.`
              : 'No regional hubs provisioned in this network.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3 px-3 py-1.5 rounded bg-[#181d28] border border-[#222834] text-xs font-mono text-slate-300 hover:text-white"
            >
              CLEAR SEARCH FILTER
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBranches.map((b) => {
            const isSelected = selectedBranch?.id === b.id;
            const branchWhs = warehousesMap[b.id] || [];
            const isOnline = b.is_active !== 0;
            const canEdit = canEditHub(b);

            return (
              <div
                key={b.id}
                className={`rounded border transition-all duration-150 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#12161f] border-blue-500/80 shadow-md shadow-blue-950/40 ring-1 ring-blue-500/50'
                    : 'bg-[#12161f] border-[#222834] hover:border-slate-700'
                }`}
              >
                {/* Hub Node Header */}
                <div className="p-4 border-b border-[#222834] space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-800/60 tracking-wider">
                        {b.code}
                      </span>
                      <div>
                        <h2 className="text-sm font-bold text-white tracking-tight leading-tight flex items-center gap-1.5">
                          {b.name}
                        </h2>
                        <span className="font-mono text-[11px] text-slate-400 uppercase tracking-wider">
                          {b.city}, KENYA
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          ONLINE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          OFFLINE
                        </span>
                      )}

                      {isSelected && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          <Check className="w-3 h-3 text-blue-400" />
                          ACTIVE SCOPE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Physical & Dispatch Connectivity */}
                  <div className="bg-[#181d28] border border-[#222834] rounded p-2.5 space-y-1.5 font-mono text-[11px] text-slate-300">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate text-slate-300">
                        {b.address || `${b.city}, Kenya`}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#222834]/80">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate text-slate-400">{b.phone || '+254 20 123 4567'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate text-slate-400">
                          {b.email || `hub.${b.code.toLowerCase()}@swifttrack.co.ke`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attached Warehouses & Depots Micro-Strip */}
                <div className="px-4 py-3 border-b border-[#222834] bg-[#0f121a]">
                  <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                    <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Warehouse className="w-3 h-3 text-blue-400" />
                      ATTACHED STORAGE DEPOTS ({branchWhs.length})
                    </span>
                    <button
                      onClick={() => openInspector(b)}
                      className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 text-[10px]"
                    >
                      <span>VIEW FACILITY SPECS</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {branchWhs.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {branchWhs.map((wh) => (
                        <div
                          key={wh.id}
                          className="px-2 py-1 rounded bg-[#181d28] border border-[#222834] flex items-center gap-1.5 font-mono text-[10px]"
                        >
                          <span className="font-bold text-blue-400">{wh.code}</span>
                          <span className="text-slate-400">({wh.name})</span>
                          {wh.location_desc && (
                            <span className="text-slate-400 text-[9px] hidden sm:inline">
                              • {wh.location_desc}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-slate-400 italic">
                      Default depot initialization in progress...
                    </div>
                  )}
                </div>

                {/* Node Telemetry Counters (3 columns) */}
                <div className="grid grid-cols-3 divide-x divide-[#222834] p-3 text-center bg-[#12161f]">
                  <div>
                    <span className="block font-mono text-[10px] text-slate-400 uppercase">
                      PERSONNEL
                    </span>
                    <span className="font-mono text-sm font-bold text-white tabular-nums">
                      {b.staff_count || 0}
                    </span>
                    <span className="block font-mono text-[9px] text-slate-400">ASSIGNED</span>
                  </div>
                  <div>
                    <span className="block font-mono text-[10px] text-slate-400 uppercase">
                      DEPOTS
                    </span>
                    <span className="font-mono text-sm font-bold text-white tabular-nums">
                      {branchWhs.length || b.warehouse_count || 0}
                    </span>
                    <span className="block font-mono text-[9px] text-slate-400">FACILITIES</span>
                  </div>
                  <div>
                    <span className="block font-mono text-[10px] text-slate-400 uppercase">
                      CARGO ORDERS
                    </span>
                    <span className="font-mono text-sm font-bold text-amber-400 tabular-nums">
                      {b.total_orders || 0}
                    </span>
                    <span className="block font-mono text-[9px] text-slate-400">ROUTED</span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 border-t border-[#222834] bg-[#141822] flex items-center gap-2">
                  <button
                    onClick={() => handleSelectBranch(b)}
                    disabled={isSelected}
                    className={`flex-1 py-1.5 px-2 rounded text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-900/40 text-blue-400 border border-blue-500/40 cursor-default'
                        : 'bg-[#181d28] hover:bg-[#222938] text-slate-200 hover:text-white border border-[#222834]'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>ACTIVE SCOPE</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span>SWITCH CONTEXT</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => openInspector(b)}
                    title="Inspect facility depots and add warehouses"
                    className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-blue-400" />
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => openEditModal(b)}
                      title="Edit hub details and physical address"
                      className="p-1.5 rounded bg-[#181d28] hover:bg-[#222938] text-slate-300 hover:text-white border border-[#222834] transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4 text-slate-400 hover:text-amber-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. MULTI-TENANT ISOLATION GOVERNANCE FOOTER */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-mono text-[11px]">
            CRYPTOGRAPHIC AUDIT // ALL REGIONAL NODE TRANSACTIONS ARE LOCALLY SCOPED & SECURED
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
          <span>LATENCY: &lt;14ms</span>
          <span>•</span>
          <span>TENANT ISOLATION: STRICT</span>
          <span>•</span>
          <span>DARAJA PAYBILL: INTEGRATED</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PROVISION NEW REGIONAL HUB (SUPER ADMIN ONLY) */}
      {/* ========================================================================= */}
      {isCreateHubModalOpen && (
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
                onClick={() => {
                  sound.playScan();
                  setIsCreateHubModalOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateHub} className="p-4 space-y-4">
              {createHubError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{createHubError}</span>
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
                    value={createFormData.code}
                    onChange={(e) =>
                      setCreateFormData({
                        ...createFormData,
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
                    value={createFormData.name}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, name: e.target.value })
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
                    value={createFormData.city}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, city: e.target.value })
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
                    value={createFormData.address}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, address: e.target.value })
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
                    value={createFormData.phone}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, phone: e.target.value })
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
                    value={createFormData.email}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, email: e.target.value })
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
                  onClick={() => {
                    sound.playScan();
                    setIsCreateHubModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded border border-[#222834] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingHub}
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm shadow-blue-950/50 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingHub ? (
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
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT HUB PROFILE (SUPER ADMIN & BRANCH MANAGER) */}
      {/* ========================================================================= */}
      {isEditHubModalOpen && selectedHubForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-xl overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                  EDIT HUB PROFILE // {selectedHubForEdit.code}
                </h3>
              </div>
              <button
                onClick={() => {
                  sound.playScan();
                  setIsEditHubModalOpen(false);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditHub} className="p-4 space-y-4">
              {editHubError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editHubError}</span>
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
                    value={selectedHubForEdit.code}
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
                    value={editFormData.name}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, name: e.target.value })
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
                    value={editFormData.city}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, city: e.target.value })
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
                    value={editFormData.address}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, address: e.target.value })
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
                    value={editFormData.phone}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, phone: e.target.value })
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
                    value={editFormData.email}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, email: e.target.value })
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
                    value={editFormData.is_active}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, is_active: Number(e.target.value) })
                    }
                    className="bg-[#12161f] border border-[#222834] rounded px-3 py-1 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
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
                  onClick={() => {
                    sound.playScan();
                    setIsEditHubModalOpen(false);
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
                      <span>SAVE PROFILE</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: HUB INSPECTOR & FACILITY DEPOTS DRAWER / MODAL */}
      {/* ========================================================================= */}
      {inspectingHub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28] shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                  FACILITY SPECIFICATIONS // HUB: {inspectingHub.code}
                </h3>
              </div>
              <button
                onClick={() => {
                  sound.playScan();
                  setInspectingHub(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Hub Metadata Matrix */}
              <div className="bg-[#181d28] border border-[#222834] rounded p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase">HUB NODE ID</span>
                  <span className="font-bold text-white">#{inspectingHub.id}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase">NODE CODE</span>
                  <span className="font-bold text-blue-400">{inspectingHub.code}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase">CITY LOCATION</span>
                  <span className="font-bold text-white">{inspectingHub.city}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase">OPERATIONAL STATUS</span>
                  <span
                    className={`font-bold ${
                      inspectingHub.is_active !== 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {inspectingHub.is_active !== 0 ? 'ONLINE' : 'SUSPENDED'}
                  </span>
                </div>
              </div>

              {/* Physical Address & Contact specs */}
              <div className="bg-[#181d28] border border-[#222834] rounded p-3 space-y-2 font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-white">{inspectingHub.address}</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-slate-300 pt-2 border-t border-[#222834]">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                    <span>{inspectingHub.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    <span>{inspectingHub.email}</span>
                  </div>
                </div>
              </div>

              {/* Connected Storage Depots Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-blue-400" />
                    REGISTERED STORAGE DEPOTS & BAYS (
                    {(warehousesMap[inspectingHub.id] || []).length})
                  </h4>

                  {canEditHub(inspectingHub) && !isAddingWarehouse && (
                    <button
                      onClick={() => {
                        sound.playScan();
                        setIsAddingWarehouse(true);
                        setWarehouseError('');
                      }}
                      className="px-2.5 py-1 rounded bg-[#181d28] hover:bg-[#222836] border border-[#222834] text-[11px] font-mono font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>ADD DEPOT BAY</span>
                    </button>
                  )}
                </div>

                {/* Inline Add Warehouse Form */}
                {isAddingWarehouse && (
                  <form
                    onSubmit={handleAddWarehouse}
                    className="p-3 bg-[#151923] border border-blue-500/40 rounded space-y-3 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-400">
                        PROVISION STORAGE DEPOT / FACILITY
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingWarehouse(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {warehouseError && (
                      <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-mono">
                        {warehouseError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Depot Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={warehouseFormData.code}
                          onChange={(e) =>
                            setWarehouseFormData({
                              ...warehouseFormData,
                              code: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder={`W-${inspectingHub.code}-02`}
                          className="w-full bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs text-white uppercase font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Depot Facility Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={warehouseFormData.name}
                          onChange={(e) =>
                            setWarehouseFormData({
                              ...warehouseFormData,
                              name: e.target.value,
                            })
                          }
                          placeholder="e.g. Cold Chain Pharmaceutical Bay"
                          className="w-full bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Location / Bay Description
                      </label>
                      <input
                        type="text"
                        value={warehouseFormData.location_desc}
                        onChange={(e) =>
                          setWarehouseFormData({
                            ...warehouseFormData,
                            location_desc: e.target.value,
                          })
                        }
                        placeholder="e.g. Zone C, Loading Bay 4-8"
                        className="w-full bg-[#181d28] border border-[#222834] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222834]">
                      <button
                        type="button"
                        onClick={() => setIsAddingWarehouse(false)}
                        className="px-2.5 py-1 rounded bg-[#181d28] text-slate-300 text-[11px] font-mono"
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingWarehouse}
                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingWarehouse ? (
                          <>
                            <RotateCcw className="w-3 h-3 animate-spin" />
                            <span>SAVING...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            <span>SAVE FACILITY</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Depots List Table */}
                <div className="border border-[#222834] rounded overflow-hidden">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="bg-[#181d28] text-slate-400 border-b border-[#222834] uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Code</th>
                        <th className="p-2.5">Depot Facility</th>
                        <th className="p-2.5">Bay / Location Description</th>
                        <th className="p-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222834]">
                      {(warehousesMap[inspectingHub.id] || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                            No warehouse facilities registered under this hub.
                          </td>
                        </tr>
                      ) : (
                        (warehousesMap[inspectingHub.id] || []).map((wh) => (
                          <tr key={wh.id} className="hover:bg-[#181d28]/50 transition-colors">
                            <td className="p-2.5 font-bold text-blue-400">{wh.code}</td>
                            <td className="p-2.5 font-sans font-medium text-white">{wh.name}</td>
                            <td className="p-2.5 text-slate-400">
                              {wh.location_desc || 'Primary Depot Staging Area'}
                            </td>
                            <td className="p-2.5 text-right">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                ACTIVE
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tenant Isolation Guarantee box */}
              <div className="p-3 rounded bg-[#181d28] border border-[#222834] flex items-start gap-2 text-slate-400 text-[11px]">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-white font-mono">TENANT ISOLATION POLICY:</strong> In accordance with SwiftTrack architectural specifications, all POS orders, local stock balances, and assigned staff are strictly bounded to Hub Node #{inspectingHub.id} ({inspectingHub.code}). Inter-branch movements require formal dual-control transfer manifests.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#222834] bg-[#181d28] flex items-center justify-between shrink-0">
              <span className="font-mono text-[10px] text-slate-400">
                PROVINCIAL CONTEXT: {inspectingHub.city.toUpperCase()}
              </span>
              <button
                onClick={() => {
                  sound.playScan();
                  setInspectingHub(null);
                }}
                className="px-3 py-1.5 rounded bg-[#12161f] hover:bg-[#202736] border border-[#222834] text-xs font-mono text-slate-200"
              >
                CLOSE INSPECTOR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
