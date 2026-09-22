// client/src/views/ProcurementView.jsx
// SwiftTrack Kenya: Phase 8 Suppliers & Complete Procurement Lifecycle Cockpit
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  ShoppingBag,
  Building2,
  FileText,
  PackageCheck,
  Receipt,
  RotateCcw,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Truck,
  ArrowRight,
  Eye,
  Send,
  Check,
  X,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

export function ProcurementView() {
  const { user, selectedBranch } = useAuth();
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'requisitions', 'suppliers', 'grns', 'invoices', 'returns'
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Telemetry KPIs
  const [telemetry, setTelemetry] = useState({
    active_pos: 0,
    pending_approval_pos: 0,
    pending_prs: 0,
    total_po_spend: 0,
    open_payable_amount: 0,
    active_suppliers: 0
  });

  // Entities Data
  const [suppliers, setSuppliers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [grns, setGrns] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [warehousesList, setWarehousesList] = useState([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showCreatePRModal, setShowCreatePRModal] = useState(false);
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [showCreateSupplierModal, setShowCreateSupplierModal] = useState(false);
  const [showReceiveGoodsModal, setShowReceiveGoodsModal] = useState(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showCreateReturnModal, setShowCreateReturnModal] = useState(false);

  // Selected Active Entity Details Drawer/Modal
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [selectedPR, setSelectedPR] = useState(null);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isManagerOrAdmin = ['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(user?.role);

  // Fetch all procurement data
  const fetchData = async () => {
    setLoading(true);
    try {
      const branchParam = selectedBranch && selectedBranch !== 'all' ? `?branch_id=${selectedBranch}` : '';

      const [
        telemRes,
        supsRes,
        prsRes,
        posRes,
        grnsRes,
        invsRes,
        retsRes,
        prodsRes,
        whsRes
      ] = await Promise.all([
        api.get(`/api/v1/procurement/telemetry${branchParam}`).catch(() => ({})),
        api.get('/api/v1/suppliers').catch(() => []),
        api.get(`/api/v1/procurement/requisitions${branchParam}`).catch(() => []),
        api.get(`/api/v1/procurement/orders${branchParam}`).catch(() => []),
        api.get(`/api/v1/procurement/grns${branchParam}`).catch(() => []),
        api.get(`/api/v1/procurement/invoices${branchParam}`).catch(() => []),
        api.get(`/api/v1/procurement/returns${branchParam}`).catch(() => []),
        api.get('/api/products').catch(() => []),
        api.get('/api/warehouses').catch(() => [])
      ]);

      if (telemRes) setTelemetry(telemRes);
      if (Array.isArray(supsRes)) setSuppliers(supsRes);
      if (Array.isArray(prsRes)) setRequisitions(prsRes);
      if (Array.isArray(posRes)) setOrders(posRes);
      if (Array.isArray(grnsRes)) setGrns(grnsRes);
      if (Array.isArray(invsRes)) setInvoices(invsRes);
      if (Array.isArray(retsRes)) setReturns(retsRes);
      if (Array.isArray(prodsRes)) setProductsList(prodsRes);
      if (Array.isArray(whsRes)) setWarehousesList(whsRes);

      setLastSync(new Date());
    } catch (err) {
      console.error('Failed to load procurement data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranch]);

  // Tab definitions
  const tabs = [
    { id: 'orders', label: 'Purchase Orders', icon: ShoppingBag, count: orders.length },
    { id: 'requisitions', label: 'Requisitions (PR)', icon: FileText, count: requisitions.filter(r => r.status === 'SUBMITTED').length, highlight: true },
    { id: 'suppliers', label: 'Suppliers Directory', icon: Building2, count: suppliers.length },
    { id: 'grns', label: 'Goods Receipts (GRN)', icon: PackageCheck, count: grns.length },
    { id: 'invoices', label: 'Invoices & Payments', icon: Receipt, count: invoices.filter(i => i.status === 'PENDING').length },
    { id: 'returns', label: 'Supplier Returns', icon: RotateCcw, count: returns.length }
  ];

  // Helper status color badges
  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">DRAFT</span>;
      case 'SUBMITTED':
      case 'PENDING_APPROVAL':
      case 'PENDING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDING</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">APPROVED</span>;
      case 'SENT_TO_SUPPLIER':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">SENT TO VENDOR</span>;
      case 'PARTIALLY_RECEIVED':
      case 'PARTIALLY_PAID':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">PARTIAL</span>;
      case 'FULLY_RECEIVED':
      case 'PAID':
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">COMPLETED</span>;
      case 'REJECTED':
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">{status}</span>;
      case 'CONVERTED_TO_PO':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">PO CONVERTED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">{status}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0c0e12] overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-800/80 bg-[#12161f]/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Suppliers & Procurement Cockpit
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-md">
                  Phase 8
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                End-to-end procurement lifecycle from Requisition to PO, GRN, Invoicing, and Supplier Settlement
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { sound.playClick(); fetchData(); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-xs font-medium text-slate-300 transition-all hover:text-white"
            title="Refresh procurement data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            Refresh
          </button>

          {isManagerOrAdmin && (
            <>
              <button
                onClick={() => { sound.playClick(); setShowCreatePRModal(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                New Requisition
              </button>

              <button
                onClick={() => { sound.playClick(); setShowCreatePOModal(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-semibold text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-[1.01]"
              >
                <Plus className="w-4 h-4" />
                Create PO
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Telemetry Banner */}
      <div className="px-6 py-3.5 border-b border-slate-800/60 bg-[#0e1118]/60 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Active POs</div>
          <div className="text-xl font-bold font-mono text-white mt-1">{telemetry.active_pos || 0}</div>
          <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" /> In fulfillment pipeline
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Pending PR Approvals</div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">{telemetry.pending_prs || 0}</div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
            <FileText className="w-3 h-3" /> Awaiting sign-off
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Active Suppliers</div>
          <div className="text-xl font-bold font-mono text-white mt-1">{telemetry.active_suppliers || 0}</div>
          <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
            <Award className="w-3 h-3" /> Verified KRA PIN vendors
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">PO Commitments</div>
          <div className="text-lg font-bold font-mono text-white mt-1 truncate">
            KES {(telemetry.total_po_spend || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
            <TrendingUp className="w-3 h-3" /> Total PO value
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Open Payables</div>
          <div className="text-lg font-bold font-mono text-rose-400 mt-1 truncate">
            KES {(telemetry.open_payable_amount || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-rose-400/80 flex items-center gap-1 mt-0.5">
            <Receipt className="w-3 h-3" /> Unsettled invoices
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Quality Pass Rate</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">98.4%</div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Inbound inspection
          </div>
        </div>
      </div>

      {/* Tab Navigation & Search */}
      <div className="px-6 py-2.5 border-b border-slate-800/80 bg-[#12161f]/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { sound.playClick(); setActiveTab(tab.id); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive
                        ? 'bg-amber-500/30 text-amber-200'
                        : tab.highlight && tab.count > 0
                        ? 'bg-amber-500/20 text-amber-300 font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* TAB 1: PURCHASE ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                Purchase Orders Master Ledger
              </h2>
              <div className="text-xs text-slate-400 font-mono">
                Showing {orders.length} orders
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Branch / Warehouse</th>
                    <th className="py-3 px-4">Receiving Progress</th>
                    <th className="py-3 px-4">Total (KES)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-500 text-xs font-sans">
                        No purchase orders found. Click "Create PO" to raise an order with a supplier.
                      </td>
                    </tr>
                  ) : (
                    orders
                      .filter(po =>
                        !searchQuery ||
                        po.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        po.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((po) => {
                        const ordered = po.total_ordered_qty || 1;
                        const received = po.total_received_qty || 0;
                        const pct = Math.min(100, Math.round((received / ordered) * 100));

                        return (
                          <tr key={po.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-white">
                              {po.po_number}
                              <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                                Issued: {new Date(po.created_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300 font-sans">
                              <div className="font-medium text-white">{po.supplier_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{po.supplier_code}</div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-300 font-sans">
                              <div>{po.branch_name}</div>
                              <div className="text-[11px] text-slate-500">{po.warehouse_name}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
                                <span>{received} / {ordered} items</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-white">
                              {Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-4">
                              {getStatusBadge(po.status)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 font-sans">
                                <button
                                  onClick={async () => {
                                    sound.playClick();
                                    const full = await api.get(`/api/v1/procurement/orders/${po.id}`);
                                    setSelectedPO(full);
                                  }}
                                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                                >
                                  View
                                </button>

                                {isManagerOrAdmin && ['APPROVED', 'SENT_TO_SUPPLIER', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                                  <button
                                    onClick={async () => {
                                      sound.playClick();
                                      const full = await api.get(`/api/v1/procurement/orders/${po.id}`);
                                      setSelectedPO(full);
                                      setShowReceiveGoodsModal(true);
                                    }}
                                    className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition-colors"
                                  >
                                    Receive
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
          </div>
        )}

        {/* TAB 2: PURCHASE REQUISITIONS */}
        {activeTab === 'requisitions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Purchase Requisitions Internal Requests
              </h2>
              {isManagerOrAdmin && (
                <button
                  onClick={() => setShowCreatePRModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Raise PR
                </button>
              )}
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">PR Number</th>
                    <th className="py-3 px-4">Requested By</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Urgency</th>
                    <th className="py-3 px-4">Est. Cost (KES)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {requisitions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-500 text-xs font-sans">
                        No purchase requisitions found. Click "Raise PR" to create an internal restock request.
                      </td>
                    </tr>
                  ) : (
                    requisitions.map((pr) => (
                      <tr key={pr.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {pr.pr_number}
                          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                            {new Date(pr.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-sans">
                          {pr.requested_by_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-sans">
                          {pr.branch_name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              pr.urgency === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : pr.urgency === 'HIGH'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {pr.urgency}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {Number(pr.total_estimated_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatusBadge(pr.status)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 font-sans">
                            {pr.status === 'DRAFT' && (
                              <button
                                onClick={async () => {
                                  sound.playClick();
                                  await api.post(`/api/v1/procurement/requisitions/${pr.id}/submit`);
                                  fetchData();
                                }}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium border border-slate-700"
                              >
                                Submit
                              </button>
                            )}
                            {isManagerOrAdmin && pr.status === 'SUBMITTED' && (
                              <button
                                onClick={async () => {
                                  sound.playClick();
                                  await api.post(`/api/v1/procurement/requisitions/${pr.id}/approve`);
                                  fetchData();
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                sound.playClick();
                                const full = await api.get(`/api/v1/procurement/requisitions/${pr.id}`);
                                setSelectedPR(full);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                            >
                              Details
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
        )}

        {/* TAB 3: SUPPLIERS DIRECTORY */}
        {activeTab === 'suppliers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                Verified Supplier Directory & Governance
              </h2>
              {isManagerOrAdmin && (
                <button
                  onClick={() => setShowCreateSupplierModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Supplier
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-white text-sm">{s.name}</h3>
                        <div className="text-[11px] font-mono text-amber-400 mt-0.5">{s.code}</div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        <Award className="w-3.5 h-3.5" /> {s.rating || 5.0}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-300 font-sans">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{s.phone}</span>
                      </div>
                      {s.email && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          <span>{s.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                        <span className="text-slate-500">KRA PIN:</span>
                        <span className="text-white">{s.tax_pin || 'NOT_REGISTERED'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="text-[10px] text-slate-500">TERMS</div>
                      <div className="text-white font-medium">{s.payment_terms}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">ORDERS</div>
                      <div className="text-white font-medium">{s.total_orders || 0}</div>
                    </div>
                    <div>
                      <button
                        onClick={async () => {
                          sound.playClick();
                          const full = await api.get(`/api/v1/suppliers/${s.id}`);
                          setSelectedSupplier(full);
                        }}
                        className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-sans font-medium text-xs border border-slate-700 transition-colors"
                      >
                        Profile & Scorecard
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: GOODS RECEIVED NOTES (GRN) */}
        {activeTab === 'grns' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-400" />
                Goods Received Notes (Inbound Invariant Receipts)
              </h2>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">GRN Number</th>
                    <th className="py-3 px-4">PO Reference</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Warehouse</th>
                    <th className="py-3 px-4">Items Received</th>
                    <th className="py-3 px-4">Total Cost (KES)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {grns.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-500 text-xs font-sans">
                        No goods received notes found. Goods receipts are generated upon checking inbound PO deliveries.
                      </td>
                    </tr>
                  ) : (
                    grns.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-emerald-400">
                          {g.receipt_number}
                          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                            {new Date(g.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-white">
                          {g.po_number || 'ADHOC_RECEIPT'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-sans">
                          {g.supplier_name || 'Standard Vendor'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-sans">
                          {g.warehouse_name}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          {g.total_items} items
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {Number(g.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={async () => {
                              sound.playClick();
                              const full = await api.get(`/api/v1/procurement/grns/${g.id}`);
                              setSelectedGRN(full);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 font-sans"
                          >
                            Inspect
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

        {/* TAB 5: INVOICES & PAYMENTS */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-400" />
                Supplier Bills & 3-Way Matched Invoices
              </h2>
              {isManagerOrAdmin && (
                <button
                  onClick={() => setShowCreateInvoiceModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Supplier Invoice
                </button>
              )}
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Vendor Bill #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">PO Reference</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Amount Paid / Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500 text-xs font-sans">
                        No supplier invoices recorded. Invoices support 3-way matching against POs and GRNs.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3.5 px-4 text-amber-400 font-bold">
                          {inv.supplier_invoice_no}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-sans">
                          {inv.supplier_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {inv.po_number || 'DIRECT'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {inv.due_date}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-emerald-400">{Number(inv.amount_paid).toLocaleString()}</span>
                          <span className="text-slate-500"> / </span>
                          <span className="text-white">{Number(inv.total_amount).toLocaleString()}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatusBadge(inv.status)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 font-sans">
                            {inv.status !== 'PAID' && isManagerOrAdmin && (
                              <button
                                onClick={() => {
                                  sound.playClick();
                                  setSelectedInvoice(inv);
                                  setShowRecordPaymentModal(true);
                                }}
                                className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium border border-amber-500/30"
                              >
                                Pay
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                sound.playClick();
                                const full = await api.get(`/api/v1/procurement/invoices/${inv.id}`);
                                setSelectedInvoice(full);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                            >
                              Details
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
        )}

        {/* TAB 6: SUPPLIER RETURNS (DEBIT NOTES) */}
        {activeTab === 'returns' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                Supplier Returns & Debit Notes
              </h2>
              {isManagerOrAdmin && (
                <button
                  onClick={() => setShowCreateReturnModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-rose-500/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Return Defective Stock
                </button>
              )}
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Return Note #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Warehouse</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Debit Value (KES)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {returns.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-500 text-xs font-sans">
                        No supplier returns or debit notes logged. Use "Return Defective Stock" to return damaged or oversupplied items.
                      </td>
                    </tr>
                  ) : (
                    returns.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-rose-400">
                          {ret.return_number}
                          <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                            {new Date(ret.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-sans">
                          {ret.supplier_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-sans">
                          {ret.warehouse_name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300 border border-slate-700">
                            {ret.reason}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {Number(ret.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatusBadge(ret.status)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 font-sans">
                            {ret.status === 'DRAFT' && isManagerOrAdmin && (
                              <button
                                onClick={async () => {
                                  sound.playClick();
                                  await api.post(`/api/v1/procurement/returns/${ret.id}/approve`);
                                  fetchData();
                                }}
                                className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/30"
                              >
                                Approve & Deduct Stock
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE REQUISITION */}
      {showCreatePRModal && (
        <CreatePRModal
          onClose={() => setShowCreatePRModal(false)}
          onSuccess={() => { setShowCreatePRModal(false); fetchData(); }}
          productsList={productsList}
          user={user}
        />
      )}

      {/* MODAL 2: CREATE PURCHASE ORDER */}
      {showCreatePOModal && (
        <CreatePOModal
          onClose={() => setShowCreatePOModal(false)}
          onSuccess={() => { setShowCreatePOModal(false); fetchData(); }}
          suppliers={suppliers}
          productsList={productsList}
          warehousesList={warehousesList}
          user={user}
        />
      )}

      {/* MODAL 3: CREATE SUPPLIER */}
      {showCreateSupplierModal && (
        <CreateSupplierModal
          onClose={() => setShowCreateSupplierModal(false)}
          onSuccess={() => { setShowCreateSupplierModal(false); fetchData(); }}
        />
      )}

      {/* MODAL 4: RECEIVE GOODS (GRN) */}
      {showReceiveGoodsModal && selectedPO && (
        <ReceiveGoodsModal
          po={selectedPO}
          onClose={() => setShowReceiveGoodsModal(false)}
          onSuccess={() => { setShowReceiveGoodsModal(false); setSelectedPO(null); fetchData(); }}
        />
      )}

      {/* MODAL 5: CREATE INVOICE */}
      {showCreateInvoiceModal && (
        <CreateInvoiceModal
          suppliers={suppliers}
          orders={orders}
          onClose={() => setShowCreateInvoiceModal(false)}
          onSuccess={() => { setShowCreateInvoiceModal(false); fetchData(); }}
        />
      )}

      {/* MODAL 6: RECORD PAYMENT */}
      {showRecordPaymentModal && selectedInvoice && (
        <RecordPaymentModal
          invoice={selectedInvoice}
          onClose={() => setShowRecordPaymentModal(false)}
          onSuccess={() => { setShowRecordPaymentModal(false); setSelectedInvoice(null); fetchData(); }}
        />
      )}

      {/* MODAL 7: CREATE RETURN */}
      {showCreateReturnModal && (
        <CreateReturnModal
          suppliers={suppliers}
          productsList={productsList}
          warehousesList={warehousesList}
          onClose={() => setShowCreateReturnModal(false)}
          onSuccess={() => { setShowCreateReturnModal(false); fetchData(); }}
        />
      )}

      {/* SUPPLIER DETAIL & SCORECARD DRAWER */}
      {selectedSupplier && (
        <SupplierDetailModal
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          onRefresh={async () => {
            const updated = await api.get(`/api/v1/suppliers/${selectedSupplier.id}`);
            setSelectedSupplier(updated);
            fetchData();
          }}
          productsList={productsList}
        />
      )}

      {/* PO DETAIL DRAWER */}
      {selectedPO && !showReceiveGoodsModal && (
        <PODetailModal
          po={selectedPO}
          onClose={() => setSelectedPO(null)}
          onRefresh={async () => {
            const updated = await api.get(`/api/v1/procurement/orders/${selectedPO.id}`);
            setSelectedPO(updated);
            fetchData();
          }}
          isManagerOrAdmin={isManagerOrAdmin}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// MODAL IMPLEMENTATIONS
// ----------------------------------------------------------------------------

function CreatePRModal({ onClose, onSuccess, productsList, user }) {
  const [urgency, setUrgency] = useState('MEDIUM');
  const [neededByDate, setNeededByDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { product_id: productsList[0]?.id || '', quantity: 10, unit_cost: productsList[0]?.cost_price || 0 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddItem = () => {
    setItems([...items, { product_id: productsList[0]?.id || '', quantity: 10, unit_cost: productsList[0]?.cost_price || 0 }]);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id') {
      const p = productsList.find(x => x.id === Number(value));
      if (p) updated[index].unit_cost = p.cost_price || 0;
    }
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/procurement/requisitions', {
        urgency,
        needed_by_date: neededByDate || null,
        notes,
        items: items.map(it => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost)
        }))
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to submit requisition');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            Raise Purchase Requisition (PR)
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Urgency Level</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="LOW">Low Urgency</option>
                <option value="MEDIUM">Medium Urgency</option>
                <option value="HIGH">High Urgency</option>
                <option value="CRITICAL">Critical Restock</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Needed By Date</label>
              <input
                type="date"
                value={neededByDate}
                onChange={(e) => setNeededByDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-mono text-slate-400">Requested Items</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <select
                    value={it.product_id}
                    onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    {productsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-20 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={it.unit_cost}
                    onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                    placeholder="Cost"
                    className="w-28 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Reason / Internal Notes</label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why are these goods needed..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors"
            >
              {submitting ? 'Creating...' : 'Submit Requisition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreatePOModal({ onClose, onSuccess, suppliers, productsList, warehousesList, user }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState(warehousesList[0]?.id || '');
  const [paymentTerms, setPaymentTerms] = useState('NET30');
  const [expectedDate, setExpectedDate] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { product_id: productsList[0]?.id || '', ordered_quantity: 50, unit_cost: productsList[0]?.cost_price || 0 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddItem = () => {
    setItems([...items, { product_id: productsList[0]?.id || '', ordered_quantity: 50, unit_cost: productsList[0]?.cost_price || 0 }]);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    if (field === 'product_id') {
      const p = productsList.find(x => x.id === Number(value));
      if (p) updated[index].unit_cost = p.cost_price || 0;
    }
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, it) => acc + (Number(it.ordered_quantity || 0) * Number(it.unit_cost || 0)), 0);
  const vat = subtotal * 0.16;
  const grandTotal = subtotal + vat + Number(shippingFee || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId || !warehouseId) {
      setError('Supplier and Warehouse are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/procurement/orders', {
        supplier_id: Number(supplierId),
        warehouse_id: Number(warehouseId),
        payment_terms: paymentTerms,
        expected_delivery_date: expectedDate || null,
        shipping_fee: Number(shippingFee) || 0,
        notes,
        items: items.map(it => ({
          product_id: Number(it.product_id),
          ordered_quantity: Number(it.ordered_quantity),
          unit_cost: Number(it.unit_cost),
          tax_rate: 16.0
        }))
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create Purchase Order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            Issue Purchase Order (PO)
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Destination Warehouse</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                {warehousesList.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="NET30">NET 30 Days</option>
                <option value="NET15">NET 15 Days</option>
                <option value="NET60">NET 60 Days</option>
                <option value="COD">Cash on Delivery</option>
                <option value="ADVANCE">Advance 100%</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Expected Delivery</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Shipping Fee (KES)</label>
              <input
                type="number"
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-mono text-slate-400">Order Lines</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <select
                    value={it.product_id}
                    onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    {productsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={it.ordered_quantity}
                    onChange={(e) => handleItemChange(idx, 'ordered_quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-20 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={it.unit_cost}
                    onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                    placeholder="Cost"
                    className="w-28 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing summary */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span>KES {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>VAT (16% Standard):</span>
              <span>KES {vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-800">
              <span>Grand Total:</span>
              <span className="text-amber-400">KES {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors"
            >
              {submitting ? 'Generating...' : 'Issue Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateSupplierModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: 'Nairobi',
    country: 'Kenya',
    lead_time_days: 3,
    payment_terms: 'NET30',
    tax_pin: '',
    bank_name: '',
    bank_account_no: '',
    mpesa_paybill: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name || !formData.phone) {
      setError('Supplier Code, Name, and Phone are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/suppliers', formData);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create supplier');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            Add Supplier to Directory
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Supplier Code *</label>
              <input
                type="text"
                placeholder="e.g. BAMBURI-01"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white uppercase font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Company Name *</label>
              <input
                type="text"
                placeholder="e.g. Bamburi Cement PLC"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">KRA PIN</label>
              <input
                type="text"
                placeholder="e.g. P051234567Z"
                value={formData.tax_pin}
                onChange={(e) => setFormData({ ...formData, tax_pin: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white uppercase font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Payment Terms</label>
              <select
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="NET30">NET 30</option>
                <option value="NET15">NET 15</option>
                <option value="NET60">NET 60</option>
                <option value="COD">Cash On Delivery</option>
                <option value="ADVANCE">Advance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="Account Rep"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Phone *</label>
              <input
                type="text"
                placeholder="+254..."
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Email</label>
              <input
                type="email"
                placeholder="sales@..."
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Bank Name</label>
              <input
                type="text"
                placeholder="e.g. KCB Bank"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Bank Account / Paybill</label>
              <input
                type="text"
                placeholder="Account number"
                value={formData.bank_account_no}
                onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors"
            >
              {submitting ? 'Saving...' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReceiveGoodsModal({ po, onClose, onSuccess }) {
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptLines, setReceiptLines] = useState(
    (po.items || []).map(it => ({
      po_item_id: it.id,
      product_name: it.product_name,
      ordered_quantity: it.ordered_quantity,
      received_so_far: it.received_quantity,
      pending: it.ordered_quantity - it.received_quantity,
      quantity_receiving: Math.max(0, it.ordered_quantity - it.received_quantity),
      condition: 'GOOD',
      batch_number: '',
      expiry_date: ''
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLineChange = (index, field, value) => {
    const updated = [...receiptLines];
    updated[index][field] = value;
    setReceiptLines(updated);
  };

  const handleReceive = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const linesToSubmit = receiptLines
      .filter(l => Number(l.quantity_receiving) > 0)
      .map(l => ({
        po_item_id: l.po_item_id,
        quantity: Number(l.quantity_receiving),
        condition: l.condition,
        batch_number: l.batch_number || null,
        expiry_date: l.expiry_date || null
      }));

    if (linesToSubmit.length === 0) {
      setError('Please specify at least one item quantity to receive');
      setSubmitting(false);
      return;
    }

    try {
      await api.post(`/api/v1/procurement/orders/${po.id}/receive`, {
        supplier_invoice_no: supplierInvoiceNo,
        delivery_note_no: deliveryNoteNo,
        items: linesToSubmit,
        notes
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to process receiving');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-400" />
              Inbound Stock Receiving (GRN) — {po.po_number}
            </h3>
            <div className="text-xs text-slate-400 font-sans mt-0.5">
              Receiving goods from {po.supplier_name} into {po.warehouse_name}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleReceive} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Supplier Invoice #</label>
              <input
                type="text"
                placeholder="e.g. INV-10029"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Delivery Note #</label>
              <input
                type="text"
                placeholder="e.g. DN-9912"
                value={deliveryNoteNo}
                onChange={(e) => setDeliveryNoteNo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-2">Item Inspection & Receiving Quantities</label>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {receiptLines.map((line, idx) => (
                <div key={idx} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>{line.product_name}</span>
                    <span className="font-mono text-slate-400">
                      Pending: <span className="text-amber-400">{line.pending}</span> / {line.ordered_quantity}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-500">Qty Receiving</label>
                      <input
                        type="number"
                        min="0"
                        max={line.pending}
                        value={line.quantity_receiving}
                        onChange={(e) => handleLineChange(idx, 'quantity_receiving', e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-500">Condition</label>
                      <select
                        value={line.condition}
                        onChange={(e) => handleLineChange(idx, 'condition', e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="GOOD">Good (Available Stock)</option>
                        <option value="DAMAGED">Damaged on Arrival</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-500">Batch Number</label>
                      <input
                        type="text"
                        placeholder="Optional"
                        value={line.batch_number}
                        onChange={(e) => handleLineChange(idx, 'batch_number', e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Crediting Stock...' : 'Confirm Receipt & Allocate Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateInvoiceModal({ suppliers, orders, onClose, onSuccess }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [poId, setPoId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handlePOSelect = (selectedPoId) => {
    setPoId(selectedPoId);
    const order = orders.find(o => o.id === Number(selectedPoId));
    if (order) {
      setSupplierId(order.supplier_id);
      setSubtotal(order.subtotal);
      setTaxAmount(order.tax_amount);
      setTotalAmount(order.total_amount);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId || !supplierInvoiceNo || !totalAmount) {
      setError('Supplier, Vendor Invoice #, and Total Amount are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/procurement/invoices', {
        supplier_id: Number(supplierId),
        purchase_order_id: poId ? Number(poId) : null,
        supplier_invoice_no: supplierInvoiceNo,
        invoice_date: invoiceDate,
        due_date: dueDate || invoiceDate,
        subtotal: Number(subtotal) || Number(totalAmount) * 0.84,
        tax_amount: Number(taxAmount) || Number(totalAmount) * 0.16,
        total_amount: Number(totalAmount)
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to record invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            Log Supplier Bill / Invoice
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Match Against Purchase Order (Optional)</label>
            <select
              value={poId}
              onChange={(e) => handlePOSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="">No PO (Direct Bill)</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>{o.po_number} — {o.supplier_name} (KES {Number(o.total_amount).toLocaleString()})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Supplier's Invoice # *</label>
              <input
                type="text"
                placeholder="e.g. SINV-88421"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Total Bill Amount (KES) *</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono font-bold text-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors"
            >
              {submitting ? 'Saving...' : 'Record Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecordPaymentModal({ invoice, onClose, onSuccess }) {
  const remaining = Number(invoice.total_amount) - Number(invoice.amount_paid);
  const [amount, setAmount] = useState(remaining);
  const [paymentMethod, setPaymentMethod] = useState('BANK');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !referenceNumber) {
      setError('Amount and Reference / Cheque number are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/api/v1/procurement/invoices/${invoice.id}/pay`, {
        amount: Number(amount),
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        payment_date: paymentDate,
        notes
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            Disburse Supplier Payment
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1 text-xs font-mono">
            <div className="text-slate-400">Bill: <span className="text-white font-bold">{invoice.supplier_invoice_no}</span></div>
            <div className="text-slate-400">Supplier: <span className="text-white font-bold">{invoice.supplier_name}</span></div>
            <div className="text-slate-400">Outstanding Balance: <span className="text-amber-400 font-bold">KES {remaining.toLocaleString()}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Disbursement Amount (KES) *</label>
              <input
                type="number"
                step="0.01"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="BANK">Bank Transfer (EFT/RTGS)</option>
                <option value="MPESA">M-Pesa B2B / Paybill</option>
                <option value="CASH">Petty Cash</option>
                <option value="CARD">Corporate Card</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Reference / Cheque / Transaction ID *</label>
            <input
              type="text"
              placeholder="e.g. EFT-994821 or QKD88124KL"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono uppercase"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs transition-colors shadow-md shadow-emerald-500/20"
            >
              {submitting ? 'Processing...' : 'Disburse Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateReturnModal({ suppliers, productsList, warehousesList, onClose, onSuccess }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [warehouseId, setWarehouseId] = useState(warehousesList[0]?.id || '');
  const [reason, setReason] = useState('DAMAGED_ON_ARRIVAL');
  const [productId, setProductId] = useState(productsList[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(productsList[0]?.cost_price || 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/procurement/returns', {
        supplier_id: Number(supplierId),
        warehouse_id: Number(warehouseId),
        reason,
        items: [
          {
            product_id: Number(productId),
            quantity: Number(quantity),
            unit_cost: Number(unitCost),
            from_inventory_state: reason === 'DAMAGED_ON_ARRIVAL' ? 'DAMAGED' : 'AVAILABLE'
          }
        ]
      });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create return note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-400" />
            Raise Supplier Return (Debit Note)
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Warehouse</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                {warehousesList.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Reason for Return</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="DAMAGED_ON_ARRIVAL">Damaged On Arrival</option>
              <option value="DEFECTIVE">Defective / Quality Failure</option>
              <option value="OVER_DELIVERY">Excess Over-Delivery</option>
              <option value="WRONG_ITEM">Incorrect SKU Delivered</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Product</label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                const p = productsList.find(x => x.id === Number(e.target.value));
                if (p) setUnitCost(p.cost_price || 0);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
            >
              {productsList.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Return Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Unit Cost (KES)</label>
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-colors"
            >
              {submitting ? 'Generating...' : 'Issue Debit Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SupplierDetailModal({ supplier, onClose, onRefresh, productsList }) {
  const [subTab, setSubTab] = useState('scorecard'); // 'scorecard', 'contacts', 'products', 'history'
  const perf = supplier.performance || {};
  const history = supplier.history || [];
  const contacts = supplier.contacts || [];
  const products = supplier.products || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              {supplier.name}
              <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {supplier.code}
              </span>
            </h3>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              KRA PIN: {supplier.tax_pin || 'N/A'} • Payment Terms: {supplier.payment_terms}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="px-6 py-2 border-b border-slate-800 flex gap-2 bg-slate-900/40">
          {[
            { id: 'scorecard', label: 'Performance Scorecard' },
            { id: 'contacts', label: `Contacts (${contacts.length})` },
            { id: 'products', label: `Contracted Products (${products.length})` },
            { id: 'history', label: `Timeline (${history.length})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                subTab === t.id ? 'bg-amber-500/20 text-amber-300 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6 overflow-y-auto flex-1">
          {subTab === 'scorecard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Fulfillment Accuracy</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{perf.fulfillment_rate || 100}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Received vs Ordered</div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Quality Pass Rate</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{perf.quality_pass_rate || 100}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Goods in usable condition</div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Total Settled</div>
                  <div className="text-xl font-bold font-mono text-white mt-1 truncate">
                    KES {(perf.total_paid || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Disbursed via Bank/M-Pesa</div>
                </div>
              </div>

              <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="text-slate-300 font-bold font-sans">Banking & Settlement Profile:</div>
                <div className="text-slate-400">Bank: <span className="text-white">{supplier.bank_name || 'N/A'}</span></div>
                <div className="text-slate-400">Account: <span className="text-white">{supplier.bank_account_no || 'N/A'}</span></div>
                <div className="text-slate-400">M-Pesa Paybill: <span className="text-white">{supplier.mpesa_paybill || 'N/A'}</span></div>
                <div className="text-slate-400">Lead Time: <span className="text-white">{supplier.lead_time_days || 3} days</span></div>
              </div>
            </div>
          )}

          {subTab === 'contacts' && (
            <div className="space-y-3">
              {contacts.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">No contacts listed.</div>
              ) : (
                contacts.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white text-xs flex items-center gap-2">
                        {c.name}
                        {c.is_primary === 1 && (
                          <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] rounded font-mono">PRIMARY</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{c.role || 'Sales Rep'}</div>
                    </div>
                    <div className="text-right text-xs font-mono text-slate-300">
                      <div>{c.phone}</div>
                      <div className="text-slate-500 text-[10px]">{c.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {subTab === 'products' && (
            <div className="space-y-2">
              {products.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">No contracted products assigned.</div>
              ) : (
                products.map((p) => (
                  <div key={p.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-semibold text-white font-sans">{p.product_name}</div>
                      <div className="text-slate-500 text-[10px]">SKU: {p.sku} | Vendor SKU: {p.supplier_sku || 'N/A'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-amber-400 font-bold">KES {Number(p.agreed_cost).toLocaleString()}</div>
                      <div className="text-slate-500 text-[10px]">Min Qty: {p.min_order_quantity}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {subTab === 'history' && (
            <div className="space-y-2">
              {history.map((ev, i) => (
                <div key={i} className="p-2.5 bg-slate-900/40 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold">{ev.type}</span>
                    <span className="text-white font-sans">{ev.title}</span>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    {new Date(ev.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PODetailModal({ po, onClose, onRefresh, isManagerOrAdmin }) {
  const items = po.items || [];
  const receipts = po.receipts || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-base flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              {po.po_number}
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {po.status}
              </span>
            </h3>
            <div className="text-xs text-slate-400 font-sans mt-0.5">
              Supplier: {po.supplier_name} • Destination: {po.warehouse_name} ({po.branch_name})
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Header controls if APPROVED or DRAFT */}
          {isManagerOrAdmin && po.status === 'APPROVED' && (
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center justify-between">
              <div className="text-xs text-sky-300 font-sans">
                This PO is approved. Transmit formal order details to the vendor.
              </div>
              <button
                onClick={async () => {
                  sound.playClick();
                  await api.post(`/api/v1/procurement/orders/${po.id}/send`);
                  onRefresh();
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Send to Vendor
              </button>
            </div>
          )}

          {isManagerOrAdmin && po.status === 'DRAFT' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
              <div className="text-xs text-amber-300 font-sans">
                Review line items and authorize procurement order.
              </div>
              <button
                onClick={async () => {
                  sound.playClick();
                  await api.post(`/api/v1/procurement/orders/${po.id}/approve`);
                  onRefresh();
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Approve PO
              </button>
            </div>
          )}

          {/* Line items table */}
          <div>
            <div className="text-xs font-mono text-slate-400 mb-2">Order Line Items:</div>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-3 font-sans">Product</th>
                    <th className="py-2.5 px-3">Ordered</th>
                    <th className="py-2.5 px-3">Received</th>
                    <th className="py-2.5 px-3">Unit Cost</th>
                    <th className="py-2.5 px-3">Total (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3 font-sans text-white font-medium">
                        {it.product_name}
                        <div className="text-[10px] text-slate-500 font-mono">{it.sku}</div>
                      </td>
                      <td className="py-2.5 px-3 text-white font-bold">{it.ordered_quantity}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">{it.received_quantity}</td>
                      <td className="py-2.5 px-3 text-slate-300">{Number(it.unit_cost).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-white font-bold">{Number(it.total_cost).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inbound GRN History */}
          <div>
            <div className="text-xs font-mono text-slate-400 mb-2">Inbound Goods Receipts (GRNs):</div>
            {receipts.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                No inbound receipts logged yet.
              </div>
            ) : (
              <div className="space-y-2">
                {receipts.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">{r.receipt_number}</span>
                      <span className="text-slate-400 font-sans">Received by {r.received_by_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-bold">{r.total_items} items</span>
                      <span className="text-slate-500 text-[10px] ml-2">({new Date(r.created_at).toLocaleDateString()})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
