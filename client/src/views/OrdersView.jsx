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
  Plus,
  Download,
  Edit,
  AlertCircle,
  ArrowUpRight,
  Check,
  Send,
  ChevronRight,
  AlertTriangle,
  Trash2,
  Lock,
  Unlock,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';

const STATE_MACHINE_STEPS = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PAID', label: 'Paid' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'PACKED', label: 'Packed' },
  { key: 'READY_FOR_DISPATCH', label: 'Ready' },
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'DELIVERED', label: 'Delivered' },
];

export const ALTERNATIVE_STATES = [
  'CANCELLED',
  'FAILED_DELIVERY',
  'RETURNED',
  'PARTIALLY_RETURNED',
  'REFUNDED',
];

export function OrdersView() {
  const { user, selectedBranch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [orderTypeFilter, setOrderTypeFilter] = useState('ALL');

  // Modals
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('items'); // items, customer, timeline, notes, delivery

  // Create / Edit Order Modal
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create'); // create or edit
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);

  // Form Fields
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formCustomerSearch, setFormCustomerSearch] = useState('');
  const [formCustomerOptions, setFormCustomerOptions] = useState([]);
  const [formCustomerDropdown, setFormCustomerDropdown] = useState(false);
  const [formSelectedCustomer, setFormSelectedCustomer] = useState(null);
  const [formDeliveryAddress, setFormDeliveryAddress] = useState('');
  const [formDeliveryCity, setFormDeliveryCity] = useState('Nairobi');
  const [formRecipientName, setFormRecipientName] = useState('');
  const [formRecipientPhone, setFormRecipientPhone] = useState('');
  const [formDeliveryFee, setFormDeliveryFee] = useState(350);
  const [formSpecialInstructions, setFormSpecialInstructions] = useState('');
  const [formItems, setFormItems] = useState([]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Cancel Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Tax Invoice Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Thermal Receipt Modal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState(null);

  // Internal Notes State
  const [newNoteText, setNewNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const searchInputRef = useRef(null);

  // Fetch orders from API
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const data = await api.get(`/api/orders${branchParam}`);
      setOrders(Array.isArray(data) ? data : []);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load orders:', e);
      api.toast('Failed to load orders: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedBranch]);

  // Load product catalog for order form
  useEffect(() => {
    async function loadCatalog() {
      try {
        const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
        const data = await api.get(`/api/products${branchParam}`);
        if (Array.isArray(data)) {
          setCatalogProducts(
            data.map((p) => ({
              ...p,
              price: Number(p.price ?? p.selling_price ?? 0),
              selling_price: Number(p.selling_price ?? p.price ?? 0),
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load catalog:', err);
      }
    }
    loadCatalog();
  }, [selectedBranch]);

  // Debounced customer search for order form
  useEffect(() => {
    let active = true;
    async function searchCustomers() {
      if (!formCustomerSearch.trim()) {
        setFormCustomerOptions([]);
        return;
      }
      try {
        const res = await api.get(`/api/customers?search=${encodeURIComponent(formCustomerSearch.trim())}&limit=5`);
        if (active && res.customers) {
          setFormCustomerOptions(res.customers);
        }
      } catch (err) {
        // ignore network error
      }
    }
    const t = setTimeout(searchCustomers, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [formCustomerSearch]);

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
        setOrderFormOpen(false);
        setInvoiceModalOpen(false);
        setReceiptModalOpen(false);
        setCancelModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // View full order details & timeline
  const viewOrderDetails = async (order) => {
    try {
      sound.playScan();
      const full = await api.get(`/api/orders/${order.id}`);
      setSelectedOrder(full || order);
      setDetailTab('items');
      setOrderDetailsModalOpen(true);
    } catch (e) {
      setSelectedOrder(order);
      setOrderDetailsModalOpen(true);
    }
  };

  // Open Create Order Modal
  const openCreateModal = () => {
    setFormMode('create');
    setEditingOrderId(null);
    setFormCustomerId('');
    setFormCustomerSearch('');
    setFormSelectedCustomer(null);
    setFormDeliveryAddress('');
    setFormDeliveryCity('Nairobi');
    setFormRecipientName('');
    setFormRecipientPhone('');
    setFormDeliveryFee(350);
    setFormSpecialInstructions('');
    setFormItems(
      catalogProducts.length > 0
        ? [{ product_id: catalogProducts[0].id, quantity: 1, unit_price: catalogProducts[0].selling_price }]
        : []
    );
    setOrderFormOpen(true);
  };

  // Invariant Guard: editing locked once order moves to PACKED or beyond
  const isFulfillmentLocked = (status) => !['DRAFT', 'CONFIRMED'].includes(status);

  // Open Edit Order Modal (Allowed for DRAFT or CONFIRMED)
  const openEditModal = async (order) => {
    if (isFulfillmentLocked(order.status)) {
      api.toast(`Cannot edit order in '${order.status}' status. Editing is only permitted prior to fulfillment.`, 'error');
      return;
    }
    try {
      const full = await api.get(`/api/orders/${order.id}`);
      setFormMode('edit');
      setEditingOrderId(order.id);
      setFormCustomerId(full.customer_id);
      setFormSelectedCustomer({
        id: full.customer_id,
        full_name: full.customer_name,
        phone: full.customer_phone,
      });
      setFormCustomerSearch(full.customer_name);
      setFormDeliveryAddress(full.delivery_address || '');
      setFormDeliveryCity(full.delivery_city || 'Nairobi');
      setFormRecipientName(full.recipient_name || '');
      setFormRecipientPhone(full.recipient_phone || '');
      setFormDeliveryFee(Number(full.delivery_fee) || 0);
      setFormSpecialInstructions(full.special_instructions || '');
      setFormItems(
        (full.items || []).map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
        }))
      );
      setOrderFormOpen(true);
    } catch (err) {
      api.toast(`Failed to load order for editing: ${err.message}`, 'error');
    }
  };

  // Submit Order Form (Create or Edit)
  const handleSaveOrder = async (targetInitialStatus = 'DRAFT') => {
    if (!formSelectedCustomer) {
      api.toast('Please select a customer', 'error');
      return;
    }
    if (formItems.length === 0) {
      api.toast('Please add at least one line item', 'error');
      return;
    }

    try {
      setFormSubmitting(true);
      if (formMode === 'create') {
        const payload = {
          branch_id: selectedBranch?.id || user?.branch_id || 1,
          customer_id: formSelectedCustomer.id,
          initial_status: targetInitialStatus,
          delivery_address: formDeliveryAddress,
          delivery_city: formDeliveryCity,
          recipient_name: formRecipientName || formSelectedCustomer.full_name,
          recipient_phone: formRecipientPhone || formSelectedCustomer.phone,
          delivery_fee: Number(formDeliveryFee) || 0,
          special_instructions: formSpecialInstructions,
          items: formItems.map((it) => ({
            product_id: Number(it.product_id),
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
          })),
        };

        const res = await api.post('/api/orders', payload);
        sound.playSuccess();
        api.toast(`Order ${res.order_number} created in ${res.status}!`, 'success');
        setOrderFormOpen(false);
        fetchOrders();
      } else {
        const payload = {
          delivery_fee: Number(formDeliveryFee) || 0,
          delivery_address: formDeliveryAddress,
          delivery_city: formDeliveryCity,
          recipient_name: formRecipientName,
          recipient_phone: formRecipientPhone,
          special_instructions: formSpecialInstructions,
          items: formItems.map((it) => ({
            product_id: Number(it.product_id),
            quantity: Number(it.quantity),
            unit_price: Number(it.unit_price),
          })),
        };

        await api.put(`/api/orders/${editingOrderId}`, payload);
        sound.playSuccess();
        api.toast('Order modified successfully before fulfillment', 'success');
        setOrderFormOpen(false);
        fetchOrders();
        if (selectedOrder && selectedOrder.id === editingOrderId) {
          viewOrderDetails({ id: editingOrderId });
        }
      }
    } catch (err) {
      sound.playError();
      api.toast(`Error: ${err.message}`, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // State Machine Transition Handler
  const handleTransition = async (toStatus, notes = '') => {
    if (!selectedOrder) return;
    try {
      const res = await api.post(`/api/orders/${selectedOrder.id}/transition`, {
        status: toStatus,
        notes: notes || `Advanced to ${toStatus}`,
      });
      sound.playSuccess();
      api.toast(`Order moved to ${toStatus}!`, 'success');
      setSelectedOrder(res.order);
      fetchOrders();
    } catch (err) {
      sound.playError();
      api.toast(`Transition blocked: ${err.message}`, 'error');
    }
  };

  // Cancel Order Handler
  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    try {
      setCancelling(true);
      const res = await api.post(`/api/orders/${selectedOrder.id}/cancel`, {
        reason: cancelReason || 'Order cancelled by staff',
      });
      sound.playSuccess();
      api.toast('Order cancelled and reserved stock released', 'success');
      setSelectedOrder(res.order);
      setCancelModalOpen(false);
      setCancelReason('');
      fetchOrders();
    } catch (err) {
      sound.playError();
      api.toast(`Cancellation failed: ${err.message}`, 'error');
    } finally {
      setCancelling(false);
    }
  };

  // Add Internal Staff Note
  const handleAddNote = async (e) => {
    e?.preventDefault();
    if (!selectedOrder || !newNoteText.trim()) return;
    try {
      setSubmittingNote(true);
      const res = await api.post(`/api/orders/${selectedOrder.id}/notes`, { note: newNoteText.trim() });
      sound.playSuccess();
      setSelectedOrder({ ...selectedOrder, internal_notes_list: res.notes });
      setNewNoteText('');
      api.toast('Staff note recorded', 'success');
    } catch (err) {
      api.toast(`Failed to add note: ${err.message}`, 'error');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Open Printable Tax Invoice Modal
  const openInvoiceModal = async (order) => {
    try {
      setInvoiceLoading(true);
      setInvoiceModalOpen(true);
      const inv = await api.get(`/api/orders/${order.id}/invoice`);
      setInvoiceData(inv);
    } catch (err) {
      api.toast(`Invoice generation failed: ${err.message}`, 'error');
      setInvoiceModalOpen(false);
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Open Thermal Receipt Modal
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

  // Export Filtered Orders to CSV
  const handleExportCsv = () => {
    const branchParam = selectedBranch ? `branch_id=${selectedBranch.id}&` : '';
    const statusParam = statusFilter !== 'ALL' ? `status=${statusFilter}&` : '';
    const searchParam = searchQuery ? `search=${encodeURIComponent(searchQuery)}&` : '';
    window.open(`/api/orders/export?${branchParam}${statusParam}${searchParam}`, '_blank');
  };

  // Operational Handler Aliases
  const handleTransitionStatus = handleTransition;
  const handleConfirmCancel = handleCancelOrder;
  const handleViewInvoice = openInvoiceModal;
  const handleViewReceipt = openReceiptModal;
  const handleSubmitOrder = handleSaveOrder;
  const handleOpenCreate = openCreateModal;
  const handleOpenEdit = openEditModal;

  // Filtered orders list
  const filteredOrders = orders.filter((o) => {
    if (orderTypeFilter !== 'ALL' && o.order_type !== orderTypeFilter) return false;
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOrder = o.order_number?.toLowerCase().includes(q);
      const matchCustomer = o.customer_name?.toLowerCase().includes(q);
      const matchPhone = o.customer_phone?.toLowerCase().includes(q);
      const matchDelivery = o.delivery_number?.toLowerCase().includes(q);
      if (!matchOrder && !matchCustomer && !matchPhone && !matchDelivery) return false;
    }
    return true;
  });

  // Telemetry KPIs
  const totalVolume = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const activeOrdersCount = orders.filter((o) => !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
  const draftCount = orders.filter((o) => o.status === 'DRAFT').length;

  // Form Subtotal calculation
  const formSubtotal = formItems.reduce((sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1), 0);
  const formTotal = formSubtotal + (Number(formDeliveryFee) || 0);

  // Helper: Status Badge Styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-700/40 text-slate-300 border-slate-600/50';
      case 'CONFIRMED':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'PAID':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'PROCESSING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'PACKED':
        return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40';
      case 'READY_FOR_DISPATCH':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'DISPATCHED':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'IN_TRANSIT':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 animate-pulse';
      case 'DELIVERED':
        return 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50';
      case 'CANCELLED':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'FAILED_DELIVERY':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'RETURNED':
        return 'bg-amber-600/20 text-amber-300 border-amber-600/40';
      case 'PARTIALLY_RETURNED':
        return 'bg-orange-500/20 text-orange-300 border-orange-400/40';
      case 'REFUNDED':
        return 'bg-purple-600/20 text-purple-300 border-purple-600/40';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP OPERATIONAL CONSOLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-blue-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Orders Engine // State Machine
                </h1>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
                  ETR & INVARIANT COMPLIANT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                STATION: <span className="text-slate-200 font-semibold">{selectedBranch?.name || 'All Regional Stations'}</span>
                {lastSyncTime && <span className="ml-2 text-slate-500 font-mono">({lastSyncTime} EAT)</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openCreateModal}
              className="h-8 px-3.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ CREATE ORDER</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="h-8 px-3 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export filtered orders to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">EXPORT CSV</span>
            </button>

            <button
              onClick={() => {
                fetchOrders();
                sound.playScan();
              }}
              disabled={loading}
              className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh orders ledger"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">SYNC</span>
            </button>
          </div>
        </div>

        {/* Telemetry KPI Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Orders</span>
              <span className="text-base font-mono font-bold text-white tabular-nums">{orders.length}</span>
            </div>
            <ShoppingBag className="w-4 h-4 text-slate-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-400 font-mono uppercase block">Active / In Progress</span>
              <span className="text-base font-mono font-bold text-amber-400 tabular-nums">{activeOrdersCount}</span>
            </div>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase block">Fulfilled & Delivered</span>
              <span className="text-base font-mono font-bold text-emerald-400 tabular-nums">{deliveredCount}</span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-blue-400 font-mono uppercase block">Gross Volume</span>
              <span className="text-base font-mono font-bold text-blue-400 tabular-nums truncate block">
                {api.formatKES(totalVolume)}
              </span>
            </div>
            <Banknote className="w-4 h-4 text-blue-500" />
          </div>
        </div>

        {/* State Machine Status Segmented Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-[#1b212c]">
          <span className="text-[10px] font-mono text-slate-500 uppercase mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> PIPELINE:
          </span>
          {['ALL', 'DRAFT', 'CONFIRMED', 'PAID', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'FAILED_DELIVERY', 'RETURNED', 'PARTIALLY_RETURNED', 'REFUNDED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono whitespace-nowrap transition-colors cursor-pointer border ${
                statusFilter === st
                  ? 'bg-amber-400 text-slate-950 font-bold border-amber-400'
                  : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search orders by order number, customer name, phone, or delivery number... (Press F2)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-14 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-500 text-xs font-sans focus:outline-none focus:border-amber-400"
          />
          <span className="absolute right-2.5 top-2 text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#141822]">
            F2
          </span>
        </div>
      </div>

      {/* 2. ORDERS DATA TABLE */}
      <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#0c0e12] border-b border-[#222834] text-slate-400 uppercase text-[10px]">
                <th className="p-3">Order Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Destination</th>
                <th className="p-3 text-center">Items</th>
                <th className="p-3 text-right">Delivery Fee</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-center">Allocation</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222834]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-12 text-center text-slate-500 font-mono text-xs">
                    No orders match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-[#161c28]/60 transition-colors">
                    <td className="p-3">
                      <span className="font-bold text-white hover:text-amber-300 cursor-pointer block truncate" onClick={() => viewOrderDetails(ord)}>
                        {ord.order_number}
                      </span>
                      {ord.delivery_number && (
                        <span className="text-[10px] text-indigo-400 block font-sans">
                          🚚 {ord.delivery_number}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(ord.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-slate-200 block truncate max-w-[140px]">
                        {ord.customer_name || 'Walk-in'}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">{ord.customer_phone}</span>
                    </td>
                    <td className="p-3 text-slate-300 text-[11px] truncate max-w-[130px]">
                      {ord.delivery_city || 'Nairobi'}
                    </td>
                    <td className="p-3 text-center tabular-nums text-slate-300">
                      {ord.items_count || 1}
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-400">
                      {ord.delivery_fee ? api.formatKES(ord.delivery_fee) : '—'}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-400 tabular-nums">
                      {api.formatKES(ord.total_amount)}
                    </td>
                    <td className="p-3 text-center">
                      {ord.inventory_allocated ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          ALLOCATED
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          UNALLOCATED
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${getStatusBadge(ord.status)}`}>
                        {ord.status}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => viewOrderDetails(ord)}
                          className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 hover:text-white border border-[#222834] cursor-pointer"
                          title="View Order Lifecycle"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {['DRAFT', 'CONFIRMED'].includes(ord.status) && (
                          <button
                            onClick={() => openEditModal(ord)}
                            className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-amber-400 hover:text-amber-300 border border-[#222834] cursor-pointer"
                            title="Edit Order before fulfillment"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => openInvoiceModal(ord)}
                          className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-blue-400 hover:text-blue-300 border border-[#222834] cursor-pointer"
                          title="Commercial Tax Invoice"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => openReceiptModal(ord)}
                          className="p-1 rounded bg-[#161c28] hover:bg-[#202738] text-emerald-400 hover:text-emerald-300 border border-[#222834] cursor-pointer"
                          title="Thermal Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
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

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ORDER LIFECYCLE & STATE MACHINE DEEP DIVE */}
      {/* ------------------------------------------------------------- */}
      {orderDetailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 select-none overflow-y-auto">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-4xl w-full shadow-2xl relative my-auto animate-in fade-in duration-150 text-xs font-mono">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#222834] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center font-bold">
                  #{selectedOrder.id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white uppercase">{selectedOrder.order_number}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Customer: <strong className="text-slate-200">{selectedOrder.customer_name}</strong> ({selectedOrder.customer_phone})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openInvoiceModal(selectedOrder)}
                  className="px-2.5 py-1 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>TAX INVOICE</span>
                </button>
                <button
                  onClick={() => setOrderDetailsModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* STATE MACHINE PROGRESS STEPPER */}
            <div className="p-4 bg-[#0c0e12] border-b border-[#222834]">
              {selectedOrder.status === 'CANCELLED' ? (
                <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span className="font-bold">ORDER CANCELLED</span>
                    <span className="text-[11px] text-slate-400">({selectedOrder.cancellation_reason || 'Staff cancelled'})</span>
                  </div>
                  <span className="text-[10px] text-rose-400 font-mono">Inventory Reservations Released</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between overflow-x-auto no-scrollbar gap-1 py-1">
                    {STATE_MACHINE_STEPS.map((step, idx) => {
                      const currentIdx = STATE_MACHINE_STEPS.findIndex((s) => s.key === selectedOrder.status);
                      const isCompleted = idx < currentIdx;
                      const isCurrent = idx === currentIdx;

                      return (
                        <div key={step.key} className="flex items-center gap-1 shrink-0">
                          <div
                            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 border ${
                              isCurrent
                                ? 'bg-amber-400 text-slate-950 border-amber-400 shadow'
                                : isCompleted
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-[#161c28] text-slate-500 border-[#222834]'
                            }`}
                          >
                            {isCompleted && <Check className="w-3 h-3 text-emerald-400" />}
                            <span>{step.label}</span>
                          </div>
                          {idx < STATE_MACHINE_STEPS.length - 1 && (
                            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Critical Invariant Callout */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1b212c] text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Inventory Status:</span>
                      {selectedOrder.inventory_allocated ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>ALLOCATED (RESERVED)</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>UNALLOCATED (Required before READY_FOR_DISPATCH)</span>
                        </span>
                      )}
                    </div>

                    {/* Next Action Buttons based on current state */}
                    <div className="flex items-center gap-2">
                      {selectedOrder.status === 'DRAFT' && (
                        <button
                          onClick={() => handleTransition('CONFIRMED', 'Customer confirmed order')}
                          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer"
                        >
                          CONFIRM & RESERVE INVENTORY
                        </button>
                      )}
                      {selectedOrder.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleTransition('PROCESSING', 'Order sent to picking')}
                          className="px-3 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
                        >
                          START PROCESSING (PICK)
                        </button>
                      )}
                      {selectedOrder.status === 'PAID' && (
                        <button
                          onClick={() => handleTransition('PROCESSING', 'Picking underway')}
                          className="px-3 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
                        >
                          START PROCESSING
                        </button>
                      )}
                      {selectedOrder.status === 'PROCESSING' && (
                        <button
                          onClick={() => handleTransition('PACKED', 'Items picked and packed')}
                          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                        >
                          MARK AS PACKED
                        </button>
                      )}
                      {selectedOrder.status === 'PACKED' && (
                        <button
                          onClick={() => handleTransition('READY_FOR_DISPATCH', 'Staged at dispatch')}
                          className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
                        >
                          READY FOR DISPATCH (GUARD)
                        </button>
                      )}
                      {selectedOrder.status === 'READY_FOR_DISPATCH' && (
                        <button
                          onClick={() => handleTransition('DISPATCHED', 'Outbound driver handoff')}
                          className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold cursor-pointer"
                        >
                          DISPATCH (DEDUCT STOCK)
                        </button>
                      )}
                      {selectedOrder.status === 'DISPATCHED' && (
                        <button
                          onClick={() => handleTransition('IN_TRANSIT', 'Driver en route')}
                          className="px-3 py-1 rounded bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold cursor-pointer"
                        >
                          MARK IN TRANSIT
                        </button>
                      )}
                      {selectedOrder.status === 'IN_TRANSIT' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleTransition('DELIVERED', 'POD confirmed')}
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold cursor-pointer"
                          >
                            CONFIRM DELIVERED
                          </button>
                          <button
                            onClick={() => handleTransition('FAILED_DELIVERY', 'Delivery attempt failed')}
                            className="px-2.5 py-1 rounded bg-red-900/50 hover:bg-red-800/70 border border-red-700/60 text-red-300 font-bold cursor-pointer"
                          >
                            FAILED DELIVERY
                          </button>
                        </div>
                      )}
                      {selectedOrder.status === 'FAILED_DELIVERY' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleTransition('DISPATCHED', 'Re-dispatching after failed delivery')}
                            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold cursor-pointer"
                          >
                            RE-DISPATCH
                          </button>
                          <button
                            onClick={() => handleTransition('RETURNED', 'Returned to warehouse')}
                            className="px-2.5 py-1 rounded bg-amber-900/50 hover:bg-amber-800/70 border border-amber-700/60 text-amber-300 font-bold cursor-pointer"
                          >
                            RETURN TO WH
                          </button>
                        </div>
                      )}
                      {selectedOrder.status === 'DELIVERED' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleTransition('RETURNED', 'Customer initiated return')}
                            className="px-2.5 py-1 rounded bg-amber-900/50 hover:bg-amber-800/70 border border-amber-700/60 text-amber-300 font-bold cursor-pointer"
                          >
                            RETURN ORDER
                          </button>
                          <button
                            onClick={() => handleTransition('REFUNDED', 'Order refunded')}
                            className="px-2.5 py-1 rounded bg-purple-900/50 hover:bg-purple-800/70 border border-purple-700/60 text-purple-300 font-bold cursor-pointer"
                          >
                            REFUND
                          </button>
                        </div>
                      )}
                      {selectedOrder.status === 'RETURNED' && (
                        <button
                          onClick={() => handleTransition('REFUNDED', 'Refund processed for returned items')}
                          className="px-2.5 py-1 rounded bg-purple-900/50 hover:bg-purple-800/70 border border-purple-700/60 text-purple-300 font-bold cursor-pointer"
                        >
                          PROCESS REFUND
                        </button>
                      )}

                      {/* Cancel Order Action */}
                      {!['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(selectedOrder.status) && (
                        <button
                          onClick={() => setCancelModalOpen(true)}
                          className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-bold cursor-pointer"
                        >
                          CANCEL
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex border-b border-[#222834] px-4 pt-2 gap-2 text-xs font-mono bg-[#161c28]">
              {[
                { id: 'items', label: `Items (${selectedOrder.items?.length || 0})` },
                { id: 'customer', label: 'Customer & Address' },
                { id: 'timeline', label: `Timeline (${selectedOrder.timeline?.length || 0})` },
                { id: 'notes', label: `Internal Notes (${selectedOrder.internal_notes_list?.length || 0})` },
                { id: 'delivery', label: 'Delivery & Fleet' },
              ].map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setDetailTab(tb.id)}
                  className={`py-2 px-3 border-b-2 font-bold cursor-pointer transition-colors ${
                    detailTab === tb.id
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {/* TAB PANELS */}
            <div className="p-4 sm:p-5 max-h-96 overflow-y-auto">
              {/* TAB 1: ITEMS */}
              {detailTab === 'items' && (
                <div className="space-y-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#222834] text-slate-400 uppercase text-[10px]">
                        <th className="pb-2">SKU</th>
                        <th className="pb-2">Product Name</th>
                        <th className="pb-2 text-center">Qty</th>
                        <th className="pb-2 text-right">Unit Price</th>
                        <th className="pb-2 text-right">Total Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222834]">
                      {(selectedOrder.items || []).map((it) => (
                        <tr key={it.id} className="text-slate-300">
                          <td className="py-2 text-[10px] text-slate-400">{it.sku}</td>
                          <td className="py-2 font-medium text-white">{it.product_name}</td>
                          <td className="py-2 text-center tabular-nums">{it.quantity}</td>
                          <td className="py-2 text-right tabular-nums">{api.formatKES(it.unit_price)}</td>
                          <td className="py-2 text-right font-bold text-emerald-400 tabular-nums">
                            {api.formatKES(it.total_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Summary Totals */}
                  <div className="pt-3 border-t border-[#222834] max-w-xs ml-auto space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal:</span>
                      <span className="text-white tabular-nums">{api.formatKES(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>KRA VAT (16%):</span>
                      <span className="text-white tabular-nums">{api.formatKES(selectedOrder.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Delivery Fee:</span>
                      <span className="text-white tabular-nums">{api.formatKES(selectedOrder.delivery_fee)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1 border-t border-[#222834] text-sm">
                      <span className="text-white">TOTAL:</span>
                      <span className="text-emerald-400 tabular-nums">{api.formatKES(selectedOrder.total_amount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CUSTOMER & DESTINATION */}
              {detailTab === 'customer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded bg-[#0c0e12] border border-[#222834] space-y-2">
                    <span className="text-[10px] uppercase text-slate-500 font-bold block">CUSTOMER PROFILE</span>
                    <p className="font-bold text-white text-sm">{selectedOrder.customer_name}</p>
                    <p className="text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{selectedOrder.customer_phone}</span>
                    </p>
                    {selectedOrder.customer_email && (
                      <p className="text-slate-400 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{selectedOrder.customer_email}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500">
                      Customer Number: <strong className="text-slate-300">{selectedOrder.customer_number || 'N/A'}</strong>
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[#0c0e12] border border-[#222834] space-y-2">
                    <span className="text-[10px] uppercase text-slate-500 font-bold block">DELIVERY DESTINATION</span>
                    <p className="text-white font-medium flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{selectedOrder.delivery_address || 'Customer Primary Address'}</span>
                    </p>
                    <p className="text-slate-400">City / Region: <strong className="text-slate-200">{selectedOrder.delivery_city}</strong></p>
                    <p className="text-slate-400">Recipient Contact: {selectedOrder.recipient_name} ({selectedOrder.recipient_phone})</p>
                    {selectedOrder.special_instructions && (
                      <div className="p-2 rounded bg-[#161c28] border border-[#222834] text-[11px] text-slate-300 mt-2">
                        <strong className="text-amber-300">Instructions: </strong> {selectedOrder.special_instructions}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: STATUS TIMELINE */}
              {detailTab === 'timeline' && (
                <div className="space-y-3">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">LIFECYCLE STATUS HISTORY</span>
                  <div className="border-l-2 border-[#222834] pl-4 space-y-3">
                    {(selectedOrder.timeline || []).map((tl) => (
                      <div key={tl.id} className="relative">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${getStatusBadge(tl.to_status)}`}>
                            {tl.to_status}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(tl.created_at).toLocaleString('en-KE')}
                          </span>
                          {tl.user_name && (
                            <span className="text-[10px] text-slate-400">by {tl.user_name} ({tl.user_role})</span>
                          )}
                        </div>
                        {tl.notes && <p className="text-slate-300 text-[11px] mt-1">{tl.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: INTERNAL NOTES */}
              {detailTab === 'notes' && (
                <div className="space-y-4">
                  {/* Note Composer */}
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows="2"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add an internal staff note for this order..."
                      className="w-full p-2.5 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400 font-sans text-xs"
                      required
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submittingNote || !newNoteText.trim()}
                        className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>POST NOTE</span>
                      </button>
                    </div>
                  </form>

                  {/* Notes List */}
                  <div className="space-y-2 pt-2 border-t border-[#222834]">
                    {(selectedOrder.internal_notes_list || []).length === 0 ? (
                      <p className="text-slate-500 text-center py-4">No internal staff notes yet.</p>
                    ) : (
                      selectedOrder.internal_notes_list.map((n) => (
                        <div key={n.id} className="p-2.5 rounded bg-[#0c0e12] border border-[#222834] space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-slate-200">{n.author_name} ({n.author_role})</span>
                            <span>{new Date(n.created_at).toLocaleString('en-KE')}</span>
                          </div>
                          <p className="text-slate-300 text-xs font-sans">{n.note}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: DELIVERY & FLEET */}
              {detailTab === 'delivery' && (
                <div className="space-y-3">
                  {selectedOrder.delivery ? (
                    <div className="p-3 rounded bg-[#0c0e12] border border-[#222834] space-y-2 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-[#222834]">
                        <span className="font-bold text-white uppercase">DELIVERY #{selectedOrder.delivery.delivery_number}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          {selectedOrder.delivery.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Driver Assigned</span>
                          <span className="font-bold text-white">{selectedOrder.delivery.driver_name || 'Unassigned'}</span>
                          {selectedOrder.delivery.driver_phone && <span className="text-[10px] text-slate-400 block">{selectedOrder.delivery.driver_phone}</span>}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">Fleet Vehicle</span>
                          <span className="font-bold text-white">{selectedOrder.delivery.registration_number || 'Standard Van'}</span>
                        </div>
                      </div>

                      {selectedOrder.delivery.pod_recipient && (
                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] mt-2">
                          <strong className="block">PROOF OF DELIVERY RECORDED:</strong>
                          <span>Signed by {selectedOrder.delivery.pod_recipient} at {selectedOrder.delivery.pod_verified_at}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-6">No courier delivery record linked for this order.</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#222834] flex justify-end gap-2 bg-[#0c0e12]">
              <button
                onClick={() => setOrderDetailsModalOpen(false)}
                className="px-4 py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: ORDER CREATE & EDIT (OrderFormModal) */}
      {/* ------------------------------------------------------------- */}
      {orderFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 select-none overflow-y-auto">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-2xl w-full shadow-2xl relative my-auto animate-in fade-in duration-150 text-xs font-mono">
            <div className="p-4 border-b border-[#222834] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase">
                  {formMode === 'create' ? 'CREATE NEW ORDER' : `EDIT ORDER #${editingOrderId}`}
                </h3>
              </div>
              <button onClick={() => setOrderFormOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Customer Selector */}
              <div className="space-y-1 relative">
                <label className="text-[10px] uppercase text-slate-400 block font-bold">1. CUSTOMER PROFILE *</label>
                {formSelectedCustomer ? (
                  <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">{formSelectedCustomer.full_name}</span>
                      <span className="text-slate-400 ml-2 font-mono text-[11px]">{formSelectedCustomer.phone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormSelectedCustomer(null);
                        setFormCustomerId('');
                        setFormCustomerSearch('');
                      }}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Search existing customer by name, phone, or number..."
                      value={formCustomerSearch}
                      onChange={(e) => {
                        setFormCustomerSearch(e.target.value);
                        setFormCustomerDropdown(true);
                      }}
                      onFocus={() => setFormCustomerDropdown(true)}
                      className="w-full p-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400"
                    />
                    {formCustomerDropdown && formCustomerOptions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-gray-900 border border-gray-700 rounded shadow-2xl max-h-40 overflow-y-auto">
                        {formCustomerOptions.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setFormSelectedCustomer(c);
                              setFormCustomerId(c.id);
                              setFormDeliveryAddress(c.address || '');
                              setFormDeliveryCity(c.city || 'Nairobi');
                              setFormRecipientName(c.full_name);
                              setFormRecipientPhone(c.phone);
                              setFormCustomerDropdown(false);
                            }}
                            className="p-2 hover:bg-gray-800 cursor-pointer border-b border-gray-800 text-xs flex justify-between"
                          >
                            <span className="font-bold text-white">{c.full_name}</span>
                            <span className="text-slate-400">{c.phone}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Delivery Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded bg-[#0c0e12] border border-[#222834]">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={formDeliveryAddress}
                    onChange={(e) => setFormDeliveryAddress(e.target.value)}
                    placeholder="Street, Building, Unit"
                    className="w-full p-1.5 rounded bg-[#161c28] border border-[#222834] text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block mb-1">Delivery City</label>
                  <input
                    type="text"
                    value={formDeliveryCity}
                    onChange={(e) => setFormDeliveryCity(e.target.value)}
                    className="w-full p-1.5 rounded bg-[#161c28] border border-[#222834] text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block mb-1">Delivery Fee (KES)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={formDeliveryFee}
                    onChange={(e) => setFormDeliveryFee(e.target.value)}
                    className="w-full p-1.5 rounded bg-[#161c28] border border-[#222834] text-emerald-400 font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block mb-1">Recipient Phone</label>
                  <input
                    type="text"
                    value={formRecipientPhone}
                    onChange={(e) => setFormRecipientPhone(e.target.value)}
                    placeholder="+254..."
                    className="w-full p-1.5 rounded bg-[#161c28] border border-[#222834] text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase text-slate-400 font-bold block">2. ORDER ITEMS</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (catalogProducts.length > 0) {
                        setFormItems([
                          ...formItems,
                          { product_id: catalogProducts[0].id, quantity: 1, unit_price: catalogProducts[0].selling_price },
                        ]);
                      }
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> ADD ITEM
                  </button>
                </div>

                <div className="space-y-2">
                  {formItems.map((it, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-[#0c0e12] border border-[#222834] flex items-center gap-2">
                      <select
                        value={it.product_id}
                        onChange={(e) => {
                          const pId = Number(e.target.value);
                          const p = catalogProducts.find((prod) => prod.id === pId);
                          setFormItems(
                            formItems.map((item, i) =>
                              i === idx ? { ...item, product_id: pId, unit_price: p?.selling_price || item.unit_price } : item
                            )
                          );
                        }}
                        className="flex-1 p-1.5 rounded bg-[#161c28] border border-[#222834] text-white text-xs"
                      >
                        {catalogProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({api.formatKES(p.selling_price)})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => {
                          const q = Math.max(1, Number(e.target.value) || 1);
                          setFormItems(formItems.map((item, i) => (i === idx ? { ...item, quantity: q } : item)));
                        }}
                        className="w-16 p-1.5 rounded bg-[#161c28] border border-[#222834] text-white text-center font-bold text-xs"
                      />

                      <span className="w-24 text-right font-bold text-emerald-400 tabular-nums">
                        {api.formatKES((Number(it.unit_price) || 0) * (Number(it.quantity) || 1))}
                      </span>

                      {formItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-3 rounded bg-[#0c0e12] border border-[#222834] flex justify-between items-baseline font-bold text-sm">
                <span className="text-slate-400">TOTAL DUE (INCL. DELIVERY):</span>
                <span className="text-emerald-400 text-base tabular-nums">{api.formatKES(formTotal)}</span>
              </div>
            </div>

            <div className="p-4 border-t border-[#222834] flex justify-end gap-2 bg-[#0c0e12]">
              <button
                type="button"
                onClick={() => setOrderFormOpen(false)}
                className="px-4 py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 cursor-pointer"
              >
                CANCEL
              </button>

              {formMode === 'create' ? (
                <>
                  <button
                    type="button"
                    disabled={formSubmitting}
                    onClick={() => handleSaveOrder('DRAFT')}
                    className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    SAVE AS DRAFT
                  </button>
                  <button
                    type="button"
                    disabled={formSubmitting}
                    onClick={() => handleSaveOrder('CONFIRMED')}
                    className="px-4 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                  >
                    CONFIRM & RESERVE INVENTORY
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={() => handleSaveOrder()}
                  className="px-4 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer disabled:opacity-50"
                >
                  SAVE CHANGES
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: CANCEL ORDER */}
      {/* ------------------------------------------------------------- */}
      {cancelModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150 text-xs font-mono">
            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>CANCEL ORDER #{selectedOrder.order_number}</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-2">
              Cancelling will release any reserved inventory back into available stock.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-[10px] uppercase text-slate-400 block font-bold">Cancellation Reason</label>
              <textarea
                rows="3"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full p-2.5 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-rose-400 text-xs font-sans"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelOrder}
                className="flex-1 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {cancelling ? 'CANCELLING...' : 'CONFIRM CANCEL'}
              </button>
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 cursor-pointer"
              >
                BACK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: PRINTABLE COMMERCIAL TAX INVOICE */}
      {/* ------------------------------------------------------------- */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none overflow-y-auto">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg max-w-xl w-full shadow-2xl relative my-auto animate-in fade-in duration-150 text-xs font-mono">
            <div className="p-4 border-b border-[#222834] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>COMMERCIAL TAX INVOICE</span>
              </h3>
              <button onClick={() => setInvoiceModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[75vh] overflow-y-auto">
              {invoiceLoading || !invoiceData ? (
                <div className="py-12 text-center text-slate-400">Loading invoice data...</div>
              ) : (
                <div id="tax-invoice-printable" className="bg-white text-black p-6 rounded shadow font-sans text-xs space-y-4">
                  {/* Tax Invoice Header */}
                  <div className="flex justify-between items-start border-b pb-4">
                    <div>
                      <h2 className="text-base font-black uppercase tracking-wider text-neutral-900">{invoiceData.company.company_name}</h2>
                      <p className="text-[11px] text-neutral-600">{invoiceData.company.address}</p>
                      <p className="text-[11px] text-neutral-600">KRA PIN: <strong>{invoiceData.company.kra_pin}</strong></p>
                      <p className="text-[11px] text-neutral-600">{invoiceData.company.email} • {invoiceData.company.phone}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-neutral-900 text-white font-mono font-bold text-[10px]">
                        ORIGINAL TAX INVOICE
                      </span>
                      <h3 className="text-sm font-bold text-neutral-800 mt-1 font-mono">{invoiceData.invoice_number}</h3>
                      <p className="text-[11px] text-neutral-500 font-mono">Date: {new Date(invoiceData.date).toLocaleDateString('en-KE')}</p>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div className="grid grid-cols-2 gap-4 border-b pb-4 text-[11px]">
                    <div>
                      <span className="text-[10px] uppercase text-neutral-500 font-bold block">BILLED TO:</span>
                      <p className="font-bold text-neutral-900">{invoiceData.customer.name}</p>
                      <p className="text-neutral-600">Phone: {invoiceData.customer.phone}</p>
                      <p className="text-neutral-600">KRA PIN: {invoiceData.customer.kra_pin}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-neutral-500 font-bold block">DELIVERY ADDRESS:</span>
                      <p className="text-neutral-800">{invoiceData.customer.delivery_address}</p>
                      <p className="text-neutral-600">{invoiceData.customer.delivery_city}</p>
                    </div>
                  </div>

                  {/* Line Items */}
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b font-bold text-neutral-600 uppercase text-[9px]">
                        <th className="pb-1.5">Description</th>
                        <th className="pb-1.5 text-center">Qty</th>
                        <th className="pb-1.5 text-right">Unit Price</th>
                        <th className="pb-1.5 text-right">VAT Rate</th>
                        <th className="pb-1.5 text-right">Total (KES)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {invoiceData.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2">
                            <span className="font-medium text-neutral-900 block">{it.name}</span>
                            <span className="text-[9px] text-neutral-500 font-mono">{it.sku}</span>
                          </td>
                          <td className="py-2 text-center tabular-nums">{it.quantity}</td>
                          <td className="py-2 text-right tabular-nums">{api.formatKES(it.unit_price)}</td>
                          <td className="py-2 text-right">{it.tax_rate}%</td>
                          <td className="py-2 text-right font-bold tabular-nums">{api.formatKES(it.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals Breakdown */}
                  <div className="border-t pt-3 space-y-1 text-[11px] max-w-xs ml-auto font-mono">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Taxable Base:</span>
                      <span className="tabular-nums">{api.formatKES(invoiceData.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">KRA VAT (16%):</span>
                      <span className="tabular-nums">{api.formatKES(invoiceData.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Delivery Fee:</span>
                      <span className="tabular-nums">{api.formatKES(invoiceData.delivery_fee)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs pt-1.5 border-t border-black">
                      <span>TOTAL DUE:</span>
                      <span className="tabular-nums">{api.formatKES(invoiceData.total_amount)}</span>
                    </div>
                  </div>

                  {/* KRA ETR Compliance Stamp */}
                  <div className="border-t pt-3 text-[10px] text-neutral-600 text-center font-mono">
                    <p>ETR FISCAL CODE: {invoiceData.etr_compliance.fiscal_code}</p>
                    <p className="text-[9px] text-neutral-500 mt-0.5">THIS IS A VALID TAX INVOICE SUBJECT TO KRA REGULATIONS</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#222834] flex justify-end gap-2 bg-[#0c0e12]">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PRINT INVOICE</span>
              </button>
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(false)}
                className="px-4 py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: THERMAL RECEIPT */}
      {/* ------------------------------------------------------------- */}
      {receiptModalOpen && receiptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150 text-xs font-mono">
            <button onClick={() => setReceiptModalOpen(false)} className="absolute top-3 right-3 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>

            <div className="bg-white text-black p-4 rounded font-mono text-[11px] space-y-2 shadow">
              <div className="text-center border-b pb-2">
                <h4 className="font-bold text-xs uppercase">SWIFTTRACK KENYA</h4>
                <p className="text-[10px]">{receiptOrder.branch_name || 'Nairobi Central Station'}</p>
                <p className="text-[9px] text-neutral-600">ETR KRA PIN: P051234567Z</p>
                <p className="text-[9px]">{receiptOrder.order_number}</p>
              </div>

              <div className="space-y-1 border-b pb-2 text-[10px]">
                {(receiptOrder.items || []).map((it) => (
                  <div key={it.id} className="flex justify-between">
                    <span className="truncate max-w-[150px]">{it.quantity}x {it.product_name}</span>
                    <span className="font-bold tabular-nums">{api.formatKES(it.total_price)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-[10px] border-b pb-2">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span className="tabular-nums">{api.formatKES(receiptOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (16%):</span>
                  <span className="tabular-nums">{api.formatKES(receiptOrder.tax_amount)}</span>
                </div>
                {receiptOrder.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span>DELIVERY FEE:</span>
                    <span className="tabular-nums">{api.formatKES(receiptOrder.delivery_fee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1 border-t border-dashed">
                  <span>TOTAL:</span>
                  <span className="tabular-nums">{api.formatKES(receiptOrder.total_amount)}</span>
                </div>
              </div>

              <p className="text-center text-[9px] text-neutral-600">ASANTE KWA KUNUNUA NASI</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
              >
                PRINT RECEIPT
              </button>
              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="px-4 py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
