// client/src/views/DriverView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Bike,
  MapPin,
  Phone,
  Navigation,
  PenTool,
  CheckCircle2,
  Clock,
  RotateCcw,
  X,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  MessageSquare,
  Package,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  Radio,
  FileText,
  User,
  Check,
  Truck,
} from 'lucide-react';

export function DriverView() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ACTIVE'); // ACTIVE, HISTORY
  const [expandedDeliveryId, setExpandedDeliveryId] = useState(null);

  // GPS Telemetry State
  const [gpsCoords, setGpsCoords] = useState({ latitude: -1.2921, longitude: 36.8219, accuracy: 'High (GPS Fix)' });
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // POD Modal State
  const [podModalOpen, setPodModalOpen] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [otpCode, setOtpCode] = useState('1234');
  const [recipientConfirmedName, setRecipientConfirmedName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientRelation, setRecipientRelation] = useState('Self / Customer');
  const [podNotes, setPodNotes] = useState('');
  const [signatureData, setSignatureData] = useState('');

  // Problem / Incident Modal State
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [problemDelivery, setProblemDelivery] = useState(null);
  const [problemReason, setProblemReason] = useState('Customer Phone Switched Off / Unreachable');
  const [problemNotes, setProblemNotes] = useState('');

  // Signature Canvas Refs
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Acquire Geolocation safely without triggering browser permission rejection warnings
  useEffect(() => {
    let isMounted = true;
    const fallbackCoords = { latitude: -1.2921, longitude: 36.8219, accuracy: 'Simulated NBO Central (4m)' };

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then((status) => {
            if (!isMounted) return;
            if (status.state === 'denied') {
              // Permission was already dismissed/blocked: use fallback silently without calling getCurrentPosition
              setGpsCoords({ latitude: -1.2921, longitude: 36.8219, accuracy: 'Nairobi Central Fix' });
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (!isMounted) return;
                setGpsCoords({
                  latitude: Number(pos.coords.latitude.toFixed(4)),
                  longitude: Number(pos.coords.longitude.toFixed(4)),
                  accuracy: `${Math.round(pos.coords.accuracy || 8)}m Accuracy`,
                });
              },
              () => {
                if (isMounted) setGpsCoords(fallbackCoords);
              },
              { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
            );
          })
          .catch(() => {
            if (isMounted) setGpsCoords(fallbackCoords);
          });
      } else {
        setGpsCoords(fallbackCoords);
      }
    } else {
      setGpsCoords(fallbackCoords);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch active deliveries and history
  const fetchDriverDeliveries = async () => {
    try {
      setLoading(true);
      let res = await api.get('/api/deliveries/my').catch(() => null);
      if (!res) {
        res = await api.get('/api/deliveries/driver/active').catch(() => null);
      }
      const list = res?.active_deliveries || (Array.isArray(res) ? res : []);
      setDeliveries(list);

      // Also fetch driver history
      const historyRes = await api.get('/api/deliveries/history').catch(() => []);
      if (Array.isArray(historyRes)) {
        setHistory(historyRes);
      }

      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.warn('Driver manifests notice:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverDeliveries();
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPodModalOpen(false);
        setProblemModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Canvas Drawing for POD Signature
  useEffect(() => {
    if (!podModalOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Fill background with light ivory/slate pad for maximum contrast
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#0f172a'; // Crisp jet ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const startDraw = (e) => {
      e.preventDefault();
      isDrawingRef.current = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const endDraw = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        setSignatureData(canvas.toDataURL('image/png'));
      }
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', endDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    window.addEventListener('touchend', endDraw);

    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      window.removeEventListener('mouseup', endDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      window.removeEventListener('touchend', endDraw);
    };
  }, [podModalOpen]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setSignatureData('');
      sound.playScan();
    }
  };

  // Start Transit for assigned delivery
  const handleStartRun = async (delivery) => {
    try {
      try {
        await api.patch(`/api/deliveries/${delivery.id}/start`, {
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
        });
      } catch (err) {
        await api.put(`/api/dispatch/${delivery.id}/status`, {
          status: 'IN_TRANSIT',
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
        });
      }
      sound.playScan();
      api.toast(`Transit initiated for ${delivery.recipient_name}! En route now.`, 'success');
      fetchDriverDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Failed to initiate transit: ${e.message}`, 'error');
    }
  };

  // Open Proof of Delivery Modal
  const openPodModal = (delivery) => {
    setActiveDelivery(delivery);
    setRecipientConfirmedName(delivery.recipient_name || '');
    setRecipientPhone(delivery.recipient_phone || '');
    setRecipientRelation('Self / Customer');
    setOtpCode('1234');
    setPodNotes('');
    setSignatureData('');
    setPodModalOpen(true);
    sound.playScan();
  };

  // Submit Proof of Delivery
  const handleSubmitPod = async () => {
    if (!activeDelivery) return;
    if (!recipientConfirmedName.trim()) {
      api.toast('Please enter recipient confirmed name', 'error');
      sound.playError();
      return;
    }
    if (!otpCode.trim()) {
      api.toast('Please enter customer delivery OTP code', 'error');
      sound.playError();
      return;
    }

    try {
      await api.post(`/api/deliveries/${activeDelivery.id}/pod`, {
        recipient_name: recipientConfirmedName.trim(),
        recipient_phone: recipientPhone.trim(),
        otp_code: otpCode.trim(),
        signature_data: signatureData || 'data:image/svg+xml;base64,mock-signature',
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        notes: `${recipientRelation ? `[Received by: ${recipientRelation}] ` : ''}${podNotes}`.trim(),
      });

      sound.playSuccess();
      api.toast(`Delivery #${activeDelivery.delivery_number} completed & verified!`, 'success');
      setPodModalOpen(false);
      setActiveDelivery(null);
      fetchDriverDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`POD submission failed: ${e.message}`, 'error');
    }
  };

  // Open Problem / Exception Modal
  const openProblemModal = (delivery) => {
    setProblemDelivery(delivery);
    setProblemReason('Customer Phone Switched Off / Unreachable');
    setProblemNotes('');
    setProblemModalOpen(true);
    sound.playScan();
  };

  // Submit Delivery Problem
  const handleSubmitProblem = async () => {
    if (!problemDelivery) return;

    try {
      await api.post(`/api/deliveries/${problemDelivery.id}/problem`, {
        failure_reason: problemReason,
        failure_notes: problemNotes,
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
      });

      sound.playError();
      api.toast(`Exception logged for #${problemDelivery.delivery_number}. Dispatcher alerted.`, 'warning');
      setProblemModalOpen(false);
      setProblemDelivery(null);
      fetchDriverDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Failed to log problem: ${e.message}`, 'error');
    }
  };

  // Counts & metrics
  const activeCount = deliveries.length;
  const inTransitCount = deliveries.filter((d) => d.status === 'IN_TRANSIT').length;
  const completedTodayCount = history.length;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* 1. COURIER OPERATIONAL TELEMETRY COCKPIT */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center text-amber-400">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Courier Execution Terminal
                </h1>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  ONLINE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                COURIER: <span className="text-slate-200 font-semibold">{user?.full_name || user?.username || 'Courier One'}</span>
                <span className="mx-2 text-[#222834]">|</span>
                GPS: <span className="text-slate-300 font-mono tabular-nums">{gpsCoords.latitude}, {gpsCoords.longitude}</span>
                <span className="ml-1 text-slate-500 text-[10px]">({gpsCoords.accuracy})</span>
              </p>
            </div>
          </div>

          {/* Sync & View Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[#0c0e12] p-0.5 rounded border border-[#222834] text-xs font-mono">
              <button
                onClick={() => {
                  setActiveTab('ACTIVE');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'ACTIVE'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>ACTIVE RUNS</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 text-[10px] tabular-nums">
                  {activeCount}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('HISTORY');
                  sound.playScan();
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'HISTORY'
                    ? 'bg-[#181d28] text-white border border-[#222834]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>POD HISTORY</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] tabular-nums">
                  {completedTodayCount}
                </span>
              </button>
            </div>

            <button
              onClick={() => {
                fetchDriverDeliveries();
                sound.playScan();
              }}
              disabled={loading}
              className="h-8 w-8 rounded bg-[#0c0e12] hover:bg-[#181d28] border border-[#222834] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh assigned runs"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* 2. MODULAR HARDWARE KPI STRIP (Dieter Rams Matrix) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#222834] border border-[#222834] rounded overflow-hidden">
          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Assigned Manifests</span>
              <span className="text-lg font-mono font-bold text-slate-100 tabular-nums">{activeCount}</span>
            </div>
            <Package className="w-4 h-4 text-slate-600" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider block">En Route / Transit</span>
              <span className="text-lg font-mono font-bold text-cyan-400 tabular-nums">{inTransitCount}</span>
            </div>
            <Navigation className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block">Completed (POD)</span>
              <span className="text-lg font-mono font-bold text-emerald-400 tabular-nums">{completedTodayCount}</span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="bg-[#0c0e12] p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-400 font-mono uppercase tracking-wider block">Route Status</span>
              <span className="text-xs font-mono font-bold text-amber-300">
                {activeCount > 0 ? (inTransitCount > 0 ? 'ON ROAD' : 'READY TO DEPART') : 'IDLE / HUB'}
              </span>
            </div>
            <Radio className={`w-3.5 h-3.5 ${inTransitCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
          </div>
        </div>
      </div>

      {/* 3. ACTIVE RUNS VIEW */}
      {activeTab === 'ACTIVE' && (
        <div className="space-y-3">
          {deliveries.length === 0 ? (
            <div className="bg-[#12161f] border border-[#222834] rounded p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded bg-[#181d28] border border-[#222834] flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                  All Courier Runs Completed
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-1 max-w-sm mx-auto">
                  No active delivery manifests pending at this station. New orders dispatched by HQ will stream directly into your console.
                </p>
              </div>
              <button
                onClick={fetchDriverDeliveries}
                className="px-4 py-2 rounded bg-[#181d28] hover:bg-[#222834] text-slate-300 text-xs font-mono border border-[#222834] transition-colors cursor-pointer"
              >
                Sync with Dispatch
              </button>
            </div>
          ) : (
            deliveries.map((delivery, index) => {
              const isInTransit = delivery.status === 'IN_TRANSIT';
              const isExpanded = expandedDeliveryId === delivery.id;
              const hasItems = delivery.items && delivery.items.length > 0;

              return (
                <div
                  key={delivery.id}
                  className={`bg-[#12161f] border rounded transition-colors overflow-hidden ${
                    isInTransit ? 'border-cyan-500/50' : 'border-[#222834] hover:border-slate-700'
                  }`}
                >
                  {/* Card Hardware Header */}
                  <div className="p-3.5 bg-[#0c0e12] border-b border-[#222834] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[#181d28] border border-[#222834] text-[10px] font-mono font-bold text-slate-400 flex items-center justify-center">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-mono font-bold text-blue-400">
                        {delivery.delivery_number}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        ({delivery.order_number || 'ORD'})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Priority Tag */}
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                          delivery.priority === 'URGENT'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                            : delivery.priority === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-[#181d28] text-slate-400 border border-[#222834]'
                        }`}
                      >
                        {delivery.priority || 'NORMAL'}
                      </span>

                      {/* Status Tag */}
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${
                          isInTransit
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isInTransit ? 'bg-cyan-400 animate-ping' : 'bg-indigo-400'}`} />
                        {delivery.status?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Card Core Content */}
                  <div className="p-4 space-y-3">
                    {/* Recipient & Destination Box */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-1.5">
                          <span>{delivery.recipient_name}</span>
                          {delivery.total_amount && (
                            <span className="text-xs text-emerald-400 font-mono font-bold tabular-nums">
                              • {api.formatKES(delivery.total_amount)}
                            </span>
                          )}
                        </h3>
                        <div className="flex items-start gap-1.5 text-xs text-slate-300 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            {delivery.delivery_address}
                            {delivery.delivery_city ? `, ${delivery.delivery_city}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Rapid Contact & Navigation Grid */}
                      <div className="flex items-center gap-1.5 pt-1 sm:pt-0">
                        {delivery.recipient_phone && (
                          <a
                            href={`tel:${delivery.recipient_phone}`}
                            className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-emerald-600/20 text-emerald-400 border border-[#222834] hover:border-emerald-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
                            title="Direct Call"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call</span>
                          </a>
                        )}

                        {delivery.recipient_phone && (
                          <a
                            href={`https://wa.me/${delivery.recipient_phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-green-600/20 text-green-400 border border-[#222834] hover:border-green-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
                            title="WhatsApp Message"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        )}

                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${delivery.delivery_address || ''}, ${delivery.delivery_city || 'Nairobi'}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 px-3 rounded bg-[#0c0e12] hover:bg-blue-600/20 text-blue-400 border border-[#222834] hover:border-blue-500/40 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
                          title="Open in Google Maps"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>GPS Map</span>
                        </a>
                      </div>
                    </div>

                    {/* Special Delivery Instructions Warning Box (if any) */}
                    {delivery.special_instructions && (
                      <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-[10px] uppercase block tracking-wider text-amber-400">
                            SPECIAL DISPATCH INSTRUCTIONS:
                          </span>
                          <span>{delivery.special_instructions}</span>
                        </div>
                      </div>
                    )}

                    {/* Parcel Manifest Items Drawer (Collapsible) */}
                    {hasItems && (
                      <div className="border-t border-[#222834] pt-2">
                        <button
                          type="button"
                          onClick={() => setExpandedDeliveryId(isExpanded ? null : delivery.id)}
                          className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Package className="w-3 h-3 text-slate-500" />
                          <span>Manifest Cargo ({delivery.items.length} item{delivery.items.length !== 1 ? 's' : ''})</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 bg-[#0c0e12] border border-[#222834] rounded p-2.5 space-y-1.5 text-xs font-mono">
                            {delivery.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-slate-300">
                                <span>{it.quantity}x {it.product_name || 'Item'}</span>
                                <span className="text-slate-500 font-mono text-[10px]">{it.sku}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. EXECUTION ACTION TRIGGER PANEL */}
                    <div className="pt-2 border-t border-[#222834]">
                      {!isInTransit ? (
                        <button
                          onClick={() => handleStartRun(delivery)}
                          className="w-full py-2.5 px-4 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-bold font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-cyan-900/30"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Depart Hub // Initiate Road Transit</span>
                        </button>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => openPodModal(delivery)}
                            className="flex-1 py-3 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
                          >
                            <PenTool className="w-4 h-4" />
                            <span>Capture Signature & Complete POD</span>
                          </button>

                          <button
                            onClick={() => openProblemModal(delivery)}
                            className="py-3 px-3 rounded bg-[#0c0e12] hover:bg-rose-500/20 text-rose-400 border border-[#222834] hover:border-rose-500/40 text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            title="Report road problem or undeliverable address"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Report Issue</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. COMPLETED POD HISTORY VIEW */}
      {activeTab === 'HISTORY' && (
        <div className="bg-[#12161f] border border-[#222834] rounded p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#222834] pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Proof of Delivery (POD) Historical Ledger
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Log of completed, signed, and OTP-verified deliveries fulfilled by your terminal
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold tabular-nums">
              {history.length} DELIVERED
            </span>
          </div>

          {history.length === 0 ? (
            <div className="border border-dashed border-[#222834] rounded p-12 text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                No Completed Runs Logged Yet
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Deliveries that you complete with digital signature and OTP verification will archive here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider bg-[#0c0e12]">
                    <th className="p-3">Manifest #</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Destination Address</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">POD Verification</th>
                    <th className="p-3 text-right">Delivered Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222834]">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-[#181d28]/40 transition-colors">
                      <td className="p-3 font-bold text-blue-400">
                        {item.delivery_number}
                        <span className="block text-[10px] text-slate-500">{item.order_number}</span>
                      </td>
                      <td className="p-3 text-slate-200 font-semibold">{item.recipient_name}</td>
                      <td className="p-3 text-slate-400 max-w-xs truncate">{item.delivery_address}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] text-slate-300 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          {item.otp_verified ? 'OTP VERIFIED' : 'SIGNED POD'}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-400 font-mono">
                        {item.verified_at ? new Date(item.verified_at).toLocaleTimeString('en-KE') : 'TODAY'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. DIGITAL PROOF OF DELIVERY (POD) CONFIRMATION MODAL */}
      {podModalOpen && activeDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-lg w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setPodModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-bold">
                STAGE-05 // PROOF OF DELIVERY (POD)
              </span>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Seal Delivery #{activeDelivery.delivery_number}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                Auto-tagged GPS: {gpsCoords.latitude}, {gpsCoords.longitude} ({gpsCoords.accuracy})
              </p>
            </div>

            {/* Recipient Verification Form */}
            <div className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Confirmed Recipient Name *
                  </label>
                  <input
                    type="text"
                    value={recipientConfirmedName}
                    onChange={(e) => setRecipientConfirmedName(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="Full name of person receiving"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Recipient Relation
                  </label>
                  <select
                    value={recipientRelation}
                    onChange={(e) => setRecipientRelation(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Self / Customer">Self / Customer</option>
                    <option value="Security / Gatekeeper">Security / Gatekeeper</option>
                    <option value="Office Reception / Mailroom">Office Reception / Mailroom</option>
                    <option value="Family Member / Colleague">Family Member / Colleague</option>
                    <option value="Other Proxy">Other Proxy</option>
                  </select>
                </div>
              </div>

              {/* Customer OTP Code Entry */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    Customer Delivery OTP PIN *
                  </label>
                  <button
                    type="button"
                    onClick={() => setOtpCode('1234')}
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    Fill Mock PIN (1234)
                  </button>
                </div>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="4-digit SMS OTP code"
                  maxLength={6}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-100 font-mono tracking-widest text-center text-sm font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Digital Canvas Signature Box */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-blue-400" />
                    Recipient Signature Pad (Touch / Pen)
                  </label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear Pad
                  </button>
                </div>

                <div className="rounded border border-[#222834] bg-[#f8fafc] p-1 flex justify-center shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={130}
                    className="w-full h-[130px] cursor-crosshair touch-none bg-[#f8fafc] rounded"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                  Sign directly inside white canvas above. Saved as digital legal ledger proof.
                </span>
              </div>

              {/* Additional Delivery Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Delivery Gate / Handover Notes (Optional)
                </label>
                <input
                  type="text"
                  value={podNotes}
                  onChange={(e) => setPodNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. Received in good order, parcel intact"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2.5">
                <button
                  onClick={handleSubmitPod}
                  className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/40 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Complete POD</span>
                </button>
                <button
                  onClick={() => setPodModalOpen(false)}
                  className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. DELIVERY EXCEPTION / PROBLEM MODAL */}
      {problemModalOpen && problemDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="bg-[#12161f] border border-rose-500/40 rounded p-6 max-w-md w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setProblemModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider block font-bold">
                INCIDENT DISPATCH REPORT
              </span>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Report Problem for #{problemDelivery.delivery_number}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                Destination: {problemDelivery.delivery_address} ({problemDelivery.recipient_name})
              </p>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Failure / Road Disruption Cause *
                </label>
                <select
                  value={problemReason}
                  onChange={(e) => setProblemReason(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="Customer Phone Switched Off / Unreachable">Customer Phone Switched Off / Unreachable</option>
                  <option value="Customer Not at Delivery Address">Customer Not at Delivery Address</option>
                  <option value="Address Incomplete or Undeliverable">Address Incomplete or Undeliverable</option>
                  <option value="Customer Refused Delivery / Cancelled">Customer Refused Delivery / Cancelled</option>
                  <option value="Vehicle Mechanical Breakdown / Puncture">Vehicle Mechanical Breakdown / Puncture</option>
                  <option value="Adverse Weather / Road Blockage">Adverse Weather / Road Blockage</option>
                  <option value="Cash / Payment Dispute">Cash / Payment Dispute</option>
                  <option value="Other Courier Incident">Other Courier Incident</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Courier Field Incident Notes
                </label>
                <textarea
                  value={problemNotes}
                  onChange={(e) => setProblemNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-rose-500 resize-none"
                  placeholder="Describe attempts to contact customer, specific landmark reached, or vehicle issue..."
                />
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  onClick={handleSubmitProblem}
                  className="flex-1 py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-rose-900/30 transition-colors cursor-pointer"
                >
                  Alert Dispatch HQ
                </button>
                <button
                  onClick={() => setProblemModalOpen(false)}
                  className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
