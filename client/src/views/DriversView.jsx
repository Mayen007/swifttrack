import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Truck,
  Plus,
  RefreshCw
} from 'lucide-react';
import {
  DRIVER_STATUS_OPTIONS,
  COMPLIANCE_STATUS_OPTIONS
} from '../components/drivers/constants.js';
import { DriverTelemetryCards } from '../components/drivers/DriverTelemetryCards.jsx';
import { DriverFilterBar } from '../components/drivers/DriverFilterBar.jsx';
import { DriverTable } from '../components/drivers/DriverTable.jsx';
import { CreateDriverModal } from '../components/drivers/CreateDriverModal.jsx';
import { DriverDetailModal } from '../components/drivers/DriverDetailModal.jsx';
import { DriverStatusModal } from '../components/drivers/DriverStatusModal.jsx';
import { AssignVehicleModal } from '../components/drivers/AssignVehicleModal.jsx';
import { LogIncidentModal } from '../components/drivers/LogIncidentModal.jsx';

export {
  DRIVER_STATUS_OPTIONS,
  COMPLIANCE_STATUS_OPTIONS
};

export function DriversView() {
  const { user, selectedBranch } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [branches, setBranches] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [complianceFilter, setComplianceFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(selectedBranch?.id || '');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);

  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverScorecard, setDriverScorecard] = useState(null);
  const [driverDeliveries, setDriverDeliveries] = useState([]);
  const [driverIncidents, setDriverIncidents] = useState([]);
  const [driverHistory, setDriverHistory] = useState([]);
  const [detailTab, setDetailTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState(false);

  const [createTab, setCreateTab] = useState('basic');
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    alt_phone: '',
    branch_id: selectedBranch?.id || 1,
    national_id: '',
    kra_pin: '',
    nssf_number: '',
    nhif_number: '',
    license_number: '',
    license_classes: 'B, C1',
    license_issue_date: '',
    license_expiry_date: '',
    ntsa_verified: 1,
    employment_type: 'FULL_TIME',
    hire_date: new Date().toISOString().split('T')[0],
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: 'Next of Kin',
    base_salary_kes: '',
    assigned_vehicle_id: '',
    blood_group: 'O+'
  });

  const [statusForm, setStatusForm] = useState({
    status: 'AVAILABLE',
    notes: ''
  });

  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  const [incidentForm, setIncidentForm] = useState({
    incident_type: 'TRAFFIC_VIOLATION',
    severity: 'LOW',
    incident_date: new Date().toISOString().slice(0, 16),
    description: '',
    action_taken: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (complianceFilter !== 'ALL') params.append('compliance', complianceFilter);
      if (branchFilter) params.append('branch_id', branchFilter);

      const [drvRes, telRes, vehRes, branchRes] = await Promise.all([
        api.get(`/api/v1/drivers?${params.toString()}`),
        api.get('/api/v1/drivers/telemetry/summary').catch(() => null),
        api.get('/api/v1/vehicles?status=AVAILABLE').catch(() => []),
        api.get('/api/v1/branches').catch(() => [])
      ]);

      setDrivers(Array.isArray(drvRes) ? drvRes : (drvRes?.drivers || []));
      if (telRes) setTelemetry(telRes);
      if (Array.isArray(vehRes)) setVehicles(vehRes);
      if (Array.isArray(branchRes)) setBranches(branchRes);
    } catch (err) {
      console.error('Error fetching driver fleet:', err);
      api.errorToast('Failed to load driver roster: ' + (err.message || 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, complianceFilter, branchFilter]);

  const handleCreateDriver = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...createForm,
        branch_id: Number(createForm.branch_id) || 1,
        assigned_vehicle_id: createForm.assigned_vehicle_id ? Number(createForm.assigned_vehicle_id) : null,
        base_salary_kes: createForm.base_salary_kes ? Number(createForm.base_salary_kes) : null,
        ntsa_verified: createForm.ntsa_verified ? 1 : 0
      };

      await api.post('/api/v1/drivers', payload);
      sound.playSuccess();
      api.successToast(`Driver ${payload.full_name} onboarded successfully!`);
      setCreateModalOpen(false);
      setCreateForm({
        full_name: '',
        email: '',
        phone: '',
        alt_phone: '',
        branch_id: selectedBranch?.id || 1,
        national_id: '',
        kra_pin: '',
        nssf_number: '',
        nhif_number: '',
        license_number: '',
        license_classes: 'B, C1',
        license_issue_date: '',
        license_expiry_date: '',
        ntsa_verified: 1,
        employment_type: 'FULL_TIME',
        hire_date: new Date().toISOString().split('T')[0],
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relation: 'Next of Kin',
        base_salary_kes: '',
        assigned_vehicle_id: '',
        blood_group: 'O+'
      });
      fetchData();
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to onboard driver');
    } finally {
      setActionLoading(false);
    }
  };

  const openDriverDetail = async (driver) => {
    sound.playClick();
    setSelectedDriver(driver);
    setDetailModalOpen(true);
    setDetailTab('overview');
    try {
      const [scorecard, deliveries, incidents, history] = await Promise.all([
        api.get(`/api/v1/drivers/${driver.id}/performance`).catch(() => null),
        api.get(`/api/v1/drivers/${driver.id}/deliveries`).catch(() => []),
        api.get(`/api/v1/drivers/${driver.id}/incidents`).catch(() => []),
        api.get(`/api/v1/drivers/${driver.id}/status-history`).catch(() => [])
      ]);
      setDriverScorecard(scorecard);
      setDriverDeliveries(Array.isArray(deliveries) ? deliveries : (deliveries?.deliveries || []));
      setDriverIncidents(Array.isArray(incidents) ? incidents : (incidents?.incidents || []));
      setDriverHistory(Array.isArray(history) ? history : (history?.history || []));
    } catch (err) {
      console.error('Failed to load driver dossier:', err);
    }
  };

  const openStatusModal = (driver) => {
    sound.playClick();
    setSelectedDriver(driver);
    setStatusForm({
      status: driver.status || 'AVAILABLE',
      notes: ''
    });
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedDriver) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/v1/drivers/${selectedDriver.id}/status`, statusForm);
      sound.playSuccess();
      api.successToast(`Driver status updated to ${statusForm.status}`);
      setStatusModalOpen(false);
      fetchData();
      if (detailModalOpen) {
        openDriverDetail(selectedDriver);
      }
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const openVehicleModal = (driver) => {
    sound.playClick();
    setSelectedDriver(driver);
    setSelectedVehicleId(driver.assigned_vehicle_id || '');
    setVehicleModalOpen(true);
  };

  const handleAssignVehicle = async (e) => {
    e.preventDefault();
    if (!selectedDriver) return;
    setActionLoading(true);
    try {
      await api.post(`/api/v1/drivers/${selectedDriver.id}/assign-vehicle`, {
        vehicle_id: selectedVehicleId ? Number(selectedVehicleId) : null
      });
      sound.playSuccess();
      api.successToast(selectedVehicleId ? 'Vehicle assigned to driver' : 'Driver unassigned from vehicle');
      setVehicleModalOpen(false);
      fetchData();
      if (detailModalOpen) {
        openDriverDetail(selectedDriver);
      }
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to assign vehicle');
    } finally {
      setActionLoading(false);
    }
  };

  const openIncidentModal = (driver) => {
    sound.playClick();
    setSelectedDriver(driver);
    setIncidentForm({
      incident_type: 'TRAFFIC_VIOLATION',
      severity: 'LOW',
      incident_date: new Date().toISOString().slice(0, 16),
      description: '',
      action_taken: ''
    });
    setIncidentModalOpen(true);
  };

  const handleLogIncident = async (e) => {
    e.preventDefault();
    if (!selectedDriver) return;
    setActionLoading(true);
    try {
      await api.post(`/api/v1/drivers/${selectedDriver.id}/incidents`, incidentForm);
      sound.playWarning();
      api.successToast('Safety incident logged to driver record');
      setIncidentModalOpen(false);
      setIncidentForm({
        incident_type: 'TRAFFIC_VIOLATION',
        severity: 'LOW',
        incident_date: new Date().toISOString().slice(0, 16),
        description: '',
        action_taken: ''
      });
      fetchData();
      if (detailModalOpen) {
        openDriverDetail(selectedDriver);
      }
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to log safety incident');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Driver Fleet & Compliance</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                  Phase 9.1
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Personnel roster, NTSA DL compliance, safety scorecards, and vehicle assignments
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-2 rounded-lg bg-[#181d28] hover:bg-[#1f2534] border border-[#222834] text-slate-300 transition-colors"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition-all hover:shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard New Driver</span>
          </button>
        </div>
      </div>

      <DriverTelemetryCards telemetry={telemetry} />

      <DriverFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        complianceFilter={complianceFilter}
        setComplianceFilter={setComplianceFilter}
        branchFilter={branchFilter}
        setBranchFilter={setBranchFilter}
        branches={branches}
        isSuperAdmin={user?.role === 'SUPER_ADMIN'}
      />

      <DriverTable
        drivers={drivers}
        loading={loading}
        onOpenDetail={openDriverDetail}
        onOpenStatus={openStatusModal}
        onOpenVehicle={openVehicleModal}
        onOpenIncident={openIncidentModal}
      />

      <CreateDriverModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        createTab={createTab}
        setCreateTab={setCreateTab}
        createForm={createForm}
        setCreateForm={setCreateForm}
        onSubmit={handleCreateDriver}
        actionLoading={actionLoading}
        branches={branches}
        vehicles={vehicles}
      />

      <DriverDetailModal
        isOpen={detailModalOpen}
        selectedDriver={selectedDriver}
        onClose={() => setDetailModalOpen(false)}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        driverScorecard={driverScorecard}
        driverDeliveries={driverDeliveries}
        driverIncidents={driverIncidents}
        driverHistory={driverHistory}
        onOpenStatus={() => openStatusModal(selectedDriver)}
        onOpenVehicle={() => openVehicleModal(selectedDriver)}
        onOpenIncident={() => openIncidentModal(selectedDriver)}
      />

      <DriverStatusModal
        isOpen={statusModalOpen}
        selectedDriver={selectedDriver}
        onClose={() => setStatusModalOpen(false)}
        statusForm={statusForm}
        setStatusForm={setStatusForm}
        onSubmit={handleUpdateStatus}
        actionLoading={actionLoading}
      />

      <AssignVehicleModal
        isOpen={vehicleModalOpen}
        selectedDriver={selectedDriver}
        onClose={() => setVehicleModalOpen(false)}
        selectedVehicleId={selectedVehicleId}
        setSelectedVehicleId={setSelectedVehicleId}
        vehicles={vehicles}
        onSubmit={handleAssignVehicle}
        actionLoading={actionLoading}
      />

      <LogIncidentModal
        isOpen={incidentModalOpen}
        selectedDriver={selectedDriver}
        onClose={() => setIncidentModalOpen(false)}
        incidentForm={incidentForm}
        setIncidentForm={setIncidentForm}
        onSubmit={handleLogIncident}
        actionLoading={actionLoading}
      />
    </div>
  );
}
