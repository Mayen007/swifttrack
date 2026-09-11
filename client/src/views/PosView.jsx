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

  // Load products
  useEffect(() => {
    async function loadCatalog() {
      try {
        setLoading(true);
        const data = await api.get('/api/products');
        if (Array.isArray(data)) {
          setProducts(data);
          const cats = Array.from(new Set(data.map((p) => p.category))).filter(Boolean);
          setCategories(cats);
        }
      } catch (e) {
        console.error('Failed to load products:', e);
      } finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Simulated barcode scan
  const handleBarcodeScan = () => {
    if (products.length === 0) return;
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    addItem(randomProduct, 1);
    api.toast(`Scanned: ${randomProduct.name} (${randomProduct.sku})`, 'success');
  };

  // Complete POS Sale
  const handleCompleteSale = async (paymentMethod, paymentRef = null) => {
    if (items.length === 0) {
      api.toast('Cart is empty', 'error');
      return;
    }

    try {
      const payload = {
        branch_id: selectedBranch?.id || user?.branch_id || 1,
        customer_name: customerName || 'Walk-in Customer',
        customer_phone: customerPhone || (paymentMethod === 'MPESA' ? mpesaPhone : ''),
        payment_method: paymentMethod,
        payment_reference: paymentRef || (paymentMethod === 'MPESA' ? `MP-${Date.now()}` : `CASH-${Date.now()}`),
        discount_amount: totals.discountAmount,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
        })),
      };

      const result = await api.post('/api/pos/checkout', payload);
      sound.playSuccess();
      api.toast(`Sale completed! Receipt #${result.order_number || result.order_id}`, 'success');

      setReceiptData({
        orderNumber: result.order_number || `ORD-${Date.now()}`,
        branchName: selectedBranch?.name || 'Nairobi Central Hub',
        cashier: user?.full_name || user?.username,
        date: new Date().toLocaleString('en-KE'),
        customerName: customerName || 'Walk-in Customer',
        items: [...items],
        subtotal: totals.rawSubtotal,
        discount: totals.discountAmount,
        vat: totals.vatAmount,
        total: totals.grandTotal,
        paymentMethod,
        paymentRef: payload.payment_reference,
      });

      clearCart();
      setMpesaModalOpen(false);
      setReceiptModalOpen(true);
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

  const filteredProducts = products.filter((p) => {
    const matchesCat = !selectedCategory || p.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-[calc(100vh-120px)] lg:h-[calc(100vh-115px)] select-none">
      {/* CATALOG REGISTER COLUMN (Left) */}
      <div className="flex-1 flex flex-col bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 overflow-hidden">
        {/* Top Control Bar: Search & Barcode Trigger */}
        <div className="flex flex-wrap items-center gap-2.5 pb-4 border-b border-[#222834]">
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
        <div className="flex items-center gap-1.5 py-3 overflow-x-auto no-scrollbar border-b border-[#1b212c]">
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
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    {product.sku}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[80px]">
                    {product.category}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-white mt-1.5 group-hover:text-amber-300 transition-colors line-clamp-2">
                  {product.name}
                </h4>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#1b212c] flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
                  {api.formatKES(product.price)}
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
      <div className="w-full lg:w-96 flex flex-col bg-[#12161f] border border-[#222834] rounded p-4 sm:p-5 shadow-xl">
        {/* Register Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h2 className="text-xs font-bold text-white uppercase tracking-widest font-mono">
              REGISTER // T-01
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={holdCart}
              title="Hold Active Cart"
              className="px-2 py-1 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[10px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <PauseCircle className="w-3 h-3 text-amber-400" />
              <span>HOLD</span>
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

        {/* Customer Data Instrument */}
        <div className="py-2.5 border-b border-[#222834] grid grid-cols-2 gap-2 text-xs font-sans">
          <input
            type="text"
            placeholder="Customer Name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="px-2.5 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-400 text-xs focus:outline-none focus:border-amber-400 font-sans"
          />
          <input
            type="text"
            placeholder="Phone Number"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="px-2.5 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-white placeholder-slate-400 text-xs font-mono focus:outline-none focus:border-amber-400"
          />
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
                    {api.formatKES(item.product.price)} @ unit
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
                  {api.formatKES(item.product.price * item.quantity)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation LED Summary Strip */}
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

        {/* Tender Trigger Console */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => handleCompleteSale('CASH')}
            disabled={items.length === 0}
            className="py-2.5 px-3 rounded bg-[#161c28] hover:bg-[#222b3d] disabled:opacity-40 text-white font-mono font-semibold text-xs flex items-center justify-center gap-2 border border-[#2b3548] transition-colors cursor-pointer disabled:cursor-not-allowed"
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
            disabled={items.length === 0}
            className="py-2.5 px-3 rounded bg-[#10b981]/15 hover:bg-[#10b981]/25 disabled:opacity-40 text-emerald-300 font-mono font-bold text-xs flex items-center justify-center gap-2 border border-[#10b981]/40 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>[2] M-PESA</span>
          </button>
        </div>
      </div>

      {/* M-PESA DARAJA STK PUSH MODAL */}
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

      {/* PRINTABLE THERMAL RECEIPT MODAL */}
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

            {/* Authentic Thermal Receipt Print Container */}
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
                    <span className="tabular-nums font-bold">{api.formatKES(it.product.price * it.quantity)}</span>
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
                  <span>TOTAL PAID:</span>
                  <span className="tabular-nums">{api.formatKES(receiptData.total)}</span>
                </div>
              </div>

              <div className="text-[9px] text-center text-neutral-600 pt-0.5">
                <p>TENDER: {receiptData.paymentMethod} ({receiptData.paymentRef})</p>
                <p className="mt-0.5 font-bold">ASANTE KWA KUNUNUA NASI</p>
              </div>
            </div>

            {/* Modal Actions */}
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
