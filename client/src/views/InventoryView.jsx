// client/src/views/InventoryView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Package,
  Search,
  Plus,
  Minus,
  RotateCcw,
  ArrowRightLeft,
  AlertTriangle,
  X,
  Building2,
  FileText,
  CheckCircle2,
  Truck,
  ArrowRight,
  ShieldAlert,
  Layers,
  Boxes,
  Check,
  Clock,
  SlidersHorizontal,
  ExternalLink,
  Barcode,
  ArrowDownRight,
  TrendingDown,
  Warehouse,
} from 'lucide-react';

export function InventoryView() {
  const { user, selectedBranch } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix', 'transfers', 'ledger'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustType, setAdjustType] = useState('ADD'); // 'ADD', 'DEDUCT', 'WRITE_OFF'
  const [adjustQty, setAdjustQty] = useState(10);
  const [adjustReason, setAdjustReason] = useState('Stock count discrepancy audit');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Inter-Branch Transfer Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferItem, setTransferItem] = useState(null);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [transferQty, setTransferQty] = useState(5);
  const [transferNotes, setTransferNotes] = useState('Scheduled transit to regional hub');

  const searchInputRef = useRef(null);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const [invData, movData, trfData, branchData] = await Promise.all([
        api.get(`/api/inventory${branchParam}`),
        api.get(`/api/inventory/movements${branchParam}`).catch(() => []),
        api.get(`/api/inventory/transfers${branchParam}`).catch(() => []),
        api.get('/api/branches').catch(() => []),
      ]);

      const items = Array.isArray(invData) ? invData : [];
      setInventory(items);
      setMovements(Array.isArray(movData) ? movData : []);
      setTransfers(Array.isArray(trfData) ? trfData : []);
      setAllBranches(Array.isArray(branchData) ? branchData : []);

      // Extract unique warehouses
      const whs = [];
      const seen = new Set();
      items.forEach((it) => {
        if (it.warehouse_id && !seen.has(it.warehouse_id)) {
          seen.add(it.warehouse_id);
          whs.push({
            id: it.warehouse_id,
            name: it.warehouse_name,
            code: it.warehouse_code,
            branch_id: it.branch_id,
            branch_name: it.branch_name,
          });
        }
      });
      setWarehouses(whs);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load inventory data:', e);
      api.toast('Failed to load inventory data: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, [selectedBranch]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        sound.playScan();
      }
      if (e.key === 'Escape') {
        setAdjustModalOpen(false);
        setTransferModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle stock adjustment submit
  const handleAdjustStock = async () => {
    if (!adjustItem || !adjustQty || adjustQty <= 0) {
      api.toast('Please enter a valid adjustment quantity', 'error');
      sound.playError();
      return;
    }

    try {
      const res = await api.post('/api/inventory/adjust', {
        warehouse_id: adjustItem.warehouse_id,
        product_id: adjustItem.product_id,
        adjustment_type: adjustType,
        quantity: Number(adjustQty),
        reason: adjustReason,
        notes: adjustNotes,
      });

      sound.playSuccess();
      api.toast(res.message || `Adjusted ${adjustItem.product_name} by ${adjustType === 'ADD' ? '+' : '-'}${adjustQty}`, 'success');
      setAdjustModalOpen(false);
      setAdjustItem(null);
      fetchInventoryData();
    } catch (e) {
      sound.playError();
      api.toast(`Adjustment failed: ${e.message}`, 'error');
    }
  };

  // Handle transfer submit
  const handleTransferStock = async () => {
    if (!transferItem || !targetWarehouseId || !transferQty || transferQty <= 0) {
      api.toast('Please select destination warehouse and valid quantity', 'error');
      sound.playError();
      return;
    }

    try {
      const srcWh = warehouses.find((w) => w.id === (sourceWarehouseId ? Number(sourceWarehouseId) : transferItem.warehouse_id)) || transferItem;
      const targetWh = warehouses.find((w) => w.id === Number(targetWarehouseId));

      await api.post('/api/inventory/transfers', {
        source_branch_id: srcWh.branch_id || selectedBranch?.id || 1,
        source_warehouse_id: srcWh.id || transferItem.warehouse_id,
        target_branch_id: targetWh?.branch_id || Number(targetBranchId) || 1,
        target_warehouse_id: Number(targetWarehouseId),
        items: [{ product_id: transferItem.product_id, quantity: Number(transferQty) }],
        notes: transferNotes,
      });

      sound.playSuccess();
      api.toast(`Transfer request initiated for ${transferQty} units of ${transferItem.product_name}`, 'success');
      setTransferModalOpen(false);
      setTransferItem(null);
      fetchInventoryData();
    } catch (e) {
      sound.playError();
      api.toast(`Transfer failed: ${e.message}`, 'error');
    }
  };

  // Progress transfer state (APPROVE, DISPATCH, RECEIVE, REJECT)
  const handleTransferAction = async (transferId, action) => {
    try {
      const res = await api.post(`/api/inventory/transfers/${transferId}/status`, { action });
      if (action === 'RECEIVE') {
        sound.playSuccess();
        api.toast(`Stock transfer successfully received into depot!`, 'success');
      } else {
        sound.playScan();
        api.toast(res.message || `Transfer state updated to ${action}`, 'success');
      }
      fetchInventoryData();
    } catch (e) {
      sound.playError();
      api.toast(`Transfer action failed: ${e.message}`, 'error');
    }
  };

  // Categories list
  const categories = ['ALL', ...Array.from(new Set(inventory.map((i) => i.category_name).filter(Boolean)))];

  // Filtered inventory list
  const filteredItems = inventory.filter((item) => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.warehouse_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesWh =
      !selectedWarehouseId || item.warehouse_id === Number(selectedWarehouseId);

    const matchesCat =
      selectedCategory === 'ALL' || item.category_name === selectedCategory;

    const matchesLow =
      !showOnlyLowStock || item.quantity_on_hand <= (item.min_stock_alert || 10);

    return matchesSearch && matchesWh && matchesCat && matchesLow;
  });

  // Telemetry KPIs
  const totalSkus = inventory.length;
  const totalUnits = inventory.reduce((sum, i) => sum + (i.quantity_on_hand || 0), 0);
  const totalValuation = inventory.reduce((sum, i) => sum + ((i.quantity_on_hand || 0) * (i.selling_price || 0)), 0);
  const lowStockCount = inventory.filter((i) => (i.quantity_on_hand || 0) <= (i.min_stock_alert || 10)).length;
  const inTransitTransfersCount = transfers.filter((t) => t.status === 'IN_TRANSIT').length;

  return (
    <div className="space-y-4">
      {/* 1. TOP OPERATIONAL INSTRUMENT CONSOLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-blue-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Warehouse Inventory & Stock Logistics
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono text-slate-400">
                  DEPOT // MULTI-BRANCH
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                STATION: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'All Regional Hubs'}</span>
                <span className="mx-2 text-[#222834]">|</span>
                LEDGER: <span className="text-emerald-400 font-bold">IMMUTABLE SQL VERIFIED</span>
                {lastSyncTime && <span className="ml-1 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
              </p>
            </div>
          </div>

          {/* Action & View Switcher */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex bg-[#0c0e12] p-0.5 rounded border border-[#222834] text-xs font-mono">
              <button
                onClick={() => {
                  setActiveTab('matrix');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'matrix'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Boxes className="w-3.5 h-3.5 text-blue-400" />
                <span>STOCK MATRIX ({totalSkus})</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('transfers');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'transfers'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>TRANSFERS ({transfers.length})</span>
                {inTransitTransfersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[10px] tabular-nums">
                    {inTransitTransfersCount} Transit
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('ledger');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'ledger'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>AUDIT LEDGER</span>
              </button>
            </div>

            <button
              onClick={() => {
                fetchInventoryData();
                sound.playScan();
              }}
              disabled={loading}
              className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh warehouse stock ledger"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
              <span>SYNC</span>
            </button>
          </div>
        </div>

        {/* 2. UNIFIED HARDWARE TELEMETRY STRIP (Dieter Rams Matrix) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Tracked SKUs</span>
              <span className="text-lg font-mono font-bold text-slate-100 tabular-nums">{totalSkus}</span>
            </div>
            <Barcode className="w-4 h-4 text-slate-600" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block">Total Inventory Value</span>
              <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
                {api.formatKES(totalValuation)}
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-blue-400 font-mono uppercase tracking-wider block">Total Units Available</span>
              <span className="text-lg font-mono font-bold text-blue-400 tabular-nums">{totalUnits}</span>
            </div>
            <Boxes className="w-4 h-4 text-blue-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-rose-400 font-mono uppercase tracking-wider block">Reorder Deficits</span>
              <span className="text-lg font-mono font-bold text-rose-400 tabular-nums">{lowStockCount}</span>
            </div>
            <AlertTriangle className={`w-4 h-4 ${lowStockCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-600'}`} />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider block">Transit Transfers</span>
              <span className="text-lg font-mono font-bold text-cyan-400 tabular-nums">{inTransitTransfersCount}</span>
            </div>
            <Truck className="w-4 h-4 text-cyan-400" />
          </div>
        </div>

        {/* 3. SWITCHBOARD CONTROLS & FILTER BAR */}
        {activeTab === 'matrix' && (
          <div className="pt-2 border-t border-[#222834] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU, barcode, item name, warehouse... [F2]"
                className="w-full pl-8 pr-8 py-1.5 bg-[#0c0e12] border border-[#222834] focus:border-blue-500/60 rounded text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Segmented Filter Pills */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Warehouse Filter */}
              <select
                value={selectedWarehouseId}
                onChange={(e) => {
                  setSelectedWarehouseId(e.target.value);
                  sound.playScan();
                }}
                className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">ALL WAREHOUSES ({warehouses.length})</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code || 'DEPOT'})
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  sound.playScan();
                }}
                className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'ALL CATEGORIES' : c}
                  </option>
                ))}
              </select>

              {/* Low Stock Toggle */}
              <button
                onClick={() => {
                  setShowOnlyLowStock(!showOnlyLowStock);
                  sound.playScan();
                }}
                className={`px-2.5 py-1.5 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  showOnlyLowStock
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>DEFICITS ONLY ({lowStockCount})</span>
              </button>

              {(searchQuery || selectedWarehouseId || selectedCategory !== 'ALL' || showOnlyLowStock) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedWarehouseId('');
                    setSelectedCategory('ALL');
                    setShowOnlyLowStock(false);
                    sound.playScan();
                  }}
                  className="px-2 py-1.5 rounded bg-[#181d28] hover:bg-rose-500/20 border border-[#222834] hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-[10px] font-mono cursor-pointer transition-colors"
                >
                  RESET
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. TAB 1: STOCK MATRIX VIEW */}
      {activeTab === 'matrix' && (
        <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                  <th className="p-3">SKU & Product Identification</th>
                  <th className="p-3">Warehouse Hub</th>
                  <th className="p-3 text-right">Available</th>
                  <th className="p-3 text-right">Reserved</th>
                  <th className="p-3 text-right">Threshold</th>
                  <th className="p-3">Health Status</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Total Valuation</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222834]">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-500 font-mono">
                      <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      <span>No stock records matching the current filter parameters.</span>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const onHand = item.quantity_on_hand ?? 0;
                    const reserved = item.quantity_reserved ?? 0;
                    const available = item.quantity_available ?? Math.max(0, onHand - reserved);
                    const threshold = item.min_stock_alert ?? 10;
                    const isDeficit = onHand <= threshold;
                    const lineValuation = onHand * (item.selling_price || 0);

                    // Ratio for capacity bar
                    const ratio = Math.min(100, Math.round((onHand / (threshold * 3)) * 100));

                    return (
                      <tr key={`${item.warehouse_id}-${item.product_id}`} className="hover:bg-[#181d28]/40 transition-colors">
                        {/* SKU & Identification */}
                        <td className="p-3">
                          <div className="font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{item.product_name}</span>
                            {item.category_name && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#181d28] border border-[#222834] text-slate-400 font-normal">
                                {item.category_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="text-blue-400 font-semibold">{item.sku}</span>
                            {item.barcode && (
                              <span className="text-slate-500 flex items-center gap-1">
                                <Barcode className="w-3 h-3" />
                                {item.barcode}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Warehouse Hub */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Building2 className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="font-semibold">{item.warehouse_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            {item.branch_name || 'Central Hub'}
                          </span>
                        </td>

                        {/* Available */}
                        <td className="p-3 text-right">
                          <span className="text-sm font-bold text-slate-100 tabular-nums">
                            {available}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-1">{item.unit || 'pcs'}</span>
                        </td>

                        {/* Reserved */}
                        <td className="p-3 text-right text-slate-400 tabular-nums">
                          {reserved > 0 ? (
                            <span className="text-amber-400 font-bold">{reserved}</span>
                          ) : (
                            <span>0</span>
                          )}
                        </td>

                        {/* Safety Threshold */}
                        <td className="p-3 text-right text-slate-400 tabular-nums">
                          {threshold}
                        </td>

                        {/* Health Status & Progress Bar */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 ${
                                isDeficit
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              <span className={`w-1 h-1 rounded-full ${isDeficit ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                              {isDeficit ? 'REORDER' : 'HEALTHY'}
                            </span>
                          </div>
                          <div className="w-20 bg-[#0c0e12] rounded h-1 border border-[#222834] mt-1.5 overflow-hidden">
                            <div
                              className={`h-full ${isDeficit ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.max(8, ratio)}%` }}
                            />
                          </div>
                        </td>

                        {/* Unit Price */}
                        <td className="p-3 text-right text-slate-300 tabular-nums">
                          {api.formatKES(item.selling_price)}
                        </td>

                        {/* Total Line Valuation */}
                        <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">
                          {api.formatKES(lineValuation)}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setAdjustItem(item);
                                setAdjustType('ADD');
                                setAdjustQty(10);
                                setAdjustReason('Stock count discrepancy audit');
                                setAdjustNotes('');
                                setAdjustModalOpen(true);
                                sound.playScan();
                              }}
                              className="px-2 py-1 rounded bg-[#0c0e12] hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 border border-[#222834] hover:border-blue-500/40 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Submit Stock Count Adjustment"
                            >
                              ADJUST
                            </button>

                            <button
                              onClick={() => {
                                setTransferItem(item);
                                setSourceWarehouseId(String(item.warehouse_id));
                                setTargetWarehouseId(
                                  warehouses.find((w) => w.id !== item.warehouse_id)?.id ? String(warehouses.find((w) => w.id !== item.warehouse_id).id) : ''
                                );
                                setTransferQty(Math.min(10, Math.max(1, available)));
                                setTransferModalOpen(true);
                                sound.playScan();
                              }}
                              className="px-2 py-1 rounded bg-[#0c0e12] hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 border border-[#222834] hover:border-indigo-500/40 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Transfer to Another Hub"
                            >
                              TRANSFER
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
        </div>
      )}

      {/* 5. TAB 2: INTER-BRANCH STOCK TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#222834] pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                Inter-Branch Stock Transfers & Replenishment Pipeline
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Logistics transfers moving between Nairobi Central, Mombasa Port, and Kisumu Depots
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono font-bold tabular-nums">
              {transfers.length} TRANSFER ORDERS
            </span>
          </div>

          {transfers.length === 0 ? (
            <div className="border border-dashed border-[#222834] rounded p-12 text-center space-y-2">
              <Truck className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                No Inter-Branch Transfers Pending
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Initiate a stock transfer from the Stock Matrix to stage inventory moves between regional hubs.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((trf) => {
                const isPending = trf.status === 'PENDING_APPROVAL';
                const isApproved = trf.status === 'APPROVED';
                const isInTransit = trf.status === 'IN_TRANSIT';
                const isReceived = trf.status === 'RECEIVED';

                return (
                  <div
                    key={trf.id}
                    className="bg-[#0c0e12] border border-[#222834] rounded p-4 space-y-3 transition-colors hover:border-slate-700"
                  >
                    {/* Transfer Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222834] pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-bold text-indigo-400">
                          {trf.transfer_number}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                          <span className="font-semibold">{trf.source_warehouse_name || trf.source_branch_name}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-semibold text-emerald-400">{trf.target_warehouse_name || trf.target_branch_name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1 ${
                            isReceived
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : isInTransit
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                              : isApproved
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isReceived ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                          {trf.status?.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(trf.created_at).toLocaleDateString('en-KE')}
                        </span>
                      </div>
                    </div>

                    {/* Transfer Manifest Cargo Items */}
                    <div className="bg-[#12161f] border border-[#222834] rounded p-3">
                      <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1 font-bold">
                        CARGO MANIFEST ITEMS:
                      </span>
                      <div className="space-y-1">
                        {trf.items && trf.items.length > 0 ? (
                          trf.items.map((it) => (
                            <div key={it.id} className="flex justify-between text-xs font-mono text-slate-300">
                              <span className="font-semibold">{it.quantity_requested}x {it.product_name}</span>
                              <span className="text-slate-500 text-[10px]">{it.sku}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 font-mono italic">Manifest details pending</span>
                        )}
                      </div>
                      {trf.notes && (
                        <p className="text-[10px] text-slate-400 font-mono mt-2 pt-1 border-t border-[#222834] italic">
                          Notes: {trf.notes}
                        </p>
                      )}
                    </div>

                    {/* Operational Action Controls */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500 font-mono">
                        Requested by: {trf.requested_by_name || 'Station Manager'}
                      </span>

                      <div className="flex gap-2">
                        {isPending && (
                          <button
                            onClick={() => handleTransferAction(trf.id, 'APPROVE')}
                            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Approve Transfer
                          </button>
                        )}

                        {(isPending || isApproved) && (
                          <button
                            onClick={() => handleTransferAction(trf.id, 'DISPATCH')}
                            className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Dispatch Transit</span>
                          </button>
                        )}

                        {isInTransit && (
                          <button
                            onClick={() => handleTransferAction(trf.id, 'RECEIVE')}
                            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-950"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm & Receive Stock</span>
                          </button>
                        )}

                        {isReceived && (
                          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            TRANSFERRED & STOCKED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 3: AUDIT MOVEMENT LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#222834] pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Immutable Stock Movement Audit Ledger
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Cryptographic transaction log of all SKU stock delta variations, sales, and warehouse relocations
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              TRIGGER PROTECTED
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">SKU & Product</th>
                  <th className="p-3">Warehouse Hub</th>
                  <th className="p-3">Movement Type</th>
                  <th className="p-3 text-right">Delta Change</th>
                  <th className="p-3 text-right">Previous Qty</th>
                  <th className="p-3 text-right">New Qty</th>
                  <th className="p-3">Audit Reason</th>
                  <th className="p-3 text-right">User Stamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222834]">
                {movements.map((mov) => {
                  const isPositive = (mov.quantity_change ?? mov.quantity_delta) > 0;
                  const delta = mov.quantity_change ?? mov.quantity_delta;

                  return (
                    <tr key={mov.id} className="hover:bg-[#181d28]/40 transition-colors">
                      <td className="p-3 text-slate-400 font-mono text-[10px]">
                        {new Date(mov.created_at).toLocaleString('en-KE')}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-200 block">{mov.product_name}</span>
                        <span className="text-slate-500 text-[10px]">{mov.sku}</span>
                      </td>
                      <td className="p-3 text-slate-300">{mov.warehouse_name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-[#0c0e12] border border-[#222834] text-slate-300">
                          {mov.movement_type}
                        </span>
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-bold tabular-nums ${
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPositive ? `+${delta}` : delta}
                      </td>
                      <td className="p-3 text-right text-slate-500 tabular-nums">
                        {mov.previous_quantity ?? '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-200 tabular-nums">
                        {mov.new_quantity ?? '-'}
                      </td>
                      <td className="p-3 text-slate-400 italic max-w-xs truncate">
                        {mov.reason || 'Standard operational adjustment'}
                      </td>
                      <td className="p-3 text-right text-slate-400 text-[10px]">
                        {mov.user_full_name || mov.username || 'System Engine'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. STOCK ADJUSTMENT MODAL */}
      {adjustModalOpen && adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setAdjustModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider font-bold">
                AUDIT // STOCK ADJUSTMENT
              </span>
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-400" />
                {adjustItem.product_name}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Hub: <strong className="text-slate-200">{adjustItem.warehouse_name}</strong> • Current on hand:{' '}
                <span className="text-emerald-400 font-bold tabular-nums">{adjustItem.quantity_on_hand}</span>
              </p>
            </div>

            <div className="space-y-3.5 text-xs font-mono">
              {/* Adjustment Direction Segmented Switch */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Adjustment Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADD')}
                    className={`py-2 rounded font-bold text-[11px] flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                      adjustType === 'ADD'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#0c0e12] border-[#222834] text-slate-400'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" /> ADD
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('DEDUCT')}
                    className={`py-2 rounded font-bold text-[11px] flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                      adjustType === 'DEDUCT'
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                        : 'bg-[#0c0e12] border-[#222834] text-slate-400'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" /> DEDUCT
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('WRITE_OFF')}
                    className={`py-2 rounded font-bold text-[11px] flex items-center justify-center gap-1 border transition-colors cursor-pointer ${
                      adjustType === 'WRITE_OFF'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-[#0c0e12] border-[#222834] text-slate-400'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> WRITE OFF
                  </button>
                </div>
              </div>

              {/* Quantity input with fast increment pills */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Quantity Delta *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    className="flex-1 px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-1">
                    {[1, 5, 10, 25].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAdjustQty(amt)}
                        className="px-2 py-1.5 rounded bg-[#181d28] hover:bg-[#222834] border border-[#222834] text-slate-300 text-[10px] font-mono cursor-pointer"
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Audit Reason *
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Stock count discrepancy audit">Stock count discrepancy audit</option>
                  <option value="Damaged / expired goods write-off">Damaged / expired goods write-off</option>
                  <option value="Supplier restock receipt discrepancy">Supplier restock receipt discrepancy</option>
                  <option value="Internal test / demonstration use">Internal test / demonstration use</option>
                  <option value="Customer return restock">Customer return restock</option>
                  <option value="Other audited variation">Other audited variation</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Audit Notes / Approver Reference
                </label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Verified by station manager on physical count"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 flex gap-2.5">
                <button
                  onClick={handleAdjustStock}
                  className="flex-1 py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-blue-900/30 transition-colors cursor-pointer"
                >
                  Commit Adjustment
                </button>
                <button
                  onClick={() => setAdjustModalOpen(false)}
                  className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. INTER-BRANCH TRANSFER MODAL */}
      {transferModalOpen && transferItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setTransferModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider font-bold">
                LOGISTICS // INTER-BRANCH TRANSFER
              </span>
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                Transfer {transferItem.product_name}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Source Depot: <strong className="text-slate-200">{transferItem.warehouse_name}</strong> • Available:{' '}
                <span className="text-emerald-400 font-bold tabular-nums">{transferItem.quantity_on_hand}</span>
              </p>
            </div>

            <div className="space-y-3.5 text-xs font-mono">
              {/* Destination Warehouse */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Destination Regional Depot *
                </label>
                <select
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- Choose Target Depot --</option>
                  {warehouses
                    .filter((w) => w.id !== transferItem.warehouse_id)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.branch_name || 'Regional Hub'})
                      </option>
                    ))}
                </select>
              </div>

              {/* Transfer Quantity */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Transfer Quantity * (Max: {transferItem.quantity_on_hand})
                </label>
                <input
                  type="number"
                  min="1"
                  max={transferItem.quantity_on_hand}
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Transit Details */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Logistics Transit Route & Vehicle
                </label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Scheduled Isuzu NPR transit trunk line"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2.5">
                <button
                  onClick={handleTransferStock}
                  className="flex-1 py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-indigo-900/30 transition-colors cursor-pointer"
                >
                  Initiate Transfer Order
                </button>
                <button
                  onClick={() => setTransferModalOpen(false)}
                  className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
