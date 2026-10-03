// client/src/components/pos/ParcelCounterBooking.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  MapPin,
  Building2,
  Phone,
  User,
  Search,
  Plus,
  Trash2,
  Calculator,
  ShieldCheck,
  CreditCard,
  Banknote,
  Smartphone,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Clock,
  Layers,
  FileText,
  RefreshCw,
  X
} from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';
import { PrintableWaybillModal } from './PrintableWaybillModal.jsx';

export function ParcelCounterBooking({ user, activeShift, onRefreshShift, onOpenShiftRequest, onNavigate }) {
  // Destination Hubs
  const [hubs, setHubs] = useState([]);
  const [loadingHubs, setLoadingHubs] = useState(true);

  // Form State
  const [destinationHubId, setDestinationHubId] = useState('');
  const [serviceType, setServiceType] = useState('STANDARD'); // STANDARD, EXPRESS, SAME_DAY
  const [deliveryType, setDeliveryType] = useState('LAST_MILE'); // LAST_MILE, PICKUP_AT_HUB

  // Shipper / Sender Details
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [senderCity, setSenderCity] = useState('');

  // Consignee / Recipient Details
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCity, setRecipientCity] = useState('');

  // Parcels Array
  const [parcels, setParcels] = useState([
    {
      id: 1,
      package_type: 'BOX',
      weight_kg: 2.5,
      length_cm: 30,
      width_cm: 20,
      height_cm: 15,
      description: 'General Merchandise'
    }
  ]);

  // Value Added Services
  const [declaredValue, setDeclaredValue] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Quote State
  const [quote, setQuote] = useState(null);
  const [calculatingQuote, setCalculatingQuote] = useState(false);

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH, MPESA, CARD, ACCOUNT, SPLIT
  const [cashTendered, setCashTendered] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaReceipt, setMpesaReceipt] = useState('');
  const [cardRef, setCardRef] = useState('');
  const [accountPoRef, setAccountPoRef] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitMpesa, setSplitMpesa] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Completed Waybill Modal State
  const [waybillModalOpen, setWaybillModalOpen] = useState(false);
  const [waybillData, setWaybillData] = useState(null);

  // Reprint Modal State
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [reprintQuery, setReprintQuery] = useState('');
  const [reprintLoading, setReprintLoading] = useState(false);

  // Customer search quick lookup
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [senderCustomerId, setSenderCustomerId] = useState(null);
  const [quoteError, setQuoteError] = useState(null);

  // Fetch regional hubs on mount
  useEffect(() => {
    async function loadHubs() {
      try {
        setLoadingHubs(true);
        const res = await api.get('/api/branches');
        const list = Array.isArray(res) ? res : (res?.data || []);
        setHubs(list);
        // Default to first hub that is not origin hub
        const originId = user?.branchId || 1;
        const other = list.find(h => h.id !== originId);
        if (other) setDestinationHubId(String(other.id));
      } catch (err) {
        console.error('Failed to load hubs:', err);
      } finally {
        setLoadingHubs(false);
      }
    }
    loadHubs();
  }, [user?.branchId]);

  // Pre-fill sender phone into MPESA field when senderPhone changes
  useEffect(() => {
    if (senderPhone && !mpesaPhone) {
      setMpesaPhone(senderPhone);
    }
  }, [senderPhone]);

  // Customer Quick Lookup
  const handleCustomerSearch = async (query) => {
    setCustomerSearch(query);
    if (!query || query.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    try {
      setSearchingCustomer(true);
      const res = await api.get(`/api/customers?search=${encodeURIComponent(query.trim())}`);
      const list = Array.isArray(res) ? res : (res?.customers || res?.data || []);
      setCustomerResults(list.slice(0, 5));
    } catch (e) {
      // Ignore
    } finally {
      setSearchingCustomer(false);
    }
  };

  const selectSenderCustomer = (c) => {
    setSenderCustomerId(c.id || null);
    setSenderName(c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim());
    setSenderPhone(c.phone || '');
    setSenderEmail(c.email || '');
    setSenderAddress(c.address || c.physical_address || '');
    setSenderCity(c.city || '');
    setCustomerResults([]);
    setCustomerSearch('');
    sound.playSuccess();
  };

  // Add Parcel
  const handleAddParcel = () => {
    const nextId = parcels.length > 0 ? Math.max(...parcels.map(p => p.id)) + 1 : 1;
    setParcels(prev => [
      ...prev,
      {
        id: nextId,
        package_type: 'BOX',
        weight_kg: 1.0,
        length_cm: 20,
        width_cm: 20,
        height_cm: 15,
        description: 'General Merchandise'
      }
    ]);
  };

  // Remove Parcel
  const handleRemoveParcel = (id) => {
    if (parcels.length <= 1) return;
    setParcels(prev => prev.filter(p => p.id !== id));
  };

  // Update Parcel Field
  const handleUpdateParcel = (id, field, value) => {
    setParcels(prev => prev.map(p => {
      if (p.id !== id) return p;
      return { ...p, [field]: value };
    }));
  };

  // Calculate live volumetric weight for a single parcel
  const getParcelVolumetric = (p) => {
    const l = Number(p.length_cm) || 0;
    const w = Number(p.width_cm) || 0;
    const h = Number(p.height_cm) || 0;
    if (l <= 0 || w <= 0 || h <= 0) return 0;
    return Number(((l * w * h) / 5000).toFixed(2));
  };

  // Calculate Aggregates
  const aggregates = useMemo(() => {
    let actSum = 0;
    let volSum = 0;
    parcels.forEach(p => {
      const act = Number(p.weight_kg) || 0;
      const vol = getParcelVolumetric(p);
      actSum += act;
      volSum += vol;
    });
    const actTotal = Number(actSum.toFixed(2));
    const volTotal = Number(volSum.toFixed(2));
    const chgTotal = Number(Math.max(actTotal, volTotal).toFixed(2));
    return {
      count: parcels.length,
      actualWeight: actTotal,
      volumetricWeight: volTotal,
      chargeableWeight: chgTotal
    };
  }, [parcels]);

  // Request Quote from Backend
  const fetchQuote = useCallback(async () => {
    if (!destinationHubId || parcels.length === 0) return;
    try {
      setCalculatingQuote(true);
      setQuoteError(null);
      const originId = user?.branchId || 1;
      const payload = {
        origin_hub_id: originId,
        destination_hub_id: Number(destinationHubId),
        service_type: serviceType,
        parcels: parcels.map(p => ({
          weight_kg: Number(p.weight_kg) || 0.1,
          length_cm: Number(p.length_cm) || 0,
          width_cm: Number(p.width_cm) || 0,
          height_cm: Number(p.height_cm) || 0,
          package_type: p.package_type
        })),
        declared_value: Number(declaredValue) || 0,
        cod_amount: Number(codAmount) || 0
      };

      const res = await api.post('/api/pos/counter/quote', payload);
      if (res) {
        setQuote(res);
      }
    } catch (err) {
      console.error('Quote calculation error:', err);
      setQuoteError(err?.message || 'Failed to calculate freight quote');
    } finally {
      setCalculatingQuote(false);
    }
  }, [destinationHubId, parcels, serviceType, declaredValue, codAmount, user?.branchId]);

  useEffect(() => {
    if (!destinationHubId || parcels.length === 0) return;
    const timer = setTimeout(() => {
      fetchQuote();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  // Total Due
  const totalAmountDue = quote?.total_amount || 0;

  // Tender change calculation
  const cashChange = useMemo(() => {
    const t = Number(cashTendered) || 0;
    if (t <= 0 || t < totalAmountDue) return 0;
    return Number((t - totalAmountDue).toFixed(2));
  }, [cashTendered, totalAmountDue]);

  // Open Payment Modal
  const handleOpenPayment = () => {
    if (!activeShift) {
      api.toast('Shift is closed. Please open a register shift with opening float first.', 'error');
      if (onOpenShiftRequest) onOpenShiftRequest();
      return;
    }
    if (!senderName || !senderPhone || !senderAddress) {
      api.toast('Please provide Shipper (Sender) Name, Phone, and Address', 'error');
      return;
    }
    if (!recipientName || !recipientPhone || !recipientAddress) {
      api.toast('Please provide Consignee (Recipient) Name, Phone, and Address', 'error');
      return;
    }
    if (!destinationHubId) {
      api.toast('Please select Destination Hub', 'error');
      return;
    }

    setCashTendered(String(totalAmountDue));
    setSplitCash(String(Number((totalAmountDue / 2).toFixed(2))));
    setSplitMpesa(String(Number((totalAmountDue - Number((totalAmountDue / 2).toFixed(2))).toFixed(2))));
    setPaymentModalOpen(true);
  };

  // Submit Booking & Payment
  const handleExecuteBooking = async () => {
    try {
      setSubmittingBooking(true);
      const originId = user?.branchId || 1;

      let paymentPayload = {};
      if (paymentMethod === 'SPLIT') {
        const cAmt = Number(splitCash) || 0;
        const mAmt = Number(splitMpesa) || 0;
        if (Math.abs((cAmt + mAmt) - totalAmountDue) > 0.05) {
          api.toast(`Split payments (KES ${cAmt + mAmt}) must equal total due (KES ${totalAmountDue})`, 'error');
          setSubmittingBooking(false);
          return;
        }
        paymentPayload = {
          split_payments: [
            { method: 'CASH', amount: cAmt, amount_tendered: cAmt },
            { method: 'MPESA', amount: mAmt, mpesa_phone: mpesaPhone, mpesa_receipt: mpesaReceipt || `MP${Date.now().toString().slice(-6)}` }
          ]
        };
      } else if (paymentMethod === 'CASH') {
        const t = Number(cashTendered) || totalAmountDue;
        if (t < totalAmountDue) {
          api.toast(`Cash tendered (KES ${t}) is less than total due (KES ${totalAmountDue})`, 'error');
          setSubmittingBooking(false);
          return;
        }
        paymentPayload = {
          payment_method: 'CASH',
          amount_tendered: t
        };
      } else if (paymentMethod === 'MPESA') {
        paymentPayload = {
          payment_method: 'MPESA',
          mpesa_phone: mpesaPhone || senderPhone,
          mpesa_receipt: mpesaReceipt || `MP${Date.now().toString().slice(-6)}`
        };
      } else if (paymentMethod === 'CARD') {
        paymentPayload = {
          payment_method: 'CARD',
          card_ref: cardRef || `CRD-${Date.now().toString().slice(-6)}`
        };
      } else if (paymentMethod === 'ACCOUNT') {
        if (!senderCustomerId) {
          api.toast('Account tender requires a registered corporate customer. Please select one in Step 2.', 'error');
          setSubmittingBooking(false);
          return;
        }
        paymentPayload = {
          payment_method: 'ACCOUNT',
          account_po_ref: accountPoRef.trim() || undefined
        };
      }

      const bookingBody = {
        origin_hub_id: originId,
        destination_hub_id: Number(destinationHubId),
        service_type: serviceType,
        delivery_type: deliveryType,
        sender_customer_id: senderCustomerId || undefined,
        sender: {
          name: senderName,
          phone: senderPhone,
          email: senderEmail,
          address: senderAddress,
          city: senderCity || 'Nairobi'
        },
        recipient: {
          name: recipientName,
          phone: recipientPhone,
          email: recipientEmail,
          address: recipientAddress,
          city: recipientCity || 'Mombasa'
        },
        parcels: parcels.map(p => ({
          package_type: p.package_type,
          weight_kg: Number(p.weight_kg),
          length_cm: Number(p.length_cm),
          width_cm: Number(p.width_cm),
          height_cm: Number(p.height_cm),
          description: p.description
        })),
        declared_value: Number(declaredValue) || 0,
        cod_amount: Number(codAmount) || 0,
        special_instructions: specialInstructions,
        ...paymentPayload
      };

      const res = await api.post('/api/pos/counter/book', bookingBody);

      if (res && res.data) {
        sound.playSuccess();
        api.toast('Consignment successfully booked, paid, and accepted!', 'success');
        setWaybillData(res.data.waybill);
        setPaymentModalOpen(false);
        setWaybillModalOpen(true);
        if (onRefreshShift) onRefreshShift();
      }
    } catch (err) {
      sound.playError();
      api.toast(`Booking failed: ${err.message}`, 'error');
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Reset form for next booking
  const handleResetForm = () => {
    setSenderCustomerId(null);
    setQuoteError(null);
    setAccountPoRef('');
    setSenderName('');
    setSenderPhone('');
    setSenderEmail('');
    setSenderAddress('');
    setSenderCity('');
    setRecipientName('');
    setRecipientPhone('');
    setRecipientEmail('');
    setRecipientAddress('');
    setRecipientCity('');
    setDeclaredValue('');
    setCodAmount('');
    setSpecialInstructions('');
    setParcels([
      {
        id: 1,
        package_type: 'BOX',
        weight_kg: 2.5,
        length_cm: 30,
        width_cm: 20,
        height_cm: 15,
        description: 'General Merchandise'
      }
    ]);
  };

  // Lookup Waybill for Reprint
  const handleLookupReprint = async () => {
    if (!reprintQuery || !reprintQuery.trim()) {
      api.toast('Enter tracking or waybill number', 'error');
      return;
    }
    try {
      setReprintLoading(true);
      const res = await api.get(`/api/pos/counter/waybill/${encodeURIComponent(reprintQuery.trim())}`);
      if (res && res.waybill) {
        setWaybillData(res.waybill);
        setReprintModalOpen(false);
        setWaybillModalOpen(true);
      } else {
        api.toast('Waybill not found', 'error');
      }
    } catch (err) {
      api.toast(`Lookup failed: ${err.message}`, 'error');
    } finally {
      setReprintLoading(false);
    }
  };

  const originHub = hubs.find(h => h.id === (user?.branchId || 1)) || { name: 'Nairobi Central Hub', code: 'NRB-HQ' };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Controls */}
      <div className="bg-[#121622] border border-[#2a3447] rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Logistics Counter Terminal
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                INTAKE & RATING
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Origin Hub: <span className="text-white font-bold">{originHub.name} ({originHub.code})</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setReprintModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-[#181e2b] hover:bg-[#202738] border border-[#263045] text-slate-200 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>REPRINT WAYBILL</span>
          </button>
          <button
            onClick={handleResetForm}
            className="px-3 py-1.5 rounded-lg bg-[#181e2b] hover:bg-[#202738] border border-[#263045] text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Clear all fields"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>CLEAR</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form Inputs (Left) and Live Tariff / Tender Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Shipper, Consignee, Routing, Parcels */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Card 1: Routing & Service Level */}
          <div className="bg-[#121622] border border-[#222834] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#222834] pb-2.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-200">
                  1. Routing Corridor & Service Level
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Destination Hub / Depot <span className="text-rose-400">*</span>
                </label>
                <select
                  value={destinationHubId}
                  onChange={(e) => setDestinationHubId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                  disabled={loadingHubs}
                >
                  <option value="">-- Select Destination Hub --</option>
                  {hubs
                    .filter(h => h.id !== (user?.branchId || 1))
                    .map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.code}) — {h.city}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Delivery Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('LAST_MILE')}
                    className={`px-3 py-2 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer text-center ${
                      deliveryType === 'LAST_MILE'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-[#0b0e14] border-[#222834] text-slate-400 hover:text-white'
                    }`}
                  >
                    Doorstep Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('PICKUP_AT_HUB')}
                    className={`px-3 py-2 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer text-center ${
                      deliveryType === 'PICKUP_AT_HUB'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-[#0b0e14] border-[#222834] text-slate-400 hover:text-white'
                    }`}
                  >
                    Hub Counter Pickup
                  </button>
                </div>
              </div>
            </div>

            {/* Service Level Pills */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                Transport Service Priority
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'STANDARD', title: 'Standard Freight', desc: 'Road Cargo • 24-48h', rate: 'Base 1.0x' },
                  { id: 'EXPRESS', title: 'Priority Express', desc: 'Next-Day Express', rate: '+25% Priority' },
                  { id: 'SAME_DAY', title: 'Same-Day Metro', desc: 'Air/Direct Courier', rate: '+50% Urgent' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceType(s.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      serviceType === s.id
                        ? 'bg-blue-600/15 border-blue-500 ring-1 ring-blue-500/50'
                        : 'bg-[#0b0e14] border-[#222834] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold font-mono ${serviceType === s.id ? 'text-blue-400' : 'text-white'}`}>
                        {s.title}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">{s.rate}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Shipper (Sender) & Consignee (Recipient) */}
          <div className="bg-[#121622] border border-[#222834] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#222834] pb-2.5">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-200">
                  2. Shipper & Consignee Parties
                </h3>
              </div>

              {/* Quick Customer Search Trigger */}
              <div className="relative">
                <div className="flex items-center gap-1.5 bg-[#0b0e14] border border-[#222834] rounded-lg px-2.5 py-1 text-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search existing customer..."
                    value={customerSearch}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    className="bg-transparent text-white text-[11px] font-mono focus:outline-none w-44"
                  />
                </div>

                {customerResults.length > 0 && (
                  <div className="absolute right-0 top-full mt-1 w-72 bg-[#0d111a] border border-[#222834] rounded-lg shadow-xl z-20 overflow-hidden divide-y divide-[#1e2433]">
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectSenderCustomer(c)}
                        className="w-full text-left p-2 hover:bg-white/[0.04] transition-colors cursor-pointer text-xs"
                      >
                        <div className="font-bold text-white">{c.name || `${c.first_name || ''} ${c.last_name || ''}`}</div>
                        <div className="text-[10px] font-mono text-emerald-400">{c.phone}</div>
                        <div className="text-[10px] text-slate-400 truncate">{c.address || c.city}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Shipper Column */}
              <div className="space-y-2.5 bg-[#0b0e14]/60 border border-[#1e2433] rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-400 font-mono text-[11px] font-bold uppercase">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Shipper / Sender</span>
                  </div>
                  {senderCustomerId ? (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                      Linked Account
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-800/40 px-1.5 py-0.5 rounded">
                      Walk-in
                    </span>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Full Name / Company *"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    placeholder="Phone Number (+254...) *"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Street / Pickup Address *"
                    value={senderAddress}
                    onChange={(e) => setSenderAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="City / Town"
                    value={senderCity}
                    onChange={(e) => setSenderCity(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Email (Optional)"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Consignee Column */}
              <div className="space-y-2.5 bg-[#0b0e14]/60 border border-[#1e2433] rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] font-bold uppercase">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Consignee / Recipient</span>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Full Name / Recipient *"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    placeholder="Phone Number (+254...) *"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Delivery Address / Landmark *"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Destination City"
                    value={recipientCity}
                    onChange={(e) => setRecipientCity(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Email (Optional)"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Multi-Parcel Consignment Details & Volumetric Calculator */}
          <div className="bg-[#121622] border border-[#222834] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#222834] pb-2.5">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-200">
                  3. Consignment Parcels & Volumetric Rating
                </h3>
              </div>

              <button
                type="button"
                onClick={handleAddParcel}
                className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 hover:text-white text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD PARCEL</span>
              </button>
            </div>

            {/* Parcels Repeater */}
            <div className="space-y-3">
              {parcels.map((p, idx) => {
                const volWeight = getParcelVolumetric(p);
                const actWeight = Number(p.weight_kg) || 0;
                const chgWeight = Math.max(actWeight, volWeight);

                return (
                  <div key={p.id} className="bg-[#0b0e14] border border-[#1e2433] rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-mono font-bold text-white uppercase">
                          Parcel #{idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-mono text-slate-400">
                          Volumetric: <span className="text-cyan-400 font-bold">{volWeight} kg</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 border-l border-[#222834] pl-2">
                          Chargeable: <span className="text-emerald-400 font-bold">{chgWeight} kg</span>
                        </div>
                        {parcels.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveParcel(p.id)}
                            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors ml-1 cursor-pointer"
                            title="Remove parcel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <div>
                        <label className="block text-[9px] font-mono uppercase text-slate-500 mb-0.5">Package Type</label>
                        <select
                          value={p.package_type}
                          onChange={(e) => handleUpdateParcel(p.id, 'package_type', e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-[#121622] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                        >
                          <option value="BOX">Box / Carton</option>
                          <option value="FLYER">Flyer / Bag</option>
                          <option value="ENVELOPE">Envelope / Docs</option>
                          <option value="CRATE">Wooden Crate</option>
                          <option value="PALLET">Pallet Cargo</option>
                          <option value="ROLL">Roll / Tube</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono uppercase text-slate-500 mb-0.5">Actual Wt (kg) *</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={p.weight_kg}
                          onChange={(e) => handleUpdateParcel(p.id, 'weight_kg', e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-[#121622] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono uppercase text-slate-500 mb-0.5">Length (cm)</label>
                        <input
                          type="number"
                          min="1"
                          value={p.length_cm}
                          onChange={(e) => handleUpdateParcel(p.id, 'length_cm', e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-[#121622] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono uppercase text-slate-500 mb-0.5">Width (cm)</label>
                        <input
                          type="number"
                          min="1"
                          value={p.width_cm}
                          onChange={(e) => handleUpdateParcel(p.id, 'width_cm', e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-[#121622] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono uppercase text-slate-500 mb-0.5">Height (cm)</label>
                        <input
                          type="number"
                          min="1"
                          value={p.height_cm}
                          onChange={(e) => handleUpdateParcel(p.id, 'height_cm', e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-[#121622] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono uppercase text-slate-500 mb-0.5">Content Description</label>
                        <input
                          type="text"
                          placeholder="e.g. Spare parts"
                          value={p.description}
                          onChange={(e) => handleUpdateParcel(p.id, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-[#121622] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Optional Value-Added Services */}
            <div className="pt-2 border-t border-[#1e2433] grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-0.5">
                  Declared Value (KES)
                </label>
                <input
                  type="number"
                  placeholder="0.00 (Insurance)"
                  value={declaredValue}
                  onChange={(e) => setDeclaredValue(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-0.5">
                  Cash on Delivery (COD) (KES)
                </label>
                <input
                  type="number"
                  placeholder="0.00 (Collect on Delivery)"
                  value={codAmount}
                  onChange={(e) => setCodAmount(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 mb-0.5">
                  Handling Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fragile, Keep Upright"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#0b0e14] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Live Rating & Tender Action */}
        <div className="lg:col-span-4 space-y-4">
          <div className="sticky top-4 bg-[#121622] border border-[#222834] rounded-xl p-4 sm:p-5 space-y-4 shadow-lg">
            
            <div className="flex items-center justify-between border-b border-[#222834] pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase font-mono tracking-wider text-slate-200">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Live Rating & Breakdown</span>
              </div>
              {calculatingQuote && (
                <span className="text-[10px] font-mono text-blue-400 animate-pulse">Calculating...</span>
              )}
            </div>

            {/* Aggregates Summary Box */}
            <div className="grid grid-cols-2 gap-2 bg-[#0b0e14] p-3 rounded-lg border border-[#1e2433] text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Total Parcels</span>
                <span className="text-white font-bold">{aggregates.count} Pcs</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Actual Weight</span>
                <span className="text-slate-300 font-bold">{aggregates.actualWeight} kg</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Volumetric Wt</span>
                <span className="text-cyan-400 font-bold">{aggregates.volumetricWeight} kg</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Chargeable Wt</span>
                <span className="text-emerald-400 font-extrabold text-sm">{aggregates.chargeableWeight} kg</span>
              </div>
            </div>

            {/* Itemized Charges Breakdown */}
            {calculatingQuote ? (
              <div className="space-y-2 py-1 font-mono text-xs animate-pulse">
                <div className="flex justify-between items-center py-1">
                  <span className="h-3 w-28 bg-slate-800 rounded" />
                  <span className="h-3 w-16 bg-slate-800 rounded" />
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="h-3 w-32 bg-slate-800 rounded" />
                  <span className="h-3 w-16 bg-slate-800 rounded" />
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="h-3 w-24 bg-slate-800 rounded" />
                  <span className="h-3 w-14 bg-slate-800 rounded" />
                </div>
                <div className="border-t border-[#222834] pt-3 flex items-baseline justify-between">
                  <span className="h-4 w-20 bg-slate-800 rounded" />
                  <span className="h-6 w-28 bg-slate-800 rounded" />
                </div>
              </div>
            ) : quoteError ? (
              <div className="p-3 rounded-lg bg-amber-950/25 border border-amber-800/40 text-amber-300 text-xs font-mono space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Quote Calculation Pending</span>
                </div>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">{quoteError}</p>
                <button
                  type="button"
                  onClick={fetchQuote}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer underline underline-offset-2"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Re-calculate quote</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Base Tariff (First 5kg):</span>
                  <span className="text-white font-bold">KES {quote?.base_rate ? Number(quote.base_rate).toFixed(2) : '—'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Additional Weight Fee:</span>
                  <span className="text-white font-bold">KES {quote?.weight_charge ? Number(quote.weight_charge).toFixed(2) : '—'}</span>
                </div>
                {Number(quote?.surcharges) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Priority Surcharge:</span>
                    <span className="text-amber-400 font-bold">+KES {Number(quote?.surcharges).toFixed(2)}</span>
                  </div>
                )}
                {Number(quote?.cod_fee) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>COD Collection Fee:</span>
                    <span className="text-amber-400 font-bold">+KES {Number(quote?.cod_fee).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>VAT (16% KRA Standard):</span>
                  <span className="text-slate-300 font-bold">KES {quote?.tax_amount ? Number(quote.tax_amount).toFixed(2) : '—'}</span>
                </div>

                <div className="border-t border-[#222834] pt-3 flex items-baseline justify-between">
                  <span className="text-sm font-bold text-white uppercase">Total Due:</span>
                  <span className="text-2xl font-black text-emerald-400 tabular-nums">
                    KES {quote?.total_amount ? Number(quote.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </span>
                </div>
              </div>
            )}

            {/* Shift Guard Warning */}
            {!activeShift && (
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Register Locked</p>
                  <p className="text-[11px] text-amber-400/80">Please open an active register shift before processing counter payments.</p>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              type="button"
              onClick={handleOpenPayment}
              disabled={!activeShift || calculatingQuote || !quote?.total_amount || quote?.total_amount <= 0 || !destinationHubId || !senderName || !recipientName}
              className={`w-full py-3.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                activeShift && !calculatingQuote && quote?.total_amount > 0 && destinationHubId && senderName && recipientName
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer hover:scale-[1.01]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>PROCEED TO PAYMENT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payment Tender Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0e121a] border border-[#222834] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-[#121622] border-b border-[#222834] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-white">
                  Counter Payment Tender
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Total Amount Due: <span className="text-emerald-400 font-bold">KES {totalAmountDue}</span>
                </p>
              </div>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="p-4 space-y-4 font-mono">
              <div className="grid grid-cols-4 gap-1.5 bg-[#080a0e] p-1 rounded-lg border border-[#1e2433]">
                {[
                  { id: 'CASH', label: 'Cash', icon: Banknote },
                  { id: 'MPESA', label: 'M-Pesa', icon: Smartphone },
                  { id: 'CARD', label: 'Card', icon: CreditCard },
                  { id: 'SPLIT', label: 'Split', icon: Layers }
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`py-2 rounded text-[11px] font-bold flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                        paymentMethod === m.id
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* CASH Tender */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Cash Tendered (KES)</label>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#080a0e] border border-[#222834] text-white text-base font-bold focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Quick Denominations */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[500, 1000, 2000, 5000].map((denom) => (
                      <button
                        key={denom}
                        type="button"
                        onClick={() => setCashTendered(String(denom))}
                        className="py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        +{denom}
                      </button>
                    ))}
                  </div>

                  {/* Change Calculation Box */}
                  <div className="p-3 rounded-lg bg-[#080a0e] border border-[#1e2433] flex justify-between items-center">
                    <span className="text-xs text-slate-400">Change to Return:</span>
                    <span className="text-base font-bold text-emerald-400 tabular-nums">
                      KES {cashChange}
                    </span>
                  </div>
                </div>
              )}

              {/* M-PESA Tender */}
              {paymentMethod === 'MPESA' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">M-Pesa Mobile Number</label>
                    <input
                      type="tel"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      placeholder="+2547..."
                      className="w-full px-3 py-2 rounded-lg bg-[#080a0e] border border-[#222834] text-white text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">M-Pesa Receipt Code (e.g. QKA882910Z)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={mpesaReceipt}
                        onChange={(e) => setMpesaReceipt(e.target.value.toUpperCase())}
                        placeholder="QKA882910Z"
                        className="w-full px-3 py-2 rounded-lg bg-[#080a0e] border border-[#222834] text-white text-xs font-mono uppercase focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setMpesaReceipt(`MP${Math.floor(10000000 + Math.random() * 90000000)}`)}
                        className="px-2.5 py-1.5 rounded bg-[#161c28] hover:bg-[#202738] border border-[#222834] text-[10px] text-slate-300 whitespace-nowrap cursor-pointer"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CARD Tender */}
              {paymentMethod === 'CARD' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">POS Card Auth / Ref Code</label>
                    <input
                      type="text"
                      value={cardRef}
                      onChange={(e) => setCardRef(e.target.value.toUpperCase())}
                      placeholder="AUTH-992144"
                      className="w-full px-3 py-2 rounded-lg bg-[#080a0e] border border-[#222834] text-white text-xs font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SPLIT Tender */}
              {paymentMethod === 'SPLIT' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Cash Portion (KES)</label>
                      <input
                        type="number"
                        value={splitCash}
                        onChange={(e) => setSplitCash(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#080a0e] border border-[#222834] text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">M-Pesa Portion (KES)</label>
                      <input
                        type="number"
                        value={splitMpesa}
                        onChange={(e) => setSplitMpesa(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-[#080a0e] border border-[#222834] text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ACCOUNT Tender */}
              {paymentMethod === 'ACCOUNT' && (
                <div className="space-y-3">
                  {!senderCustomerId ? (
                    <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Corporate Credit Account Required</span>
                      </div>
                      <p className="text-[11px] text-amber-200/90 leading-relaxed font-mono">
                        Account billing (Net 30) is restricted to pre-approved corporate clients. This booking is currently set to a walk-in shipper.
                      </p>
                      <div className="pt-1 text-[10px] text-slate-400 border-t border-amber-500/20">
                        Please close this modal and use the <strong className="text-white">Customer Search</strong> in Step 2 to link a corporate account before charging.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-lg bg-[#080a0e] border border-blue-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider font-bold">Authorized Account</span>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">NET 30 INVOICED</span>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white font-mono">{senderName}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">Account ID: #{senderCustomerId} • {senderPhone}</div>
                          {senderEmail && <div className="text-[10px] text-slate-500 font-mono">{senderEmail}</div>}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Purchase Order / Cost Center Reference (Optional)
                        </label>
                        <input
                          type="text"
                          value={accountPoRef}
                          onChange={(e) => setAccountPoRef(e.target.value.toUpperCase())}
                          placeholder="e.g. PO-2026-NBO-8812"
                          className="w-full px-3 py-2 rounded-lg bg-[#080a0e] border border-[#222834] text-white text-xs font-mono uppercase focus:border-blue-500 focus:outline-none"
                        />
                        <p className="text-[10px] text-slate-500 font-mono mt-1">
                          This reference will be attached to the consolidated monthly invoice.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Payment & Issue Waybill */}
              <button
                type="button"
                onClick={handleExecuteBooking}
                disabled={submittingBooking || (paymentMethod === 'ACCOUNT' && !senderCustomerId)}
                className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  paymentMethod === 'ACCOUNT'
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                }`}
              >
                {submittingBooking ? (
                  <span>{paymentMethod === 'ACCOUNT' ? 'Charging Corporate Account...' : 'Processing Consignment...'}</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {paymentMethod === 'ACCOUNT'
                        ? (senderCustomerId ? 'CHARGE TO CORPORATE ACCOUNT' : 'SELECT CORPORATE ACCOUNT FIRST')
                        : 'CONFIRM & ISSUE OFFICIAL WAYBILL'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Printable Waybill Modal */}
      <PrintableWaybillModal
        isOpen={waybillModalOpen}
        onClose={() => setWaybillModalOpen(false)}
        waybillData={waybillData}
        onNewBooking={handleResetForm}
        onNavigate={onNavigate}
      />

      {/* Reprint Waybill Modal */}
      {reprintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0e121a] border border-[#222834] rounded-xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222834] pb-2">
              <h3 className="text-xs font-bold uppercase font-mono text-white flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-blue-400" />
                <span>Reprint Consignment Waybill</span>
              </h3>
              <button
                onClick={() => setReprintModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Tracking Number or Waybill #</label>
              <input
                type="text"
                value={reprintQuery}
                onChange={(e) => setReprintQuery(e.target.value.toUpperCase())}
                placeholder="STK-2026... or WB-..."
                className="w-full px-3 py-2 rounded-lg bg-[#080a0e] border border-[#222834] text-white text-xs font-mono uppercase focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleLookupReprint}
              disabled={reprintLoading}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {reprintLoading ? <span>Looking up...</span> : <span>RETRIEVE WAYBILL</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
