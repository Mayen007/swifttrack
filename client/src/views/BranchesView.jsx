// client/src/views/BranchesView.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import { Building2, RotateCcw, ShieldCheck } from 'lucide-react';

import { BranchHeader } from '../components/branches/BranchHeader.jsx';
import { BranchKpis } from '../components/branches/BranchKpis.jsx';
import { BranchFilters } from '../components/branches/BranchFilters.jsx';
import { BranchCard } from '../components/branches/BranchCard.jsx';
import { BranchCreateModal } from '../components/branches/BranchCreateModal.jsx';
import { BranchEditModal } from '../components/branches/BranchEditModal.jsx';
import { BranchInspectorModal } from '../components/branches/BranchInspectorModal.jsx';

export function BranchesView() {
  const {
    user,
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

      setCreateFormData({
        code: '',
        name: '',
        city: '',
        address: '',
        phone: '',
        email: '',
      });
      setIsCreateHubModalOpen(false);

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
        is_active: editFormData.is_active,
      };

      const updated = await api.put(`/api/branches/${selectedHubForEdit.id}`, payload);
      sound.playSuccess();
      api.toast(`Hub '${updated.code || selectedHubForEdit.code}' updated successfully`, 'success');

      setIsEditHubModalOpen(false);
      setSelectedHubForEdit(null);

      if (refreshBranches) await refreshBranches();
      await loadBranchNetwork();
    } catch (err) {
      console.error('Failed to update branch:', err);
      sound.playError();
      setEditHubError(err.message || 'Failed to update branch details');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Add Warehouse Depot
  const handleAddWarehouse = async (e) => {
    e.preventDefault();
    setWarehouseError('');

    if (!inspectingHub) return;
    if (!warehouseFormData.code.trim() || !warehouseFormData.name.trim()) {
      sound.playError();
      setWarehouseError('Depot Code and Depot Facility Name are mandatory.');
      return;
    }

    try {
      setIsSubmittingWarehouse(true);
      const payload = {
        code: warehouseFormData.code.trim().toUpperCase(),
        name: warehouseFormData.name.trim(),
        location_desc: warehouseFormData.location_desc.trim() || 'Secondary Staging Bay',
      };

      await api.post(`/api/branches/${inspectingHub.id}/warehouses`, payload);
      sound.playSuccess();
      api.toast(`Warehouse depot '${payload.code}' attached to Hub ${inspectingHub.code}`, 'success');

      const updatedWhs = await api.get(`/api/branches/${inspectingHub.id}/warehouses`);
      setWarehousesMap((prev) => ({
        ...prev,
        [inspectingHub.id]: Array.isArray(updatedWhs) ? updatedWhs : [],
      }));

      setWarehouseFormData({
        code: '',
        name: '',
        location_desc: '',
      });
      setIsAddingWarehouse(false);

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
      if (statusFilter === 'ACTIVE' && b.is_active === 0) return false;
      if (statusFilter === 'INACTIVE' && b.is_active !== 0) return false;

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

  // Permission helper
  const canEditHub = (hub) => {
    if (isSuperAdmin) return true;
    if (isBranchManager && Number(user?.branch_id) === Number(hub.id)) return true;
    return false;
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP COCKPIT HEADER */}
      <BranchHeader
        loading={loading}
        isSuperAdmin={isSuperAdmin}
        onRefresh={handleManualRefresh}
        onOpenCreateModal={() => {
          sound.playScan();
          setCreateHubError('');
          setIsCreateHubModalOpen(true);
        }}
      />

      {/* 2. TELEMETRY STRIP */}
      <BranchKpis kpis={kpis} />

      {/* 3. SEARCH & STATUS FILTER SWITCHBOARD */}
      <BranchFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        totalHubs={kpis.totalHubs}
        activeHubs={kpis.activeHubs}
        lastSyncTime={lastSyncTime}
      />

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
              className="mt-3 px-3 py-1.5 rounded bg-[#181d28] border border-[#222834] text-xs font-mono text-slate-300 hover:text-white cursor-pointer"
            >
              CLEAR SEARCH FILTER
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBranches.map((b) => (
            <BranchCard
              key={b.id}
              branch={b}
              isSelected={selectedBranch?.id === b.id}
              warehouses={warehousesMap[b.id] || []}
              canEdit={canEditHub(b)}
              onSelectBranch={handleSelectBranch}
              onOpenInspector={openInspector}
              onOpenEdit={openEditModal}
            />
          ))}
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

      {/* MODAL 1: PROVISION NEW REGIONAL HUB */}
      <BranchCreateModal
        isOpen={isCreateHubModalOpen}
        formData={createFormData}
        setFormData={setCreateFormData}
        isSubmitting={isSubmittingHub}
        error={createHubError}
        onClose={() => {
          sound.playScan();
          setIsCreateHubModalOpen(false);
        }}
        onSubmit={handleCreateHub}
      />

      {/* MODAL 2: EDIT HUB PROFILE */}
      <BranchEditModal
        isOpen={isEditHubModalOpen}
        hub={selectedHubForEdit}
        formData={editFormData}
        setFormData={setEditFormData}
        isSubmitting={isSubmittingEdit}
        error={editHubError}
        isSuperAdmin={isSuperAdmin}
        onClose={() => {
          sound.playScan();
          setIsEditHubModalOpen(false);
        }}
        onSubmit={handleEditHub}
      />

      {/* MODAL 3: HUB INSPECTOR & FACILITY DEPOTS */}
      <BranchInspectorModal
        hub={inspectingHub}
        warehouses={inspectingHub ? warehousesMap[inspectingHub.id] || [] : []}
        canEdit={inspectingHub ? canEditHub(inspectingHub) : false}
        isAddingWarehouse={isAddingWarehouse}
        setIsAddingWarehouse={setIsAddingWarehouse}
        warehouseFormData={warehouseFormData}
        setWarehouseFormData={setWarehouseFormData}
        isSubmittingWarehouse={isSubmittingWarehouse}
        warehouseError={warehouseError}
        onClose={() => {
          sound.playScan();
          setInspectingHub(null);
        }}
        onAddWarehouse={handleAddWarehouse}
      />
    </div>
  );
}
