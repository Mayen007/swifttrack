// client/src/views/InventoryView.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';

import { InventoryHeader } from '../components/inventory/InventoryHeader.jsx';
import { InventoryKpis } from '../components/inventory/InventoryKpis.jsx';
import { InventoryFilters } from '../components/inventory/InventoryFilters.jsx';
import { InventoryTable } from '../components/inventory/InventoryTable.jsx';
import { InventoryLedgerTable } from '../components/inventory/InventoryLedgerTable.jsx';
import { InventoryTransfersTable } from '../components/inventory/InventoryTransfersTable.jsx';
import { InventoryStateTransitionModal } from '../components/inventory/InventoryStateTransitionModal.jsx';
import { InventoryTransferModal } from '../components/inventory/InventoryTransferModal.jsx';

export function InventoryView() {
  const { selectedBranch } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix', 'movements', 'transfers'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');

  // Modals
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [selectedItemForTransition, setSelectedItemForTransition] = useState(null);
  const [transitionMode, setTransitionMode] = useState('QUARANTINE');

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState(null);

  const fetchInventoryData = useCallback(async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const [invData, movData, trfData, branchData] = await Promise.all([
        api.get(`/api/v1/inventory${branchParam}`),
        api.get(`/api/v1/inventory/movements${branchParam}`).catch(() => []),
        api.get(`/api/v1/inventory/transfers${branchParam}`).catch(() => []),
        api.get('/api/branches').catch(() => []),
      ]);

      setInventory(Array.isArray(invData) ? invData : []);
      setMovements(Array.isArray(movData) ? movData : []);
      setTransfers(Array.isArray(trfData) ? trfData : []);
      setBranches(Array.isArray(branchData) ? branchData : []);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load inventory data:', e);
      api.toast('Failed to load inventory: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  const warehouses = useMemo(() => {
    const list = [];
    const seen = new Set();
    inventory.forEach((it) => {
      if (it.warehouse_id && !seen.has(it.warehouse_id)) {
        seen.add(it.warehouse_id);
        list.push({
          id: it.warehouse_id,
          name: it.warehouse_name,
          branch_id: it.branch_id,
          branch_name: it.branch_name,
        });
      }
    });
    return list;
  }, [inventory]);

  const categories = useMemo(() => {
    const set = new Set(inventory.map((it) => it.category_name || it.category).filter(Boolean));
    return Array.from(set).sort();
  }, [inventory]);

  const totals = useMemo(() => {
    return inventory.reduce(
      (acc, it) => ({
        onHand: acc.onHand + (Number(it.quantity_on_hand) || 0),
        available: acc.available + (Number(it.quantity_available) || 0),
        reserved: acc.reserved + (Number(it.quantity_reserved) || 0),
        inTransit: acc.inTransit + (Number(it.quantity_in_transit) || 0),
        damaged: acc.damaged + (Number(it.quantity_damaged) || 0),
        expired: acc.expired + (Number(it.quantity_expired) || 0),
      }),
      { onHand: 0, available: 0, reserved: 0, inTransit: 0, damaged: 0, expired: 0 }
    );
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((it) => {
      if (selectedWarehouseId && String(it.warehouse_id) !== String(selectedWarehouseId)) return false;
      if (selectedCategory !== 'ALL' && (it.category_name || it.category) !== selectedCategory) return false;

      if (stateFilter === 'LOW_STOCK' && (it.quantity_available ?? 0) > (it.reorder_threshold ?? 10)) return false;
      if (stateFilter === 'DAMAGED' && (it.quantity_damaged ?? 0) <= 0) return false;
      if (stateFilter === 'EXPIRED' && (it.quantity_expired ?? 0) <= 0) return false;
      if (stateFilter === 'RESERVED' && (it.quantity_reserved ?? 0) <= 0) return false;
      if (stateFilter === 'IN_TRANSIT' && (it.quantity_in_transit ?? 0) <= 0) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        it.sku?.toLowerCase().includes(q) ||
        it.product_name?.toLowerCase().includes(q) ||
        it.barcode?.toLowerCase().includes(q)
      );
    });
  }, [inventory, selectedWarehouseId, selectedCategory, stateFilter, searchQuery]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <InventoryHeader
        loading={loading}
        lastSyncTime={lastSyncTime}
        onRefresh={() => {
          sound.playScan();
          fetchInventoryData();
        }}
        onOpenTransfer={() => {
          setSelectedItemForTransfer(filteredInventory[0] || null);
          setTransferModalOpen(true);
        }}
        onOpenStateTransition={() => {
          setSelectedItemForTransition(filteredInventory[0] || null);
          setTransitionMode('QUARANTINE');
          setTransitionModalOpen(true);
        }}
      />

      <InventoryKpis totals={totals} />

      <InventoryFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedWarehouseId={selectedWarehouseId}
        setSelectedWarehouseId={setSelectedWarehouseId}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        stateFilter={stateFilter}
        setStateFilter={setStateFilter}
        warehouses={warehouses}
        categories={categories}
        onResetFilters={() => {
          setSearchQuery('');
          setSelectedWarehouseId('');
          setSelectedCategory('ALL');
          setStateFilter('ALL');
        }}
      />

      {activeTab === 'matrix' && (
        <InventoryTable
          loading={loading}
          inventory={filteredInventory}
          onQuarantineItem={(it) => {
            setSelectedItemForTransition(it);
            setTransitionMode('QUARANTINE');
            setTransitionModalOpen(true);
          }}
          onExpireItem={(it) => {
            setSelectedItemForTransition(it);
            setTransitionMode('EXPIRE');
            setTransitionModalOpen(true);
          }}
          onTransferItem={(it) => {
            setSelectedItemForTransfer(it);
            setTransferModalOpen(true);
          }}
          onAdjustItem={(it) => {
            setSelectedItemForTransition(it);
            setTransitionMode('WRITEOFF');
            setTransitionModalOpen(true);
          }}
        />
      )}

      {activeTab === 'movements' && (
        <InventoryLedgerTable loading={loading} movements={movements} />
      )}

      {activeTab === 'transfers' && (
        <InventoryTransfersTable loading={loading} transfers={transfers} onRefresh={fetchInventoryData} />
      )}

      <InventoryStateTransitionModal
        isOpen={transitionModalOpen}
        onClose={() => setTransitionModalOpen(false)}
        item={selectedItemForTransition}
        initialMode={transitionMode}
        onSuccess={fetchInventoryData}
      />

      <InventoryTransferModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        item={selectedItemForTransfer}
        warehouses={warehouses}
        branches={branches}
        onSuccess={fetchInventoryData}
      />
    </div>
  );
}
