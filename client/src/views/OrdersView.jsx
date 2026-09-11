// client/src/views/OrdersView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Receipt,
  Search,
  Printer,
  Eye,
  X,
  CreditCard,
  Building2,
  Calendar,
  RotateCcw,
  Smartphone,
  Banknote,
  Truck,
  CheckCircle2,
  Clock,
  Filter,
  FileText,
  User,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Tag,
  Hash,
} from 'lucide-react';

export function OrdersView() {
  const { user, selectedBranch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState('ALL'); // ALL, WALK_IN_POS, DELIVERY_DISPATCH
  const [tenderFilter, setTenderFilter] = useState('ALL'); // ALL, MPESA, CASH, CARD
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, COMPLETED, DISPATCHED, PREPARING, PENDING

  // Order Details Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);

  // Thermal Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState(null);

  const searchInputRef = useRef(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const data = await api.get(`/api/orders${branchParam}`);
      setOrders(Array.isArray(data) ? data : []);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load orders:', e);
      api.toast('Failed to load transactions: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
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
        setOrderDetailsModalOpen(false);
        setReceiptModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // View full order details
  const viewOrderDetails = async (order) => {
    try {
      sound.playScan();
      const full = await api.get(`/api/orders/${order.id}`);
      setSelectedOrder(full || order);
      setOrderDetailsModalOpen(true);
    } catch (e) {
      setSelectedOrder(order);
      setOrderDetailsModalOpen(true);
    }
  };

  // Open thermal receipt modal
  const openReceiptModal = async (order) => {
    try {
      sound.playScan();
      const full = await api.get(`/api/orders/${order.id}`);
      setReceiptOrder(full || order);
      setReceiptModalOpen(true);
    } catch (e) {
      setReceiptOrder(order);
      setReceiptModalOpen(true);
    }
  };

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    // Type filter
    if (orderTypeFilter !== 'ALL' && o.order_type !== orderTypeFilter) {
      return false;
    }
    // Tender filter
    if (tenderFilter !== 'ALL' && o.payment_method !== tenderFilter) {
      return false;
    }
    // Status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'COMPLETED' && !['COMPLETED', 'PAID', 'DELIVERED'].includes(o.status)) {
        return false;
      } else if (statusFilter !== 'COMPLETED' && o.status !== statusFilter) {
        return false;
      }
    }
    // Text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOrder = o.order_number?.toLowerCase().includes(q);
      const matchCustomer = o.customer_name?.toLowerCase().includes(q);
      const matchPhone = o.customer_phone?.toLowerCase().includes(q);
      const matchRef = o.payment_reference?.toLowerCase().includes(q);
      const matchCashier = o.cashier_name?.toLowerCase().includes(q);
      const matchDelivery = o.delivery_number?.toLowerCase().includes(q);

      if (!matchOrder && !matchCustomer && !matchPhone && !matchRef && !matchCashier && !matchDelivery) {
        return false;
      }
    }
    return true;
  });

  // Telemetry KPIs
  const totalVolume = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const mpesaVolume = orders.filter((o) => o.payment_method === 'MPESA').reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const cashVolume = orders.filter((o) => o.payment_method === 'CASH').reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const deliveryCount = orders.filter((o) => o.order_type === 'DELIVERY_DISPATCH' || !!o.delivery_number).length;
  const posCount = orders.filter((o) => o.order_type === 'WALK_IN_POS' || !o.delivery_number).length;

  return (
    <div className="space-y-4">
      {/* 1. TOP OPERATIONAL INSTRUMENT CONSOLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-blue-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Sales Ledger & Order Transactions
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono text-slate-400">
                  AUDIT // FINANCIALS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                STATION: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'All Regional Stations'}</span>
                <span className="mx-2 text-[#222834]">|</span>
                ETR: <span className="text-emerald-400 font-bold">KRA COMPLIANT</span>
                {lastSyncTime && <span className="ml-1 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchOrders();
                sound.playScan();
              }}
              disabled={loading}
              className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh sales ledger"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
              <span>SYNC LEDGER</span>
            </button>
          </div>
        </div>

        {/* 2. UNIFIED HARDWARE TELEMETRY STRIP (Dieter Rams Matrix) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block">Gross Sales Revenue</span>
              <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
                {api.formatKES(totalVolume)}
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Transactions Total</span>
              <span className="text-lg font-mono font-bold text-slate-100 tabular-nums">{orders.length}</span>
            </div>
            <Receipt className="w-4 h-4 text-slate-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-green-400 font-mono uppercase tracking-wider block">M-Pesa Express Total</span>
              <span className="text-lg font-mono font-bold text-green-400 tabular-nums">
                {api.formatKES(mpesaVolume)}
              </span>
            </div>
            <Smartphone className="w-4 h-4 text-green-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-blue-400 font-mono uppercase tracking-wider block">Cash Register Total</span>
              <span className="text-lg font-mono font-bold text-blue-400 tabular-nums">
                {api.formatKES(cashVolume)}
              </span>
            </div>
            <Banknote className="w-4 h-4 text-blue-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-wider block">Channel Distribution</span>
              <span className="text-xs font-mono font-bold text-slate-300">
                {posCount} POS • {deliveryCount} Courier
              </span>
            </div>
            <Truck className="w-4 h-4 text-indigo-400" />
          </div>
        </div>

        {/* 3. SWITCHBOARD CONTROLS & FILTER BAR */}
        <div className="pt-2 border-t border-[#222834] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, customer, phone, M-Pesa ref, cashier... [F2]"
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
            {/* Order Type Filter */}
            <div className="flex bg-[#0c0e12] p-0.5 rounded border border-[#222834] text-[10px] font-mono">
              {[
                { id: 'ALL', label: 'ALL TYPES' },
                { id: 'WALK_IN_POS', label: 'POS' },
                { id: 'DELIVERY_DISPATCH', label: 'COURIER' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setOrderTypeFilter(t.id);
                    sound.playScan();
                  }}
                  className={`px-2 py-1 rounded font-bold transition-colors cursor-pointer ${
                    orderTypeFilter === t.id
                      ? 'bg-[#181d28] text-white border border-[#222834]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tender Method Filter */}
            <select
              value={tenderFilter}
              onChange={(e) => {
                setTenderFilter(e.target.value);
                sound.playScan();
              }}
              className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">ALL TENDERS</option>
              <option value="MPESA">M-PESA</option>
              <option value="CASH">CASH</option>
              <option value="CARD">CARD</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                sound.playScan();
              }}
              className="px-2.5 py-1.5 bg-[#0c0e12] border border-[#222834] rounded text-[11px] font-mono text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">ALL STATUSES</option>
              <option value="COMPLETED">COMPLETED / PAID</option>
              <option value="DISPATCHED">DISPATCHED</option>
              <option value="PREPARING">PREPARING</option>
              <option value="PENDING">PENDING</option>
            </select>

            {(searchQuery || orderTypeFilter !== 'ALL' || tenderFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setOrderTypeFilter('ALL');
                  setTenderFilter('ALL');
                  setStatusFilter('ALL');
                  sound.playScan();
                }}
                className="px-2 py-1.5 rounded bg-[#181d28] hover:bg-rose-500/20 border border-[#222834] hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-[10px] font-mono cursor-pointer transition-colors"
              >
                RESET
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. ORDERS MATRIX TABLE (Dieter Rams Mathematical Ledger) */}
      <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                <th className="p-3">Order # & Manifest</th>
                <th className="p-3">Date & Timestamp</th>
                <th className="p-3">Customer & Channel</th>
                <th className="p-3">Tender & Reference</th>
                <th className="p-3">Cashier / Station</th>
                <th className="p-3 text-right">Items</th>
                <th className="p-3 text-right">Gross Total (KES)</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222834]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500 font-mono">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <span>No sales transactions found matching the filter criteria.</span>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isPaid = ['COMPLETED', 'PAID', 'DELIVERED'].includes(ord.status);
                  const isMpesa = ord.payment_method === 'MPESA';
                  const isDelivery = ord.order_type === 'DELIVERY_DISPATCH' || !!ord.delivery_number;

                  return (
                    <tr key={ord.id} className="hover:bg-[#181d28]/40 transition-colors">
                      {/* Order & Delivery Number */}
                      <td className="p-3">
                        <div className="font-bold text-blue-400">{ord.order_number}</div>
                        {ord.delivery_number && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Truck className="w-2.5 h-2.5 text-indigo-400" />
                            {ord.delivery_number}
                          </span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="p-3 text-slate-400 text-[10px] tabular-nums">
                        {new Date(ord.created_at).toLocaleString('en-KE')}
                      </td>

                      {/* Customer & Channel */}
                      <td className="p-3">
                        <div className="font-semibold text-slate-200">{ord.customer_name || 'Walk-in Retail Customer'}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span
                            className={`px-1 rounded text-[9px] uppercase font-bold ${
                              isDelivery
                                ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                                : 'bg-[#181d28] text-slate-400 border border-[#222834]'
                            }`}
                          >
                            {isDelivery ? 'COURIER' : 'POS'}
                          </span>
                          {ord.customer_phone && <span>{ord.customer_phone}</span>}
                        </div>
                      </td>

                      {/* Tender & Payment Reference */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              isMpesa
                                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                : ord.payment_method === 'CARD'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            {ord.payment_method}
                          </span>
                        </div>
                        {ord.payment_reference && (
                          <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[120px]">
                            {ord.payment_reference}
                          </span>
                        )}
                      </td>

                      {/* Cashier / Station */}
                      <td className="p-3 text-slate-300 text-[11px]">
                        <span>{ord.cashier_name || 'Cashier'}</span>
                        <span className="text-[10px] text-slate-500 block">{ord.branch_name || 'Hub'}</span>
                      </td>

                      {/* Items Count */}
                      <td className="p-3 text-right font-bold text-slate-300 tabular-nums">
                        {ord.items_count || 1}
                      </td>

                      {/* Total Gross Amount */}
                      <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">
                        {api.formatKES(ord.total_amount)}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : ord.status === 'DISPATCHED'
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => viewOrderDetails(ord)}
                            className="px-2 py-1 rounded bg-[#0c0e12] hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 border border-[#222834] hover:border-blue-500/40 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Inspect Order Audit"
                          >
                            <Eye className="w-3 h-3" />
                            <span>INSPECT</span>
                          </button>

                          <button
                            onClick={() => openReceiptModal(ord)}
                            className="px-2 py-1 rounded bg-[#0c0e12] hover:bg-slate-700 text-slate-300 hover:text-white border border-[#222834] text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                            title="Reprint Thermal Receipt"
                          >
                            <Printer className="w-3 h-3 text-slate-400" />
                            <span>RECEIPT</span>
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

      {/* 5. ORDER AUDIT INSPECTOR MODAL */}
      {orderDetailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-lg w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setOrderDetailsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider font-bold">
                AUDIT // TRANSACTION INSPECTOR
              </span>
              <h3 className="text-base font-bold text-slate-100 font-mono mt-0.5">
                {selectedOrder.order_number}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Executed on {new Date(selectedOrder.created_at).toLocaleString('en-KE')}
              </p>
            </div>

            {/* Metadata Matrix */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-[#0c0e12] border border-[#222834] rounded p-3">
              <div>
                <span className="text-slate-500 block text-[10px]">CUSTOMER:</span>
                <span className="font-semibold text-slate-200">{selectedOrder.customer_name || 'Walk-in Retail'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">TENDER:</span>
                <span className="font-bold text-emerald-400">{selectedOrder.payment_method}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">PAYMENT REFERENCE:</span>
                <span className="font-mono text-slate-300 truncate block">{selectedOrder.payment_reference || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">CASHIER:</span>
                <span className="text-slate-300 font-semibold">{selectedOrder.cashier_name || 'Cashier'}</span>
              </div>
            </div>

            {/* Delivery Manifest Context (if delivery) */}
            {selectedOrder.delivery && (
              <div className="p-3 bg-[#0c0e12] border border-[#222834] rounded space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-indigo-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    DISPATCH MANIFEST // {selectedOrder.delivery.delivery_number}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 border border-indigo-500/30">
                    {selectedOrder.delivery.status}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Courier Driver:</span>
                  <span className="text-slate-200 font-semibold">{selectedOrder.delivery.driver_name || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Assigned Vehicle:</span>
                  <span className="text-slate-200">{selectedOrder.delivery.registration_number || selectedOrder.delivery.vehicle_model || 'Boda Boda'}</span>
                </div>
                {selectedOrder.delivery.pod_recipient && (
                  <div className="flex justify-between text-emerald-400 text-[11px] pt-1 border-t border-[#222834]">
                    <span>POD Verified Recipient:</span>
                    <span className="font-bold">{selectedOrder.delivery.pod_recipient}</span>
                  </div>
                )}
              </div>
            )}

            {/* Line Items List */}
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Itemized Line Items
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {(selectedOrder.items || []).map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-[#0c0e12] border border-[#222834] flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <span className="font-bold text-slate-200 block">{it.product_name || `SKU Item #${it.product_id}`}</span>
                      <span className="text-[10px] text-slate-400">
                        {it.quantity} {it.unit || 'pcs'} x {api.formatKES(it.unit_price)}
                      </span>
                    </div>
                    <span className="font-bold text-slate-200 tabular-nums">
                      {api.formatKES(it.quantity * it.unit_price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Ledger Breakdown */}
            <div className="pt-2 border-t border-[#222834] space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal (Net of Tax):</span>
                <span className="tabular-nums">{api.formatKES(selectedOrder.subtotal || selectedOrder.total_amount * 0.84)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>KRA VAT (16% Standard):</span>
                <span className="tabular-nums">{api.formatKES(selectedOrder.vat_amount || selectedOrder.total_amount * 0.16)}</span>
              </div>
              <div className="flex justify-between text-slate-100 font-bold text-sm pt-1 border-t border-[#222834]">
                <span>Grand Total Settled:</span>
                <span className="text-emerald-400 font-black tabular-nums">
                  {api.formatKES(selectedOrder.total_amount)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex gap-2.5">
              <button
                onClick={() => {
                  setOrderDetailsModalOpen(false);
                  openReceiptModal(selectedOrder);
                }}
                className="flex-1 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>View Thermal Receipt</span>
              </button>
              <button
                onClick={() => setOrderDetailsModalOpen(false)}
                className="py-2 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. THERMAL RECEIPT MODAL (Dieter Rams Clean Monospace ETR Receipt) */}
      {receiptModalOpen && receiptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-sm w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setReceiptModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Thermal Paper Simulation */}
            <div
              id="printable-thermal-receipt"
              className="bg-white text-black p-5 rounded font-mono text-[11px] leading-relaxed shadow-md select-text"
            >
              <div className="text-center pb-2 border-b border-dashed border-gray-400 space-y-0.5">
                <h2 className="text-sm font-black tracking-wider uppercase">SwiftTrack Kenya</h2>
                <p className="text-[10px] text-gray-700">{receiptOrder.branch_name || 'Nairobi Central Hub'}</p>
                <p className="text-[9px] text-gray-600">KRA PIN: P051982736X • ETR APPROVED</p>
                <p className="text-[9px] text-gray-600">TEL: +254 700 000 000</p>
              </div>

              <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>RECEIPT #:</span>
                  <span className="font-bold">{receiptOrder.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{new Date(receiptOrder.created_at).toLocaleString('en-KE')}</span>
                </div>
                <div className="flex justify-between">
                  <span>CASHIER:</span>
                  <span>{receiptOrder.cashier_name || user?.full_name || 'Staff'}</span>
                </div>
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span>{receiptOrder.customer_name || 'Walk-in Customer'}</span>
                </div>
                {receiptOrder.payment_reference && (
                  <div className="flex justify-between">
                    <span>PAY REF:</span>
                    <span className="font-bold">{receiptOrder.payment_reference}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
                <div className="flex justify-between font-bold text-[10px] pb-0.5">
                  <span>ITEM</span>
                  <span>QTY x PRICE</span>
                  <span>TOTAL</span>
                </div>
                {(receiptOrder.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span className="truncate max-w-[110px]">{it.product_name}</span>
                    <span>{it.quantity} x {Number(it.unit_price).toFixed(0)}</span>
                    <span className="font-bold tabular-nums">{(it.quantity * it.unit_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span className="tabular-nums">{(receiptOrder.total_amount * 0.84).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>KRA VAT 16%:</span>
                  <span className="tabular-nums">{(receiptOrder.total_amount * 0.16).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-black pt-1 border-t border-gray-300">
                  <span>TOTAL (KES):</span>
                  <span className="tabular-nums">{Number(receiptOrder.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-[10px] pt-0.5">
                  <span>TENDER ({receiptOrder.payment_method}):</span>
                  <span className="tabular-nums">{Number(receiptOrder.total_amount).toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center pt-3 text-[9px] text-gray-700 space-y-0.5">
                <p className="font-bold">*** OFFICIAL FISCAL RECEIPT ***</p>
                <p>Asante kwa Kununua Nasi!</p>
                <p className="text-[8px] text-gray-500 font-mono">POWERED BY SWIFTTRACK ENTERPRISE</p>
              </div>
            </div>

            {/* Print Trigger */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  sound.playSuccess();
                  window.print();
                }}
                className="flex-1 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Physical Slip</span>
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="py-2 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
