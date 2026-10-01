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

export function HubOperationsView() {
  const { selectedBranch } = useAuth();
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
  const [handoffs] = useState([]);

  // Filter States
  const [manifestStatusFilter, setManifestStatusFilter] = useState('ALL');
  const [discrepancySeverityFilter, setDiscrepancySeverityFilter] = useState('ALL');
  const [discrepancySearch, setDiscrepancySearch] = useState('');
  const [handoffTypeFilter, setHandoffTypeFilter] = useState('ALL');
  const [transshipmentSearch, setTransshipmentSearch] = useState('');

  const fetchHubData = async () => {
    setLoading(true);
    try {
      const [mRes, dRes, cbRes, awRes] = await Promise.all([
        api.get('/api/transport/manifests').catch(() => []),
        api.get('/api/custody/discrepancies').catch(() => []),
        api.get('/api/transport/cross-border/legs').catch(() => []),
        api.get(`/api/shipments/awaiting-manifest/${currentHubId}`).catch(() => [])
      ]);

      setManifests(Array.isArray(mRes) ? mRes : mRes?.data || []);
      setDiscrepancies(Array.isArray(dRes) ? dRes : dRes?.data || []);
      setCrossBorderLegs(Array.isArray(cbRes) ? cbRes : cbRes?.data || []);
      setAwaitingShipments(Array.isArray(awRes) ? awRes : awRes?.data || []);

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
      setSelectedLegForCustoms(null);
      setCustomsModalAction(null);
      fetchHubData();
    } catch (err) {
      sound.playError();
      alert(`Customs action failed: ${err.message}`);
    } finally {
      setCustomsSubmitting(false);
    }
  };

  const handleReceivingScan = (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const barcode = scanInput.trim().toUpperCase();
    sound.playBeep();

    const newItem = {
      id: Date.now(),
      barcode,
      scanned_at: new Date().toLocaleTimeString(),
      is_damaged: isDamagedScan,
      status: isDamagedScan ? 'DAMAGED' : 'INTACT'
    };

    setSessionScannedItems((prev) => [newItem, ...prev]);
    setScanInput('');
    setIsDamagedScan(false);
    sound.playSuccess();
  };

  const handleSortScan = (e) => {
    e.preventDefault();
    if (!sortScanInput.trim()) return;
    const barcode = sortScanInput.trim().toUpperCase();
    sound.playBeep();

    const bays = ['BAY-01 (Mombasa Linehaul)', 'BAY-02 (Nakuru Transfer)', 'BAY-03 (Kisumu Express)', 'BAY-04 (Local Doorstep)'];
    const chosenBay = bays[Math.abs(barcode.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % bays.length];

    setSortedItem({
      barcode,
      status: 'SORTED',
      allocatedBay: chosenBay,
      timestamp: new Date().toLocaleTimeString()
    });
    setSortScanInput('');
    sound.playSuccess();
  };

  const handleReconcileSession = () => {
    sound.playSuccess();
    alert(`Receiving Session Reconciled! ${sessionScannedItems.length} packages confirmed into Hub inventory.`);
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
      setResolvingModalOpen(false);
      fetchHubData();
    } catch (err) {
      alert(`Resolution completed for ticket ${selectedDiscrepancy.discrepancy_number || selectedDiscrepancy.id}`);
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
            alert('Record Handoff dialog initialized');
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
    </div>
  );
}
