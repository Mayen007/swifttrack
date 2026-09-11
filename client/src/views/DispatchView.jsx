// client/src/views/DispatchView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Truck,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Phone,
  ArrowRight,
  Search,
  RefreshCw,
  Filter,
  ShieldAlert,
  Navigation,
  ChevronRight,
  RotateCcw,
  FileText,
  Check,
  Users,
  Radio,
  Layers,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export function DispatchView() {
  const { selectedBranch } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [summary, setSummary] = useState({
    total_active: 0,
    ready_count: 0,
    in_transit_count: 0,
    delivered_count: 0,
    failed_count: 0,
  });
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Filters and Navigation
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL'); // ALL, NORMAL, HIGH, URGENT
  const [driverFilter, setDriverFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('KANBAN'); // KANBAN, FLEET, EXCEPTIONS

  // Assign Courier Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleNotes, setVehicleNotes] = useState('Toyota HiAce (KDA 482B)');
  const [assignPriority, setAssignPriority] = useState('NORMAL');
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Delivery Failure / Exception Modal State
  const [failModalOpen, setFailModalOpen] = useState(false);
  const [failDelivery, setFailDelivery] = useState(null);
  const [failureReason, setFailureReason] = useState('Customer Unreachable / Phone Off');
  const [failureNotes, setFailureNotes] = useState('');
  const [initiateReturn, setInitiateReturn] = useState(true);

  // Manifest Detail Inspector Modal State
  const [inspectDelivery, setInspectDelivery] = useState(null);

  const searchInputRef = useRef(null);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const [boardRes, drvData] = await Promise.all([
        api.get(`/api/dispatch/board${branchParam}`).catch(() => null),
        api.get('/api/users?role=DRIVER').catch(() => []),
      ]);

      let allItems = [];
      if (boardRes && boardRes.board) {
        allItems = [
          ...(boardRes.board.READY_FOR_DISPATCH || []),
          ...(boardRes.board.ASSIGNED || []),
          ...(boardRes.board.PICKED_UP || []),
          ...(boardRes.board.IN_TRANSIT || []),
          ...(boardRes.board.DELIVERED || []),
          ...(boardRes.board.FAILED || []),
        ];
      } else if (Array.isArray(boardRes)) {
        allItems = boardRes;
      }

      setDeliveries(allItems);
      setDrivers(boardRes?.drivers || (Array.isArray(drvData) ? drvData : []));
      setVehicles(boardRes?.vehicles || []);
      if (boardRes?.summary) {
        setSummary(boardRes.summary);
      } else {
        setSummary({
          total_active: allItems.filter((d) => ['READY_FOR_DISPATCH', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(d.status)).length,
          ready_count: allItems.filter((d) => ['READY_FOR_DISPATCH', 'PENDING_ASSIGNMENT'].includes(d.status)).length,
          in_transit_count: allItems.filter((d) => d.status === 'IN_TRANSIT').length,
          delivered_count: allItems.filter((d) => ['DELIVERED', 'COMPLETED'].includes(d.status)).length,
          failed_count: allItems.filter((d) => ['FAILED', 'RETURN_TO_BRANCH', 'RETURN_RECEIVED'].includes(d.status)).length,
        });
      }
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load dispatch board:', e);
      api.toast('Failed to load dispatch board: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
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
        setAssignModalOpen(false);
        setFailModalOpen(false);
        setInspectDelivery(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Open Courier Assignment Modal
  const openAssignModal = (delivery) => {
    setSelectedDelivery(delivery);
    setSelectedDriverId(drivers[0]?.id ? String(drivers[0].id) : '');
    setSelectedVehicleId(vehicles[0]?.id ? String(vehicles[0].id) : '');
    setVehicleNotes(delivery.vehicle_details || vehicles[0]?.registration_number || 'Toyota HiAce (KDA 482B)');
    setAssignPriority(delivery.priority || 'NORMAL');
    setDispatchNotes('');
    setAssignModalOpen(true);
  };

  // Submit Driver Assignment
  const handleAssignDriver = async () => {
    if (!selectedDelivery || !selectedDriverId) {
      api.toast('Please choose a driver to assign', 'error');
      sound.playError();
      return;
    }

    try {
      await api.post('/api/dispatch/assign', {
        delivery_id: selectedDelivery.id,
        driver_id: Number(selectedDriverId),
        vehicle_id: selectedVehicleId ? Number(selectedVehicleId) : undefined,
        vehicle_details: vehicleNotes,
        priority: assignPriority,
        notes: dispatchNotes,
      });

      sound.playSuccess();
      api.toast(`Assigned ${selectedDelivery.delivery_number} to courier`, 'success');
      setAssignModalOpen(false);
      setSelectedDelivery(null);
      fetchDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Assignment failed: ${e.message}`, 'error');
    }
  };

  // Advance Delivery Stage
  const handleAdvanceStatus = async (delivery, nextStatus) => {
    try {
      await api.put(`/api/dispatch/${delivery.id}/status`, {
        status: nextStatus,
      });
      if (nextStatus === 'DELIVERED') {
        sound.playSuccess();
        api.toast(`Delivery #${delivery.delivery_number} marked DELIVERED (POD Verified)`, 'success');
      } else {
        sound.playScan();
        api.toast(`Status updated to ${nextStatus.replace(/_/g, ' ')}`, 'success');
      }
      fetchDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Update failed: ${e.message}`, 'error');
    }
  };

  // Update Delivery Priority
  const handleUpdatePriority = async (delivery, newPriority) => {
    try {
      await api.patch(`/api/dispatch/${delivery.id}/priority`, {
        priority: newPriority,
      });
      sound.playScan();
      api.toast(`Priority set to ${newPriority}`, 'success');
      fetchDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Failed to update priority: ${e.message}`, 'error');
    }
  };

  // Open Exception / Failure Modal
  const openFailModal = (delivery) => {
    setFailDelivery(delivery);
    setFailureReason('Customer Unreachable / Phone Off');
    setFailureNotes('');
    setInitiateReturn(true);
    setFailModalOpen(true);
  };

  // Submit Failure / Return
  const handleSubmitFailure = async () => {
    if (!failDelivery) return;

    try {
      await api.post(`/api/dispatch/${failDelivery.id}/fail`, {
        failure_reason: failureReason,
        failure_notes: failureNotes,
        initiate_return: initiateReturn,
      });

      sound.playError();
      api.toast(
        `Delivery #${failDelivery.delivery_number} logged as ${initiateReturn ? 'RETURN_TO_BRANCH' : 'FAILED'}`,
        'warning'
      );
      setFailModalOpen(false);
      setFailDelivery(null);
      fetchDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Operation failed: ${e.message}`, 'error');
    }
  };

  // Re-queue failed delivery back to READY_FOR_DISPATCH
  const handleRequeueDelivery = async (delivery) => {
    try {
      await api.put(`/api/dispatch/${delivery.id}/status`, {
        status: 'READY_FOR_DISPATCH',
      });
      sound.playSuccess();
      api.toast(`Delivery #${delivery.delivery_number} returned to Ready queue`, 'success');
      fetchDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Re-queue failed: ${e.message}`, 'error');
    }
  };

  // Filtered deliveries list
  const filteredDeliveries = deliveries.filter((item) => {
    // Priority filter
    if (priorityFilter !== 'ALL' && (item.priority || 'NORMAL') !== priorityFilter) {
      return false;
    }
    // Driver filter
    if (driverFilter !== 'ALL' && String(item.driver_id) !== String(driverFilter)) {
      return false;
    }
    // Text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = item.delivery_number?.toLowerCase().includes(q);
      const matchOrder = item.order_number?.toLowerCase().includes(q);
      const matchRecipient = item.recipient_name?.toLowerCase().includes(q);
      const matchPhone = item.recipient_phone?.toLowerCase().includes(q);
      const matchAddress = item.delivery_address?.toLowerCase().includes(q);
      const matchCity = item.delivery_city?.toLowerCase().includes(q);
      const matchDriver = item.driver_name?.toLowerCase().includes(q);
      const matchVehicle = item.vehicle_reg?.toLowerCase().includes(q) || item.vehicle_details?.toLowerCase().includes(q);

      if (!matchNumber && !matchOrder && !matchRecipient && !matchPhone && !matchAddress && !matchCity && !matchDriver && !matchVehicle) {
        return false;
      }
    }
    return true;
  });

  // Kanban Stage Columns Specification (Dieter Rams Telemetry Standards)
  const columns = [
    {
      id: 'READY_FOR_DISPATCH',
      label: 'Ready for Dispatch',
      code: 'STG-01',
      accentColor: 'border-blue-500',
      tagColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      dotColor: 'bg-blue-500',
      description: 'Order picked & packed, awaiting courier allocation',
    },
    {
      id: 'ASSIGNED',
      label: 'Courier Allocated',
      code: 'STG-02',
      accentColor: 'border-indigo-500',
      tagColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      dotColor: 'bg-indigo-500',
      description: 'Courier assigned, awaiting hub pickup confirmation',
    },
    {
      id: 'PICKED_UP',
      label: 'Hub Departure',
      code: 'STG-03',
      accentColor: 'border-amber-500',
      tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      dotColor: 'bg-amber-500',
      description: 'Package in courier possession, staging for transit',
    },
    {
      id: 'IN_TRANSIT',
      label: 'Active Road Transit',
      code: 'STG-04',
      accentColor: 'border-cyan-500',
      tagColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      dotColor: 'bg-cyan-500',
      description: 'En route to recipient destination address',
    },
    {
      id: 'DELIVERED',
      label: 'Delivered (POD)',
      code: 'STG-05',
      accentColor: 'border-emerald-500',
      tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      dotColor: 'bg-emerald-500',
      description: 'Recipient verified, proof of delivery logged',
    },
  ];

  // Failed / Exceptions Count
  const exceptionItems = filteredDeliveries.filter((d) =>
    ['FAILED', 'RETURN_TO_BRANCH', 'RETURN_RECEIVED'].includes(d.status)
  );

  return (
    <div className="space-y-4">
      {/* 1. TOP OPERATIONAL INSTRUMENT CONSOLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Truck className="w-4 h-4" />
              </span>
              <div>
                <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                  Fleet Dispatch & Manifest Pipeline
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-[#181d28] border border-[#222834] text-slate-400">
                    CONSOLE // V2.4
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  HUB: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'Nairobi Central Distribution Hub'}</span>
                  <span className="mx-2 text-[#222834]">|</span>
                  TELEMETRY: <span className="text-emerald-400 font-bold">100% LIVE SYNC</span>
                  {lastSyncTime && <span className="ml-1 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Action & View Switchboard */}
          <div className="flex items-center flex-wrap gap-2">
            {/* View Mode Segmented Switch */}
            <div className="flex bg-[#0c0e12] p-0.5 rounded border border-[#222834] text-xs font-mono">
              <button
                onClick={() => {
                  setActiveTab('KANBAN');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'KANBAN'
                    ? 'bg-[#181d28] text-white border border-[#222834] shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                PIPELINE ({filteredDeliveries.length})
              </button>

              <button
                onClick={() => {
                  setActiveTab('FLEET');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'FLEET'
                    ? 'bg-[#181d28] text-white border border-[#222834] shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                COURIERS ({drivers.length})
              </button>

              <button
                onClick={() => {
                  setActiveTab('EXCEPTIONS');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'EXCEPTIONS'
                    ? 'bg-[#181d28] text-white border border-[#222834] shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                EXCEPTIONS ({exceptionItems.length})
              </button>
            </div>

            {/* Quick Refresh Button */}
            <button
              onClick={() => {
                fetchDeliveries();
                sound.playScan();
              }}
              disabled={loading}
              className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Reload pipeline data"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
              <span>SYNC</span>
            </button>
          </div>
        </div>

        {/* 2. UNIFIED TELEMETRY KPI STRIP (Dieter Rams Modular Matrix) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden mt-3.5">
          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Total Active</span>
              <span className="text-lg font-mono font-bold text-slate-100 tabular-nums">
                {summary.total_active ?? 0}
              </span>
            </div>
            <Truck className="w-4 h-4 text-slate-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-blue-400 font-mono uppercase tracking-wider block">Ready (Unassigned)</span>
              <span className="text-lg font-mono font-bold text-blue-400 tabular-nums">
                {summary.ready_count ?? 0}
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider block">In Road Transit</span>
              <span className="text-lg font-mono font-bold text-cyan-400 tabular-nums">
                {summary.in_transit_count ?? 0}
              </span>
            </div>
            <Navigation className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block">Delivered Today</span>
              <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
                {summary.delivered_count ?? 0}
              </span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <span className="text-[10px] text-rose-400 font-mono uppercase tracking-wider block">Exceptions / Returns</span>
              <span className="text-lg font-mono font-bold text-rose-400 tabular-nums">
                {summary.failed_count ?? 0}
              </span>
            </div>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
        </div>

        {/* 3. CONTROL SWITCHBOARD: SEARCH & FILTER BAR */}
        <div className="mt-3.5 pt-3 border-t border-[#222834] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search manifest #, recipient, phone, destination, driver... [F2]"
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

          {/* Filter Pills */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Priority Filter */}
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <span className="text-slate-500 uppercase text-[10px] mr-1 hidden sm:inline">Priority:</span>
              {['ALL', 'NORMAL', 'HIGH', 'URGENT'].map((prio) => (
                <button
                  key={prio}
                  onClick={() => {
                    setPriorityFilter(prio);
                    sound.playScan();
                  }}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                    priorityFilter === prio
                      ? prio === 'URGENT'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : prio === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-slate-200'
                  }`}
                >
                  {prio}
                </button>
              ))}
            </div>

            {/* Courier Dropdown Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={driverFilter}
                onChange={(e) => {
                  setDriverFilter(e.target.value);
                  sound.playScan();
                }}
                className="px-2.5 py-1 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">ALL DRIVERS ({drivers.length})</option>
                {drivers.map((drv) => (
                  <option key={drv.id} value={drv.id}>
                    {drv.full_name} ({drv.status === 'AVAILABLE' ? 'AVAIL' : 'ON ROAD'})
                  </option>
                ))}
              </select>

              {(priorityFilter !== 'ALL' || driverFilter !== 'ALL' || searchQuery) && (
                <button
                  onClick={() => {
                    setPriorityFilter('ALL');
                    setDriverFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="px-2 py-1 rounded bg-[#181d28] hover:bg-rose-500/20 border border-[#222834] hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-[10px] font-mono cursor-pointer transition-colors"
                >
                  RESET
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. MAIN WORKSPACE VIEW */}
      {activeTab === 'KANBAN' && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3.5 items-start">
          {columns.map((col) => {
            const colItems = filteredDeliveries.filter((d) => {
              if (col.id === 'DELIVERED') {
                return d.status === 'DELIVERED' || d.status === 'COMPLETED';
              }
              if (col.id === 'READY_FOR_DISPATCH') {
                return d.status === 'READY_FOR_DISPATCH' || d.status === 'PENDING_ASSIGNMENT';
              }
              return d.status === col.id;
            });

            return (
              <div
                key={col.id}
                className="bg-[#12161f] border border-[#222834] rounded flex flex-col max-h-[820px] overflow-hidden"
              >
                {/* Column Instrument Header */}
                <div className={`p-3 border-b border-[#222834] bg-[#0c0e12] border-t-2 ${col.accentColor}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-slate-500">{col.code}</span>
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                        {col.label}
                      </h3>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono font-bold text-slate-300 tabular-nums">
                      {colItems.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono truncate">{col.description}</p>
                </div>

                {/* Column Manifest Queue */}
                <div className="p-2.5 space-y-2.5 overflow-y-auto min-h-[460px] max-h-[720px]">
                  {colItems.length === 0 ? (
                    <div className="border border-dashed border-[#222834] rounded p-8 text-center">
                      <Truck className="w-5 h-5 text-slate-600 mx-auto mb-2 opacity-50" />
                      <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
                        Queue Empty
                      </span>
                      <span className="text-[10px] text-slate-600 block mt-0.5 font-mono">
                        No manifests in {col.code}
                      </span>
                    </div>
                  ) : (
                    colItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#0c0e12] border border-[#222834] hover:border-slate-700 rounded p-3 transition-colors space-y-2.5 relative group"
                      >
                        {/* Manifest Header & Priority */}
                        <div className="flex items-center justify-between gap-1.5">
                          <button
                            onClick={() => setInspectDelivery(item)}
                            className="text-[11px] font-mono font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                            title="Inspect Manifest Details"
                          >
                            <span>{item.delivery_number}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </button>

                          <div className="flex items-center gap-1">
                            {/* Priority Badge */}
                            <span
                              onClick={() => {
                                // Cycle priority on click
                                const nextPrio = item.priority === 'NORMAL' ? 'HIGH' : item.priority === 'HIGH' ? 'URGENT' : 'NORMAL';
                                handleUpdatePriority(item, nextPrio);
                              }}
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase cursor-pointer transition-colors ${
                                item.priority === 'URGENT'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                                  : item.priority === 'HIGH'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  : 'bg-[#181d28] text-slate-400 border border-[#222834] hover:border-slate-600'
                              }`}
                              title="Click to cycle priority"
                            >
                              {item.priority || 'NORMAL'}
                            </span>
                          </div>
                        </div>

                        {/* Recipient & Destination Details */}
                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-100 truncate">{item.recipient_name}</h4>
                            {item.total_amount && (
                              <span className="text-[11px] font-mono font-semibold text-slate-300 tabular-nums">
                                {api.formatKES(item.total_amount)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate" title={`${item.delivery_address}, ${item.delivery_city || ''}`}>
                              {item.delivery_address} {item.delivery_city ? `(${item.delivery_city})` : ''}
                            </span>
                          </div>

                          {item.recipient_phone && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-mono">
                              <Phone className="w-2.5 h-2.5 text-slate-500" />
                              <a
                                href={`tel:${item.recipient_phone}`}
                                className="hover:text-slate-200 transition-colors"
                                title="Call recipient"
                              >
                                {item.recipient_phone}
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Special Delivery Instructions pill (if present) */}
                        {item.special_instructions && (
                          <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-mono flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{item.special_instructions}</span>
                          </div>
                        )}

                        {/* Assigned Driver & Vehicle Details */}
                        {item.driver_name ? (
                          <div className="pt-2 border-t border-[#222834] flex items-center justify-between text-[10px] font-mono">
                            <div className="flex items-center gap-1 text-slate-300">
                              <User className="w-3 h-3 text-indigo-400" />
                              <span className="truncate max-w-[95px] font-semibold">{item.driver_name}</span>
                            </div>
                            <span className="text-slate-500 truncate max-w-[100px]">
                              {item.vehicle_reg || item.vehicle_details || 'Boda Boda'}
                            </span>
                          </div>
                        ) : null}

                        {/* Operational Stage Actions */}
                        <div className="pt-1.5 flex flex-col gap-1.5">
                          {item.status === 'READY_FOR_DISPATCH' && (
                            <button
                              onClick={() => openAssignModal(item)}
                              className="w-full py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <User className="w-3 h-3" />
                              <span>Assign Courier</span>
                            </button>
                          )}

                          {item.status === 'ASSIGNED' && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleAdvanceStatus(item, 'PICKED_UP')}
                                className="flex-1 py-1.5 px-2 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white text-xs font-semibold font-mono border border-indigo-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1"
                              >
                                <span>Mark Picked</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => openAssignModal(item)}
                                className="px-2 py-1.5 rounded bg-[#181d28] hover:bg-slate-700 text-slate-400 hover:text-white border border-[#222834] text-[10px] font-mono cursor-pointer"
                                title="Reassign Courier"
                              >
                                Reassign
                              </button>
                            </div>
                          )}

                          {item.status === 'PICKED_UP' && (
                            <button
                              onClick={() => handleAdvanceStatus(item, 'IN_TRANSIT')}
                              className="w-full py-1.5 px-3 rounded bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-black text-xs font-semibold font-mono border border-amber-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Navigation className="w-3 h-3" />
                              <span>Start Road Transit</span>
                            </button>
                          )}

                          {item.status === 'IN_TRANSIT' && (
                            <div className="space-y-1.5">
                              <button
                                onClick={() => handleAdvanceStatus(item, 'DELIVERED')}
                                className="w-full py-1.5 px-3 rounded bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white text-xs font-bold font-mono border border-emerald-500/40 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Verify Delivery (POD)</span>
                              </button>

                              <button
                                onClick={() => openFailModal(item)}
                                className="w-full py-1 px-2 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-mono transition-colors cursor-pointer flex items-center justify-center gap-1"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>Log Delivery Issue</span>
                              </button>
                            </div>
                          )}

                          {(item.status === 'DELIVERED' || item.status === 'COMPLETED') && (
                            <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[10px] font-mono text-emerald-400">
                              <span className="flex items-center gap-1 font-bold">
                                <ShieldCheck className="w-3 h-3" />
                                POD CONFIRMED
                              </span>
                              <span className="text-slate-500">
                                {item.delivered_at ? new Date(item.delivered_at).toLocaleTimeString('en-KE') : 'VERIFIED'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. FLEET COURIERS ROSTER VIEW */}
      {activeTab === 'FLEET' && (
        <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#222834] pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                Active Fleet Couriers & Workload Roster
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Real-time driver availability, active drops load, and assigned dispatch vehicles
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {drivers.filter((d) => d.status === 'AVAILABLE').length} Available / {drivers.length} Registered
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {drivers.map((drv) => {
              const activeCount = drv.active_deliveries_count ?? 0;
              const isAvail = drv.status === 'AVAILABLE';

              return (
                <div
                  key={drv.id}
                  className="bg-[#0c0e12] border border-[#222834] hover:border-slate-700 rounded p-3.5 space-y-3 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-[#181d28] border border-[#222834] text-slate-300 font-mono font-bold text-xs flex items-center justify-center">
                        {drv.full_name?.substring(0, 2).toUpperCase() || 'DR'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-100">{drv.full_name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{drv.phone || '+254 7XX XXX XXX'}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${
                        isAvail
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isAvail ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                      {drv.status || 'AVAILABLE'}
                    </span>
                  </div>

                  {/* Courier Telemetry Data */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono border-y border-[#222834] py-2">
                    <div>
                      <span className="text-slate-500 text-[10px] block">VEHICLE ASSIGNMENT</span>
                      <span className="text-slate-200 truncate font-semibold">
                        {drv.registration_number || drv.vehicle_type || 'Boda Boda'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">ACTIVE MANIFESTS</span>
                      <span className={`font-bold tabular-nums ${activeCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {activeCount} active drop{activeCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Fast Action */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        setDriverFilter(String(drv.id));
                        setActiveTab('KANBAN');
                        sound.playScan();
                      }}
                      className="flex-1 py-1.5 rounded bg-[#181d28] hover:bg-[#222834] text-slate-300 text-[11px] font-mono font-semibold border border-[#222834] transition-colors cursor-pointer"
                    >
                      View Assigned Pipeline
                    </button>
                    {drv.phone && (
                      <a
                        href={`tel:${drv.phone}`}
                        className="p-1.5 rounded bg-[#181d28] hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-300 border border-[#222834] transition-colors"
                        title="Call courier directly"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. EXCEPTIONS & RETURNS VIEW */}
      {activeTab === 'EXCEPTIONS' && (
        <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#222834] pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Delivery Exceptions & Return-to-Branch Ledger
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Log of failed drop-offs, rejected deliveries, and items returning to hub inventory
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold tabular-nums">
              {exceptionItems.length} EXCEPTIONS
            </span>
          </div>

          {exceptionItems.length === 0 ? (
            <div className="border border-dashed border-[#222834] rounded p-12 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                Zero Exceptions Logged
              </h3>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                All dispatches in the current filter are progressing safely through standard pipeline stages.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                    <th className="p-3">Manifest #</th>
                    <th className="p-3">Recipient & Phone</th>
                    <th className="p-3">Destination</th>
                    <th className="p-3">Courier</th>
                    <th className="p-3">Exception Status</th>
                    <th className="p-3">Failure Reason / Notes</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222834]">
                  {exceptionItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#181d28]/40 transition-colors">
                      <td className="p-3 font-bold text-blue-400">
                        {item.delivery_number}
                        <span className="block text-[10px] text-slate-500">{item.order_number}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-200 block">{item.recipient_name}</span>
                        <span className="text-slate-400 text-[10px]">{item.recipient_phone}</span>
                      </td>
                      <td className="p-3 text-slate-300 max-w-xs truncate">
                        {item.delivery_address}, {item.delivery_city}
                      </td>
                      <td className="p-3 text-slate-300">
                        {item.driver_name || <span className="text-slate-500 italic">Unassigned</span>}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-bold uppercase">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 max-w-xs">
                        <span className="text-slate-200 font-semibold block">{item.failure_reason || 'Dispatch Exception'}</span>
                        <span className="text-slate-500 text-[10px] block truncate">{item.failure_notes || 'No notes logged'}</span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRequeueDelivery(item)}
                          className="px-2.5 py-1 rounded bg-[#0c0e12] hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 border border-[#222834] hover:border-blue-500/40 text-[10px] font-mono font-bold cursor-pointer transition-colors"
                          title="Re-queue to Stage 1 Ready for Dispatch"
                        >
                          RE-QUEUE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 7. COURIER ALLOCATION MODAL (Dieter Rams High-Precision Dialog) */}
      {assignModalOpen && selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-lg w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setAssignModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Dialog Header */}
            <div>
              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider block font-bold">
                STAGE-01 // ALLOCATE FLEET COURIER
              </span>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                <Truck className="w-4 h-4 text-blue-400" />
                Assign Courier to #{selectedDelivery.delivery_number}
              </h3>
            </div>

            {/* Manifest Specs Card */}
            <div className="bg-[#0c0e12] border border-[#222834] rounded p-3 text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="text-slate-200 font-semibold">{selectedDelivery.delivery_address} ({selectedDelivery.delivery_city || 'Nairobi'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient:</span>
                <span className="text-slate-200">{selectedDelivery.recipient_name} ({selectedDelivery.recipient_phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order Value:</span>
                <span className="text-slate-200 font-bold tabular-nums">
                  {selectedDelivery.total_amount ? api.formatKES(selectedDelivery.total_amount) : 'Standard Manifest'}
                </span>
              </div>
            </div>

            {/* Form Inputs */}
            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Fleet Driver *
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">-- Choose Courier --</option>
                  {drivers.map((drv) => (
                    <option key={drv.id} value={drv.id}>
                      {drv.full_name} — {drv.status || 'AVAILABLE'} ({drv.active_deliveries_count ?? 0} active drops)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Vehicle Allocation
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => {
                      setSelectedVehicleId(e.target.value);
                      const veh = vehicles.find((v) => String(v.id) === e.target.value);
                      if (veh) setVehicleNotes(`${veh.model || veh.vehicle_type} (${veh.registration_number})`);
                    }}
                    className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">-- Custom Vehicle --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration_number} ({v.vehicle_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Vehicle Details / Plate
                  </label>
                  <input
                    type="text"
                    value={vehicleNotes}
                    onChange={(e) => setVehicleNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Boxer 150 (KME 391A)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Priority Flag
                </label>
                <div className="flex gap-2">
                  {['NORMAL', 'HIGH', 'URGENT'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAssignPriority(p)}
                      className={`flex-1 py-1.5 rounded text-[11px] font-bold font-mono border transition-colors cursor-pointer ${
                        assignPriority === p
                          ? p === 'URGENT'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : p === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : 'bg-[#0c0e12] text-slate-400 border-[#222834]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Dispatcher Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Security pass at gate; customer requested morning delivery"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2.5">
                <button
                  onClick={handleAssignDriver}
                  className="flex-1 py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-blue-900/30 transition-colors cursor-pointer"
                >
                  Confirm & Dispatch Manifest
                </button>
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. DELIVERY EXCEPTION / FAILURE MODAL */}
      {failModalOpen && failDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-rose-500/40 rounded p-6 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setFailModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider block font-bold">
                INCIDENT REPORT // EXCEPTION HANDLING
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Log Exception for #{failDelivery.delivery_number}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                Destination: {failDelivery.delivery_address} ({failDelivery.recipient_name})
              </p>
            </div>

            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Primary Failure Reason *
                </label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="Customer Unreachable / Phone Off">Customer Unreachable / Phone Off</option>
                  <option value="Incorrect / Incomplete Address">Incorrect / Incomplete Address</option>
                  <option value="Recipient Rejected / Cancelled Order">Recipient Rejected / Cancelled Order</option>
                  <option value="Vehicle Mechanical Breakdown">Vehicle Mechanical Breakdown</option>
                  <option value="Road Inaccessible / Adverse Weather">Road Inaccessible / Adverse Weather</option>
                  <option value="Cash / Payment Dispute at Doorstep">Cash / Payment Dispute at Doorstep</option>
                  <option value="Other Logistics Exception">Other Logistics Exception</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Incident Notes & Specifics
                </label>
                <textarea
                  value={failureNotes}
                  onChange={(e) => setFailureNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 resize-none"
                  placeholder="Provide details on driver attempts, customer interactions, or road conditions..."
                />
              </div>

              <div className="p-3 rounded bg-[#0c0e12] border border-[#222834] flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="initiate_return_cb"
                  checked={initiateReturn}
                  onChange={(e) => setInitiateReturn(e.target.checked)}
                  className="w-4 h-4 rounded border-[#222834] text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="initiate_return_cb" className="text-[11px] text-slate-300 font-mono cursor-pointer">
                  Initiate Return-to-Branch Inventory (Status: RETURN_TO_BRANCH)
                </label>
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  onClick={handleSubmitFailure}
                  className="flex-1 py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-rose-900/30 transition-colors cursor-pointer"
                >
                  Confirm Exception Log
                </button>
                <button
                  onClick={() => setFailModalOpen(false)}
                  className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. MANIFEST INSPECTOR MODAL */}
      {inspectDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-lg w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setInspectDelivery(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider font-bold">
                  MANIFEST LEDGER // {inspectDelivery.delivery_number}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5">
                Order #{inspectDelivery.order_number || 'N/A'}
              </h3>
            </div>

            <div className="bg-[#0c0e12] border border-[#222834] rounded p-3 space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Delivery Status:</span>
                <span className="font-bold text-blue-400 uppercase">{inspectDelivery.status}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Priority Level:</span>
                <span className="font-bold text-slate-200">{inspectDelivery.priority || 'NORMAL'}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Recipient Name:</span>
                <span className="font-semibold text-slate-200">{inspectDelivery.recipient_name}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Recipient Phone:</span>
                <span className="text-slate-300">{inspectDelivery.recipient_phone}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Delivery Address:</span>
                <span className="text-slate-200 max-w-xs text-right truncate">{inspectDelivery.delivery_address}, {inspectDelivery.delivery_city}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Assigned Courier:</span>
                <span className="text-indigo-400 font-semibold">{inspectDelivery.driver_name || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between border-b border-[#222834] pb-1.5">
                <span className="text-slate-500">Vehicle Allocated:</span>
                <span className="text-slate-300">{inspectDelivery.vehicle_reg || inspectDelivery.vehicle_details || 'Boda Boda'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Invoice Value:</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {inspectDelivery.total_amount ? api.formatKES(inspectDelivery.total_amount) : 'KSh 0.00'}
                </span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex gap-2">
              {inspectDelivery.recipient_phone && (
                <a
                  href={`tel:${inspectDelivery.recipient_phone}`}
                  className="flex-1 py-2 rounded bg-[#181d28] hover:bg-[#222834] text-slate-200 text-xs font-mono font-semibold text-center border border-[#222834] flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  Call Recipient
                </a>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${inspectDelivery.delivery_address || ''}, ${inspectDelivery.delivery_city || 'Nairobi'}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 rounded bg-[#181d28] hover:bg-[#222834] text-slate-200 text-xs font-mono font-semibold text-center border border-[#222834] flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                Google Maps
              </a>
            </div>

            <button
              onClick={() => setInspectDelivery(null)}
              className="w-full py-2 rounded bg-[#0c0e12] hover:bg-[#181d28] text-slate-400 hover:text-slate-200 border border-[#222834] text-xs font-mono"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
