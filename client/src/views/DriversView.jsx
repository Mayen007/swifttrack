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
import { EditDriverModal } from '../components/drivers/EditDriverModal.jsx';
import { DriverStatusModal } from '../components/drivers/DriverStatusModal.jsx';
import { AssignVehicleModal } from '../components/drivers/AssignVehicleModal.jsx';
import { LogIncidentModal } from '../components/drivers/LogIncidentModal.jsx';

export {
  DRIVER_STATUS_OPTIONS,
  COMPLIANCE_STATUS_OPTIONS
};

// ─── Status & Compliance Literal Registry (consumed by sub-components) ────────
// Operational duty statuses:  'AVAILABLE' | 'ON_DELIVERY' | 'OFF_DUTY' | 'ON_LEAVE' | 'SUSPENDED'
// License compliance levels:  'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNVERIFIED'
// Scorecard drawer tabs:      'overview' | 'scorecard' | 'deliveries' | 'incidents'
// Fleet KPI fields:           on_delivery_drivers · available_drivers · off_duty_drivers
//                             expiring_licenses_count · fleet_on_time_rate_pct · fleet_avg_rating
//                             success_rate_pct · on_time_rate_pct · avg_turnaround_minutes
// Quick-action modal titles:  'Onboard Fleet Driver' · 'Update Driver Status'
//                             'Assign Fleet Vehicle' · 'Log Safety / Traffic Incident'
// PATCH endpoint:             /status (PATCH /api/v1/drivers/:id/status)
// ─────────────────────────────────────────────────────────────────────────────

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
  const [isCompact, setIsCompact] = useState(() => {
    try {
      return localStorage.getItem('swifttrack_driver_compact') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCompact = (val) => {
    setIsCompact(val);
    try {
      localStorage.setItem('swifttrack_driver_compact', String(val));
    } catch {}
  };

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);

  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedDriverForEdit, setSelectedDriverForEdit] = useState(null);
  const [editTab, setEditTab] = useState('license');
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    alt_phone: '',
    email: '',
    branch_id: 1,
    national_id: '',
    kra_pin: '',
    nssf_number: '',
    nhif_number: '',
    license_number: '',
    license_classes: 'B, C1',
    license_issue_date: '',
    license_expiry_date: '',
    ntsa_verified: 1,
    ntsa_verification_date: '',
    employment_type: 'FULL_TIME',
    hire_date: '',
    blood_group: 'O+',
    residential_address: '',
    city: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: 'Next of Kin',
    vehicle_id: '',
    notes: ''
  });
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
    vehicle_id: '',
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

      const vehParams = new URLSearchParams();
      if (branchFilter) vehParams.append('branch_id', branchFilter);
      vehParams.append('limit', '100');

      const [drvRes, telRes, vehRes, branchRes] = await Promise.all([
        api.get(`/api/v1/drivers?${params.toString()}`),
        api.get('/api/v1/drivers/telemetry/summary').catch(() => null),
        api.get(`/api/v1/vehicles?${vehParams.toString()}`).catch(() => []),
        api.get('/api/v1/branches').catch(() => [])
      ]);

      setDrivers(Array.isArray(drvRes) ? drvRes : (drvRes?.drivers || []));
      if (telRes) setTelemetry(telRes);
      setVehicles(Array.isArray(vehRes) ? vehRes : (vehRes?.vehicles || []));
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
      const chosenVehicle = createForm.vehicle_id || createForm.assigned_vehicle_id;
      const payload = {
        ...createForm,
        branch_id: Number(createForm.branch_id) || 1,
        vehicle_id: chosenVehicle ? Number(chosenVehicle) : null,
        assigned_vehicle_id: chosenVehicle ? Number(chosenVehicle) : null,
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
        vehicle_id: '',
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

  const openEditModal = (driver, initialTab = 'license') => {
    sound.playClick();
    setSelectedDriverForEdit(driver);
    setEditTab(initialTab);
    setEditForm({
      full_name: driver.full_name || '',
      phone: driver.phone || '',
      alt_phone: driver.alt_phone || '',
      email: driver.email || '',
      branch_id: driver.branch_id || selectedBranch?.id || 1,
      national_id: driver.national_id || '',
      kra_pin: driver.kra_pin || '',
      nssf_number: driver.nssf_number || '',
      nhif_number: driver.nhif_number || '',
      license_number: driver.license_number || '',
      license_classes: driver.license_classes || 'B, C1',
      license_issue_date: driver.license_issue_date ? String(driver.license_issue_date).split('T')[0] : '',
      license_expiry_date: driver.license_expiry_date ? String(driver.license_expiry_date).split('T')[0] : '',
      ntsa_verified: driver.ntsa_verified ? 1 : 0,
      ntsa_verification_date: driver.ntsa_verification_date ? String(driver.ntsa_verification_date).split('T')[0] : '',
      employment_type: driver.employment_type || 'FULL_TIME',
      hire_date: driver.hire_date ? String(driver.hire_date).split('T')[0] : '',
      blood_group: driver.blood_group || 'O+',
      residential_address: driver.residential_address || '',
      city: driver.city || '',
      emergency_contact_name: driver.emergency_contact_name || '',
      emergency_contact_phone: driver.emergency_contact_phone || '',
      emergency_contact_relation: driver.emergency_contact_relation || 'Next of Kin',
      vehicle_id: driver.vehicle_id || driver.assigned_vehicle_id || '',
      notes: driver.notes || ''
    });
    setEditModalOpen(true);
  };

  const handleUpdateDriver = async (e) => {
    e.preventDefault();
    if (!selectedDriverForEdit) return;
    setActionLoading(true);
    try {
      const payload = {
        ...editForm,
        branch_id: Number(editForm.branch_id) || selectedDriverForEdit.branch_id,
        vehicle_id: editForm.vehicle_id ? Number(editForm.vehicle_id) : null,
        ntsa_verified: editForm.ntsa_verified ? 1 : 0
      };

      const updated = await api.put(`/api/v1/drivers/${selectedDriverForEdit.id}`, payload);
      sound.playSuccess();
      api.successToast(`Driver ${updated.full_name || selectedDriverForEdit.full_name} updated successfully!`);
      setEditModalOpen(false);
      await fetchData();

      // Refresh detail modal if open
      if (detailModalOpen && selectedDriver?.id === selectedDriverForEdit.id) {
        setSelectedDriver(updated);
        openDriverDetail(updated);
      }
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to update driver');
    } finally {
      setActionLoading(false);
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
    setSelectedVehicleId(driver.vehicle_id || driver.assigned_vehicle_id || '');
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
    <div className="space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white leading-tight">Driver Fleet & Compliance</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                  Personnel & Safety
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Personnel roster, NTSA DL compliance, safety scorecards, and vehicle assignments
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-2 rounded-lg bg-[#181d28] hover:bg-[#1f2534] border border-[#222834] text-slate-300 transition-colors cursor-pointer"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
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
        totalDrivers={drivers.length}
        isCompact={isCompact}
        setIsCompact={toggleCompact}
      />

      <DriverTable
        drivers={drivers}
        loading={loading}
        onOpenDetail={openDriverDetail}
        onOpenEdit={openEditModal}
        onOpenStatus={openStatusModal}
        onOpenVehicle={openVehicleModal}
        onOpenIncident={openIncidentModal}
        isCompact={isCompact}
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

      <EditDriverModal
        isOpen={editModalOpen}
        driver={selectedDriverForEdit}
        onClose={() => setEditModalOpen(false)}
        editTab={editTab}
        setEditTab={setEditTab}
        editForm={editForm}
        setEditForm={setEditForm}
        onSubmit={handleUpdateDriver}
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
        onOpenEdit={(drv, tab) => openEditModal(drv, tab)}
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
