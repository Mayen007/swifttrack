import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';

import { KANBAN_COLUMNS } from '../components/dispatch/constants.js';
import { DispatchConsoleHeader } from '../components/dispatch/DispatchConsoleHeader.jsx';
import { DispatchKanbanBoard } from '../components/dispatch/DispatchKanbanBoard.jsx';
import { FleetRosterTab } from '../components/dispatch/FleetRosterTab.jsx';
import { ExceptionsTab } from '../components/dispatch/ExceptionsTab.jsx';
import { AssignCourierModal } from '../components/dispatch/AssignCourierModal.jsx';
import { LogExceptionModal } from '../components/dispatch/LogExceptionModal.jsx';
import { InspectManifestModal } from '../components/dispatch/InspectManifestModal.jsx';

export function DispatchView() {
  const { selectedBranch } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [summary, setSummary] = useState({
    total_active: 0,
    ready_count: 0,
    in_transit_count: 0,
    delivered_count: 0,
    failed_count: 0,
  });
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [driverFilter, setDriverFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('KANBAN');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleNotes, setVehicleNotes] = useState('Toyota HiAce (KDA 482B)');
  const [assignPriority, setAssignPriority] = useState('NORMAL');
  const [dispatchNotes, setDispatchNotes] = useState('');

  const [failModalOpen, setFailModalOpen] = useState(false);
  const [failDelivery, setFailDelivery] = useState(null);
  const [failureReason, setFailureReason] = useState('Customer Unreachable / Phone Off');
  const [failureNotes, setFailureNotes] = useState('');
  const [initiateReturn, setInitiateReturn] = useState(true);

  const [inspectDelivery, setInspectDelivery] = useState(null);

  const searchInputRef = useRef(null);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const [boardRes, drvData] = await Promise.all([
        api.get(`/api/dispatch/board${branchParam}`).catch(() => null),
        api.get('/api/v1/drivers?limit=100').catch(() => null),
      ]);

      let allItems = [];
      if (boardRes && boardRes.board) {
        allItems = [
          ...(boardRes.board.READY_FOR_DISPATCH || []),
          ...(boardRes.board.ASSIGNED || []),
          ...(boardRes.board.PICKED_UP || []),
          ...(boardRes.board.IN_TRANSIT || []),
          ...(boardRes.board.DELIVERED || []),
          ...(boardRes.board.FAILED || []),
        ];
      } else if (Array.isArray(boardRes)) {
        allItems = boardRes;
      }

      setDeliveries(allItems);
      const fallbackDrivers = drvData?.drivers || (Array.isArray(drvData) ? drvData : []);
      setDrivers(boardRes?.drivers || fallbackDrivers);
      setVehicles(boardRes?.vehicles || []);

      if (boardRes?.summary) {
        setSummary(boardRes.summary);
      } else {
        setSummary({
          total_active: allItems.filter((d) => ['READY_FOR_DISPATCH', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(d.status)).length,
          ready_count: allItems.filter((d) => ['READY_FOR_DISPATCH', 'PENDING_ASSIGNMENT'].includes(d.status)).length,
          in_transit_count: allItems.filter((d) => d.status === 'IN_TRANSIT').length,
          delivered_count: allItems.filter((d) => ['DELIVERED', 'COMPLETED'].includes(d.status)).length,
          failed_count: allItems.filter((d) => ['FAILED', 'RETURN_TO_BRANCH', 'RETURN_RECEIVED'].includes(d.status)).length,
        });
      }
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load dispatch board:', e);
      api.toast('Failed to load dispatch board: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [selectedBranch]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        sound.playScan();
      }
      if (e.key === 'Escape') {
        setAssignModalOpen(false);
        setFailModalOpen(false);
        setInspectDelivery(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openAssignModal = (delivery) => {
    setSelectedDelivery(delivery);
    setSelectedDriverId(drivers[0]?.id ? String(drivers[0].id) : '');
    setSelectedVehicleId(vehicles[0]?.id ? String(vehicles[0].id) : '');
    setVehicleNotes(delivery.vehicle_details || vehicles[0]?.registration_number || 'Toyota HiAce (KDA 482B)');
    setAssignPriority(delivery.priority || 'NORMAL');
    setDispatchNotes('');
    setAssignModalOpen(true);
  };

  const handleAssignDriver = async () => {
    if (!selectedDelivery || !selectedDriverId) {
      api.toast('Please choose a driver to assign', 'error');
      sound.playError();
      return;
    }

    try {
      await api.post('/api/dispatch/assign', {
        delivery_id: selectedDelivery.id,
        driver_id: Number(selectedDriverId),
        vehicle_id: selectedVehicleId ? Number(selectedVehicleId) : undefined,
        vehicle_details: vehicleNotes,
        priority: assignPriority,
        notes: dispatchNotes,
      });

      sound.playSuccess();
      api.toast(`Assigned ${selectedDelivery.delivery_number} to courier`, 'success');
      setAssignModalOpen(false);
      setSelectedDelivery(null);
      fetchDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Assignment failed: ${e.message}`, 'error');
    }
  };

  const handleAdvanceStatus = async (delivery, nextStatus) => {
    try {
      await api.put(`/api/dispatch/${delivery.id}/status`, {
        status: nextStatus,
      });
      if (nextStatus === 'DELIVERED') {
        sound.playSuccess();
        api.toast(`Delivery #${delivery.delivery_number} marked DELIVERED (POD Verified)`, 'success');
      } else {
        sound.playScan();
        api.toast(`Status updated to ${nextStatus.replace(/_/g, ' ')}`, 'success');
      }
      fetchDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Update failed: ${e.message}`, 'error');
    }
  };

  const handleUpdatePriority = async (delivery, newPriority) => {
    try {
      await api.patch(`/api/dispatch/${delivery.id}/priority`, {
        priority: newPriority,
      });
      sound.playScan();
      api.toast(`Priority set to ${newPriority}`, 'success');
      fetchDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Failed to update priority: ${e.message}`, 'error');
    }
  };

  const openFailModal = (delivery) => {
    setFailDelivery(delivery);
    setFailureReason('Customer Unreachable / Phone Off');
    setFailureNotes('');
    setInitiateReturn(true);
    setFailModalOpen(true);
  };

  const handleSubmitFailure = async () => {
    if (!failDelivery) return;

    try {
      await api.post(`/api/dispatch/${failDelivery.id}/fail`, {
        failure_reason: failureReason,
        failure_notes: failureNotes,
        initiate_return: initiateReturn,
      });

      sound.playError();
      api.toast(
        `Delivery #${failDelivery.delivery_number} logged as ${initiateReturn ? 'RETURN_TO_BRANCH' : 'FAILED'}`,
        'warning'
      );
      setFailModalOpen(false);
      setFailDelivery(null);
      fetchDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Operation failed: ${e.message}`, 'error');
    }
  };

  const handleRequeueDelivery = async (delivery) => {
    try {
      await api.put(`/api/dispatch/${delivery.id}/status`, {
        status: 'READY_FOR_DISPATCH',
      });
      sound.playSuccess();
      api.toast(`Delivery #${delivery.delivery_number} returned to Ready queue`, 'success');
      fetchDeliveries();
    } catch (e) {
      sound.playError();
      api.toast(`Re-queue failed: ${e.message}`, 'error');
    }
  };

  const filteredDeliveries = deliveries.filter((item) => {
    if (priorityFilter !== 'ALL' && (item.priority || 'NORMAL') !== priorityFilter) {
      return false;
    }
    if (driverFilter !== 'ALL' && String(item.driver_id) !== String(driverFilter)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = item.delivery_number?.toLowerCase().includes(q);
      const matchOrder = item.order_number?.toLowerCase().includes(q);
      const matchRecipient = item.recipient_name?.toLowerCase().includes(q);
      const matchPhone = item.recipient_phone?.toLowerCase().includes(q);
      const matchAddress = item.delivery_address?.toLowerCase().includes(q);
      const matchCity = item.delivery_city?.toLowerCase().includes(q);
      const matchDriver = item.driver_name?.toLowerCase().includes(q);
      const matchVehicle = item.vehicle_reg?.toLowerCase().includes(q) || item.vehicle_details?.toLowerCase().includes(q);

      if (!matchNumber && !matchOrder && !matchRecipient && !matchPhone && !matchAddress && !matchCity && !matchDriver && !matchVehicle) {
        return false;
      }
    }
    return true;
  });

  const exceptionItems = filteredDeliveries.filter((d) =>
    ['FAILED', 'RETURN_TO_BRANCH', 'RETURN_RECEIVED'].includes(d.status)
  );

  return (
    <div className="space-y-4">
      <DispatchConsoleHeader
        selectedBranch={selectedBranch}
        lastSyncTime={lastSyncTime}
        loading={loading}
        onRefresh={fetchDeliveries}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filteredDeliveriesCount={filteredDeliveries.length}
        driversCount={drivers.length}
        exceptionItemsCount={exceptionItems.length}
        summary={summary}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchInputRef={searchInputRef}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        driverFilter={driverFilter}
        setDriverFilter={setDriverFilter}
        drivers={drivers}
      />

      {activeTab === 'KANBAN' && (
        <DispatchKanbanBoard
          columns={KANBAN_COLUMNS}
          filteredDeliveries={filteredDeliveries}
          onInspectDelivery={setInspectDelivery}
          onUpdatePriority={handleUpdatePriority}
          onOpenAssignModal={openAssignModal}
          onAdvanceStatus={handleAdvanceStatus}
          onOpenFailModal={openFailModal}
        />
      )}

      {activeTab === 'FLEET' && (
        <FleetRosterTab
          drivers={drivers}
          onViewAssignedPipeline={(driverId) => {
            setDriverFilter(String(driverId));
            setActiveTab('KANBAN');
            sound.playScan();
          }}
        />
      )}

      {activeTab === 'EXCEPTIONS' && (
        <ExceptionsTab
          exceptionItems={exceptionItems}
          onRequeueDelivery={handleRequeueDelivery}
        />
      )}

      <AssignCourierModal
        isOpen={assignModalOpen}
        selectedDelivery={selectedDelivery}
        drivers={drivers}
        vehicles={vehicles}
        selectedDriverId={selectedDriverId}
        setSelectedDriverId={setSelectedDriverId}
        selectedVehicleId={selectedVehicleId}
        setSelectedVehicleId={setSelectedVehicleId}
        vehicleNotes={vehicleNotes}
        setVehicleNotes={setVehicleNotes}
        assignPriority={assignPriority}
        setAssignPriority={setAssignPriority}
        dispatchNotes={dispatchNotes}
        setDispatchNotes={setDispatchNotes}
        onClose={() => setAssignModalOpen(false)}
        onSubmit={handleAssignDriver}
      />

      <LogExceptionModal
        isOpen={failModalOpen}
        failDelivery={failDelivery}
        failureReason={failureReason}
        setFailureReason={setFailureReason}
        failureNotes={failureNotes}
        setFailureNotes={setFailureNotes}
        initiateReturn={initiateReturn}
        setInitiateReturn={setInitiateReturn}
        onClose={() => setFailModalOpen(false)}
        onSubmit={handleSubmitFailure}
      />

      <InspectManifestModal
        inspectDelivery={inspectDelivery}
        onClose={() => setInspectDelivery(null)}
      />
    </div>
  );
}
