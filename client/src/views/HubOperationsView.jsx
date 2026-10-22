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

function getFeedItems(response, collectionKey) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.[collectionKey])) return response[collectionKey];
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.[collectionKey])) return response.data[collectionKey];
  return null;
}

export function HubOperationsView() {
  const { user, selectedBranch } = useAuth();
  const currentHubId = selectedBranch?.id ?? user?.branch_id ?? null;

  const [activeTab, setActiveTab] = useState('RECEIVING');
  const [loading, setLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);
  const [openingSession, setOpeningSession] = useState(false);
  const [completingSession, setCompletingSession] = useState(false);

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
  const [transportRuns, setTransportRuns] = useState([]);
  const [shipmentToManifest, setShipmentToManifest] = useState(null);
  const [assigningShipment, setAssigningShipment] = useState(false);

  // Discrepancies State
  const [discrepancies, setDiscrepancies] = useState([]);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState(null);
  const [resolutionAction, setResolutionAction] = useState('FOUND_AND_RECONCILED');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingModalOpen, setResolvingModalOpen] = useState(false);

  // Manual sortation state
  const [sortedItem, setSortedItem] = useState(null);
  const [sortingShipmentId, setSortingShipmentId] = useState(null);

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
    setSessionsError(null);
    if (!currentHubId) {
      setManifests([]);
      setTransportRuns([]);
      setShipmentToManifest(null);
      setDiscrepancies([]);
      setCrossBorderLegs([]);
      setAwaitingShipments([]);
      setHandoffs([]);
      setSessions([]);
      setSessionScannedItems([]);
      setLoading(false);
      return;
    }

    try {
      let sessionsLoadError = null;
      const [mRes, rRes, dRes, cbRes, awRes, hRes, sessionsRes] = await Promise.all([
        api.get('/api/transport/manifests').catch((error) => {
          console.error('Error fetching manifests:', error);
          return null;
        }),
        api.get(`/api/transport/runs?hub_id=${currentHubId}`).catch((error) => {
          console.error('Error fetching transport runs:', error);
          return null;
        }),
        api.get('/api/custody/discrepancies').catch((error) => {
          console.error('Error fetching discrepancies:', error);
          return null;
        }),
        api.get('/api/transport/cross-border/legs').catch((error) => {
          console.error('Error fetching cross-border movements:', error);
          return null;
        }),
        api.get(`/api/shipments/awaiting-manifest/${currentHubId}`).catch((error) => {
          console.error('Error fetching awaiting shipments:', error);
          return null;
        }),
        api.get('/api/custody/handoffs').catch((error) => {
          console.error('Error fetching handoffs:', error);
          return null;
        }),
        api.get(`/api/custody/receiving-sessions?hub_id=${currentHubId}`).catch((error) => {
          sessionsLoadError = error;
          console.error('Error fetching receiving sessions:', error);
          return null;
        })
      ]);

      const manifestItems = getFeedItems(mRes, 'manifests');
      const runItems = getFeedItems(rRes, 'runs');
      const discrepancyItems = getFeedItems(dRes, 'discrepancies');
      const crossBorderItems = getFeedItems(cbRes, 'legs');
      const awaitingItems = getFeedItems(awRes, 'shipments');
      const handoffItems = getFeedItems(hRes, 'handoffs');
      setManifests(manifestItems || []);
      setTransportRuns(runItems || []);
      setDiscrepancies(discrepancyItems || []);
      setCrossBorderLegs(crossBorderItems || []);
      setAwaitingShipments(awaitingItems || []);
      setHandoffs(handoffItems || []);
      const failedHubFeeds = [];
      if (!manifestItems) failedHubFeeds.push('manifests');
      if (!runItems) failedHubFeeds.push('transport runs');
      if (!discrepancyItems) failedHubFeeds.push('discrepancies');
      if (!crossBorderItems) failedHubFeeds.push('cross-border movements');
      if (!awaitingItems) failedHubFeeds.push('awaiting shipments');
      if (!handoffItems) failedHubFeeds.push('handoffs');

      if (sessionsLoadError) {
        setSessions([]);
        setSessionScannedItems([]);
        setSessionsError('Receiving sessions could not be loaded. Try syncing again.');
      } else if (!Array.isArray(sessionsRes?.receiving_sessions)) {
        console.error('Unexpected receiving sessions response:', sessionsRes);
        setSessions([]);
        setSessionScannedItems([]);
        setSessionsError('Receiving sessions could not be loaded because the response was invalid.');
      } else {
        const receivingSessions = sessionsRes.receiving_sessions;
        setSessions(receivingSessions);
        const activeSession = receivingSessions.find((session) => session.status === 'IN_PROGRESS');

        if (activeSession) {
          try {
            const sessionDetail = await api.get(`/api/custody/receiving-sessions/${activeSession.id}`);
            const items = Array.isArray(sessionDetail?.items) ? sessionDetail.items : [];
            setSessionScannedItems(items.map((item) => ({
              id: item.id,
              barcode: item.barcode,
              scanned_at: item.scanned_at ? new Date(item.scanned_at).toLocaleTimeString() : '',
              is_damaged: item.condition !== 'GOOD',
              status: item.condition === 'GOOD' ? 'INTACT' : item.condition
            })));
          } catch (error) {
            console.error('Error fetching active receiving session details:', error);
            setSessionScannedItems([]);
            setSessionsError('The active receiving session loaded, but its scanned parcels could not be shown.');
          }
        } else {
          setSessionScannedItems([]);
        }
      }
      if (failedHubFeeds.length > 0) {
        api.toast(`Some hub data could not be loaded: ${failedHubFeeds.join(', ')}.`, 'warning');
      }
    } catch (err) {
      console.warn('Error fetching hub operations telemetry:', err);
      setSessionsError('Hub operations data could not be loaded. Try syncing again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignShipmentToRun = async (runId, createRun = false) => {
    if (!shipmentToManifest || assigningShipment) return;
    setAssigningShipment(true);
    try {
      let targetRunId = runId;
      if (createRun) {
        const run = await api.post('/api/transport/runs', {
          origin_hub_id: currentHubId,
          destination_hub_id: shipmentToManifest.leg_destination || shipmentToManifest.destination_hub_id,
          notes: `Outbound linehaul for ${shipmentToManifest.tracking_number}`,
        });
        targetRunId = run?.id;
        if (!targetRunId) throw new Error('The server did not return the created transport run.');
      }
      if (!targetRunId) throw new Error('Select a transport run or create a new one.');

      await api.post(`/api/transport/runs/${targetRunId}/manifest/items`, {
        shipment_id: shipmentToManifest.id,
      });
      sound.playSuccess();
      api.toast(`${shipmentToManifest.tracking_number} assigned to the outbound run.`, 'success');
      setShipmentToManifest(null);
      await fetchHubData();
    } catch (error) {
      sound.playError();
      api.toast(`Could not assign parcel to a run: ${error.message}`, 'error');
      await fetchHubData();
    } finally {
      setAssigningShipment(false);
    }
  };

  useEffect(() => {
    setShipmentToManifest(null);
    fetchHubData();
  }, [selectedBranch, currentHubId]);

  const activeReceivingSession = sessions.find((session) => session.status === 'IN_PROGRESS') || null;

  const handleOpenReceivingSession = async () => {
    if (!currentHubId) return;
    setOpeningSession(true);
    try {
      const session = await api.post('/api/custody/receiving-sessions', { hub_id: currentHubId });
      setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
      setSessionScannedItems([]);
      sound.playSuccess();
      api.toast(`Receiving session ${session.session_number} opened.`, 'success');
    } catch (err) {
      sound.playError();
      api.toast(`Could not open receiving session: ${err.message}`, 'error');
    } finally {
      setOpeningSession(false);
    }
  };

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
    if (!activeReceivingSession) {
      api.toast('Open a receiving session before scanning parcels.', 'error');
      return;
    }

    const barcode = scanInput.trim().toUpperCase();
    sound.playBeep();

    try {
      const scanRes = await api.post(`/api/custody/receiving-sessions/${activeReceivingSession.id}/scan`, {
        barcode,
        condition: isDamagedScan ? 'DAMAGED' : 'GOOD',
        condition_notes: isDamagedScan ? 'Flagged as damaged during inbound hub intake' : undefined
      });

      const item = scanRes?.item;
      if (!item) throw new Error('The server did not return the recorded receiving item.');
      const newItem = {
        id: item.id,
        barcode: item.barcode,
        scanned_at: item.scanned_at ? new Date(item.scanned_at).toLocaleTimeString() : new Date().toLocaleTimeString(),
        is_damaged: item.condition !== 'GOOD',
        status: item.condition === 'GOOD' ? 'INTACT' : item.condition
      };

      setSessionScannedItems((prev) => [newItem, ...prev]);
      if (scanRes.session) {
        setSessions((current) => current.map((session) => (
          session.id === scanRes.session.id ? scanRes.session : session
        )));
      }
      setScanInput('');
      setIsDamagedScan(false);
      sound.playScan();
      api.toast(
        scanRes.discrepancy
          ? `Scan recorded. A ${(scanRes.discrepancy.discrepancy_type || 'receiving').toLowerCase().replaceAll('_', ' ')} discrepancy was raised.`
          : `Parcel ${barcode} received into session ${activeReceivingSession.session_number}.`,
        scanRes.discrepancy ? 'warning' : 'success'
      );
    } catch (err) {
      sound.playError();
      api.toast(`Intake scan failed: ${err.message}`, 'error');
    }
  };

  const handleManualSort = async (shipment) => {
    if (sortingShipmentId) return;
    setSortingShipmentId(shipment.id);
    try {
      const result = await api.post('/api/custody/sortations/manual', {
        shipment_id: shipment.id,
        hub_id: currentHubId,
      });
      if (result?.current_status !== 'SORTED' || !result?.event_id) {
        throw new Error('The server did not confirm the manual sortation.');
      }

      setSortedItem({
        barcode: result.tracking_number,
        allocatedBay: result.allocated_bay,
        confirmedBy: result.confirmed_by,
        confirmedAt: new Date(result.confirmed_at).toLocaleString('en-KE'),
      });
      sound.playSuccess();
      api.toast(`${result.tracking_number} manually sorted to ${result.allocated_bay}`, 'success');
      await fetchHubData();
    } catch (err) {
      sound.playError();
      api.toast(`Manual sort confirmation failed: ${err.message}`, 'error');
    } finally {
      setSortingShipmentId(null);
    }
  };

  const handleReconcileSession = async () => {
    if (!activeReceivingSession) return;
    setCompletingSession(true);
    try {
      const result = await api.post(`/api/custody/receiving-sessions/${activeReceivingSession.id}/complete`, {});
      if (!result?.session) throw new Error('The server did not return the completed receiving session.');
      setSessions((current) => current.map((session) => (
        session.id === result.session.id ? result.session : session
      )));
      setSessionScannedItems([]);
      sound.playSuccess();
      const missingCount = Number(result.missing_items_count || 0);
      api.toast(
        missingCount > 0
          ? `Session completed. ${missingCount} missing manifest parcel${missingCount === 1 ? '' : 's'} flagged for review.`
          : `Receiving session ${result.session.session_number} completed.`,
        'success'
      );
    } catch (err) {
      sound.playError();
      api.toast(`Could not complete receiving session: ${err.message}`, 'error');
    } finally {
      setCompletingSession(false);
    }
  };

  const handleResolveDiscrepancy = async (e) => {
    e.preventDefault();
    if (!selectedDiscrepancy) return;
    try {
      await api.post(`/api/custody/discrepancies/${selectedDiscrepancy.id}/resolve`, {
        resolution_action: resolutionAction,
        resolution_notes: resolutionNotes
      });
      sound.playSuccess();
      api.toast(`Discrepancy #${selectedDiscrepancy.discrepancy_number || selectedDiscrepancy.id} successfully resolved`, 'success');
      setResolvingModalOpen(false);
      setSelectedDiscrepancy(null);
      setResolutionNotes('');
      fetchHubData();
    } catch (err) {
      sound.playError();
      api.toast(`Resolution failed: ${err.message}`, 'error');
    }
  };

  if (!currentHubId) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-slate-300">
        Select an operating branch from the top bar to view and process its hub operations.
      </div>
    );
  }

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
          sessionsError={sessionsError}
          sessionsLoading={loading}
          activeReceivingSession={activeReceivingSession}
          openingSession={openingSession}
          completingSession={completingSession}
          onOpenReceivingSession={handleOpenReceivingSession}
          onReceivingScan={handleReceivingScan}
          onReconcileSession={handleReconcileSession}
        />
      )}

      {activeTab === 'SORT' && (
        <SortationTab
          onManualSort={handleManualSort}
          onOpenManifests={() => setActiveTab('MANIFESTS')}
          sortingShipmentId={sortingShipmentId}
          sortedItem={sortedItem}
          awaitingShipments={awaitingShipments}
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
          runs={transportRuns}
          currentHubId={currentHubId}
          shipment={shipmentToManifest}
          assigningShipment={assigningShipment}
          onAssignShipment={handleAssignShipmentToRun}
          onCancelShipmentAssignment={() => setShipmentToManifest(null)}
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
            setResolutionAction('FOUND_AND_RECONCILED');
            setResolutionNotes('');
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
          onManualSort={handleManualSort}
          sortingShipmentId={sortingShipmentId}
          onAttachToManifest={(shipment) => {
            setShipmentToManifest(shipment);
            setActiveTab('MANIFESTS');
            sound.playClick();
          }}
        />
      )}

      {resolvingModalOpen && (
        <ResolveDiscrepancyModal
          selectedDiscrepancy={selectedDiscrepancy}
          resolutionAction={resolutionAction}
          setResolutionAction={setResolutionAction}
          resolutionNotes={resolutionNotes}
          setResolutionNotes={setResolutionNotes}
          onClose={() => {
            setResolvingModalOpen(false);
            setSelectedDiscrepancy(null);
          }}
          onSubmit={handleResolveDiscrepancy}
        />
      )}

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
