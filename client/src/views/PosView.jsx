import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import { ParcelCounterBooking } from '../components/pos/ParcelCounterBooking.jsx';
import { ShiftStatusBar } from '../components/pos/ShiftStatusBar.jsx';
import { PosModeSelector } from '../components/pos/PosModeSelector.jsx';
import { ShiftGateCard } from '../components/pos/ShiftGateCard.jsx';
import { RetailCatalog } from '../components/pos/RetailCatalog.jsx';
import { RetailCart } from '../components/pos/RetailCart.jsx';
import { OpenShiftModal } from '../components/pos/OpenShiftModal.jsx';
import { CloseShiftModal } from '../components/pos/CloseShiftModal.jsx';
import { CashMovementModal } from '../components/pos/CashMovementModal.jsx';
import { CashTenderModal } from '../components/pos/CashTenderModal.jsx';
import { SplitPaymentModal } from '../components/pos/SplitPaymentModal.jsx';
import { HeldCartsModal } from '../components/pos/HeldCartsModal.jsx';
import { ReprintReceiptModal } from '../components/pos/ReprintReceiptModal.jsx';
import { ProductExchangeModal } from '../components/pos/ProductExchangeModal.jsx';
import { MpesaPaymentModal } from '../components/pos/MpesaPaymentModal.jsx';
import { PosReceiptModal } from '../components/pos/PosReceiptModal.jsx';

export function PosView({ onNavigate }) {
  const { user, selectedBranch } = useAuth();
  const [posMode, setPosMode] = useState('PARCEL');
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

  const [openingFloat, setOpeningFloat] = useState(5000);
  const [openShiftNotes, setOpenShiftNotes] = useState('Morning register shift');
  const [countedCash, setCountedCash] = useState(0);
  const [closeShiftNotes, setCloseShiftNotes] = useState('');
  const [closingSummary, setClosingSummary] = useState(null);
  const [movementType, setMovementType] = useState('PAYOUT');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const [cashTendered, setCashTendered] = useState(0);

  const [splitLines, setSplitLines] = useState([
    { id: 1, method: 'CASH', amount: '' },
    { id: 2, method: 'MPESA', amount: '', phone: '', ref: '' },
  ]);

  const [reprintQuery, setReprintQuery] = useState('');
  const [reprintData, setReprintData] = useState(null);
  const [reprintLoading, setReprintLoading] = useState(false);

  const [exchangeReturnProduct, setExchangeReturnProduct] = useState('');
  const [exchangeReturnQty, setExchangeReturnQty] = useState(1);
  const [exchangePurchaseProduct, setExchangePurchaseProduct] = useState('');
  const [exchangePurchaseQty, setExchangePurchaseQty] = useState(1);
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  const [mpesaModalOpen, setMpesaModalOpen] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaStep, setMpesaStep] = useState('idle');
  const [countdown, setCountdown] = useState(15);

  const [receiptData, setReceiptData] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const searchInputRef = useRef(null);

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

  useEffect(() => {
    setCashTendered(totals.grandTotal);
  }, [totals.grandTotal]);

  const handleBarcodeScan = () => {
    if (products.length === 0) return;
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    addItem(randomProduct, 1);
    api.toast(`Scanned: ${randomProduct.name} (${randomProduct.sku})`, 'success');
  };

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
        branchName: selectedBranch?.name || 'Primary Branch',
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

      loadActiveShift();
    } catch (err) {
      sound.playError();
      api.toast(`Checkout failed: ${err.message}`, 'error');
    }
  };

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

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-120px)] lg:h-[calc(100vh-115px)] select-none">
      <ShiftStatusBar
        activeShift={activeShift}
        onOpenMovement={() => setMovementModalOpen(true)}
        onOpenExchange={() => setExchangeModalOpen(true)}
        onOpenReprint={() => setReprintModalOpen(true)}
        onOpenCloseShift={() => {
          setCountedCash(activeShift.expected_cash || 0);
          setCloseShiftModalOpen(true);
        }}
        onOpenOpenShift={() => setOpenShiftModalOpen(true)}
      />

      <PosModeSelector posMode={posMode} setPosMode={setPosMode} />

      {posMode === 'PARCEL' ? (
        !activeShift && !shiftLoading ? (
          <ShiftGateCard onOpenShift={() => setOpenShiftModalOpen(true)} />
        ) : (
          <ParcelCounterBooking
            user={user}
            selectedBranch={selectedBranch}
            activeShift={activeShift}
            onOpenShiftRequest={() => setOpenShiftModalOpen(true)}
            onRefreshShift={loadActiveShift}
            onNavigate={onNavigate}
          />
        )
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[calc(100vh-14rem)] min-h-[580px]">
          <RetailCatalog
            searchInputRef={searchInputRef}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onBarcodeScan={handleBarcodeScan}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            productsCount={products.length}
            categories={categories}
            filteredProducts={filteredProducts}
            onAddItem={addItem}
          />

          <RetailCart
            activeShift={activeShift}
            selectedBranch={selectedBranch}
            user={user}
            heldCarts={heldCarts}
            onOpenHeldCarts={() => setHeldCartsModalOpen(true)}
            onHoldCart={holdCart}
            onClearCart={clearCart}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            customerDropdownOpen={customerDropdownOpen}
            setCustomerDropdownOpen={setCustomerDropdownOpen}
            customerOptions={customerOptions}
            setMpesaPhone={setMpesaPhone}
            items={items}
            onUpdateQty={updateQty}
            totals={totals}
            discountPercent={discountPercent}
            setDiscountPercent={setDiscountPercent}
            onOpenCash={() => {
              setCashTendered(totals.grandTotal);
              setCashModalOpen(true);
            }}
            onOpenMpesa={() => {
              setMpesaStep('idle');
              setMpesaModalOpen(true);
            }}
            onCompleteSale={handleCompleteSale}
            onOpenSplit={() => {
              const half = Math.round(totals.grandTotal / 2);
              setSplitLines([
                { id: 1, method: 'CASH', amount: half },
                { id: 2, method: 'MPESA', amount: totals.grandTotal - half, phone: mpesaPhone, ref: `MP-${Date.now()}` },
              ]);
              setSplitModalOpen(true);
            }}
          />
        </div>
      )}

      <OpenShiftModal
        isOpen={openShiftModalOpen}
        onClose={() => setOpenShiftModalOpen(false)}
        user={user}
        selectedBranch={selectedBranch}
        openingFloat={openingFloat}
        setOpeningFloat={setOpeningFloat}
        shiftNotes={openShiftNotes}
        setShiftNotes={setOpenShiftNotes}
        onSubmit={handleOpenShift}
      />

      <CloseShiftModal
        isOpen={closeShiftModalOpen}
        onClose={() => setCloseShiftModalOpen(false)}
        activeShift={activeShift}
        countedCash={countedCash}
        setCountedCash={setCountedCash}
        closeShiftNotes={closeShiftNotes}
        setCloseShiftNotes={setCloseShiftNotes}
        onSubmit={handleCloseShift}
      />

      <CashMovementModal
        isOpen={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        activeShift={activeShift}
        movementType={movementType}
        setMovementType={setMovementType}
        movementAmount={movementAmount}
        setMovementAmount={setMovementAmount}
        movementReason={movementReason}
        setMovementReason={setMovementReason}
        onSubmit={handleDrawerMovement}
      />

      <CashTenderModal
        isOpen={cashModalOpen}
        onClose={() => setCashModalOpen(false)}
        totals={totals}
        cashTendered={cashTendered}
        setCashTendered={setCashTendered}
        onCompleteSale={handleCompleteSale}
      />

      <SplitPaymentModal
        isOpen={splitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        totals={totals}
        splitLines={splitLines}
        setSplitLines={setSplitLines}
        mpesaPhone={mpesaPhone}
        onCompleteSale={handleCompleteSale}
      />

      <HeldCartsModal
        isOpen={heldCartsModalOpen}
        onClose={() => setHeldCartsModalOpen(false)}
        heldCarts={heldCarts}
        onRecall={recallCart}
        onDiscard={discardHeldCart}
      />

      <ReprintReceiptModal
        isOpen={reprintModalOpen}
        onClose={() => setReprintModalOpen(false)}
        reprintQuery={reprintQuery}
        setReprintQuery={setReprintQuery}
        onLookupReceipt={handleLookupReceipt}
        reprintLoading={reprintLoading}
        reprintData={reprintData}
        setReprintData={setReprintData}
        lastCompletedSaleNumber={lastCompletedSaleNumber}
      />

      <ProductExchangeModal
        isOpen={exchangeModalOpen}
        onClose={() => setExchangeModalOpen(false)}
        exchangeReturnProduct={exchangeReturnProduct}
        setExchangeReturnProduct={setExchangeReturnProduct}
        exchangeReturnQty={exchangeReturnQty}
        setExchangeReturnQty={setExchangeReturnQty}
        exchangePurchaseProduct={exchangePurchaseProduct}
        setExchangePurchaseProduct={setExchangePurchaseProduct}
        exchangePurchaseQty={exchangePurchaseQty}
        setExchangePurchaseQty={setExchangePurchaseQty}
        exchangeSubmitting={exchangeSubmitting}
        products={products}
        onSubmit={handleExchangeSubmit}
      />

      <MpesaPaymentModal
        isOpen={mpesaModalOpen}
        onClose={() => setMpesaModalOpen(false)}
        totals={totals}
        mpesaStep={mpesaStep}
        mpesaPhone={mpesaPhone}
        setMpesaPhone={setMpesaPhone}
        onInitiate={triggerMpesaStk}
        countdown={countdown}
      />

      <PosReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receiptData={receiptData}
      />
    </div>
  );
}
