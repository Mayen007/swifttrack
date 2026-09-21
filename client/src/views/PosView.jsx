// client/src/views/PosView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Search,
  ScanBarcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  Smartphone,
  Banknote,
  Printer,
  CheckCircle2,
  X,
  CreditCard,
  Percent,
  User,
  UserCheck,
  Clock,
  ArrowRightLeft,
  Lock,
  Unlock,
  RotateCcw,
  FileText,
  Coins,
  AlertTriangle,
  Landmark,
  Split,
  ChevronDown,
} from 'lucide-react';

export function PosView() {
  const { user, selectedBranch } = useAuth();
  const {
    items,
    addItem,
    updateQty,
    removeItem,
    clearCart,
    holdCart,
    recallCart,
    discardHeldCart,
    heldCarts,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    discountPercent,
    setDiscountPercent,
    totals,
  } = useCart();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Phase 5.1 Shift & Cash Drawer Control State
  const [activeShift, setActiveShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [openShiftModalOpen, setOpenShiftModalOpen] = useState(false);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [heldCartsModalOpen, setHeldCartsModalOpen] = useState(false);
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [lastCompletedSaleNumber, setLastCompletedSaleNumber] = useState(null);

  // Shift & Drawer Form States
  const [openingFloat, setOpeningFloat] = useState(5000);
  const [openShiftNotes, setOpenShiftNotes] = useState('Morning register shift');
  const [countedCash, setCountedCash] = useState(0);
  const [closeShiftNotes, setCloseShiftNotes] = useState('');
  const [closingSummary, setClosingSummary] = useState(null);
  const [movementType, setMovementType] = useState('PAYOUT');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  // Cash Payment Dialog State
  const [cashTendered, setCashTendered] = useState(0);

  // Split Payment Dialog State
  const [splitLines, setSplitLines] = useState([
    { id: 1, method: 'CASH', amount: '' },
    { id: 2, method: 'MPESA', amount: '', phone: '', ref: '' },
  ]);

  // Reprint Receipt State
  const [reprintQuery, setReprintQuery] = useState('');
  const [reprintData, setReprintData] = useState(null);
  const [reprintLoading, setReprintLoading] = useState(false);

  // Product Exchange State
  const [exchangeReturnProduct, setExchangeReturnProduct] = useState('');
  const [exchangeReturnQty, setExchangeReturnQty] = useState(1);
  const [exchangePurchaseProduct, setExchangePurchaseProduct] = useState('');
  const [exchangePurchaseQty, setExchangePurchaseQty] = useState(1);
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);

  // Customer Selection State (Phase 4.1 CRM Integration)
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  // M-Pesa Modal State
  const [mpesaModalOpen, setMpesaModalOpen] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState('254712345678');
  const [mpesaStep, setMpesaStep] = useState('idle'); // idle, pushing, awaiting_pin, success
  const [countdown, setCountdown] = useState(15);

  // Thermal Receipt Modal State
  const [receiptData, setReceiptData] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Search input ref
  const searchInputRef = useRef(null);

  // Load active cashier shift
  const loadActiveShift = async () => {
    try {
      setShiftLoading(true);
      const res = await api.get('/api/pos/shift/current');
      setActiveShift(res.shift || null);
      if (res.shift) {
        setCountedCash(res.shift.expected_cash || 0);
      }
    } catch (err) {
      console.error('Failed to load active shift:', err);
      setActiveShift(null);
    } finally {
      setShiftLoading(false);
    }
  };

  useEffect(() => {
    loadActiveShift();
  }, [selectedBranch]);

  // Search customers debounced
  useEffect(() => {
    let isMounted = true;
    async function searchCustomers() {
      if (!customerSearch.trim()) {
        setCustomerOptions([]);
        return;
      }
      try {
        const res = await api.get(`/api/customers?search=${encodeURIComponent(customerSearch.trim())}&limit=5`);
        if (isMounted && res.customers) {
          setCustomerOptions(res.customers);
        }
      } catch (err) {
        // Ignore network errors in autocomplete
      }
    }
    const timer = setTimeout(searchCustomers, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [customerSearch]);

  // Load products scoped to the active branch station
  useEffect(() => {
    async function loadCatalog() {
      try {
        setLoading(true);
        const branchParam = selectedBranch
          ? `?branch_id=${selectedBranch.id}`
          : (user?.branch_id ? `?branch_id=${user.branch_id}` : '');
        const data = await api.get(`/api/products${branchParam}`);
        if (Array.isArray(data)) {
          const normalized = data.map((p) => ({
            ...p,
            price: Number(p.price ?? p.selling_price ?? 0),
            selling_price: Number(p.selling_price ?? p.price ?? 0),
            category: p.category || p.category_name || 'General',
          }));
          setProducts(normalized);
          const cats = Array.from(new Set(normalized.map((p) => p.category))).filter(Boolean);
          setCategories(cats);
        }
      } catch (e) {
        console.error('Failed to load products:', e);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, [selectedBranch, user?.branch_id]);

  // Keyboard shortcut F2 to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setMpesaModalOpen(false);
        setReceiptModalOpen(false);
        setOpenShiftModalOpen(false);
        setCloseShiftModalOpen(false);
        setMovementModalOpen(false);
        setHeldCartsModalOpen(false);
        setReprintModalOpen(false);
        setCashModalOpen(false);
        setSplitModalOpen(false);
        setExchangeModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update cash tendered default when cart grandTotal changes
  useEffect(() => {
    setCashTendered(totals.grandTotal);
  }, [totals.grandTotal]);

  // Simulated barcode scan
  const handleBarcodeScan = () => {
    if (products.length === 0) return;
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    addItem(randomProduct, 1);
    api.toast(`Scanned: ${randomProduct.name} (${randomProduct.sku})`, 'success');
  };

  // Open Shift Handler
  const handleOpenShift = async (e) => {
    e?.preventDefault();
    try {
      const res = await api.post('/api/pos/shift/open', {
        opening_float: Number(openingFloat),
        notes: openShiftNotes,
      });
      sound.playSuccess();
      api.toast(`Shift #${res.shift?.shift_number} opened with KES ${Number(openingFloat).toLocaleString()}`, 'success');
      setActiveShift(res.shift);
      setOpenShiftModalOpen(false);
    } catch (err) {
      sound.playError();
      api.toast(`Failed to open shift: ${err.message}`, 'error');
    }
  };

  // Close Shift Handler
  const handleCloseShift = async (e) => {
    e?.preventDefault();
    if (!activeShift) return;
    try {
      const res = await api.post('/api/pos/shift/close', {
        shift_id: activeShift.id,
        closing_cash_counted: Number(countedCash),
        notes: closeShiftNotes,
      });
      sound.playSuccess();
      api.toast(`Shift #${activeShift.shift_number} closed successfully`, 'success');
      setClosingSummary(res.shift);
      setActiveShift(null);
      setCloseShiftModalOpen(false);
    } catch (err) {
      sound.playError();
      api.toast(`Failed to close shift: ${err.message}`, 'error');
    }
  };

  // Cash Drawer Movement Handler (Payout or Drop)
  const handleDrawerMovement = async (e) => {
    e?.preventDefault();
    if (!activeShift) {
      api.toast('No active shift', 'error');
      return;
    }
    const amt = Number(movementAmount);
    if (!amt || amt <= 0) {
      api.toast('Enter valid movement amount', 'error');
      return;
    }
    if (!movementReason.trim()) {
      api.toast('Please provide a reason', 'error');
      return;
    }
    try {
      const res = await api.post('/api/pos/shift/movement', {
        shift_id: activeShift.id,
        movement_type: movementType,
        amount: amt,
        reason: movementReason,
      });
      sound.playSuccess();
      api.toast(`Drawer ${movementType} of KES ${amt.toLocaleString()} recorded`, 'success');
      setActiveShift(res.shift);
      setMovementModalOpen(false);
      setMovementAmount('');
      setMovementReason('');
    } catch (err) {
      sound.playError();
      api.toast(`Movement failed: ${err.message}`, 'error');
    }
  };

  // Complete POS Sale
  const handleCompleteSale = async (paymentMethod, paymentRef = null, customPayments = null, tendered = null, change = null) => {
    if (items.length === 0) {
      api.toast('Cart is empty', 'error');
      return;
    }

    if (!activeShift) {
      sound.playError();
      api.toast('Register locked: Please open an active shift before checkout.', 'error');
      setOpenShiftModalOpen(true);
      return;
    }

    if (selectedCustomer && (selectedCustomer.status === 'BLOCKED' || selectedCustomer.status === 'SUSPENDED')) {
      sound.playError();
      api.toast(`Checkout blocked: Customer '${selectedCustomer.full_name}' is ${selectedCustomer.status}.`, 'error');
      return;
    }

    try {
      const payload = {
        branch_id: selectedBranch?.id || user?.branch_id || 1,
        shift_id: activeShift.id,
        customer_id: selectedCustomer ? selectedCustomer.id : undefined,
        customer_name: selectedCustomer ? selectedCustomer.full_name : (customerName || 'Walk-in Customer'),
        customer_phone: selectedCustomer ? selectedCustomer.phone : (customerPhone || (paymentMethod === 'MPESA' ? mpesaPhone : '')),
        discount_amount: totals.discountAmount,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: Number(item.product.price ?? item.product.selling_price ?? 0),
        })),
      };

      if (customPayments && Array.isArray(customPayments)) {
        payload.payments = customPayments;
        payload.payment_method = 'SPLIT';
        payload.payment_reference = 'SPLIT-TENDER';
      } else {
        payload.payment_method = paymentMethod;
        payload.payment_reference = paymentRef || (paymentMethod === 'MPESA' ? `MP-${Date.now()}` : `${paymentMethod}-${Date.now()}`);
      }

      const result = await api.post('/api/pos/checkout', payload);
      sound.playSuccess();
      const orderNum = result.order_number || result.order_id || result.sale?.sale_number || `REC-${Date.now()}`;
      api.toast(`Sale completed! Receipt #${orderNum}`, 'success');

      setLastCompletedSaleNumber(result.sale?.sale_number || orderNum);

      setReceiptData({
        orderNumber: result.sale?.sale_number || orderNum,
        branchName: selectedBranch?.name || 'Nairobi Central Hub',
        cashier: user?.full_name || user?.username,
        date: new Date().toLocaleString('en-KE'),
        customerName: selectedCustomer ? selectedCustomer.full_name : (customerName || 'Walk-in Customer'),
        customerPhone: selectedCustomer ? selectedCustomer.phone : customerPhone,
        items: [...items],
        subtotal: totals.rawSubtotal,
        discount: totals.discountAmount,
        vat: totals.vatAmount,
        total: totals.grandTotal,
        paymentMethod: customPayments ? 'SPLIT' : paymentMethod,
        paymentRef: payload.payment_reference,
        payments: customPayments || [{ method: paymentMethod, amount: totals.grandTotal }],
        tendered: tendered ?? totals.grandTotal,
        change: change ?? 0,
        isReprint: false,
      });

      clearCart();
      setSelectedCustomer(null);
      setCustomerSearch('');
      setMpesaModalOpen(false);
      setCashModalOpen(false);
      setSplitModalOpen(false);
      setReceiptModalOpen(true);

      // Refresh shift metrics
      loadActiveShift();
    } catch (err) {
      sound.playError();
      api.toast(`Checkout failed: ${err.message}`, 'error');
    }
  };

  // M-Pesa STK push workflow
  const triggerMpesaStk = () => {
    if (!mpesaPhone || mpesaPhone.length < 10) {
      api.toast('Please enter a valid Safaricom phone number', 'error');
      return;
    }
    setMpesaStep('pushing');
    sound.playScan();

    setTimeout(() => {
      setMpesaStep('awaiting_pin');
      setCountdown(10);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setMpesaStep('success');
            sound.playSuccess();
            setTimeout(() => {
              handleCompleteSale('MPESA', `QA${Math.floor(10000000 + Math.random() * 90000000)}`);
            }, 1200);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 1500);
  };

  // Reprint Receipt Lookup
  const handleLookupReceipt = async (queryParam) => {
    const q = (queryParam || reprintQuery).trim();
    if (!q) {
      api.toast('Enter receipt or sale number', 'error');
      return;
    }
    try {
      setReprintLoading(true);
      const res = await api.get(`/api/pos/receipt/${encodeURIComponent(q)}`);
      if (res && res.sale) {
        setReprintData(res);
      } else {
        api.toast('Receipt record not found', 'error');
      }
    } catch (err) {
      api.toast(`Receipt lookup failed: ${err.message}`, 'error');
    } finally {
      setReprintLoading(false);
    }
  };

  // Product Exchange Submit
  const handleExchangeSubmit = async (e) => {
    e?.preventDefault();
    if (!exchangeReturnProduct || !exchangePurchaseProduct) {
      api.toast('Select both return and replacement items', 'error');
      return;
    }
    try {
      setExchangeSubmitting(true);
      const res = await api.post('/api/pos/exchange', {
        branch_id: selectedBranch?.id || user?.branch_id || 1,
        return_items: [{ product_id: Number(exchangeReturnProduct), quantity: Number(exchangeReturnQty) }],
        purchase_items: [{ product_id: Number(exchangePurchaseProduct), quantity: Number(exchangePurchaseQty) }],
        settlement_method: 'CASH',
        notes: 'POS In-store customer item exchange',
      });
      sound.playSuccess();
      api.toast(`Exchange processed! Net: KES ${res.net_settlement_amount} (${res.settlement_type})`, 'success');
      setExchangeModalOpen(false);
      setExchangeReturnProduct('');
      setExchangePurchaseProduct('');
      loadActiveShift();
    } catch (err) {
      sound.playError();
      api.toast(`Exchange failed: ${err.message}`, 'error');
    } finally {
      setExchangeSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = !selectedCategory || p.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    return matchesCat && matchesSearch;
  });

  // Calculate shift variance
  const cashExpected = activeShift ? Number(activeShift.expected_cash || 0) : 0;
  const cashVariance = Number(countedCash) - cashExpected;

  // Split payment totals
  const totalSplitAllocated = splitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const remainingSplitDue = totals.grandTotal - totalSplitAllocated;

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-120px)] lg:h-[calc(100vh-115px)] select-none">
      {/* SHIFT & CASH DRAWER STATUS BAR */}
      <div className="w-full bg-[#12161f] border border-[#222834] rounded px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {activeShift ? (
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-white uppercase tracking-wider">
                SHIFT #{activeShift.shift_number}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-4 text-slate-400 border-l border-[#222834] pl-4">
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Drawer Cash</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {api.formatKES(activeShift.expected_cash)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Float</span>
                <span className="text-white tabular-nums">
                  {api.formatKES(activeShift.opening_float)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Shift Sales</span>
                <span className="text-white tabular-nums">
                  {api.formatKES(activeShift.total_sales_amount)} ({activeShift.total_sales_count})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-bold uppercase tracking-wider">
              NO ACTIVE SHIFT — REGISTER LOCKED
            </span>
            <span className="hidden sm:inline text-slate-400 text-[11px]">
              (Open shift with initial float to enable sales)
            </span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activeShift ? (
            <>
              <button
                onClick={() => setMovementModalOpen(true)}
                className="px-2.5 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Petty Cash Payout or Safe Drop"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">DRAWER MOVE</span>
              </button>

              <button
                onClick={() => setExchangeModalOpen(true)}
                className="px-2.5 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Product Exchange"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden md:inline">EXCHANGE</span>
              </button>

              <button
                onClick={() => setReprintModalOpen(true)}
                className="px-2.5 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Reprint Customer Receipt"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden md:inline">REPRINT</span>
              </button>

              <button
                onClick={() => {
                  setCountedCash(activeShift.expected_cash || 0);
                  setCloseShiftModalOpen(true);
                }}
                className="px-3 py-1.5 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-white text-[11px] font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Close Shift and Reconcile Cash Drawer"
              >
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>CLOSE SHIFT</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setOpenShiftModalOpen(true)}
              className="px-3.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>OPEN REGISTER SHIFT</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN TWO-COLUMN REGISTER INTERFACE */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
        {/* CATALOG REGISTER COLUMN (Left) */}
        <div className="flex-1 flex flex-col bg-[#12161f] border border-[#222834] rounded p-4 overflow-hidden">
          {/* Top Control Bar: Search & Barcode Trigger */}
          <div className="flex flex-wrap items-center gap-2.5 pb-3 border-b border-[#222834]">
            <div className="flex-1 relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search catalog by name, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-14 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-400 text-xs focus:outline-none focus:border-amber-400 font-sans transition-colors"
              />
              <span className="absolute right-2.5 top-2 text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#141822]">
                F2
              </span>
            </div>

            <button
              onClick={handleBarcodeScan}
              className="px-3 py-2 rounded bg-[#161c28] hover:bg-[#1f2738] border border-[#2b3548] text-amber-300 text-xs font-mono font-medium flex items-center gap-2 transition-colors cursor-pointer"
              title="Trigger Barcode Scan"
            >
              <ScanBarcode className="w-4 h-4 text-amber-400" />
              <span>SCAN_BARCODE</span>
            </button>
          </div>

          {/* Category Segmented Selector */}
          <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto no-scrollbar border-b border-[#1b212c]">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1 rounded text-xs font-medium font-mono whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === ''
                  ? 'bg-[#222834] text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
              }`}
            >
              ALL ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded text-xs font-medium font-mono uppercase whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#222834] text-amber-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Instrument Grid */}
          <div className="flex-1 overflow-y-auto pt-3 pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 auto-rows-max">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => addItem(product, 1)}
                className="p-3 rounded bg-[#0c0e12] hover:bg-[#141822] border border-[#222834] hover:border-[#3b475e] transition-colors cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap truncate">
                      {product.sku}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[80px] shrink-0 text-right">
                      {product.category || product.category_name || 'General'}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white mt-1.5 group-hover:text-amber-300 transition-colors line-clamp-2">
                    {product.name}
                  </h4>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#1b212c] flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
                    {api.formatKES(product.price ?? product.selling_price ?? 0)}
                  </span>
                  <span className="w-5 h-5 rounded bg-[#161c28] group-hover:bg-amber-400 text-slate-400 group-hover:text-slate-950 flex items-center justify-center transition-colors">
                    <Plus className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* POS REGISTER & CART (Right) */}
        <div className="w-full lg:w-96 flex flex-col bg-[#12161f] border border-[#222834] rounded p-4 shadow-xl">
          {/* Register Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <h2 className="text-xs font-bold text-white uppercase tracking-widest font-mono">
                REGISTER // {selectedBranch ? `${selectedBranch.code}` : (user?.branch_code || 'T-01')}
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (heldCarts.length > 0) {
                    setHeldCartsModalOpen(true);
                  } else {
                    holdCart();
                  }
                }}
                title={heldCarts.length > 0 ? 'View Held Carts' : 'Hold Active Cart'}
                className="px-2 py-1 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[10px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <PauseCircle className="w-3 h-3 text-amber-400" />
                <span>HOLD {heldCarts.length > 0 ? `(${heldCarts.length})` : ''}</span>
              </button>
              <button
                onClick={clearCart}
                title="Clear Cart"
                className="px-2 py-1 rounded bg-[#161c28] hover:bg-rose-950/40 border border-[#222834] hover:border-rose-900/60 text-[10px] font-mono text-slate-300 hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>CLEAR</span>
              </button>
            </div>
          </div>

          {/* Customer Data Instrument (CRM Phase 4.1) */}
          <div className="py-2.5 border-b border-[#222834] space-y-2 text-xs font-sans relative">
            {selectedCustomer ? (
              <div className={`p-2 rounded border ${
                selectedCustomer.status === 'BLOCKED' || selectedCustomer.status === 'SUSPENDED'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-bold text-white text-xs truncate max-w-[150px]">{selectedCustomer.full_name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/40 text-gray-300 border border-gray-700">
                      {selectedCustomer.customer_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase ${
                      selectedCustomer.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {selectedCustomer.status}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerName('');
                        setCustomerPhone('');
                      }}
                      className="p-0.5 text-gray-400 hover:text-white rounded"
                      title="Unlink Customer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                  <span>{selectedCustomer.phone}</span>
                  <span>{selectedCustomer.city || 'Nairobi'}</span>
                </div>
                {(selectedCustomer.status === 'BLOCKED' || selectedCustomer.status === 'SUSPENDED') && (
                  <div className="mt-1.5 text-[10px] text-rose-400 font-bold flex items-center gap-1">
                    <span>⚠️ Checkout Blocked: Customer is {selectedCustomer.status}</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search existing customer or enter name..."
                    value={customerSearch || customerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerSearch(val);
                      setCustomerName(val);
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400 font-sans"
                  />

                  {customerDropdownOpen && customerOptions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {customerOptions.map((cust) => (
                        <div
                          key={cust.id}
                          onClick={() => {
                            setSelectedCustomer(cust);
                            setCustomerName(cust.full_name);
                            setCustomerPhone(cust.phone);
                            if (cust.phone) setMpesaPhone(cust.phone.replace(/[^0-9]/g, ''));
                            setCustomerDropdownOpen(false);
                            setCustomerSearch('');
                          }}
                          className="px-3 py-2 hover:bg-gray-800 cursor-pointer border-b border-gray-800/60 last:border-0 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-white text-xs">{cust.full_name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{cust.phone} • {cust.customer_number}</p>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            cust.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {cust.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Phone (e.g. +254...)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="px-2.5 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                  <div className="flex items-center text-[10px] text-gray-400 px-1 font-mono">
                    <span>{customerName ? 'Manual Customer' : 'Walk-in (Default)'}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Cart Item Matrix */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
            {items.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs font-mono">
                <ShoppingCart className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                <span>REGISTER EMPTY // SELECT ITEMS OR SCAN</span>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.product.id}
                  className="p-2.5 rounded bg-[#0c0e12] border border-[#222834] flex items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-white truncate">{item.product.name}</h5>
                    <div className="text-slate-400 font-mono text-[10px] tabular-nums mt-0.5">
                      {api.formatKES(item.product.price ?? item.product.selling_price ?? 0)} @ unit
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#141822] border border-[#222834] rounded px-1 py-0.5">
                    <button
                      onClick={() => updateQty(item.product.id, item.quantity - 1)}
                      className="w-5 h-5 rounded hover:bg-[#222834] text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="font-mono font-bold text-white text-xs w-4 text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.product.id, item.quantity + 1)}
                      className="w-5 h-5 rounded hover:bg-[#222834] text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  <div className="text-right font-mono font-bold text-emerald-400 min-w-[70px] tabular-nums">
                    {api.formatKES((item.product.price ?? item.product.selling_price ?? 0) * item.quantity)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Calculation Summary Strip */}
          <div className="pt-3 border-t border-[#222834] space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-400">
              <span>SUBTOTAL ({totals.itemCount} ITEMS):</span>
              <span className="text-white tabular-nums">{api.formatKES(totals.rawSubtotal)}</span>
            </div>

            {/* Discount Selector */}
            <div className="flex items-center justify-between text-slate-400 py-0.5">
              <span className="flex items-center gap-1">
                <Percent className="w-3 h-3 text-amber-400" /> DISCOUNT:
              </span>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiscountPercent(d)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer border ${
                      discountPercent === d
                        ? 'bg-amber-400 text-slate-950 font-bold border-amber-400'
                        : 'bg-[#0c0e12] text-slate-400 border-[#222834] hover:text-white'
                    }`}
                  >
                    {d}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between text-slate-400">
              <span>KRA VAT (16%):</span>
              <span className="text-white tabular-nums">{api.formatKES(totals.vatAmount)}</span>
            </div>

            {/* TOTAL DISPLAY INSTRUMENT */}
            <div className="pt-2 border-t border-[#222834] flex justify-between items-baseline bg-[#0c0e12] p-2.5 rounded border">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">TOTAL DUE</span>
              <span className="text-xl font-black text-emerald-400 font-mono tabular-nums">
                {api.formatKES(totals.grandTotal)}
              </span>
            </div>
          </div>

          {/* Tender Trigger Console (Cash, M-Pesa, Card, Bank, Split) */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                if (items.length === 0) return;
                setCashTendered(totals.grandTotal);
                setCashModalOpen(true);
              }}
              disabled={items.length === 0 || !activeShift}
              className="py-2.5 px-2 rounded bg-[#161c28] hover:bg-[#222b3d] disabled:opacity-40 text-white font-mono font-semibold text-xs flex items-center justify-center gap-1.5 border border-[#2b3548] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Banknote className="w-4 h-4 text-emerald-400" />
              <span>[1] CASH</span>
            </button>

            <button
              onClick={() => {
                if (items.length === 0) return;
                setMpesaStep('idle');
                setMpesaModalOpen(true);
              }}
              disabled={items.length === 0 || !activeShift}
              className="py-2.5 px-2 rounded bg-[#10b981]/15 hover:bg-[#10b981]/25 disabled:opacity-40 text-emerald-300 font-mono font-bold text-xs flex items-center justify-center gap-1.5 border border-[#10b981]/40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>[2] M-PESA</span>
            </button>

            <button
              onClick={() => handleCompleteSale('CARD', `CRD-${Date.now()}`)}
              disabled={items.length === 0 || !activeShift}
              className="py-2 px-2 rounded bg-[#161c28] hover:bg-[#202738] disabled:opacity-40 text-slate-200 font-mono text-[11px] flex items-center justify-center gap-1.5 border border-[#222834] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <CreditCard className="w-3.5 h-3.5 text-blue-400" />
              <span>[3] CARD</span>
            </button>

            <button
              onClick={() => {
                const half = Math.round(totals.grandTotal / 2);
                setSplitLines([
                  { id: 1, method: 'CASH', amount: half },
                  { id: 2, method: 'MPESA', amount: totals.grandTotal - half, phone: mpesaPhone, ref: `MP-${Date.now()}` },
                ]);
                setSplitModalOpen(true);
              }}
              disabled={items.length === 0 || !activeShift}
              className="py-2 px-2 rounded bg-[#161c28] hover:bg-[#202738] disabled:opacity-40 text-slate-200 font-mono text-[11px] flex items-center justify-center gap-1.5 border border-[#222834] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Split className="w-3.5 h-3.5 text-amber-400" />
              <span>[4] SPLIT PAY</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: OPEN REGISTER SHIFT */}
      {/* ------------------------------------------------------------- */}
      {openShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-md w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => setOpenShiftModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">OPEN REGISTER SHIFT</h3>
                <p className="text-[11px] text-slate-400">Initialize drawer cash float and station session</p>
              </div>
            </div>

            <form onSubmit={handleOpenShift} className="mt-4 space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3 text-slate-300">
                <div className="bg-[#0c0e12] p-2.5 rounded border border-[#222834]">
                  <span className="text-[10px] text-slate-500 uppercase block">Cashier</span>
                  <span className="font-bold text-white">{user?.full_name || user?.username}</span>
                </div>
                <div className="bg-[#0c0e12] p-2.5 rounded border border-[#222834]">
                  <span className="text-[10px] text-slate-500 uppercase block">Station Hub</span>
                  <span className="font-bold text-white">{selectedBranch?.name || 'Nairobi Central Hub'}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Opening Cash Float (KES) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-emerald-400 text-sm font-bold focus:outline-none focus:border-amber-400"
                  required
                />
                <div className="flex gap-2 mt-1.5">
                  {[2000, 5000, 10000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOpeningFloat(preset)}
                      className="px-2 py-0.5 text-[10px] rounded bg-[#161c28] border border-[#222834] text-slate-300 hover:text-white cursor-pointer"
                    >
                      KES {preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Opening Notes / Denomination Details
                </label>
                <input
                  type="text"
                  value={openShiftNotes}
                  onChange={(e) => setOpenShiftNotes(e.target.value)}
                  placeholder="e.g. 5x 1000, 10x 200, 10x 100"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-colors cursor-pointer"
                >
                  START CASHIER SHIFT
                </button>
                <button
                  type="button"
                  onClick={() => setOpenShiftModalOpen(false)}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: CLOSE REGISTER SHIFT & EOD RECONCILIATION */}
      {/* ------------------------------------------------------------- */}
      {closeShiftModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-lg w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => setCloseShiftModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  CLOSE SHIFT // RECONCILIATION
                </h3>
                <p className="text-[11px] text-slate-400">Shift #{activeShift.shift_number} End-of-Day Balancing</p>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="mt-4 space-y-3.5 text-xs font-mono">
              {/* Ledger breakdown */}
              <div className="bg-[#0c0e12] border border-[#222834] rounded p-3 space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Opening Float:</span>
                  <span className="text-white tabular-nums">{api.formatKES(activeShift.opening_float)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cash Sales ({activeShift.total_sales_count} tx):</span>
                  <span className="text-emerald-400 font-bold tabular-nums">+{api.formatKES(activeShift.total_cash_amount)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>M-Pesa / Card / Bank:</span>
                  <span className="text-blue-400 tabular-nums">
                    {api.formatKES(Number(activeShift.total_mpesa_amount) + Number(activeShift.total_card_amount) + Number(activeShift.total_bank_amount))}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300 font-bold pt-1.5 border-t border-[#222834]">
                  <span>EXPECTED DRAWER CASH:</span>
                  <span className="text-emerald-400 text-sm tabular-nums">{api.formatKES(cashExpected)}</span>
                </div>
              </div>

              {/* Physical Cash Counted input */}
              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Physical Cash Counted (KES) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white text-base font-bold focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              {/* Variance Indicator */}
              <div className={`p-3 rounded border flex items-center justify-between ${
                Math.abs(cashVariance) < 0.01
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : cashVariance > 0
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <div>
                  <span className="text-[10px] uppercase block font-bold">CASH VARIANCE</span>
                  <span className="font-bold text-sm">
                    {Math.abs(cashVariance) < 0.01
                      ? 'PERFECTLY BALANCED (0.00 KES)'
                      : cashVariance > 0
                      ? `OVERAGE (+${api.formatKES(cashVariance)})`
                      : `SHORTAGE (-${api.formatKES(Math.abs(cashVariance))})`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Status</span>
                  <span className="font-bold uppercase">
                    {Math.abs(cashVariance) < 0.01 ? 'BALANCED' : cashVariance > 0 ? 'OVER' : 'SHORT'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Handover Notes / Discrepancy Reason
                </label>
                <textarea
                  rows="2"
                  value={closeShiftNotes}
                  onChange={(e) => setCloseShiftNotes(e.target.value)}
                  placeholder="Notes for the branch manager / supervisor..."
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400 font-sans"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors cursor-pointer"
                >
                  SUBMIT COUNT & CLOSE SHIFT
                </button>
                <button
                  type="button"
                  onClick={() => setCloseShiftModalOpen(false)}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  BACK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: CASH DRAWER MOVEMENT (PAYOUT / DROP) */}
      {/* ------------------------------------------------------------- */}
      {movementModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => setMovementModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">DRAWER MOVEMENT</h3>
                <p className="text-[11px] text-slate-400">Current Cash: {api.formatKES(activeShift.expected_cash)}</p>
              </div>
            </div>

            <form onSubmit={handleDrawerMovement} className="mt-4 space-y-3.5 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType('PAYOUT')}
                  className={`py-2 rounded font-bold cursor-pointer border ${
                    movementType === 'PAYOUT'
                      ? 'bg-amber-400 text-slate-950 border-amber-400'
                      : 'bg-[#0c0e12] text-slate-300 border-[#222834]'
                  }`}
                >
                  PETTY PAYOUT
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('DROP_OUT')}
                  className={`py-2 rounded font-bold cursor-pointer border ${
                    movementType === 'DROP_OUT'
                      ? 'bg-amber-400 text-slate-950 border-amber-400'
                      : 'bg-[#0c0e12] text-slate-300 border-[#222834]'
                  }`}
                >
                  SAFE DROP
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Amount (KES) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Reason / Purpose *
                </label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="e.g. Packaging tape & bubble wrap"
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-colors cursor-pointer"
                >
                  RECORD MOVEMENT
                </button>
                <button
                  type="button"
                  onClick={() => setMovementModalOpen(false)}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: CASH TENDER & CHANGE CALCULATOR */}
      {/* ------------------------------------------------------------- */}
      {cashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => setCashModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pb-3 border-b border-[#222834]">
              <Banknote className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
              <h3 className="text-sm font-bold text-white uppercase font-mono">CASH PAYMENT & CHANGE</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Total Due: <strong className="text-emerald-400 tabular-nums">{api.formatKES(totals.grandTotal)}</strong>
              </p>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 uppercase mb-1">
                  Cash Tendered (KES)
                </label>
                <input
                  type="number"
                  min={totals.grandTotal}
                  step="10"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white font-bold text-base focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setCashTendered(totals.grandTotal)}
                    className="flex-1 py-1 text-[10px] rounded bg-[#161c28] border border-[#222834] text-slate-300 hover:text-white cursor-pointer"
                  >
                    EXACT
                  </button>
                  {[500, 1000, 2000].map((extra) => (
                    <button
                      key={extra}
                      type="button"
                      onClick={() => setCashTendered(Math.ceil(totals.grandTotal / extra) * extra)}
                      className="flex-1 py-1 text-[10px] rounded bg-[#161c28] border border-[#222834] text-slate-300 hover:text-white cursor-pointer"
                    >
                      +{extra}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change Output */}
              <div className="bg-[#0c0e12] border border-[#222834] p-3 rounded flex justify-between items-baseline">
                <span className="text-xs text-slate-400 uppercase">CHANGE DUE:</span>
                <span className="text-lg font-bold text-emerald-400 tabular-nums">
                  {api.formatKES(Math.max(0, cashTendered - totals.grandTotal))}
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const change = Math.max(0, cashTendered - totals.grandTotal);
                    handleCompleteSale('CASH', `CASH-${Date.now()}`, null, cashTendered, change);
                  }}
                  disabled={cashTendered < totals.grandTotal}
                  className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  CONFIRM CASH TENDER
                </button>
                <button
                  type="button"
                  onClick={() => setCashModalOpen(false)}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: SPLIT / MIXED PAYMENT */}
      {/* ------------------------------------------------------------- */}
      {splitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-md w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => setSplitModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                <Split className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">SPLIT TENDER PAYMENT</h3>
                <p className="text-[11px] text-slate-400">
                  Total Due: <strong className="text-emerald-400 tabular-nums">{api.formatKES(totals.grandTotal)}</strong>
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              {splitLines.map((line, idx) => (
                <div key={line.id} className="p-2.5 rounded bg-[#0c0e12] border border-[#222834] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">TENDER #{idx + 1}</span>
                    {splitLines.length > 1 && (
                      <button
                        onClick={() => setSplitLines(splitLines.filter((l) => l.id !== line.id))}
                        className="text-rose-400 hover:text-rose-300 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={line.method}
                      onChange={(e) => {
                        const m = e.target.value;
                        setSplitLines(splitLines.map((l) => (l.id === line.id ? { ...l, method: m } : l)));
                      }}
                      className="px-2 py-1.5 rounded bg-[#161c28] border border-[#222834] text-white text-xs focus:outline-none"
                    >
                      <option value="CASH">CASH</option>
                      <option value="MPESA">M-PESA</option>
                      <option value="CARD">CARD</option>
                      <option value="BANK_TRANSFER">BANK</option>
                    </select>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Amount (KES)"
                      value={line.amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSplitLines(splitLines.map((l) => (l.id === line.id ? { ...l, amount: val } : l)));
                      }}
                      className="px-2 py-1.5 rounded bg-[#161c28] border border-[#222834] text-emerald-400 font-bold text-xs focus:outline-none"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const rem = Math.max(0, remainingSplitDue);
                  setSplitLines([...splitLines, { id: Date.now(), method: 'CASH', amount: rem || '' }]);
                }}
                className="w-full py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[11px] text-slate-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>ADD ANOTHER TENDER LINE</span>
              </button>

              {/* Status breakdown */}
              <div className="bg-[#0c0e12] p-2.5 rounded border border-[#222834] space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Allocated:</span>
                  <span className="text-white tabular-nums">{api.formatKES(totalSplitAllocated)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Remaining Due:</span>
                  <span className={`tabular-nums ${remainingSplitDue <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {api.formatKES(remainingSplitDue)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const formatted = splitLines.map((l) => ({
                      method: l.method,
                      amount: Number(l.amount) || 0,
                      reference_code: `${l.method}-${Date.now()}`,
                    }));
                    handleCompleteSale('SPLIT', null, formatted);
                  }}
                  disabled={remainingSplitDue > 0.05}
                  className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  CONFIRM SPLIT PAYMENT
                </button>
                <button
                  type="button"
                  onClick={() => setSplitModalOpen(false)}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: HELD CARTS DRAWER */}
      {/* ------------------------------------------------------------- */}
      {heldCartsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-md w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => setHeldCartsModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                <PauseCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">HELD REGISTER CARTS</h3>
                <p className="text-[11px] text-slate-400">{heldCarts.length} cart(s) on reserve</p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {heldCarts.length === 0 ? (
                <p className="text-center py-8 text-slate-500 font-mono text-xs">No held carts currently on reserve.</p>
              ) : (
                heldCarts.map((c) => {
                  const cartSum = c.items.reduce(
                    (s, it) => s + (it.product.price ?? it.product.selling_price ?? 0) * it.quantity,
                    0
                  );
                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded bg-[#0c0e12] border border-[#222834] flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{c.customerName || 'Walk-in Customer'}</span>
                          <span className="text-[10px] text-slate-500">({c.heldAt})</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {c.items.length} product(s) • <strong className="text-emerald-400">{api.formatKES(cartSum)}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            recallCart(c.id);
                            setHeldCartsModalOpen(false);
                          }}
                          className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          RESUME
                        </button>
                        <button
                          onClick={() => discardHeldCart(c.id)}
                          className="p-1 rounded bg-[#161c28] hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-[#222834] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-[#222834] mt-3">
              <button
                onClick={() => setHeldCartsModalOpen(false)}
                className="w-full py-2 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 text-xs font-mono cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 7: REPRINT RECEIPT LOOKUP */}
      {/* ------------------------------------------------------------- */}
      {reprintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-md w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => {
                setReprintModalOpen(false);
                setReprintData(null);
              }}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">REPRINT RECEIPT LOOKUP</h3>
                <p className="text-[11px] text-slate-400">Search sale/receipt number for duplicate thermal copy</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. SALE-1-347925"
                  value={reprintQuery}
                  onChange={(e) => setReprintQuery(e.target.value)}
                  className="flex-1 px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => handleLookupReceipt()}
                  disabled={reprintLoading}
                  className="px-3 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
                >
                  {reprintLoading ? 'LOOKING UP...' : 'SEARCH'}
                </button>
              </div>

              {lastCompletedSaleNumber && (
                <button
                  type="button"
                  onClick={() => {
                    setReprintQuery(lastCompletedSaleNumber);
                    handleLookupReceipt(lastCompletedSaleNumber);
                  }}
                  className="text-[10px] text-slate-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Reprint Last Sale ({lastCompletedSaleNumber})
                </button>
              )}

              {/* Receipt Preview if loaded */}
              {reprintData && (
                <div className="mt-3 p-3 bg-white text-black rounded text-[10px] font-mono space-y-2 max-h-60 overflow-y-auto">
                  <div className="text-center border-b border-black pb-1">
                    <p className="font-bold uppercase">*** DUPLICATE REPRINT ***</p>
                    <p className="font-bold text-xs">SWIFTTRACK KENYA</p>
                    <p>{reprintData.sale.sale_number}</p>
                    <p className="text-[9px] text-neutral-600">{reprintData.sale.created_at}</p>
                  </div>
                  <div className="space-y-0.5">
                    {reprintData.items.map((it) => (
                      <div key={it.id} className="flex justify-between">
                        <span>{it.quantity}x {it.product_name}</span>
                        <span className="font-bold">{api.formatKES(it.line_total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-black pt-1 flex justify-between font-bold">
                    <span>TOTAL:</span>
                    <span>{api.formatKES(reprintData.sale.total_amount)}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                {reprintData && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>PRINT DUPLICATE</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setReprintModalOpen(false);
                    setReprintData(null);
                  }}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 8: PRODUCT EXCHANGE */}
      {/* ------------------------------------------------------------- */}
      {exchangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded-lg p-5 max-w-md w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => setExchangeModalOpen(false)}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#222834]">
              <div className="w-9 h-9 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-mono">PRODUCT EXCHANGE</h3>
                <p className="text-[11px] text-slate-400">Return item and purchase replacement with net settlement</p>
              </div>
            </div>

            <form onSubmit={handleExchangeSubmit} className="mt-4 space-y-3 font-mono text-xs">
              {/* Return Section */}
              <div className="p-2.5 rounded bg-rose-500/5 border border-rose-500/20 space-y-2">
                <span className="text-[10px] font-bold text-rose-400 uppercase block">1. ITEM RETURNED BY CUSTOMER</span>
                <select
                  value={exchangeReturnProduct}
                  onChange={(e) => setExchangeReturnProduct(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none"
                  required
                >
                  <option value="">Select Returned Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({api.formatKES(p.price ?? p.selling_price)})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Qty Returned:</span>
                  <input
                    type="number"
                    min="1"
                    value={exchangeReturnQty}
                    onChange={(e) => setExchangeReturnQty(e.target.value)}
                    className="w-20 px-2 py-1 rounded bg-[#0c0e12] border border-[#222834] text-white font-bold"
                  />
                </div>
              </div>

              {/* Purchase Section */}
              <div className="p-2.5 rounded bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <span className="text-[10px] font-bold text-emerald-400 uppercase block">2. NEW REPLACEMENT ITEM</span>
                <select
                  value={exchangePurchaseProduct}
                  onChange={(e) => setExchangePurchaseProduct(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-white focus:outline-none"
                  required
                >
                  <option value="">Select Replacement Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({api.formatKES(p.price ?? p.selling_price)})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Qty Taken:</span>
                  <input
                    type="number"
                    min="1"
                    value={exchangePurchaseQty}
                    onChange={(e) => setExchangePurchaseQty(e.target.value)}
                    className="w-20 px-2 py-1 rounded bg-[#0c0e12] border border-[#222834] text-white font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={exchangeSubmitting}
                  className="flex-1 py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors cursor-pointer disabled:opacity-40"
                >
                  {exchangeSubmitting ? 'PROCESSING...' : 'PROCESS EXCHANGE'}
                </button>
                <button
                  type="button"
                  onClick={() => setExchangeModalOpen(false)}
                  className="px-4 py-2.5 rounded bg-[#161c28] hover:bg-[#202738] text-slate-300 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 9: M-PESA DARAJA STK PUSH */}
      {/* ------------------------------------------------------------- */}
      {mpesaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => setMpesaModalOpen(false)}
              aria-label="Close modal"
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center">
              <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                M-Pesa STK Express Push
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                AMOUNT: <strong className="text-emerald-400 tabular-nums">{api.formatKES(totals.grandTotal)}</strong>
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {mpesaStep === 'idle' && (
                <>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                      Customer Safaricom Number
                    </label>
                    <input
                      type="text"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      placeholder="2547XXXXXXXX"
                      className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                      Target: Safaricom M-Pesa Daraja Gateway
                    </span>
                  </div>

                  <button
                    onClick={triggerMpesaStk}
                    className="w-full py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold text-xs transition-colors cursor-pointer"
                  >
                    SEND STK PROMPT
                  </button>
                </>
              )}

              {mpesaStep === 'pushing' && (
                <div className="py-6 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-mono text-emerald-400">Connecting Daraja Gateway...</p>
                </div>
              )}

              {mpesaStep === 'awaiting_pin' && (
                <div className="py-4 text-center space-y-3 font-mono">
                  <div className="text-xs text-slate-300 bg-[#0c0e12] border border-[#222834] p-3 rounded">
                    <p className="font-semibold text-white">Prompt transmitted to {mpesaPhone}</p>
                    <p className="text-slate-400 text-[11px] mt-1">Awaiting 4-digit PIN authentication on device...</p>
                  </div>
                  <div className="text-xs text-amber-400 animate-pulse tabular-nums">
                    CALLBACK TIMER: {countdown}s
                  </div>
                </div>
              )}

              {mpesaStep === 'success' && (
                <div className="py-4 text-center space-y-2 font-mono">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Payment Confirmed</h4>
                  <p className="text-[11px] text-slate-400">Rendering receipt ledger...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 10: PRINTABLE THERMAL RECEIPT */}
      {/* ------------------------------------------------------------- */}
      {receiptModalOpen && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 select-none">
          <div className="bg-[#12161f] border border-[#222834] rounded p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in duration-150">
            <button
              onClick={() => setReceiptModalOpen(false)}
              aria-label="Close receipt"
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div id="thermal-receipt-container" className="bg-white text-black p-4 rounded font-mono text-xs shadow-inner space-y-2.5">
              <div className="text-center border-b border-black pb-2">
                <h2 className="font-bold text-xs uppercase tracking-widest">SWIFTTRACK KENYA</h2>
                <p className="text-[10px]">{receiptData.branchName}</p>
                <p className="text-[9px] text-neutral-600">KRA PIN: P051234567Z • ETR VAT COMPLIANT</p>
                <p className="text-[9px] text-neutral-600">{receiptData.date}</p>
                <p className="text-[10px] font-bold mt-1">REC: {receiptData.orderNumber}</p>
              </div>

              <div className="space-y-1 border-b border-black pb-2 text-[10px]">
                {receiptData.items.map((it) => (
                  <div key={it.product.id} className="flex justify-between">
                    <span className="truncate max-w-[150px]">
                      {it.quantity}x {it.product.name}
                    </span>
                    <span className="tabular-nums font-bold">
                      {api.formatKES((it.product.price ?? it.product.selling_price ?? 0) * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-[10px] border-b border-black pb-2">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span className="tabular-nums">{api.formatKES(receiptData.subtotal)}</span>
                </div>
                {receiptData.discount > 0 && (
                  <div className="flex justify-between text-neutral-800">
                    <span>DISCOUNT:</span>
                    <span className="tabular-nums">-{api.formatKES(receiptData.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>VAT (16%):</span>
                  <span className="tabular-nums">{api.formatKES(receiptData.vat)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed border-black">
                  <span>TOTAL DUE:</span>
                  <span className="tabular-nums">{api.formatKES(receiptData.total)}</span>
                </div>
                {receiptData.change > 0 && (
                  <div className="flex justify-between text-neutral-700">
                    <span>CASH CHANGE:</span>
                    <span className="tabular-nums font-bold">{api.formatKES(receiptData.change)}</span>
                  </div>
                )}
              </div>

              <div className="text-[9px] text-center text-neutral-600 pt-0.5">
                <p>TENDER: {receiptData.paymentMethod} ({receiptData.paymentRef})</p>
                <p className="mt-0.5 font-bold">ASANTE KWA KUNUNUA NASI</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PRINT RECEIPT</span>
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="py-2 px-3 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 text-xs font-mono transition-colors cursor-pointer"
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
