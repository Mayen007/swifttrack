// client/src/views/ShipmentsView.jsx
// SwiftTrack Logistics: First-Class Shipments Lifecycle, Multi-Leg Tracking & Exceptions View
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Package,
  Search,
  Filter,
  Plus,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Truck,
  MapPin,
  FileText,
  Eye,
  RefreshCw,
  Copy,
  ChevronRight,
  X,
  ExternalLink,
  QrCode,
  Calendar,
  Layers,
  Banknote,
  Send
} from 'lucide-react';
import { MultiLegJourney } from '../components/shipments/MultiLegJourney.jsx';

export function ShipmentsView({ onNavigate }) {
  const { user, selectedBranch } = useAuth();

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [serviceFilter, setServiceFilter] = useState('ALL');

  // Selected Shipment for Deep Inspection Drawer
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [trackingEvents, setTrackingEvents] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [legs, setLegs] = useState([]);

  // Status Transition Modal
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [transitionNotes, setTransitionNotes] = useState('');
  const [submittingTransition, setSubmittingTransition] = useState(false);

  // Copy Feedback
  const [copiedId, setCopiedId] = useState(null);

  const fetchShipments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/shipments');
      const data = res?.data || res?.shipments || (Array.isArray(res) ? res : []);
      setShipments(data);
    } catch (err) {
      console.error('Failed to load shipments:', err);
      setError(err.message || 'Unable to load shipments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [selectedBranch]);

  // Deep inspection on shipment select
  const handleSelectShipment = async (shipment) => {
    setSelectedShipment(shipment);
    setDrawerLoading(true);
    sound.playClick();
    try {
      const res = await api.get(`/api/shipments/${shipment.id}`);
      const details = res?.data || res;
      if (details) {
        setSelectedShipment(details);
        setParcels(details.parcels || []);
        setLegs(details.legs || []);
        setTrackingEvents(details.timeline || details.tracking_events || details.events || []);
      }
    } catch (err) {
      console.warn('Failed to fetch full shipment details, using summary:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    sound.playSuccess();
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenTransitionModal = (shipment) => {
    setSelectedShipment(shipment);
    setTargetStatus('');
    setTransitionNotes('');
    setTransitionModalOpen(true);
  };

  const handleExecuteTransition = async (e) => {
    e.preventDefault();
    if (!selectedShipment || !targetStatus) return;
    setSubmittingTransition(true);
    try {
      await api.post(`/api/shipments/${selectedShipment.id}/transition`, {
        target_status: targetStatus,
        status: targetStatus,
        notes: transitionNotes,
        hub_id: selectedShipment.current_hub_id || selectedBranch?.id || 1
      });
      sound.playSuccess();
      setTransitionModalOpen(false);
      fetchShipments();
      if (selectedShipment) {
        handleSelectShipment({ ...selectedShipment, status: targetStatus });
      }
    } catch (err) {
      alert(`Transition failed: ${err.message}`);
      sound.playAlert();
    } finally {
      setSubmittingTransition(false);
    }
  };

  // Filtered List
  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.waybill_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.recipient_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      const matchesService = serviceFilter === 'ALL' || s.service_type === serviceFilter;

      return matchesSearch && matchesStatus && matchesService;
    });
  }, [shipments, searchQuery, statusFilter, serviceFilter]);

  // Telemetry Aggregates
  const metrics = useMemo(() => {
    const total = shipments.length;
    const inTransit = shipments.filter((s) => s.status === 'IN_TRANSIT').length;
    const atHub = shipments.filter((s) => s.status === 'AT_HUB' || s.status === 'AT_ORIGIN_HUB').length;
    const delivered = shipments.filter((s) => s.status === 'DELIVERED').length;
    const exceptions = shipments.filter((s) => s.status === 'EXCEPTION' || s.status === 'ON_HOLD').length;
    return { total, inTransit, atHub, delivered, exceptions };
  }, [shipments]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'AT_HUB':
      case 'AT_ORIGIN_HUB':
      case 'SORTED':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'BOOKED':
      case 'ACCEPTED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'EXCEPTION':
      case 'ON_HOLD':
      case 'FAILED_DELIVERY':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-4">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-xl font-bold text-white tracking-tight">Shipment Operations & Waybills</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative consignment lifecycle, multi-leg routing, chain of custody & delivery confirmation
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchShipments}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-[#181d28] hover:bg-[#1f2534] border border-[#222834] text-xs font-semibold text-slate-300 flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('pos')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-blue-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              Book Consignment
            </button>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="bg-[#12161f] border border-[#222834] p-3 rounded-xl">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Consignments</p>
          <p className="text-2xl font-bold text-white mt-1">{metrics.total}</p>
        </div>
        <div className="bg-[#12161f] border border-[#222834] p-3 rounded-xl">
          <p className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">In Transit Linehaul</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{metrics.inTransit}</p>
        </div>
        <div className="bg-[#12161f] border border-[#222834] p-3 rounded-xl">
          <p className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">At Hubs / Staging</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{metrics.atHub}</p>
        </div>
        <div className="bg-[#12161f] border border-[#222834] p-3 rounded-xl">
          <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Delivered & POD</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{metrics.delivered}</p>
        </div>
        <div className="bg-[#12161f] border border-[#222834] p-3 rounded-xl col-span-2 sm:col-span-1">
          <p className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">Exceptions / On Hold</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">{metrics.exceptions}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#12161f] border border-[#222834] p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tracking #, waybill, sender, consignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Lifecycle States</option>
            <option value="BOOKED">BOOKED</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="SORTED">SORTED</option>
            <option value="IN_TRANSIT">IN_TRANSIT</option>
            <option value="AT_HUB">AT_HUB</option>
            <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="ON_HOLD">ON_HOLD</option>
            <option value="EXCEPTION">EXCEPTION</option>
          </select>

          {/* Service Filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Services</option>
            <option value="STANDARD">Standard Linehaul</option>
            <option value="EXPRESS">Express Priority</option>
            <option value="SAME_DAY">Same Day Direct</option>
          </select>
        </div>
      </div>

      {/* Main Shipments Table */}
      <div className="bg-[#12161f] border border-[#222834] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#181d28] text-slate-400 font-semibold border-b border-[#222834]">
              <tr>
                <th className="py-2 px-3">Tracking & Waybill</th>
                <th className="py-2 px-3">Route & Corridors</th>
                <th className="py-2 px-3">Shipper $\to$ Consignee</th>
                <th className="py-2 px-3">Parcels & Weight</th>
                <th className="py-2 px-3">Billing & COD</th>
                <th className="py-2 px-3">Current Status</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222834] text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading logistics network shipments...
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
                    No shipments match your criteria.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => handleSelectShipment(s)}
                    className="hover:bg-white/[0.02] cursor-pointer transition"
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-white tracking-wide">{s.tracking_number}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(s.tracking_number, s.id);
                          }}
                          className="text-slate-500 hover:text-slate-300 p-1"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {s.waybill_number || `WAY-${s.id}`}
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-white">
                        <span>Hub #{s.origin_hub_id}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span>Hub #{s.destination_hub_id}</span>
                      </div>
                      <div className="text-[10px] text-blue-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{s.current_location_desc || `At Hub #${s.current_hub_id || s.origin_hub_id}`}</span>
                        {s.total_legs > 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-[9px] border border-blue-500/20">
                            {s.total_legs} Legs
                          </span>
                        )}
                        {s.is_cross_border === 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-[9px] border border-amber-500/20">
                            🛂 Border
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <div className="font-medium text-white">{s.sender_name || 'Shipper'}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        $\to$ {s.recipient_name || 'Consignee'} ({s.recipient_city || 'City'})
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <div className="text-white font-medium">
                        {s.total_parcels || 1} pkg ({s.actual_weight_kg || 0} kg)
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Vol: {s.volumetric_weight_kg || 0} kg
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <div className="font-medium text-white">
                        {s.currency || 'KES'} {(s.total_amount || 0).toLocaleString()}
                      </div>
                      {Number(s.cod_amount) > 0 ? (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          COD: {s.currency || 'KES'} {Number(s.cod_amount).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">{s.payment_terms || 'PREPAID'}</span>
                      )}
                    </td>

                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(s.status)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {s.status}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenTransitionModal(s)}
                          className="px-2.5 py-1 rounded-lg bg-[#181d28] hover:bg-[#1f2534] border border-[#222834] text-[11px] font-semibold text-slate-300"
                        >
                          Transition
                        </button>
                        <button
                          onClick={() => handleSelectShipment(s)}
                          className="p-1.5 rounded-lg bg-[#181d28] hover:bg-[#1f2534] text-slate-400 hover:text-white"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep Inspection Drawer Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-[#0c0e12] border-l border-[#222834] h-full overflow-y-auto flex flex-col p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#222834]">
              <div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(selectedShipment.status)}`}>
                  {selectedShipment.status}
                </span>
                <h2 className="text-lg font-bold text-white font-mono mt-1">
                  {selectedShipment.tracking_number}
                </h2>
                <p className="text-xs text-slate-400">Waybill: {selectedShipment.waybill_number || `WAY-${selectedShipment.id}`}</p>
              </div>

              <button
                onClick={() => setSelectedShipment(null)}
                className="p-2 rounded-xl bg-[#181d28] hover:bg-[#1f2534] text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenTransitionModal(selectedShipment)}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow"
              >
                <Send className="w-3.5 h-3.5" />
                Change Operational State
              </button>
              <button
                onClick={() => handleCopy(selectedShipment.tracking_number, 'drawer')}
                className="px-3 py-2 rounded-xl bg-[#181d28] hover:bg-[#1f2534] border border-[#222834] text-xs font-semibold text-slate-300 flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedId === 'drawer' ? 'Copied' : 'Copy Tracking'}
              </button>
            </div>

            {/* Multi-Leg Corridor Journey & Cross-Border Customs Section */}
            <MultiLegJourney
              shipment={selectedShipment}
              legs={legs}
              onUpdate={() => handleSelectShipment(selectedShipment)}
            />

            {/* Parties & Consignment Payload */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#12161f] border border-[#222834] p-3.5 rounded-xl space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Shipper</p>
                <p className="font-semibold text-white">{selectedShipment.sender_name}</p>
                <p className="text-slate-400">{selectedShipment.sender_phone}</p>
                <p className="text-[10px] text-slate-500 truncate">{selectedShipment.sender_address}</p>
              </div>

              <div className="bg-[#12161f] border border-[#222834] p-3.5 rounded-xl space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Consignee</p>
                <p className="font-semibold text-white">{selectedShipment.recipient_name}</p>
                <p className="text-slate-400">{selectedShipment.recipient_phone}</p>
                <p className="text-[10px] text-slate-500 truncate">{selectedShipment.recipient_address}</p>
              </div>
            </div>

            {/* Parcels List */}
            <div className="bg-[#12161f] border border-[#222834] p-3 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Parcels ({parcels.length})</span>
                <span className="font-mono text-slate-300 font-normal">Actual: {selectedShipment.actual_weight_kg || 0} kg</span>
              </h3>

              <div className="space-y-2">
                {parcels.map((p, idx) => (
                  <div key={p.id || idx} className="bg-[#181d28] border border-[#222834] p-3 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-mono font-bold text-white">{p.parcel_number || `PCL-${selectedShipment.tracking_number}-${idx+1}`}</p>
                      <p className="text-[10px] text-slate-400">{p.description || 'Standard Box'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-white">{p.weight_kg} kg</p>
                      <p className="text-[10px] text-slate-500">{p.length_cm}x{p.width_cm}x{p.height_cm} cm</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tracking History Timeline */}
            <div className="bg-[#12161f] border border-[#222834] p-3 rounded-xl space-y-3 flex-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custody & Tracking Events</h3>
              <div className="relative pl-4 border-l border-blue-500/20 space-y-4 my-2">
                {trackingEvents.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No operational events recorded yet.</p>
                ) : (
                  trackingEvents.map((evt, idx) => (
                    <div key={evt.id || idx} className="relative group">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-[#12161f]" />
                      <div className="text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{evt.event_name || evt.event_code}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {evt.created_at ? new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{evt.description}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">By: {evt.actor_name || 'System'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* State Transition Modal */}
      {transitionModalOpen && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#12161f] border border-[#222834] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <h3 className="font-bold text-white text-base">Transition Shipment State</h3>
              <button onClick={() => setTransitionModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransition} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Current State</label>
                <input
                  type="text"
                  disabled
                  value={selectedShipment.status}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Operational State</label>
                <select
                  required
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select target state...</option>
                  <option value="ACCEPTED">ACCEPTED (Intake Confirmed)</option>
                  <option value="AT_ORIGIN_HUB">AT_ORIGIN_HUB</option>
                  <option value="SORTED">SORTED (Bay Allocated)</option>
                  <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>
                  <option value="IN_TRANSIT">IN_TRANSIT (Linehaul Departure)</option>
                  <option value="AT_HUB">AT_HUB (Destination Received)</option>
                  <option value="READY_FOR_DELIVERY">READY_FOR_DELIVERY</option>
                  <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="ON_HOLD">ON_HOLD</option>
                  <option value="EXCEPTION">EXCEPTION</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Audit Notes / Reason</label>
                <textarea
                  rows="3"
                  placeholder="Enter reason or dispatch details..."
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransitionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#181d28] text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTransition || !targetStatus}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg disabled:opacity-50"
                >
                  {submittingTransition ? 'Updating...' : 'Confirm Transition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
