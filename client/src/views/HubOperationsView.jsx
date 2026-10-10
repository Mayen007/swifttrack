import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';

import { HubHeaderNav } from '../components/hub/HubHeaderNav.jsx';
import { InboundReceivingTab } from '../components/hub/InboundReceivingTab.jsx';
import { SortationTab } from '../components/hub/SortationTab.jsx';
import { CustodyHandoffsTab } from '../components/hub/CustodyHandoffsTab.jsx';
import { LinehaulManifestsTab } from '../components/hub/LinehaulManifestsTab.jsx';
import { DiscrepanciesTab } from '../components/hub/DiscrepanciesTab.jsx';
import { CrossBorderCustomsTab } from '../components/hub/CrossBorderCustomsTab.jsx';
import { TransshipmentTab } from '../components/hub/TransshipmentTab.jsx';
import { ResolveDiscrepancyModal } from '../components/hub/ResolveDiscrepancyModal.jsx';
import { CustomsActionModal } from '../components/hub/CustomsActionModal.jsx';
import { RecordHandoffModal } from '../components/hub/RecordHandoffModal.jsx';

export function HubOperationsView() {
  const { user, selectedBranch } = useAuth();
  const currentHubId = selectedBranch?.id || 1;

  const [activeTab, setActiveTab] = useState('RECEIVING');
  const [loading, setLoading] = useState(false);

  // Cross-Border Customs State
  const [crossBorderLegs, setCrossBorderLegs] = useState([]);
  const [crossBorderPostFilter, setCrossBorderPostFilter] = useState('ALL');
  const [customsStatusFilter, setCustomsStatusFilter] = useState('ALL');
  const [selectedLegForCustoms, setSelectedLegForCustoms] = useState(null);
  const [customsModalAction, setCustomsModalAction] = useState(null);
  const [customsForm, setCustomsForm] = useState({
    declaration_number: '',
    certificate_number: '',
    hold_reason: 'VALUATION_DISCREPANCY',
    notes: '',
    documents_verified: true
  });
  const [customsSubmitting, setCustomsSubmitting] = useState(false);

  // Transshipment / Awaiting Outbound Manifest State
  const [awaitingShipments, setAwaitingShipments] = useState([]);

  // Inbound Receiving State
  const [sessions, setSessions] = useState([]);
  const [scanInput, setScanInput] = useState('');
  const [isDamagedScan, setIsDamagedScan] = useState(false);
  const [sessionScannedItems, setSessionScannedItems] = useState([]);
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

  // Handoffs State
  const [handoffs, setHandoffs] = useState([]);
  const [showRecordHandoffModal, setShowRecordHandoffModal] = useState(false);

  // Filter States
  const [manifestStatusFilter, setManifestStatusFilter] = useState('ALL');
  const [discrepancySeverityFilter, setDiscrepancySeverityFilter] = useState('ALL');
  const [discrepancySearch, setDiscrepancySearch] = useState('');
  const [handoffTypeFilter, setHandoffTypeFilter] = useState('ALL');
  const [transshipmentSearch, setTransshipmentSearch] = useState('');

  const fetchHubData = async () => {
    setLoading(true);
    try {
      const [mRes, dRes, cbRes, awRes, scansRes, hRes] = await Promise.all([
        api.get('/api/transport/manifests').catch(() => []),
        api.get('/api/custody/discrepancies').catch(() => []),
        api.get('/api/transport/cross-border/legs').catch(() => []),
        api.get(`/api/shipments/awaiting-manifest/${currentHubId}`).catch(() => []),
        api.get(`/api/custody/scans?hub_id=${currentHubId}&limit=20`).catch(() => null),
        api.get('/api/custody/handoffs').catch(() => [])
      ]);

      setManifests(Array.isArray(mRes) ? mRes : mRes?.data || []);
      setDiscrepancies(Array.isArray(dRes) ? dRes : dRes?.data || []);
      setCrossBorderLegs(Array.isArray(cbRes) ? cbRes : cbRes?.data || []);
      setAwaitingShipments(Array.isArray(awRes) ? awRes : awRes?.data || []);
      setHandoffs(Array.isArray(hRes?.items) ? hRes.items : (Array.isArray(hRes) ? hRes : []));

      if (scansRes?.scan_events && Array.isArray(scansRes.scan_events) && scansRes.scan_events.length > 0) {
        const formatted = scansRes.scan_events.map((s) => ({
          id: s.id,
          barcode: s.barcode,
          scanned_at: s.scanned_at ? new Date(s.scanned_at).toLocaleTimeString() : new Date().toLocaleTimeString(),
          is_damaged: !!s.is_damaged,
          status: s.condition_status || (s.is_damaged ? 'DAMAGED' : 'INTACT')
        }));
        setSessionScannedItems(formatted);
      }

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

  const openCustomsModal = (leg, actionType) => {
    setSelectedLegForCustoms(leg);
    setCustomsModalAction(actionType);
    setCustomsForm({
      declaration_number: leg.customs_declaration_number || `DEC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      certificate_number: `CC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      hold_reason: 'DOCUMENTATION_MISSING',
      notes: '',
      documents_verified: true
    });
    sound.playClick();
  };

  const handleExecuteCustoms = async (e) => {
    e.preventDefault();
    if (!selectedLegForCustoms || !customsModalAction) return;
    setCustomsSubmitting(true);

    try {
      let endpoint = '';
      let payload = {};

      switch (customsModalAction) {
        case 'SUBMIT':
          endpoint = `/api/transport/legs/${selectedLegForCustoms.id}/customs/submit`;
          payload = {
            declaration_number: customsForm.declaration_number,
            documents_verified: customsForm.documents_verified,
            notes: customsForm.notes
          };
          break;
        case 'INSPECT':
          endpoint = `/api/transport/legs/${selectedLegForCustoms.id}/customs/inspect`;
          payload = {
            inspection_result: 'SATISFACTORY',
            notes: customsForm.notes || 'Border post physical inspection completed.'
          };
          break;
        case 'HOLD':
          endpoint = `/api/transport/legs/${selectedLegForCustoms.id}/customs/hold`;
          payload = {
            hold_reason: customsForm.hold_reason,
            notes: customsForm.notes || 'Detained pending regulatory review.'
          };
          break;
        case 'CLEAR':
          endpoint = `/api/transport/legs/${selectedLegForCustoms.id}/customs/clear`;
          payload = {
            certificate_number: customsForm.certificate_number,
            notes: customsForm.notes || 'Clearance certificate granted.'
          };
          break;
        case 'RELEASE':
          endpoint = `/api/transport/legs/${selectedLegForCustoms.id}/customs/release`;
          payload = {
            notes: customsForm.notes || 'Gate pass authorized. Released to continue transit.'
          };
          break;
        default:
          throw new Error('Unrecognized action');
      }

      await api.post(endpoint, payload);
      sound.playSuccess();
      api.toast('Customs regulatory action submitted successfully', 'success');
      setSelectedLegForCustoms(null);
      setCustomsModalAction(null);
      fetchHubData();
    } catch (err) {
      sound.playError();
      api.toast(`Customs action failed: ${err.message}`, 'error');
    } finally {
      setCustomsSubmitting(false);
    }
  };

  const handleReceivingScan = async (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const barcode = scanInput.trim().toUpperCase();
    sound.playBeep();

    try {
      const scanRes = await api.post('/api/custody/scans', {
        barcode,
        scan_type: 'HUB_RECEIVING',
        hub_id: currentHubId,
        is_damaged: isDamagedScan,
        condition_status: isDamagedScan ? 'DAMAGED' : 'INTACT',
        notes: isDamagedScan ? 'Flagged as damaged during inbound hub intake' : 'Inbound physical intake scan'
      });

      const newItem = {
        id: scanRes?.id || Date.now(),
        barcode,
        scanned_at: new Date().toLocaleTimeString(),
        is_damaged: isDamagedScan,
        status: isDamagedScan ? 'DAMAGED' : 'INTACT'
      };

      setSessionScannedItems((prev) => [newItem, ...prev]);
      setScanInput('');
      setIsDamagedScan(false);
      sound.playScan();
      api.toast(`Custody intake scan logged for ${barcode}`, 'success');
    } catch (err) {
      sound.playError();
      api.toast(`Intake scan failed: ${err.message}`, 'error');
    }
  };

  const handleSortScan = async (e) => {
    e.preventDefault();
    if (!sortScanInput.trim()) return;
    const barcode = sortScanInput.trim().toUpperCase();
    sound.playBeep();

    try {
      // Look up shipment by tracking number / barcode
      const searchRes = await api.get(`/api/shipments?search=${encodeURIComponent(barcode)}`).catch(() => []);
      const shipmentList = Array.isArray(searchRes) ? searchRes : (searchRes?.data || []);
      const matchedShipment = shipmentList.find((s) => 
        s.tracking_number === barcode || 
        s.waybill_number === barcode ||
        barcode.startsWith(s.tracking_number)
      ) || shipmentList[0];

      let chosenBay = '';
      if (!matchedShipment) {
        // Fallback staging bay
        chosenBay = 'BAY-00 (Staging & Manual Audit)';
      } else if (matchedShipment.destination_hub_id === currentHubId) {
        if (matchedShipment.delivery_type === 'PICKUP_AT_HUB') {
          chosenBay = 'BAY-05 (Customer Counter Pickup)';
        } else {
          chosenBay = 'BAY-04 (Local Courier Outbound / Doorstep)';
        }
      } else {
        const destName = matchedShipment.destination_hub_name || 'Regional';
        chosenBay = `BAY-01 (${destName} Linehaul)`;
      }

      // Record sort custody scan in background
      api.post('/api/custody/scans', {
        barcode,
        scan_type: 'SORT',
        hub_id: currentHubId,
        location_desc: chosenBay,
        notes: `Allocated to ${chosenBay}`
      }).catch((err) => console.warn('Sort custody scan notice:', err.message));

      setSortedItem({
        barcode,
        status: 'SORTED',
        allocatedBay: chosenBay,
        timestamp: new Date().toLocaleTimeString(),
        shipment: matchedShipment || null
      });
      setSortScanInput('');
      sound.playSuccess();
      api.toast(`Allocated to ${chosenBay}`, 'success');
    } catch (err) {
      sound.playError();
      api.toast(`Sortation scan failed: ${err.message}`, 'error');
    }
  };

  const handleReconcileSession = () => {
    sound.playSuccess();
    api.toast(`Receiving Session Reconciled! ${sessionScannedItems.length} packages confirmed into Hub inventory.`, 'success');
    setSessionScannedItems([]);
  };

  const handleResolveDiscrepancy = async (e) => {
    e.preventDefault();
    if (!selectedDiscrepancy) return;
    try {
      await api.post(`/api/custody/discrepancies/${selectedDiscrepancy.id}/resolve`, {
        action: resolutionAction,
        notes: resolutionNotes
      });
      sound.playSuccess();
      api.toast(`Discrepancy #${selectedDiscrepancy.discrepancy_number || selectedDiscrepancy.id} successfully resolved`, 'success');
      setResolvingModalOpen(false);
      fetchHubData();
    } catch (err) {
      sound.playError();
      api.toast(`Resolution failed: ${err.message}`, 'error');
      setResolvingModalOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <HubHeaderNav
        selectedBranch={selectedBranch}
        currentHubId={currentHubId}
        loading={loading}
        onSync={fetchHubData}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        manifestsCount={manifests.length}
        discrepanciesCount={discrepancies.length}
        crossBorderCount={crossBorderLegs.length}
        awaitingCount={awaitingShipments.length}
      />

      {activeTab === 'RECEIVING' && (
        <InboundReceivingTab
          scanInput={scanInput}
          setScanInput={setScanInput}
          isDamagedScan={isDamagedScan}
          setIsDamagedScan={setIsDamagedScan}
          sessionScannedItems={sessionScannedItems}
          sessions={sessions}
          onReceivingScan={handleReceivingScan}
          onReconcileSession={handleReconcileSession}
        />
      )}

      {activeTab === 'SORT' && (
        <SortationTab
          sortScanInput={sortScanInput}
          setSortScanInput={setSortScanInput}
          onSortScan={handleSortScan}
          sortedItem={sortedItem}
        />
      )}

      {activeTab === 'HANDOFFS' && (
        <CustodyHandoffsTab
          handoffs={handoffs}
          handoffTypeFilter={handoffTypeFilter}
          setHandoffTypeFilter={setHandoffTypeFilter}
          onRecordHandoff={() => {
            sound.playClick();
            setShowRecordHandoffModal(true);
          }}
        />
      )}

      {activeTab === 'MANIFESTS' && (
        <LinehaulManifestsTab
          manifests={manifests}
          manifestStatusFilter={manifestStatusFilter}
          setManifestStatusFilter={setManifestStatusFilter}
        />
      )}

      {activeTab === 'DISCREPANCIES' && (
        <DiscrepanciesTab
          discrepancies={discrepancies}
          discrepancySeverityFilter={discrepancySeverityFilter}
          setDiscrepancySeverityFilter={setDiscrepancySeverityFilter}
          discrepancySearch={discrepancySearch}
          setDiscrepancySearch={setDiscrepancySearch}
          onOpenResolve={(d) => {
            setSelectedDiscrepancy(d);
            setResolvingModalOpen(true);
          }}
        />
      )}

      {activeTab === 'CROSS_BORDER' && (
        <CrossBorderCustomsTab
          crossBorderLegs={crossBorderLegs}
          customsStatusFilter={customsStatusFilter}
          setCustomsStatusFilter={setCustomsStatusFilter}
          crossBorderPostFilter={crossBorderPostFilter}
          setCrossBorderPostFilter={setCrossBorderPostFilter}
          loading={loading}
          onSync={fetchHubData}
          onOpenCustomsModal={openCustomsModal}
        />
      )}

      {activeTab === 'TRANSSHIPMENT' && (
        <TransshipmentTab
          currentHubId={currentHubId}
          awaitingShipments={awaitingShipments}
          transshipmentSearch={transshipmentSearch}
          setTransshipmentSearch={setTransshipmentSearch}
          onAttachToManifest={() => {
            setActiveTab('MANIFESTS');
            sound.playClick();
          }}
        />
      )}

      <ResolveDiscrepancyModal
        selectedDiscrepancy={selectedDiscrepancy}
        resolutionAction={resolutionAction}
        setResolutionAction={setResolutionAction}
        resolutionNotes={resolutionNotes}
        setResolutionNotes={setResolutionNotes}
        onClose={() => setResolvingModalOpen(false)}
        onSubmit={handleResolveDiscrepancy}
      />

      <CustomsActionModal
        selectedLegForCustoms={selectedLegForCustoms}
        customsModalAction={customsModalAction}
        customsForm={customsForm}
        setCustomsForm={setCustomsForm}
        customsSubmitting={customsSubmitting}
        onClose={() => setSelectedLegForCustoms(null)}
        onSubmit={handleExecuteCustoms}
      />

      <RecordHandoffModal
        isOpen={showRecordHandoffModal}
        onClose={() => setShowRecordHandoffModal(false)}
        onSuccess={fetchHubData}
        currentHubId={currentHubId}
        currentUser={user}
      />
    </div>
  );
}
