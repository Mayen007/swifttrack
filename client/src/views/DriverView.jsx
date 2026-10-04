import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import { CheckCircle2 } from 'lucide-react';
import { DriverCockpitHeader } from '../components/driver/DriverCockpitHeader.jsx';
import { ActiveRunCard } from '../components/driver/ActiveRunCard.jsx';
import { PodHistoryTable } from '../components/driver/PodHistoryTable.jsx';
import { PodSignatureModal } from '../components/driver/PodSignatureModal.jsx';
import { DriverProblemModal } from '../components/driver/DriverProblemModal.jsx';

export function DriverView() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ACTIVE');
  const [expandedDeliveryId, setExpandedDeliveryId] = useState(null);

  const [gpsCoords, setGpsCoords] = useState({ latitude: -1.2921, longitude: 36.8219, accuracy: 'High (GPS Fix)' });
  const [, setLastSyncTime] = useState(null);

  const [podModalOpen, setPodModalOpen] = useState(false);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [recipientConfirmedName, setRecipientConfirmedName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientRelation, setRecipientRelation] = useState('Self / Customer');
  const [podNotes, setPodNotes] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [photoData, setPhotoData] = useState('');
  const [codCollected, setCodCollected] = useState(false);

  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [problemDelivery, setProblemDelivery] = useState(null);
  const [problemReason, setProblemReason] = useState('Customer Phone Switched Off / Unreachable');
  const [problemNotes, setProblemNotes] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fallbackCoords = { latitude: -1.2921, longitude: 36.8219, accuracy: 'Simulated NBO Central (4m)' };

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then((status) => {
            if (!isMounted) return;
            if (status.state === 'denied') {
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

  const fetchDriverDeliveries = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      let res = await api.get('/api/deliveries/my').catch(() => null);
      if (!res) {
        res = await api.get('/api/deliveries/driver/active').catch(() => null);
      }
      const list = res?.active_deliveries || (Array.isArray(res) ? res : []);
      setDeliveries(list);

      const historyRes = await api.get('/api/deliveries/history').catch(() => []);
      if (Array.isArray(historyRes)) {
        setHistory(historyRes);
      }

      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.warn('Driver manifests notice:', e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverDeliveries();

    // 1. Background real-time polling every 12 seconds so dispatched tasks stream in live
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchDriverDeliveries(true);
      }
    }, 12000);

    // 2. Refresh on window focus / tab visibility
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchDriverDeliveries(true);
      }
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    // 3. Listen for direct notification clicks / task focus events
    const handleFocusDelivery = (e) => {
      const deliveryId = e.detail?.deliveryId;
      if (deliveryId) {
        setActiveTab('ACTIVE');
        setExpandedDeliveryId(Number(deliveryId));
        fetchDriverDeliveries(true);
        setTimeout(() => {
          const el = document.getElementById(`delivery-${deliveryId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 250);
      }
    };
    window.addEventListener('swifttrack:focus_delivery', handleFocusDelivery);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('swifttrack:focus_delivery', handleFocusDelivery);
    };
  }, []);

  // Handle URL delivery_id query or sessionStorage focus on mount or when deliveries change
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const deliveryParam = params.get('delivery_id') || sessionStorage.getItem('swifttrack_focus_delivery_id');
      if (deliveryParam) {
        const idNum = Number(deliveryParam);
        setActiveTab('ACTIVE');
        setExpandedDeliveryId(idNum);
        sessionStorage.removeItem('swifttrack_focus_delivery_id');

        // Clean delivery_id from URL so it doesn't linger
        try {
          const cleanUrl = new URL(window.location.href);
          if (cleanUrl.searchParams.has('delivery_id')) {
            cleanUrl.searchParams.delete('delivery_id');
            window.history.replaceState({ view: 'driver' }, '', cleanUrl.toString());
          }
        } catch {}

        setTimeout(() => {
          const el = document.getElementById(`delivery-${idNum}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }
    } catch {}
  }, [deliveries.length]);

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

  const handleStartRun = async (delivery) => {
    try {
      try {
        await api.patch(`/api/deliveries/${delivery.id}/start`, {
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
        });
      } catch {
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

  const openPodModal = (delivery) => {
    setActiveDelivery(delivery);
    setRecipientConfirmedName(delivery.recipient_name || '');
    setRecipientPhone(delivery.recipient_phone || '');
    setRecipientRelation('Self / Customer');
    setOtpCode('');
    setCodCollected(false);
    setPhotoData('');
    setPodNotes('');
    setSignatureData('');
    setPodModalOpen(true);
    sound.playScan();
  };

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

    const codAmt = Number(activeDelivery.cod_amount || activeDelivery.expected_amount || 0);
    const isCod = codAmt > 0 || activeDelivery.payment_type === 'COD' || activeDelivery.is_cod;
    if (isCod && !codCollected) {
      api.toast(`Please verify collection of COD amount (KES ${codAmt.toLocaleString()}) before sealing delivery`, 'error');
      sound.playError();
      return;
    }

    try {
      await api.post(`/api/deliveries/${activeDelivery.id}/pod`, {
        recipient_name: recipientConfirmedName.trim(),
        recipient_phone: recipientPhone.trim(),
        otp_code: otpCode.trim(),
        signature_data: signatureData || 'data:image/svg+xml;base64,mock-signature',
        photo_data: photoData || undefined,
        cod_collected: isCod ? true : undefined,
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

  const openProblemModal = (delivery) => {
    setProblemDelivery(delivery);
    setProblemReason('Customer Phone Switched Off / Unreachable');
    setProblemNotes('');
    setProblemModalOpen(true);
    sound.playScan();
  };

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

  const activeCount = deliveries.length;
  const inTransitCount = deliveries.filter((d) => d.status === 'IN_TRANSIT').length;
  const completedTodayCount = history.length;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <DriverCockpitHeader
        user={user}
        gpsCoords={gpsCoords}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCount={activeCount}
        inTransitCount={inTransitCount}
        completedTodayCount={completedTodayCount}
        loading={loading}
        onRefresh={fetchDriverDeliveries}
      />

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
            deliveries.map((delivery, index) => (
              <ActiveRunCard
                key={delivery.id}
                delivery={delivery}
                index={index}
                isExpanded={expandedDeliveryId === delivery.id}
                onToggleExpand={() => setExpandedDeliveryId(expandedDeliveryId === delivery.id ? null : delivery.id)}
                onStartRun={handleStartRun}
                onOpenPod={openPodModal}
                onOpenProblem={openProblemModal}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <PodHistoryTable history={history} />
      )}

      <PodSignatureModal
        isOpen={podModalOpen}
        onClose={() => setPodModalOpen(false)}
        activeDelivery={activeDelivery}
        gpsCoords={gpsCoords}
        recipientConfirmedName={recipientConfirmedName}
        setRecipientConfirmedName={setRecipientConfirmedName}
        recipientRelation={recipientRelation}
        setRecipientRelation={setRecipientRelation}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        podNotes={podNotes}
        setPodNotes={setPodNotes}
        signatureData={signatureData}
        setSignatureData={setSignatureData}
        photoData={photoData}
        setPhotoData={setPhotoData}
        codCollected={codCollected}
        setCodCollected={setCodCollected}
        onSubmit={handleSubmitPod}
      />

      <DriverProblemModal
        isOpen={problemModalOpen}
        onClose={() => setProblemModalOpen(false)}
        problemDelivery={problemDelivery}
        problemReason={problemReason}
        setProblemReason={setProblemReason}
        problemNotes={problemNotes}
        setProblemNotes={setProblemNotes}
        onSubmit={handleSubmitProblem}
      />
    </div>
  );
}
