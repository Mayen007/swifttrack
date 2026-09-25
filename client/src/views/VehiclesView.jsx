// client/src/views/VehiclesView.jsx
// SwiftTrack Kenya: Phase 9 Logistics & Fleet Management — Vehicle Fleet Engine (9.2)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Truck,
  Car,
  Bike,
  Wrench,
  Fuel,
  Gauge,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Activity,
  History,
  TrendingUp,
  MapPin,
  User,
  ShieldCheck,
  Zap,
  X,
  Layers,
  FileText,
  DollarSign,
  ChevronRight,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export const VEHICLE_STATUS_OPTIONS = [
  { key: 'AVAILABLE', label: 'Available', color: 'emerald' },
  { key: 'IN_TRANSIT', label: 'In Transit', color: 'blue' },
  { key: 'UNDER_MAINTENANCE', label: 'In Maintenance', color: 'amber' },
  { key: 'OUT_OF_SERVICE', label: 'Out of Service', color: 'rose' },
  { key: 'RESERVED', label: 'Reserved', color: 'purple' }
];

export const VEHICLE_TYPE_OPTIONS = [
  { key: 'MOTORCYCLE', label: 'Motorcycle', icon: Bike },
  { key: 'VAN', label: 'Van', icon: Car },
  { key: 'TRUCK', label: 'Truck', icon: Truck },
  { key: 'PICKUP', label: 'Pickup', icon: Truck },
  { key: 'TUKTUK', label: 'Tuk-Tuk', icon: Bike },
  { key: 'LORRY', label: 'Heavy Lorry', icon: Truck }
];

export const SERVICE_TYPE_OPTIONS = [
  { key: 'PREVENTIVE_SCHEDULED', label: 'Preventive Scheduled Service' },
  { key: 'OIL_CHANGE', label: 'Routine Oil & Filter Change' },
  { key: 'TIRE_REPLACEMENT', label: 'Tire Replacement & Balancing' },
  { key: 'BRAKE_OVERHAUL', label: 'Brake Pads & System Overhaul' },
  { key: 'INSPECTION_NTSA', label: 'NTSA Annual Inspection Prep' },
  { key: 'REPAIR_CORRECTIVE', label: 'Corrective Mechanical Repair' },
  { key: 'ACCIDENT_REPAIR', label: 'Accident & Bodywork Repair' }
];

export function VehiclesView() {
  const { user, selectedBranch } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(selectedBranch?.id || '');

  // Modals & Drawers
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [refuelModalOpen, setRefuelModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [mileageModalOpen, setMileageModalOpen] = useState(false);

  // Selected vehicle & detail sub-states
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleTelemetry, setVehicleTelemetry] = useState(null);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [mileageLogs, setMileageLogs] = useState([]);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'fuel' | 'maintenance' | 'mileage'
  const [actionLoading, setActionLoading] = useState(false);

  // Register Vehicle Form State
  const [registerForm, setRegisterForm] = useState({
    registration_number: '',
    vehicle_type: 'VAN',
    make: 'Toyota',
    model: 'HiAce',
    year_of_manufacture: 2023,
    chassis_number: '',
    engine_number: '',
    color: 'White',
    fuel_type: 'DIESEL',
    fuel_tank_capacity_liters: 65,
    ownership_type: 'COMPANY_OWNED',
    capacity_kg: 1200,
    cargo_volume_cbm: 6.5,
    initial_odometer_km: 15000,
    current_odometer_km: 15000,
    branch_id: selectedBranch?.id || 1,
    assigned_driver_id: '',
    next_service_odometer_km: 20000,
    next_service_date: ''
  });

  // Refuel Form State
  const [refuelForm, setRefuelForm] = useState({
    fuel_date: new Date().toISOString().split('T')[0],
    quantity_liters: '',
    cost_per_liter: '195.50',
    total_cost: '',
    odometer_km: '',
    gas_station_vendor: 'TotalEnergies Westlands',
    fuel_type: 'DIESEL',
    is_full_tank: 1,
    voucher_number: '',
    notes: ''
  });

  // Maintenance Form State
  const [maintForm, setMaintForm] = useState({
    service_type: 'PREVENTIVE_SCHEDULED',
    service_date: new Date().toISOString().split('T')[0],
    service_provider: 'DT Dobie Workshop Nairobi',
    service_odometer_km: '',
    total_cost: '',
    labor_cost: '',
    parts_cost: '',
    description: '',
    parts_replaced: '',
    next_service_target_km: '',
    next_service_target_date: '',
    status: 'IN_PROGRESS'
  });

  // Status Change State
  const [newStatus, setNewStatus] = useState('AVAILABLE');
  const [statusReason, setStatusReason] = useState('');

  // Trip / Mileage Form State
  const [tripForm, setTripForm] = useState({
    log_date: new Date().toISOString().split('T')[0],
    trip_type: 'DELIVERY_RUN',
    start_odometer_km: '',
    end_odometer_km: '',
    distance_km: '',
    origin: 'Depot Warehouse',
    destination: '',
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchFilter) params.append('branchId', branchFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (typeFilter !== 'ALL') params.append('vehicleType', typeFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', '50');

      const [vehRes, telRes] = await Promise.all([
        api.get(`/api/v1/vehicles?${params.toString()}`).catch(() => ({ vehicles: [] })),
        api.get(`/api/v1/vehicles/telemetry/summary${branchFilter ? `?branchId=${branchFilter}` : ''}`).catch(() => null)
      ]);

      setVehicles(vehRes.vehicles || []);
      setTelemetry(telRes);
    } catch (err) {
      console.error('Failed to load fleet vehicles data:', err);
      api.errorToast('Failed to fetch fleet vehicles');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxiliary = async () => {
    try {
      const [branchRes, driverRes] = await Promise.all([
        api.get('/api/v1/branches').catch(() => []),
        api.get(`/api/v1/drivers?limit=100${branchFilter ? `&branchId=${branchFilter}` : ''}`).catch(() => ({ drivers: [] }))
      ]);
      setBranches(branchRes || []);
      setDrivers(driverRes.drivers || []);
    } catch (e) {
      console.warn('Aux fetch notice:', e.message);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAuxiliary();
  }, [branchFilter, statusFilter, typeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const openVehicleDetail = async (veh) => {
    setSelectedVehicle(veh);
    setDetailTab('overview');
    setDetailModalOpen(true);

    try {
      const [telRes, fuelRes, maintRes, mileageRes] = await Promise.all([
        api.get(`/api/v1/vehicles/${veh.id}/telemetry`),
        api.get(`/api/v1/vehicles/${veh.id}/fuel?limit=20`),
        api.get(`/api/v1/vehicles/${veh.id}/maintenance?limit=20`),
        api.get(`/api/v1/vehicles/${veh.id}/mileage?limit=20`)
      ]);
      setVehicleTelemetry(telRes);
      setFuelLogs(fuelRes.fuel_logs || []);
      setMaintenanceRecords(maintRes.maintenance_records || []);
      setMileageLogs(mileageRes.mileage_logs || []);
    } catch (err) {
      console.error('Failed to load vehicle full dossier:', err);
    }
  };

  const handleRegisterVehicle = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...registerForm,
        branch_id: Number(registerForm.branch_id),
        capacity_kg: Number(registerForm.capacity_kg),
        cargo_volume_cbm: Number(registerForm.cargo_volume_cbm),
        fuel_tank_capacity_liters: Number(registerForm.fuel_tank_capacity_liters),
        initial_odometer_km: Number(registerForm.initial_odometer_km),
        current_odometer_km: Number(registerForm.current_odometer_km || registerForm.initial_odometer_km),
        year_of_manufacture: Number(registerForm.year_of_manufacture),
        assigned_driver_id: registerForm.assigned_driver_id ? Number(registerForm.assigned_driver_id) : null
      };
      await api.post('/api/v1/vehicles', payload);
      sound.playSuccess();
      api.successToast(`Vehicle ${registerForm.registration_number} registered successfully`);
      setRegisterModalOpen(false);
      fetchData();
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to register vehicle');
    } finally {
      setActionLoading(false);
    }
  };

  const openRefuelModal = (veh) => {
    setSelectedVehicle(veh);
    setRefuelForm({
      fuel_date: new Date().toISOString().split('T')[0],
      quantity_liters: '',
      cost_per_liter: veh.fuel_type === 'DIESEL' ? '195.50' : '205.00',
      total_cost: '',
      odometer_km: veh.current_odometer_km || '',
      gas_station_vendor: 'TotalEnergies Nairobi Hub',
      fuel_type: veh.fuel_type || 'DIESEL',
      is_full_tank: 1,
      voucher_number: '',
      notes: ''
    });
    setRefuelModalOpen(true);
  };

  const handleRecordFuel = async (e) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    setActionLoading(true);
    try {
      const payload = {
        ...refuelForm,
        quantity_liters: Number(refuelForm.quantity_liters),
        cost_per_liter: Number(refuelForm.cost_per_liter),
        total_cost: Number(refuelForm.total_cost || (Number(refuelForm.quantity_liters) * Number(refuelForm.cost_per_liter))),
        odometer_km: Number(refuelForm.odometer_km),
        is_full_tank: refuelForm.is_full_tank ? 1 : 0
      };
      await api.post(`/api/v1/vehicles/${selectedVehicle.id}/fuel`, payload);
      sound.playSuccess();
      api.successToast('Refuel entry logged successfully');
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

  const openMaintenanceModal = (veh) => {
    setSelectedVehicle(veh);
    const currKm = Number(veh.current_odometer_km) || 0;
    setMaintForm({
      service_type: 'PREVENTIVE_SCHEDULED',
      service_date: new Date().toISOString().split('T')[0],
      service_provider: 'DT Dobie Authorized Workshop Nairobi',
      service_odometer_km: currKm,
      total_cost: '',
      labor_cost: '',
      parts_cost: '',
      description: 'Scheduled preventive service & oil check',
      parts_replaced: 'Engine oil, oil filter, air filter',
      next_service_target_km: currKm + 5000,
      next_service_target_date: '',
      status: 'IN_PROGRESS'
    });
    setMaintenanceModalOpen(true);
  };

  const handleRecordMaintenance = async (e) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    setActionLoading(true);
    try {
      const payload = {
        ...maintForm,
        service_odometer_km: Number(maintForm.service_odometer_km),
        total_cost: Number(maintForm.total_cost),
        labor_cost: maintForm.labor_cost ? Number(maintForm.labor_cost) : 0,
        parts_cost: maintForm.parts_cost ? Number(maintForm.parts_cost) : 0,
        next_service_target_km: maintForm.next_service_target_km ? Number(maintForm.next_service_target_km) : null
      };
      await api.post(`/api/v1/vehicles/${selectedVehicle.id}/maintenance`, payload);
      sound.playSuccess();
      api.successToast('Maintenance job scheduled & logged');
      setMaintenanceModalOpen(false);
      fetchData();
      if (detailModalOpen) {
        openVehicleDetail(selectedVehicle);
      }
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to schedule maintenance');
    } finally {
      setActionLoading(false);
    }
  };

  const openStatusModal = (veh) => {
    setSelectedVehicle(veh);
    setNewStatus(veh.status);
    setStatusReason('');
    setStatusModalOpen(true);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/v1/vehicles/${selectedVehicle.id}/status`, {
        status: newStatus,
        reason: statusReason
      });
      sound.playSuccess();
      api.successToast(`Vehicle status set to ${newStatus}`);
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

  const openMileageModal = (veh) => {
    setSelectedVehicle(veh);
    const startKm = Number(veh.current_odometer_km) || 0;
    setTripForm({
      log_date: new Date().toISOString().split('T')[0],
      trip_type: 'DELIVERY_RUN',
      start_odometer_km: startKm,
      end_odometer_km: startKm + 45,
      distance_km: 45,
      origin: `${veh.branch_name || 'Central Depot'} Hub`,
      destination: 'Nairobi CBD & Industrial Area Clients',
      notes: 'Customer dispatch route delivery run'
    });
    setMileageModalOpen(true);
  };

  const handleRecordMileage = async (e) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    setActionLoading(true);
    try {
      const payload = {
        ...tripForm,
        start_odometer_km: Number(tripForm.start_odometer_km),
        end_odometer_km: Number(tripForm.end_odometer_km),
        distance_km: Number(tripForm.distance_km || (Number(tripForm.end_odometer_km) - Number(tripForm.start_odometer_km)))
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

  const renderStatusBadge = (status) => {
    const opt = VEHICLE_STATUS_OPTIONS.find(o => o.key === status) || { label: status, color: 'slate' };
    const colorClasses = {
      emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      rose: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      slate: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    }[opt.color];

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClasses}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${opt.color === 'blue' || opt.color === 'emerald' ? 'animate-pulse' : ''} bg-current`} />
        {opt.label}
      </span>
    );
  };

  const renderVehicleTypeIcon = (type) => {
    switch (type) {
      case 'MOTORCYCLE':
        return <Bike className="w-5 h-5 text-amber-400" />;
      case 'VAN':
        return <Car className="w-5 h-5 text-blue-400" />;
      case 'PICKUP':
        return <Truck className="w-5 h-5 text-emerald-400" />;
      case 'LORRY':
      case 'TRUCK':
        return <Truck className="w-5 h-5 text-purple-400" />;
      case 'TUKTUK':
        return <Bike className="w-5 h-5 text-orange-400" />;
      default:
        return <Truck className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen text-slate-100">
      {/* Header & Fleet Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/20 border border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/10">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">Fleet Vehicles</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded-full">
                  Phase 9.2
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Registry, registration numbers, types, capacity, mileage tracking, fuel logs, and maintenance
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              fetchData();
            }}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/80 transition-all flex items-center gap-2 text-sm font-medium hover:text-white"
            title="Refresh Fleet Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {(user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_MANAGER' || user?.role === 'DISPATCHER') && (
            <button
              onClick={() => {
                sound.playClick();
                setRegisterModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 transition-all flex items-center gap-2 group"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              <span>Register Vehicle</span>
            </button>
          )}
        </div>
      </div>

      {/* Telemetry KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Fleet */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Fleet</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {telemetry?.total_vehicles ?? vehicles.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>{telemetry?.total_payload_capacity_kg ? `${telemetry.total_payload_capacity_kg.toLocaleString()} kg` : 'Payload capacity'}</span>
          </div>
        </div>

        {/* Available in Depot */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Available</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {telemetry?.available_vehicles ?? vehicles.filter(v => v.status === 'AVAILABLE').length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Ready for dispatch</div>
        </div>

        {/* In Transit */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Transit</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400">
            {telemetry?.in_transit_vehicles ?? vehicles.filter(v => v.status === 'IN_TRANSIT').length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Active on delivery runs</div>
        </div>

        {/* Under Maintenance */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Maintenance</span>
            <Wrench className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {telemetry?.maintenance_vehicles ?? vehicles.filter(v => v.status === 'UNDER_MAINTENANCE').length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">In workshop & repairs</div>
        </div>

        {/* Total Odometer */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Odometer</span>
            <Gauge className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {telemetry?.total_fleet_distance_km ? `${Number(telemetry.total_fleet_distance_km).toLocaleString()} km` : '0 km'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Fleet logged distance</div>
        </div>

        {/* Fuel Economy & Spend */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Fuel Spend</span>
            <Fuel className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            KES {telemetry?.monthly_fuel_spend ? Number(telemetry.monthly_fuel_spend).toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Avg {telemetry?.fleet_avg_consumption_kml || '8.5'} km/L
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by registration plate, make, model, chassis, or driver name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/60 transition-all"
            />
          </form>

          {/* Branch Dropdown for Multi-Branch Isolation */}
          {user?.role === 'SUPER_ADMIN' && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
              >
                <option value="">All Branch Depots</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              All ({vehicles.length})
            </button>
            {VEHICLE_STATUS_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === opt.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Vehicle Type Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium mr-1">Type:</span>
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                typeFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            {VEHICLE_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  typeFilter === opt.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vehicle Registry Cards Grid */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((veh) => {
            const isDue = veh.is_service_due;
            const currentOdo = Number(veh.current_odometer_km) || 0;
            const nextOdo = Number(veh.next_service_odometer_km) || (currentOdo + 5000);

            return (
              <div
                key={veh.id}
                className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-sm flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Badge Row */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {/* Kenya Registration Plate Graphic */}
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 bg-amber-400 text-black font-black tracking-widest text-sm rounded-lg border-2 border-black shadow-sm font-mono flex items-center gap-1.5">
                        <span className="w-1.5 h-3 bg-black/40 rounded-xs" />
                        {veh.registration_number}
                      </div>
                      <div className="p-1.5 bg-slate-800/80 rounded-lg text-slate-300" title={veh.vehicle_type}>
                        {renderVehicleTypeIcon(veh.vehicle_type)}
                      </div>
                    </div>

                    {/* Operational Status */}
                    <div>
                      {renderStatusBadge(veh.status)}
                    </div>
                  </div>

                  {/* Make, Model, Year & Branch */}
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                      {veh.make || 'Toyota'} {veh.model || ''} {veh.year_of_manufacture ? `(${veh.year_of_manufacture})` : ''}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span>{veh.branch_name} Depot</span>
                      <span className="text-slate-600">•</span>
                      <span className="capitalize">{veh.fuel_type?.toLowerCase() || 'diesel'}</span>
                      <span className="text-slate-600">•</span>
                      <span>{veh.ownership_type?.replace('_', ' ')?.toLowerCase()}</span>
                    </div>
                  </div>

                  {/* Specs & Capacity Grid */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 text-xs mb-4">
                    <div>
                      <span className="text-slate-500 block">Payload Capacity</span>
                      <span className="font-semibold text-slate-200">
                        {veh.capacity_kg ? `${Number(veh.capacity_kg).toLocaleString()} kg` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Cargo Volume</span>
                      <span className="font-semibold text-slate-200">
                        {veh.cargo_volume_cbm ? `${veh.cargo_volume_cbm} m³` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Current Odometer</span>
                      <span className="font-semibold text-slate-200 flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5 text-purple-400" />
                        {currentOdo.toLocaleString()} km
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Active Deliveries</span>
                      <span className="font-semibold text-blue-400">
                        {veh.active_deliveries_count || 0} active runs
                      </span>
                    </div>
                  </div>

                  {/* Assigned Driver Chip */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-800/60 mb-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block leading-none">Designated Driver</span>
                        <span className="font-medium text-slate-200">
                          {veh.driver_name ? veh.driver_name : 'No Driver Assigned'}
                        </span>
                      </div>
                    </div>
                    {veh.driver_phone && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        {veh.driver_phone}
                      </span>
                    )}
                  </div>

                  {/* Service Target Alert */}
                  {isDue && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs mb-4">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="font-medium">
                        Service Due in {veh.km_until_service} km (Next target: {nextOdo.toLocaleString()} km)
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Actions Bottom Row */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5 text-xs">
                  {/* Quick Refuel Button */}
                  <button
                    onClick={() => {
                      sound.playClick();
                      openRefuelModal(veh);
                    }}
                    className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium transition-all flex items-center gap-1.5"
                    title="Log Fuel Receipt"
                  >
                    <Fuel className="w-3.5 h-3.5" />
                    <span>Refuel</span>
                  </button>

                  {/* Quick Maintenance Button */}
                  <button
                    onClick={() => {
                      sound.playClick();
                      openMaintenanceModal(veh);
                    }}
                    className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium transition-all flex items-center gap-1.5"
                    title="Log / Schedule Maintenance"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Service</span>
                  </button>

                  {/* Quick Mileage Log Button */}
                  <button
                    onClick={() => {
                      sound.playClick();
                      openMileageModal(veh);
                    }}
                    className="p-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium transition-all flex items-center gap-1.5"
                    title="Log Trip Mileage"
                  >
                    <Gauge className="w-3.5 h-3.5" />
                    <span>Trip</span>
                  </button>

                  {/* Status Toggle */}
                  <button
                    onClick={() => {
                      sound.playClick();
                      openStatusModal(veh);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    title="Change Status"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Full Dossier View */}
                  <button
                    onClick={() => {
                      sound.playClick();
                      openVehicleDetail(veh);
                    }}
                    className="px-2.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all flex items-center gap-1 shadow-sm"
                    title="Full Dossier & Telemetry"
                  >
                    <span>Dossier</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- MODALS & DRAWERS ---------------- */}

      {/* MODAL 1: REGISTER VEHICLE */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-900/30 to-indigo-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Register Fleet Vehicle</h2>
                  <p className="text-xs text-slate-400">Onboard a vehicle into the SwiftTrack Kenya fleet registry</p>
                </div>
              </div>
              <button
                onClick={() => setRegisterModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterVehicle} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Registration Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Registration Number (Kenya Plate) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KDL 456X or KBZ 789C"
                    value={registerForm.registration_number}
                    onChange={(e) => setRegisterForm({ ...registerForm, registration_number: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 uppercase font-mono font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Vehicle Type *
                  </label>
                  <select
                    value={registerForm.vehicle_type}
                    onChange={(e) => setRegisterForm({ ...registerForm, vehicle_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {VEHICLE_TYPE_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Make & Model */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Make *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Toyota, Isuzu, Bajaj, Nissan"
                    value={registerForm.make}
                    onChange={(e) => setRegisterForm({ ...registerForm, make: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Model & Year *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="HiAce, Boxer..."
                      value={registerForm.model}
                      onChange={(e) => setRegisterForm({ ...registerForm, model: e.target.value })}
                      className="col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="number"
                      required
                      placeholder="2023"
                      value={registerForm.year_of_manufacture}
                      onChange={(e) => setRegisterForm({ ...registerForm, year_of_manufacture: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                {/* Chassis Number & Engine Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Chassis / VIN Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JTFHL22P500129482"
                    value={registerForm.chassis_number}
                    onChange={(e) => setRegisterForm({ ...registerForm, chassis_number: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. White, Silver, Navy"
                    value={registerForm.color}
                    onChange={(e) => setRegisterForm({ ...registerForm, color: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Fuel Type & Fuel Tank */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Fuel Type
                  </label>
                  <select
                    value={registerForm.fuel_type}
                    onChange={(e) => setRegisterForm({ ...registerForm, fuel_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="DIESEL">Diesel</option>
                    <option value="PETROL">Petrol</option>
                    <option value="ELECTRIC">Electric</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Tank Capacity (Liters)
                  </label>
                  <input
                    type="number"
                    value={registerForm.fuel_tank_capacity_liters}
                    onChange={(e) => setRegisterForm({ ...registerForm, fuel_tank_capacity_liters: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Capacity (kg) & Cargo Volume (m3) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Payload Capacity (kg) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 1200"
                    value={registerForm.capacity_kg}
                    onChange={(e) => setRegisterForm({ ...registerForm, capacity_kg: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Cargo Volume (m³)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 6.5"
                    value={registerForm.cargo_volume_cbm}
                    onChange={(e) => setRegisterForm({ ...registerForm, cargo_volume_cbm: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Initial Odometer & Current Odometer */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Initial / Current Odometer (km) *
                  </label>
                  <input
                    type="number"
                    required
                    value={registerForm.initial_odometer_km}
                    onChange={(e) => setRegisterForm({
                      ...registerForm,
                      initial_odometer_km: e.target.value,
                      current_odometer_km: e.target.value
                    })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Ownership Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Ownership Type
                  </label>
                  <select
                    value={registerForm.ownership_type}
                    onChange={(e) => setRegisterForm({ ...registerForm, ownership_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="COMPANY_OWNED">Company Owned</option>
                    <option value="LEASED">Leased</option>
                    <option value="THIRD_PARTY">Third Party Contractor</option>
                  </select>
                </div>

                {/* Branch Assignment */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Depot Branch *
                  </label>
                  <select
                    required
                    value={registerForm.branch_id}
                    onChange={(e) => setRegisterForm({ ...registerForm, branch_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                {/* Driver Pairing */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Assigned Driver (Optional)
                  </label>
                  <select
                    value={registerForm.assigned_driver_id}
                    onChange={(e) => setRegisterForm({ ...registerForm, assigned_driver_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- No Driver Assigned --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name} ({d.employee_code || d.phone})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Vehicle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REFUEL LOG ENTRY */}
      {refuelModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-900/30 to-teal-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Fuel className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Log Refuel Voucher</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedVehicle.registration_number} • {selectedVehicle.make} {selectedVehicle.model}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRefuelModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordFuel} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Fuel Quantity (Liters) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 45.0"
                    value={refuelForm.quantity_liters}
                    onChange={(e) => {
                      const liters = e.target.value;
                      const price = refuelForm.cost_per_liter;
                      setRefuelForm({
                        ...refuelForm,
                        quantity_liters: liters,
                        total_cost: liters && price ? (Number(liters) * Number(price)).toFixed(2) : refuelForm.total_cost
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Price / Liter (KES) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={refuelForm.cost_per_liter}
                    onChange={(e) => {
                      const price = e.target.value;
                      const liters = refuelForm.quantity_liters;
                      setRefuelForm({
                        ...refuelForm,
                        cost_per_liter: price,
                        total_cost: liters && price ? (Number(liters) * Number(price)).toFixed(2) : refuelForm.total_cost
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Total Amount (KES) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={refuelForm.total_cost}
                    onChange={(e) => setRefuelForm({ ...refuelForm, total_cost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-emerald-400 font-bold font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Odometer at Refuel (km) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder={selectedVehicle.current_odometer_km}
                    value={refuelForm.odometer_km}
                    onChange={(e) => setRefuelForm({ ...refuelForm, odometer_km: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Gas Station / Petrol Vendor
                  </label>
                  <input
                    type="text"
                    value={refuelForm.gas_station_vendor}
                    onChange={(e) => setRefuelForm({ ...refuelForm, gas_station_vendor: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Receipt / Voucher Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VCH-98124"
                    value={refuelForm.voucher_number}
                    onChange={(e) => setRefuelForm({ ...refuelForm, voucher_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 uppercase font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Full Tank Refill?
                  </label>
                  <select
                    value={refuelForm.is_full_tank}
                    onChange={(e) => setRefuelForm({ ...refuelForm, is_full_tank: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={1}>Yes (Full Tank — Calibrate km/L)</option>
                    <option value={0}>No (Partial Top-up)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRefuelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Confirm Refuel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MAINTENANCE RECORD & SCHEDULE */}
      {maintenanceModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl my-6">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-900/30 to-orange-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Log Vehicle Service / Maintenance</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedVehicle.registration_number} • {selectedVehicle.make} {selectedVehicle.model}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMaintenanceModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordMaintenance} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Service Type *
                  </label>
                  <select
                    value={maintForm.service_type}
                    onChange={(e) => setMaintForm({ ...maintForm, service_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {SERVICE_TYPE_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Service Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={maintForm.service_date}
                    onChange={(e) => setMaintForm({ ...maintForm, service_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Odometer at Service (km) *
                  </label>
                  <input
                    type="number"
                    required
                    value={maintForm.service_odometer_km}
                    onChange={(e) => setMaintForm({ ...maintForm, service_odometer_km: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Service Provider / Workshop *
                  </label>
                  <input
                    type="text"
                    required
                    value={maintForm.service_provider}
                    onChange={(e) => setMaintForm({ ...maintForm, service_provider: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Total Cost (KES) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 18500"
                    value={maintForm.total_cost}
                    onChange={(e) => setMaintForm({ ...maintForm, total_cost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-amber-400 font-bold font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Labor Cost (KES)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={maintForm.labor_cost}
                    onChange={(e) => setMaintForm({ ...maintForm, labor_cost: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Next Target Odometer (km)
                  </label>
                  <input
                    type="number"
                    value={maintForm.next_service_target_km}
                    onChange={(e) => setMaintForm({ ...maintForm, next_service_target_km: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Initial Status
                  </label>
                  <select
                    value={maintForm.status}
                    onChange={(e) => setMaintForm({ ...maintForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="IN_PROGRESS">In Progress (Sets vehicle to UNDER_MAINTENANCE)</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="COMPLETED">Already Completed</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Description & Diagnostic Notes
                  </label>
                  <textarea
                    rows={2}
                    value={maintForm.description}
                    onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Parts Replaced / Installed
                  </label>
                  <input
                    type="text"
                    value={maintForm.parts_replaced}
                    onChange={(e) => setMaintForm({ ...maintForm, parts_replaced: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMaintenanceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Service Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: OPERATIONAL STATUS CHANGER */}
      {statusModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Update Vehicle Status</h2>
                <p className="text-xs text-slate-400 font-mono">{selectedVehicle.registration_number}</p>
              </div>
              <button
                onClick={() => setStatusModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                  Select New Operational State
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {VEHICLE_STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setNewStatus(opt.key)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        newStatus === opt.key
                          ? 'bg-blue-600/20 border-blue-500 text-white font-semibold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {newStatus === opt.key && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Reason / State Change Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared workshop inspection, ready for dispatch"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/30 flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Status</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: TRIP MILEAGE LOGGING */}
      {mileageModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-900/30 to-indigo-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Gauge className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Log Trip & Advance Mileage</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedVehicle.registration_number} • Current: {Number(selectedVehicle.current_odometer_km).toLocaleString()} km
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMileageModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordMileage} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Trip Date
                  </label>
                  <input
                    type="date"
                    required
                    value={tripForm.log_date}
                    onChange={(e) => setTripForm({ ...tripForm, log_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Trip Type
                  </label>
                  <select
                    value={tripForm.trip_type}
                    onChange={(e) => setTripForm({ ...tripForm, trip_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                  >
                    <option value="DELIVERY_RUN">Delivery Run</option>
                    <option value="RELOCATION">Depot Transfer / Relocation</option>
                    <option value="MAINTENANCE">Garage Service Trip</option>
                    <option value="TEST_DRIVE">Post-Repair Test Run</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Start Odometer (km) *
                  </label>
                  <input
                    type="number"
                    required
                    value={tripForm.start_odometer_km}
                    onChange={(e) => {
                      const start = Number(e.target.value);
                      const end = Number(tripForm.end_odometer_km);
                      setTripForm({
                        ...tripForm,
                        start_odometer_km: e.target.value,
                        distance_km: end > start ? end - start : tripForm.distance_km
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    End Odometer (km) *
                  </label>
                  <input
                    type="number"
                    required
                    value={tripForm.end_odometer_km}
                    onChange={(e) => {
                      const end = Number(e.target.value);
                      const start = Number(tripForm.start_odometer_km);
                      setTripForm({
                        ...tripForm,
                        end_odometer_km: e.target.value,
                        distance_km: end > start ? end - start : tripForm.distance_km
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-purple-400 font-bold font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Destination / Route
                  </label>
                  <input
                    type="text"
                    value={tripForm.destination}
                    onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMileageModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Record Trip</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL 6: FULL VEHICLE DOSSIER WITH 4 TABS */}
      {detailModalOpen && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl my-4 flex flex-col max-h-[90vh]">
            {/* Header banner */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-4">
                <div className="px-3.5 py-2 bg-amber-400 text-black font-black tracking-widest text-base rounded-xl border-2 border-black font-mono shadow-md">
                  {selectedVehicle.registration_number}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.year_of_manufacture ? `(${selectedVehicle.year_of_manufacture})` : ''}
                    </h2>
                    {renderStatusBadge(selectedVehicle.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedVehicle.branch_name} Depot • {selectedVehicle.vehicle_type} • {selectedVehicle.ownership_type?.replace('_', ' ')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tab navigation bar */}
            <div className="flex items-center gap-1 px-6 border-b border-slate-800 bg-slate-950/40 text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setDetailTab('overview')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  detailTab === 'overview'
                    ? 'border-blue-500 text-blue-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Overview & Specs</span>
              </button>

              <button
                onClick={() => setDetailTab('fuel')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  detailTab === 'fuel'
                    ? 'border-emerald-500 text-emerald-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Fuel className="w-4 h-4" />
                <span>Fuel Logs & Efficiency ({fuelLogs.length})</span>
              </button>

              <button
                onClick={() => setDetailTab('maintenance')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  detailTab === 'maintenance'
                    ? 'border-amber-500 text-amber-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="w-4 h-4" />
                <span>Maintenance & Repairs ({maintenanceRecords.length})</span>
              </button>

              <button
                onClick={() => setDetailTab('mileage')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  detailTab === 'mileage'
                    ? 'border-purple-500 text-purple-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Gauge className="w-4 h-4" />
                <span>Mileage & Trips ({mileageLogs.length})</span>
              </button>
            </div>

            {/* Tab content area */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* TAB 1: OVERVIEW & SPECS */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  {/* Telemetry Stat Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">Total Distance</span>
                      <div className="text-xl font-black text-white mt-1">
                        {vehicleTelemetry?.total_distance_km ? `${Number(vehicleTelemetry.total_distance_km).toLocaleString()} km` : '0 km'}
                      </div>
                      <span className="text-[10px] text-slate-500">Logged since onboarding</span>
                    </div>

                    <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">Fuel Spend</span>
                      <div className="text-xl font-black text-emerald-400 mt-1">
                        KES {vehicleTelemetry?.total_fuel_spend ? Number(vehicleTelemetry.total_fuel_spend).toLocaleString() : '0'}
                      </div>
                      <span className="text-[10px] text-slate-500">{vehicleTelemetry?.fuel_logs_count || 0} refuel entries</span>
                    </div>

                    <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">Maintenance Spend</span>
                      <div className="text-xl font-black text-amber-400 mt-1">
                        KES {vehicleTelemetry?.total_maintenance_spend ? Number(vehicleTelemetry.total_maintenance_spend).toLocaleString() : '0'}
                      </div>
                      <span className="text-[10px] text-slate-500">{vehicleTelemetry?.maintenance_records_count || 0} service jobs</span>
                    </div>

                    <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold">Operating Cost / km</span>
                      <div className="text-xl font-black text-purple-400 mt-1">
                        KES {vehicleTelemetry?.operating_cost_per_km || '0.00'}
                      </div>
                      <span className="text-[10px] text-slate-500">Total cost per km traveled</span>
                    </div>
                  </div>

                  {/* Technical Specifications */}
                  <div className="bg-slate-950/50 rounded-2xl p-5 border border-slate-800">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>Technical Registry Specifications</span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block">Registration Plate</span>
                        <span className="font-bold text-white font-mono">{selectedVehicle.registration_number}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Vehicle Type</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.vehicle_type}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Make & Model</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.make} {selectedVehicle.model}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Chassis / VIN</span>
                        <span className="font-mono text-slate-300">{selectedVehicle.chassis_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Engine Number</span>
                        <span className="font-mono text-slate-300">{selectedVehicle.engine_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Color</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.color || 'White'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Payload Capacity</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.capacity_kg ? `${selectedVehicle.capacity_kg} kg` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Cargo Volume</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.cargo_volume_cbm ? `${selectedVehicle.cargo_volume_cbm} m³` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Fuel Tank Capacity</span>
                        <span className="font-semibold text-slate-200">{selectedVehicle.fuel_tank_capacity_liters ? `${selectedVehicle.fuel_tank_capacity_liters} Liters` : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Service Target Countdown Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 to-slate-950/70 border border-blue-900/40 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider block">Preventive Service Target</span>
                      <div className="text-lg font-bold text-white mt-0.5">
                        Next Target: {selectedVehicle.next_service_odometer_km ? `${Number(selectedVehicle.next_service_odometer_km).toLocaleString()} km` : 'Unset'}
                      </div>
                      <p className="text-xs text-slate-400">
                        {vehicleTelemetry?.km_until_service !== undefined ? (
                          vehicleTelemetry.km_until_service <= 0
                            ? 'Overdue for scheduled maintenance'
                            : `${vehicleTelemetry.km_until_service.toLocaleString()} km remaining before scheduled service`
                        ) : 'Pending schedule calculation'}
                      </p>
                    </div>

                    <button
                      onClick={() => openMaintenanceModal(selectedVehicle)}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Schedule Service</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: FUEL LOGS & EFFICIENCY */}
              {detailTab === 'fuel' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Fuel Consumption & Refill History</h3>
                      <p className="text-xs text-slate-400">Voucher numbers, station vendors, and calculated km/L efficiency</p>
                    </div>
                    <button
                      onClick={() => openRefuelModal(selectedVehicle)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Refuel</span>
                    </button>
                  </div>

                  {fuelLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                      No fuel logs recorded yet for this vehicle.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-800">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Station</th>
                            <th className="p-3">Liters</th>
                            <th className="p-3">Price/L</th>
                            <th className="p-3">Total Cost</th>
                            <th className="p-3">Odometer</th>
                            <th className="p-3">Economy</th>
                            <th className="p-3">Voucher</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                          {fuelLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-800/40">
                              <td className="p-3 font-mono">{log.fuel_date}</td>
                              <td className="p-3 font-medium text-white">{log.gas_station_vendor || 'N/A'}</td>
                              <td className="p-3 font-mono">{log.quantity_liters} L</td>
                              <td className="p-3 font-mono">KES {log.cost_per_liter}</td>
                              <td className="p-3 font-bold text-emerald-400 font-mono">KES {Number(log.total_cost).toLocaleString()}</td>
                              <td className="p-3 font-mono">{Number(log.odometer_km).toLocaleString()} km</td>
                              <td className="p-3">
                                {log.calculated_consumption_kml ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                                    {log.calculated_consumption_kml} km/L
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10px]">
                                    {log.is_full_tank ? 'Base Full' : 'Partial'}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono uppercase">{log.voucher_number || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MAINTENANCE & REPAIRS */}
              {detailTab === 'maintenance' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Workshop & Preventative Maintenance Records</h3>
                      <p className="text-xs text-slate-400">Scheduled repairs, parts replaced, and labor expenses</p>
                    </div>
                    <button
                      onClick={() => openMaintenanceModal(selectedVehicle)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Service</span>
                    </button>
                  </div>

                  {maintenanceRecords.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                      No maintenance records recorded yet for this vehicle.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {maintenanceRecords.map((rec) => (
                        <div key={rec.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono font-bold">
                                {rec.service_number}
                              </span>
                              <span className="font-bold text-white text-sm">{rec.service_type?.replace(/_/g, ' ')}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rec.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400 animate-pulse'
                              }`}>
                                {rec.status}
                              </span>
                            </div>
                            <p className="text-slate-400 mt-1">
                              Garage: <strong className="text-slate-200">{rec.service_provider}</strong> • Date: {rec.service_date} • Odometer: {Number(rec.service_odometer_km).toLocaleString()} km
                            </p>
                            {rec.parts_replaced && (
                              <p className="text-slate-500 mt-0.5">
                                Parts: {rec.parts_replaced}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px]">Total Service Cost</span>
                            <span className="text-base font-black text-amber-400 font-mono">
                              KES {Number(rec.total_cost).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: MILEAGE & TRIPS */}
              {detailTab === 'mileage' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">Trip Logs & Mileage History</h3>
                      <p className="text-xs text-slate-400">Routes, dispatch runs, and odometer progression</p>
                    </div>
                    <button
                      onClick={() => openMileageModal(selectedVehicle)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Trip</span>
                    </button>
                  </div>

                  {mileageLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800">
                      No mileage logs recorded yet for this vehicle.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-800">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Start Odo</th>
                            <th className="p-3">End Odo</th>
                            <th className="p-3">Distance</th>
                            <th className="p-3">Route</th>
                            <th className="p-3">Driver</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                          {mileageLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-800/40">
                              <td className="p-3 font-mono">{log.log_date}</td>
                              <td className="p-3 font-semibold text-white">{log.trip_type?.replace(/_/g, ' ')}</td>
                              <td className="p-3 font-mono">{Number(log.start_odometer_km).toLocaleString()} km</td>
                              <td className="p-3 font-mono">{Number(log.end_odometer_km).toLocaleString()} km</td>
                              <td className="p-3 font-bold text-purple-400 font-mono">{log.distance_km} km</td>
                              <td className="p-3 text-slate-300">{log.origin || 'Depot'} → {log.destination || 'CBD'}</td>
                              <td className="p-3 text-slate-400">{log.driver_name || 'Assigned'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VehiclesView;
