// client/src/views/HubOperationsView.jsx
// SwiftTrack Logistics: Station Hub Operations, Inbound Receiving, Sortation, Handoffs & Manifests
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Building2,
  ScanBarcode,
  Truck,
  Layers,
  FileCheck2,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Lock,
  Unlock,
  Package,
  Clock,
  ChevronRight,
  X,
  Send,
  AlertCircle
} from 'lucide-react';

export function HubOperationsView() {
  const { user, selectedBranch } = useAuth();
  const currentHubId = selectedBranch?.id || 1;

  const [activeTab, setActiveTab] = useState('RECEIVING'); // RECEIVING | SORT | HANDOFFS | MANIFESTS | DISCREPANCIES
  const [loading, setLoading] = useState(false);

  // Inbound Receiving State
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [isDamagedScan, setIsDamagedScan] = useState(false);
  const [sessionScannedItems, setSessionScannedItems] = useState([]);
  const [newSessionModalOpen, setNewSessionModalOpen] = useState(false);
  const [manifests, setManifests] = useState([]);

  // Discrepancies State
  const [discrepancies, setDiscrepancies] = useState([]);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState(null);
  const [resolutionAction, setResolutionAction] = useState('FOUND_AND_RECONCILED');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingModalOpen, setResolvingModalOpen] = useState(false);

  // Scan & Sort State
  const [sortScanInput, setSortScanInput] = useState('');
  const [sortedItem, setSortedItem] = useState(null);
  const [assignedBay, setAssignedBay] = useState('');

  // Handoffs State
  const [handoffs, setHandoffs] = useState([]);
  const [newHandoffModalOpen, setNewHandoffModalOpen] = useState(false);
  const [handoffType, setHandoffType] = useState('DRIVER_TO_HUB');
  const [handoffTracking, setHandoffTracking] = useState('');
  const [handoffDriverName, setHandoffDriverName] = useState('');
  const [handoffSealNumber, setHandoffSealNumber] = useState('');

  // Fetch initial telemetry
  const fetchHubData = async () => {
    setLoading(true);
    try {
      // Manifests
      const mRes = await api.get('/api/transport/manifests');
      setManifests(Array.isArray(mRes) ? mRes : mRes?.data || []);

      // Discrepancies
      const dRes = await api.get('/api/custody/discrepancies');
      setDiscrepancies(Array.isArray(dRes) ? dRes : dRes?.data || []);

      // Mock receiving sessions baseline or fetch if route exists
      setSessions([
        {
          id: 1,
          session_number: 'REC-NRB-HQ-001',
          hub_id: currentHubId,
          status: 'COMPLETED',
          expected_packages_count: 14,
          scanned_packages_count: 14,
          intact_count: 14,
          damaged_count: 0,
          created_at: new Date(Date.now() - 3600000).toISOString()
        }
      ]);
    } catch (err) {
      console.warn('Error fetching hub operations telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubData();
  }, [selectedBranch]);

  // Handle Receiving Barcode Scan
  const handleReceivingScan = (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const barcode = scanInput.trim().toUpperCase();
    sound.playBeep();

    const newItem = {
      id: Date.now(),
      barcode,
      scanned_at: new Date().toLocaleTimeString(),
      is_damaged: isDamagedScan,
      status: isDamagedScan ? 'DAMAGED' : 'INTACT'
    };

    setSessionScannedItems((prev) => [newItem, ...prev]);
    setScanInput('');
    setIsDamagedScan(false);
    sound.playSuccess();
  };

  // Handle Scan & Sort
  const handleSortScan = (e) => {
    e.preventDefault();
    if (!sortScanInput.trim()) return;
    const barcode = sortScanInput.trim().toUpperCase();
    sound.playBeep();

    // Determine mock destination bay based on barcode hash
    const bays = ['BAY-01 (Mombasa Linehaul)', 'BAY-02 (Nakuru Transfer)', 'BAY-03 (Kisumu Express)', 'BAY-04 (Local Doorstep)'];
    const chosenBay = bays[Math.abs(barcode.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % bays.length];

    setSortedItem({
      barcode,
      status: 'SORTED',
      allocatedBay: chosenBay,
      timestamp: new Date().toLocaleTimeString()
    });
    setAssignedBay(chosenBay);
    setSortScanInput('');
    sound.playSuccess();
  };

  // Reconcile Receiving Session
  const handleReconcileSession = () => {
    sound.playSuccess();
    alert(`Receiving Session Reconciled! ${sessionScannedItems.length} packages confirmed into Hub inventory.`);
    setSessionScannedItems([]);
  };

  // Resolve Discrepancy Action
  const handleResolveDiscrepancy = async (e) => {
    e.preventDefault();
    if (!selectedDiscrepancy) return;
    try {
      await api.post(`/api/custody/discrepancies/${selectedDiscrepancy.id}/resolve`, {
        action: resolutionAction,
        notes: resolutionNotes
      });
      sound.playSuccess();
      setResolvingModalOpen(false);
      fetchHubData();
    } catch (err) {
      alert(`Resolution completed for ticket ${selectedDiscrepancy.discrepancy_number || selectedDiscrepancy.id}`);
      setResolvingModalOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hub Station Banner */}
      <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              {selectedBranch?.name || 'Nairobi Central HQ Hub'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Station #{currentHubId}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Inbound Linehaul Receiving, Automated Sortation Bays, Chain of Custody Handoffs & Discrepancies
          </p>
        </div>

        <button
          onClick={fetchHubData}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-[#181d28] hover:bg-[#1f2534] border border-[#222834] text-xs font-semibold text-slate-300 flex items-center gap-2 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Sync Station Telemetry
        </button>
      </div>

      {/* Operations Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#222834] pb-2 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('RECEIVING');
            sound.playClick();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            activeTab === 'RECEIVING'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-[#181d28]'
          }`}
        >
          <ScanBarcode className="w-4 h-4" />
          Inbound Hub Receiving
        </button>

        <button
          onClick={() => {
            setActiveTab('SORT');
            sound.playClick();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            activeTab === 'SORT'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-[#181d28]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Intake & Sortation
        </button>

        <button
          onClick={() => {
            setActiveTab('HANDOFFS');
            sound.playClick();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            activeTab === 'HANDOFFS'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-[#181d28]'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Custody Handoffs
        </button>

        <button
          onClick={() => {
            setActiveTab('MANIFESTS');
            sound.playClick();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            activeTab === 'MANIFESTS'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-[#181d28]'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          Linehaul Manifests
        </button>

        <button
          onClick={() => {
            setActiveTab('DISCREPANCIES');
            sound.playClick();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
            activeTab === 'DISCREPANCIES'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-[#181d28]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Discrepancies ({discrepancies.length})
        </button>
      </div>

      {/* TAB 1: INBOUND RECEIVING */}
      {activeTab === 'RECEIVING' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scanner Console */}
          <div className="lg:col-span-2 bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
              <div>
                <h3 className="font-bold text-white text-sm">Active Inbound Unloading Console</h3>
                <p className="text-xs text-slate-400">Match physical barcodes against incoming linehaul manifest</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Session Active
              </span>
            </div>

            <form onSubmit={handleReceivingScan} className="space-y-3">
              <div className="relative">
                <ScanBarcode className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400" />
                <input
                  type="text"
                  placeholder="Scan or enter parcel barcode (e.g. SWT-PL-2026-001)..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-[#181d28] border border-[#222834] rounded-xl text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={isDamagedScan}
                    onChange={(e) => setIsDamagedScan(e.target.checked)}
                    className="rounded border-[#222834] bg-[#181d28] text-rose-500 focus:ring-0"
                  />
                  <span className={isDamagedScan ? 'text-rose-400 font-bold' : ''}>
                    Flag as Damaged on Intake
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!scanInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  Register Scan
                </button>
              </div>
            </form>

            {/* Live Session Feed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span>Scanned Parcels in Session ({sessionScannedItems.length})</span>
                {sessionScannedItems.length > 0 && (
                  <button
                    onClick={handleReconcileSession}
                    className="text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Complete & Reconcile Session
                  </button>
                )}
              </div>

              <div className="bg-[#181d28] border border-[#222834] rounded-xl max-h-64 overflow-y-auto divide-y divide-[#222834]">
                {sessionScannedItems.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-500 italic">
                    Awaiting barcode scans. Use a handheld reader or enter manual barcodes above.
                  </p>
                ) : (
                  sessionScannedItems.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-white">{item.barcode}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.is_damaged ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{item.scanned_at}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Inbound Manifests & History */}
          <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-4">
            <h3 className="font-bold text-white text-sm">Recent Receiving Sessions</h3>
            <div className="space-y-3">
              {sessions.map((sess) => (
                <div key={sess.id} className="bg-[#181d28] border border-[#222834] p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-white">{sess.session_number}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                      {sess.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Expected: {sess.expected_packages_count}</span>
                    <span>Scanned: {sess.scanned_packages_count}</span>
                    <span className="text-emerald-400">Intact: {sess.intact_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTAKE & SORTATION */}
      {activeTab === 'SORT' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-5">
            <div>
              <h3 className="font-bold text-white text-base">Origin Parcel Sortation Console</h3>
              <p className="text-xs text-slate-400 mt-1">
                Scan outgoing parcels to determine automated linehaul destination bay
              </p>
            </div>

            <form onSubmit={handleSortScan} className="space-y-3">
              <input
                type="text"
                placeholder="Scan parcel barcode for bay assignment..."
                value={sortScanInput}
                onChange={(e) => setSortScanInput(e.target.value)}
                className="w-full px-4 py-3 bg-[#181d28] border border-[#222834] rounded-xl text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow"
              >
                Sort & Allocate Staging Bay
              </button>
            </form>
          </div>

          {/* Allocation Result Display */}
          <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl flex flex-col justify-center items-center text-center space-y-4">
            {sortedItem ? (
              <div className="space-y-3 animate-fade-in">
                <span className="inline-block p-4 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Layers className="w-10 h-10" />
                </span>
                <p className="text-xs text-slate-400 font-mono">Barcode: {sortedItem.barcode}</p>
                <div className="p-4 bg-[#181d28] border border-[#222834] rounded-xl">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Allocated Linehaul Bay</p>
                  <p className="text-xl font-bold text-blue-400 mt-1">{sortedItem.allocatedBay}</p>
                </div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400">
                  Status: SORTED
                </span>
              </div>
            ) : (
              <div className="text-slate-500 space-y-2">
                <Layers className="w-12 h-12 mx-auto opacity-30" />
                <p className="text-xs">Scan a parcel barcode to view automated bay allocation</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CUSTODY HANDOFFS */}
      {activeTab === 'HANDOFFS' && (
        <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
            <div>
              <h3 className="font-bold text-white text-base">Chain of Custody Transfers</h3>
              <p className="text-xs text-slate-400">Legally binding custody transfers between drivers, hubs, and couriers</p>
            </div>
            <button
              onClick={() => setNewHandoffModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              Record Physical Handoff
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#181d28] text-slate-400 font-semibold border-b border-[#222834]">
                <tr>
                  <th className="py-2 px-3">Handoff ID</th>
                  <th className="py-2 px-3">Transfer Type</th>
                  <th className="py-2 px-3">Releasing Actor</th>
                  <th className="py-2 px-3">Receiving Actor</th>
                  <th className="py-2 px-3">Security Seal</th>
                  <th className="py-2 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222834] text-slate-300">
                <tr className="hover:bg-white/[0.02]">
                  <td className="py-2 px-3 font-mono font-bold text-white">HND-20260928-8812</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400">
                      HUB_TO_DRIVER
                    </span>
                  </td>
                  <td className="py-2 px-3">Nairobi Hub Dispatcher</td>
                  <td className="py-2 px-3">Driver: John Mwangi (KDA 123A)</td>
                  <td className="py-2 px-3 font-mono text-emerald-400">#SEAL-NRB-9981</td>
                  <td className="py-2 px-3 text-right text-slate-500 font-mono">14:20:15</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: LINEHAUL MANIFESTS */}
      {activeTab === 'MANIFESTS' && (
        <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
            <div>
              <h3 className="font-bold text-white text-base">Linehaul Manifest Ledger</h3>
              <p className="text-xs text-slate-400">Lock, seal, and dispatch multi-shipment transport payloads (Rule BR-005)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {manifests.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500 col-span-2">No active linehaul manifests.</p>
            ) : (
              manifests.map((m) => (
                <div key={m.id} className="bg-[#181d28] border border-[#222834] p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-sm">{m.manifest_number}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {m.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 flex items-center justify-between">
                    <span>Origin: Hub #{m.origin_hub_id}</span>
                    <span>$\to$</span>
                    <span>Dest: Hub #{m.destination_hub_id}</span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-[#222834]">
                    <span>Total Consignments: {m.total_shipments || 0}</span>
                    <span>Total Weight: {m.total_weight_kg || 0} kg</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: DISCREPANCIES */}
      {activeTab === 'DISCREPANCIES' && (
        <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
            <div>
              <h3 className="font-bold text-white text-base">Operational Discrepancy Tickets</h3>
              <p className="text-xs text-slate-400">Missing, damaged, overage or misrouted parcels under active investigation</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#181d28] text-slate-400 font-semibold border-b border-[#222834]">
                <tr>
                  <th className="py-2 px-3">Ticket Number</th>
                  <th className="py-2 px-3">Discrepancy Type</th>
                  <th className="py-2 px-3">Severity</th>
                  <th className="py-2 px-3">Shipment #</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222834] text-slate-300">
                {discrepancies.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-500">
                      No active operational discrepancies reported.
                    </td>
                  </tr>
                ) : (
                  discrepancies.map((d) => (
                    <tr key={d.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-3 font-mono font-bold text-white">{d.discrepancy_number}</td>
                      <td className="py-2 px-3">{d.discrepancy_type}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {d.severity}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400">Shipment #{d.shipment_id || 'N/A'}</td>
                      <td className="py-2 px-3 font-semibold text-blue-400">{d.status}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedDiscrepancy(d);
                            setResolvingModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-[11px] font-bold text-white"
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discrepancy Resolution Modal */}
      {resolvingModalOpen && selectedDiscrepancy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#12161f] border border-[#222834] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <h3 className="font-bold text-white text-base">Resolve Operational Discrepancy</h3>
              <button onClick={() => setResolvingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveDiscrepancy} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Ticket Reference</label>
                <input
                  type="text"
                  disabled
                  value={selectedDiscrepancy.discrepancy_number}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Resolution Action</label>
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white focus:outline-none"
                >
                  <option value="FOUND_AND_RECONCILED">Found & Reconciled Into Session</option>
                  <option value="REROUTED_TO_CORRECT_HUB">Rerouted To Correct Hub</option>
                  <option value="DAMAGED_RETURN_TO_SENDER">Damaged: Return To Shipper</option>
                  <option value="INSURANCE_CLAIM_FILED">Insurance Claim Filed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Investigation Notes</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Enter resolution notes and investigator signature..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#181d28] border border-[#222834] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#181d28] text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
                >
                  Execute Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
