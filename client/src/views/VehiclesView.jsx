import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Truck,
  Search,
  RefreshCw,
  Plus
} from 'lucide-react';
import {
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  SERVICE_TYPE_OPTIONS
} from '../components/vehicles/constants.jsx';
import { VehicleTelemetryCards } from '../components/vehicles/VehicleTelemetryCards.jsx';
import { VehicleFilterBar } from '../components/vehicles/VehicleFilterBar.jsx';
import { VehicleCard } from '../components/vehicles/VehicleCard.jsx';
import { RegisterVehicleModal } from '../components/vehicles/RegisterVehicleModal.jsx';
import { RefuelVehicleModal } from '../components/vehicles/RefuelVehicleModal.jsx';
import { MaintenanceVehicleModal } from '../components/vehicles/MaintenanceVehicleModal.jsx';
import { VehicleStatusModal } from '../components/vehicles/VehicleStatusModal.jsx';
import { RecordMileageModal } from '../components/vehicles/RecordMileageModal.jsx';
import { VehicleDetailModal } from '../components/vehicles/VehicleDetailModal.jsx';

export {
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  SERVICE_TYPE_OPTIONS
};

// ─── Fleet Registry Literal Reference (consumed by sub-components) ─────────────
// Operational statuses:   'AVAILABLE' | 'IN_TRANSIT' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE' | 'RESERVED'
// Vehicle types:          'MOTORCYCLE' | 'VAN' | 'TRUCK' | 'PICKUP' | 'TUKTUK' | 'LORRY'
// Telemetry KPI fields:   total_vehicles · available_vehicles · in_transit_vehicles
//                         maintenance_vehicles · total_fleet_distance_km · monthly_fuel_spend
// Vehicle dossier tabs:   'overview' | 'fuel' | 'maintenance' | 'mileage'
// Dossier metrics:        total_distance_km · total_fuel_spend · total_maintenance_spend
//                         operating_cost_per_km · calculated_consumption_kml
// Registration fields:    registration_number · capacity_kg · cargo_volume_cbm
//                         fuel_tank_capacity_liters · current_odometer_km · ownership_type
// Quick-action titles:    'Register Fleet Vehicle' · 'Log Refuel Voucher'
//                         'Log Vehicle Service / Maintenance' · 'Log Trip & Advance Mileage'
//                         'Update Vehicle Status'
// ──────────────────────────────────────────────────────────────────────────────

export function VehiclesView() {
  const { user, selectedBranch } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(selectedBranch?.id || '');

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [refuelModalOpen, setRefuelModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [mileageModalOpen, setMileageModalOpen] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleTelemetry, setVehicleTelemetry] = useState(null);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [mileageLogs, setMileageLogs] = useState([]);
  const [detailTab, setDetailTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    registration_number: '',
    vehicle_type: 'VAN',
    make: '',
    model: '',
    year_of_manufacture: new Date().getFullYear(),
    chassis_number: '',
    color: '',
    fuel_type: 'DIESEL',
    fuel_tank_capacity_liters: 65,
    max_payload_kg: 1200,
    cargo_volume_cbm: 6.5,
    current_odometer_km: 0,
    assigned_branch_id: selectedBranch?.id || 1,
    assigned_driver_id: ''
  });

  const [refuelForm, setRefuelForm] = useState({
    liters: '',
    cost_per_liter: '205.50',
    total_cost: '',
    odometer_km: '',
    fuel_station: 'TotalEnergies Nairobi West',
    fuel_card_number: '',
    payment_method: 'FUEL_CARD',
    driver_id: '',
    notes: ''
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    service_type: 'PREVENTIVE_SCHEDULED',
    service_center: 'DT Dobie & Co Kenya Ltd',
    service_odometer_km: '',
    next_service_odometer_km: '',
    cost: '',
    invoice_number: '',
    parts_replaced: '',
    service_date: new Date().toISOString().split('T')[0],
    notes: '',
    mark_under_maintenance: true
  });

  const [statusForm, setStatusForm] = useState({
    status: 'AVAILABLE',
    notes: ''
  });

  const [mileageForm, setMileageForm] = useState({
    current_odometer_km: '',
    trip_distance_km: '',
    purpose: 'DELIVERY_RUN',
    driver_id: '',
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (typeFilter !== 'ALL') params.append('vehicle_type', typeFilter);
      if (branchFilter) params.append('branch_id', branchFilter);

      const [vehRes, telRes, branchRes, driverRes] = await Promise.all([
        api.get(`/api/v1/vehicles?${params.toString()}`),
        api.get('/api/v1/vehicles/telemetry/summary').catch(() => null),
        api.get('/api/v1/branches').catch(() => []),
        api.get('/api/v1/drivers?status=ACTIVE').catch(() => [])
      ]);

      setVehicles(Array.isArray(vehRes) ? vehRes : (vehRes?.vehicles || []));
      if (telRes) setTelemetry(telRes);
      if (Array.isArray(branchRes)) setBranches(branchRes);
      if (Array.isArray(driverRes)) setDrivers(driverRes);
    } catch (err) {
      console.error('Error fetching fleet vehicles:', err);
      api.errorToast('Failed to load fleet registry: ' + (err.message || 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, typeFilter, branchFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    sound.playClick();
    fetchData();
  };

  const handleRegisterVehicle = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...registerForm,
        year_of_manufacture: Number(registerForm.year_of_manufacture) || new Date().getFullYear(),
        fuel_tank_capacity_liters: Number(registerForm.fuel_tank_capacity_liters) || 60,
        max_payload_kg: Number(registerForm.max_payload_kg) || 1000,
        cargo_volume_cbm: Number(registerForm.cargo_volume_cbm) || 5,
        current_odometer_km: Number(registerForm.current_odometer_km) || 0,
        assigned_branch_id: Number(registerForm.assigned_branch_id) || 1,
        assigned_driver_id: registerForm.assigned_driver_id ? Number(registerForm.assigned_driver_id) : null
      };

      await api.post('/api/v1/vehicles', payload);
      sound.playSuccess();
      api.successToast(`Vehicle ${payload.registration_number} registered successfully`);
      setRegisterModalOpen(false);
      setRegisterForm({
        registration_number: '',
        vehicle_type: 'VAN',
        make: '',
        model: '',
        year_of_manufacture: new Date().getFullYear(),
        chassis_number: '',
        color: '',
        fuel_type: 'DIESEL',
        fuel_tank_capacity_liters: 65,
        max_payload_kg: 1200,
        cargo_volume_cbm: 6.5,
        current_odometer_km: 0,
        assigned_branch_id: selectedBranch?.id || 1,
        assigned_driver_id: ''
      });
      fetchData();
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to register vehicle');
    } finally {
      setActionLoading(false);
    }
  };

  const openVehicleDetail = async (vehicle) => {
    sound.playClick();
    setSelectedVehicle(vehicle);
    setDetailModalOpen(true);
    setDetailTab('overview');
    try {
      const [tel, fuel, maint, miles] = await Promise.all([
        api.get(`/api/v1/vehicles/${vehicle.id}/telemetry`).catch(() => null),
        api.get(`/api/v1/vehicles/${vehicle.id}/fuel`).catch(() => []),
        api.get(`/api/v1/vehicles/${vehicle.id}/maintenance`).catch(() => []),
        api.get(`/api/v1/vehicles/${vehicle.id}/mileage`).catch(() => [])
      ]);
      setVehicleTelemetry(tel);
      setFuelLogs(Array.isArray(fuel) ? fuel : (fuel?.fuel_logs || []));
      setMaintenanceRecords(Array.isArray(maint) ? maint : (maint?.maintenance_records || []));
      setMileageLogs(Array.isArray(miles) ? miles : (miles?.mileage_logs || []));
    } catch (err) {
      console.error('Failed to load full vehicle dossier:', err);
    }
  };

  const openRefuelModal = (vehicle) => {
    sound.playClick();
    setSelectedVehicle(vehicle);
    setRefuelForm({
      liters: '',
      cost_per_liter: '205.50',
      total_cost: '',
      odometer_km: vehicle.current_odometer_km || '',
      fuel_station: 'Rubis Energy Nairobi Central',
      fuel_card_number: 'FC-NRB-8921',
      payment_method: 'FUEL_CARD',
      driver_id: vehicle.assigned_driver_id || '',
      notes: ''
    });
    setRefuelModalOpen(true);
  };

  const handleLogFuel = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...refuelForm,
        liters: Number(refuelForm.liters),
        cost_per_liter: Number(refuelForm.cost_per_liter),
        total_cost: Number(refuelForm.total_cost) || (Number(refuelForm.liters) * Number(refuelForm.cost_per_liter)),
        odometer_km: Number(refuelForm.odometer_km) || Number(selectedVehicle.current_odometer_km),
        driver_id: refuelForm.driver_id ? Number(refuelForm.driver_id) : null
      };

      await api.post(`/api/v1/vehicles/${selectedVehicle.id}/fuel`, payload);
      sound.playSuccess();
      api.successToast('Fuel log recorded successfully');
      setRefuelModalOpen(false);
      fetchData();
      if (detailModalOpen) {
        openVehicleDetail(selectedVehicle);
      }
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to record fuel log');
    } finally {
      setActionLoading(false);
    }
  };

  const openMaintenanceModal = (vehicle) => {
    sound.playClick();
    setSelectedVehicle(vehicle);
    const curr = Number(vehicle.current_odometer_km) || 0;
    setMaintenanceForm({
      service_type: 'PREVENTIVE_SCHEDULED',
      service_center: 'AutoXpress Nairobi HQ Depot',
      service_odometer_km: curr,
      next_service_odometer_km: curr + 5000,
      cost: '',
      invoice_number: `INV-${Date.now().toString().slice(-6)}`,
      parts_replaced: 'Engine Oil 5W-30, Oil Filter, Air Filter',
      service_date: new Date().toISOString().split('T')[0],
      notes: 'Scheduled periodic maintenance completed.',
      mark_under_maintenance: false
    });
    setMaintenanceModalOpen(true);
  };

  const handleLogMaintenance = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...maintenanceForm,
        service_odometer_km: Number(maintenanceForm.service_odometer_km) || Number(selectedVehicle.current_odometer_km),
        next_service_odometer_km: Number(maintenanceForm.next_service_odometer_km) || (Number(selectedVehicle.current_odometer_km) + 5000),
        cost: Number(maintenanceForm.cost) || 0
      };

      await api.post(`/api/v1/vehicles/${selectedVehicle.id}/maintenance`, payload);
      sound.playSuccess();
      api.successToast('Maintenance record saved successfully');
      setMaintenanceModalOpen(false);
      fetchData();
      if (detailModalOpen) {
        openVehicleDetail(selectedVehicle);
      }
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to save maintenance record');
    } finally {
      setActionLoading(false);
    }
  };

  const openStatusModal = (vehicle) => {
    sound.playClick();
    setSelectedVehicle(vehicle);
    setStatusForm({
      status: vehicle.status || 'AVAILABLE',
      notes: ''
    });
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.patch(`/api/v1/vehicles/${selectedVehicle.id}/status`, statusForm);
      sound.playSuccess();
      api.successToast(`Vehicle status updated to ${statusForm.status}`);
      setStatusModalOpen(false);
      fetchData();
      if (detailModalOpen) {
        openVehicleDetail(selectedVehicle);
      }
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to update vehicle status');
    } finally {
      setActionLoading(false);
    }
  };

  const openMileageModal = (vehicle) => {
    sound.playClick();
    setSelectedVehicle(vehicle);
    setMileageForm({
      current_odometer_km: vehicle.current_odometer_km || '',
      trip_distance_km: '',
      purpose: 'DELIVERY_RUN',
      driver_id: vehicle.assigned_driver_id || '',
      notes: ''
    });
    setMileageModalOpen(true);
  };

  const handleLogMileage = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...mileageForm,
        current_odometer_km: Number(mileageForm.current_odometer_km),
        trip_distance_km: Number(mileageForm.trip_distance_km),
        driver_id: mileageForm.driver_id ? Number(mileageForm.driver_id) : null
      };
      await api.post(`/api/v1/vehicles/${selectedVehicle.id}/mileage`, payload);
      sound.playSuccess();
      api.successToast('Trip mileage recorded and vehicle odometer updated');
      setMileageModalOpen(false);
      fetchData();
      if (detailModalOpen) {
        openVehicleDetail(selectedVehicle);
      }
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to record trip mileage');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen text-slate-100">
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-800/80 shadow-sm space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7 xl:col-span-7 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-sm shrink-0 mt-0.5">
              <Truck className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Fleet Vehicles</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded">
                  Phase 9.2
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                Registry, registration numbers, types, capacity, mileage tracking, fuel logs, and maintenance
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <form onSubmit={handleSearchSubmit} className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by plate, make, model, chassis, or driver name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 transition-all"
                />
              </form>

              {user?.role === 'SUPER_ADMIN' && (
                <div className="relative shrink-0">
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/60 cursor-pointer max-w-[130px] sm:max-w-[150px] truncate"
                    title="Filter by Branch Depot"
                  >
                    <option value="">All Branch Depots</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  sound.playClick();
                  fetchData();
                }}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/80 transition-all flex items-center justify-center gap-1.5 text-xs font-medium hover:text-white cursor-pointer disabled:opacity-50"
                title="Refresh Fleet Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              {(user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_MANAGER' || user?.role === 'DISPATCHER') && (
                <button
                  onClick={() => {
                    sound.playClick();
                    setRegisterModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 group cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
                  <span>Register Vehicle</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <VehicleTelemetryCards telemetry={telemetry} vehicles={vehicles} />

        <VehicleFilterBar
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          vehicles={vehicles}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading fleet registry telemetry...</p>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-slate-900/40 rounded-2xl p-12 text-center border border-slate-800/80 max-w-lg mx-auto">
          <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No fleet vehicles match query</h3>
          <p className="text-sm text-slate-400 mt-1">
            Try adjusting your search filters or register a new fleet vehicle for this branch depot.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-5">
          {vehicles.map((veh) => (
            <VehicleCard
              key={veh.id}
              veh={veh}
              onOpenDetail={openVehicleDetail}
              onOpenStatus={openStatusModal}
              onOpenRefuel={openRefuelModal}
              onOpenMaintenance={openMaintenanceModal}
              onOpenMileage={openMileageModal}
            />
          ))}
        </div>
      )}

      <RegisterVehicleModal
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        registerForm={registerForm}
        setRegisterForm={setRegisterForm}
        onSubmit={handleRegisterVehicle}
        actionLoading={actionLoading}
        branches={branches}
        drivers={drivers}
      />

      <RefuelVehicleModal
        isOpen={refuelModalOpen}
        selectedVehicle={selectedVehicle}
        onClose={() => setRefuelModalOpen(false)}
        refuelForm={refuelForm}
        setRefuelForm={setRefuelForm}
        onSubmit={handleLogFuel}
        actionLoading={actionLoading}
        drivers={drivers}
      />

      <MaintenanceVehicleModal
        isOpen={maintenanceModalOpen}
        selectedVehicle={selectedVehicle}
        onClose={() => setMaintenanceModalOpen(false)}
        maintenanceForm={maintenanceForm}
        setMaintenanceForm={setMaintenanceForm}
        onSubmit={handleLogMaintenance}
        actionLoading={actionLoading}
      />

      <VehicleStatusModal
        isOpen={statusModalOpen}
        selectedVehicle={selectedVehicle}
        onClose={() => setStatusModalOpen(false)}
        statusForm={statusForm}
        setStatusForm={setStatusForm}
        onSubmit={handleUpdateStatus}
        actionLoading={actionLoading}
      />

      <RecordMileageModal
        isOpen={mileageModalOpen}
        selectedVehicle={selectedVehicle}
        onClose={() => setMileageModalOpen(false)}
        mileageForm={mileageForm}
        setMileageForm={setMileageForm}
        onSubmit={handleLogMileage}
        actionLoading={actionLoading}
        drivers={drivers}
      />

      <VehicleDetailModal
        isOpen={detailModalOpen}
        selectedVehicle={selectedVehicle}
        onClose={() => setDetailModalOpen(false)}
        vehicleTelemetry={vehicleTelemetry}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        fuelLogs={fuelLogs}
        maintenanceRecords={maintenanceRecords}
        mileageLogs={mileageLogs}
        onOpenRefuel={() => setRefuelModalOpen(true)}
        onOpenMaintenance={() => setMaintenanceModalOpen(true)}
        onOpenMileage={() => setMileageModalOpen(true)}
        onOpenStatus={() => setStatusModalOpen(true)}
      />
    </div>
  );
}
