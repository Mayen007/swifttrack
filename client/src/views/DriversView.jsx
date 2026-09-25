// client/src/views/DriversView.jsx
// SwiftTrack Kenya: Phase 9 Logistics & Fleet Management — Driver Management Engine (9.1)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  Truck,
  User,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Award,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Star,
  Activity,
  History,
  Car,
  X
} from 'lucide-react';

export const DRIVER_STATUS_OPTIONS = [
  { key: 'AVAILABLE', label: 'Available', color: 'emerald' },
  { key: 'ON_DELIVERY', label: 'On Delivery', color: 'blue' },
  { key: 'OFF_DUTY', label: 'Off Duty', color: 'slate' },
  { key: 'ON_LEAVE', label: 'On Leave', color: 'amber' },
  { key: 'SUSPENDED', label: 'Suspended', color: 'rose' }
];

export const COMPLIANCE_STATUS_OPTIONS = [
  { key: 'VALID', label: 'Valid', color: 'emerald' },
  { key: 'EXPIRING_SOON', label: 'Expiring Soon', color: 'amber' },
  { key: 'EXPIRED', label: 'Expired', color: 'rose' },
  { key: 'UNVERIFIED', label: 'Unverified', color: 'purple' }
];

export function DriversView() {
  const { user, selectedBranch } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [branches, setBranches] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [complianceFilter, setComplianceFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(selectedBranch?.id || '');

  // Modals & Drawers
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);

  // Selected driver for modals
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverScorecard, setDriverScorecard] = useState(null);
  const [driverDeliveries, setDriverDeliveries] = useState([]);
  const [driverIncidents, setDriverIncidents] = useState([]);
  const [driverHistory, setDriverHistory] = useState([]);
  const [detailTab, setDetailTab] = useState('overview'); // overview, scorecard, deliveries, incidents
  const [actionLoading, setActionLoading] = useState(false);

  // Create Driver Form State
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
    blood_group: 'O+',
    residential_address: '',
    city: 'Nairobi',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: 'Spouse',
    vehicle_id: '',
    notes: '',
    username: '',
    password: ''
  });

  // Action Form States
  const [newStatus, setNewStatus] = useState('AVAILABLE');
  const [statusReason, setStatusReason] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [incidentForm, setIncidentForm] = useState({
    incident_type: 'TRAFFIC_VIOLATION',
    severity: 'LOW',
    incident_date: new Date().toISOString().slice(0, 16),
    description: '',
    action_taken: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (branchFilter) queryParams.append('branchId', branchFilter);
      if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
      if (complianceFilter !== 'ALL') queryParams.append('complianceStatus', complianceFilter);
      if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());

      const [driversRes, telemetryRes] = await Promise.all([
        api.get(`/api/v1/drivers?${queryParams.toString()}`),
        api.get(`/api/v1/drivers/telemetry/summary${branchFilter ? `?branchId=${branchFilter}` : ''}`)
      ]);

      setDrivers(driversRes.drivers || []);
      setTelemetry(telemetryRes);
    } catch (err) {
      console.error('Failed to load drivers:', err);
      api.errorToast(err.message || 'Failed to load driver roster');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxiliary = async () => {
    try {
      const [branchRes, dispatchRes] = await Promise.all([
        api.get('/api/v1/branches').catch(() => []),
        api.get('/api/v1/dispatch/board').catch(() => ({ available_vehicles: [] }))
      ]);
      setBranches(branchRes || []);
      setVehicles(dispatchRes.available_vehicles || []);
    } catch (e) {
      console.warn('Aux fetch notice:', e.message);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAuxiliary();
  }, [branchFilter, statusFilter, complianceFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const openDriverDetail = async (driver) => {
    setSelectedDriver(driver);
    setDetailTab('overview');
    setDetailModalOpen(true);

    try {
      const [scorecardRes, deliveriesRes, incidentsRes, historyRes] = await Promise.all([
        api.get(`/api/v1/drivers/${driver.id}/performance`),
        api.get(`/api/v1/drivers/${driver.id}/deliveries?limit=20`),
        api.get(`/api/v1/drivers/${driver.id}/incidents`),
        api.get(`/api/v1/drivers/${driver.id}/status-history`)
      ]);
      setDriverScorecard(scorecardRes);
      setDriverDeliveries(deliveriesRes.deliveries || []);
      setDriverIncidents(incidentsRes || []);
      setDriverHistory(historyRes || []);
    } catch (err) {
      console.error('Failed to fetch driver scorecard details:', err);
    }
  };

  const handleCreateDriver = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        ...createForm,
        branch_id: Number(createForm.branch_id),
        vehicle_id: createForm.vehicle_id ? Number(createForm.vehicle_id) : null
      };
      await api.post('/api/v1/drivers', payload);
      sound.playSuccess();
      api.successToast('Driver profile created and credentials provisioned');
      setCreateModalOpen(false);
      fetchData();
    } catch (err) {
      sound.playError();
      api.errorToast(err.message || 'Failed to onboard driver');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedDriver) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/v1/drivers/${selectedDriver.id}/status`, {
        status: newStatus,
        reason: statusReason
      });
      sound.playSuccess();
      api.successToast(`Driver status transitioned to ${newStatus}`);
      setStatusModalOpen(false);
      setStatusReason('');
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
      {/* 1. Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fleet Drivers Management</h1>
              <p className="text-sm text-slate-500">
                Driver profiles, NTSA licenses, compliance warnings, live duty status, and performance scorecards
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
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

      {/* 2. Executive Telemetry KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Active on Road */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active on Road</span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{telemetry?.on_delivery_drivers ?? 0}</div>
          <p className="text-xs text-slate-500 mt-0.5">En route with parcels</p>
        </div>

        {/* Available in Yard */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available Yard</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{telemetry?.available_drivers ?? 0}</div>
          <p className="text-xs text-slate-500 mt-0.5">Ready for dispatch</p>
        </div>

        {/* Off Duty / Leave */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Off-Duty / Leave</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{telemetry?.off_duty_drivers ?? 0}</div>
          <p className="text-xs text-slate-500 mt-0.5">Rest or annual leave</p>
        </div>

        {/* Expiry Warnings */}
        <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Expiry Alert</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-amber-900">{telemetry?.expiring_licenses_count ?? 0}</div>
          <p className="text-xs text-amber-700 mt-0.5">License expires &lt;30d</p>
        </div>

        {/* Fleet On-Time Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">On-Time Rate</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{telemetry?.fleet_on_time_rate_pct ?? 0}%</div>
          <p className="text-xs text-slate-500 mt-0.5">Fleet delivery target</p>
        </div>

        {/* Avg Rating */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-amber-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fleet Rating</span>
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{telemetry?.fleet_avg_rating ?? '5.0'} / 5</div>
          <p className="text-xs text-slate-500 mt-0.5">Customer satisfaction</p>
        </div>
      </div>

      {/* 3. Filters & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, code, phone, license..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Branch Filter */}
          {user?.roleName === 'SUPER_ADMIN' && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            {DRIVER_STATUS_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>

          {/* Compliance Filter */}
          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="ALL">All Compliance</option>
            {COMPLIANCE_STATUS_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Drivers Table / Roster */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Driver Profile</th>
                <th className="py-3 px-4">Contact & Depot</th>
                <th className="py-3 px-4">Assigned Vehicle</th>
                <th className="py-3 px-4">NTSA License & Expiry</th>
                <th className="py-3 px-4">Duty Status</th>
                <th className="py-3 px-4">Scorecard & Jobs</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading driver fleet roster...</span>
                  </td>
                </tr>
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">No drivers found matching criteria</p>
                    <p className="text-xs text-slate-400 mt-1">Adjust filters or onboard new drivers above</p>
                  </td>
                </tr>
              ) : (
                drivers.map(drv => {
                  const isExpiringSoon = drv.compliance?.status === 'EXPIRING_SOON';
                  const isExpired = drv.compliance?.status === 'EXPIRED';

                  return (
                    <tr key={drv.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Driver Profile */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
                            {drv.avatar_url ? (
                              <img src={drv.avatar_url} alt={drv.full_name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              drv.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'DR'
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span>{drv.full_name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                {drv.employee_code || `DRV-${String(drv.id).padStart(4, '0')}`}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>ID: {drv.national_id || 'N/A'}</span>
                              <span>•</span>
                              <span>KRA: {drv.kra_pin || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Depot */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-900 font-medium text-xs flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{drv.phone}</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{drv.branch_name} ({drv.city || 'Nairobi'})</span>
                        </div>
                      </td>

                      {/* Assigned Vehicle */}
                      <td className="py-3.5 px-4">
                        {drv.vehicle_reg ? (
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-200">
                              <Truck className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <div className="font-semibold text-slate-900 text-xs font-mono">{drv.vehicle_reg}</div>
                              <div className="text-[11px] text-slate-500">{drv.vehicle_model || drv.vehicle_type || 'Fleet Vehicle'}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* NTSA License & Expiry */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800">
                          <span>{drv.license_number}</span>
                          <span className="text-[10px] font-normal text-slate-500 font-sans">({drv.license_classes || 'B, C1'})</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                            isExpired
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isExpiringSoon
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isExpired ? (
                              <XCircle className="w-3 h-3 text-rose-500" />
                            ) : isExpiringSoon ? (
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                            ) : (
                              <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            )}
                            <span>{drv.compliance?.message || 'Valid'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Operational Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          drv.status === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : drv.status === 'ON_DELIVERY'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : drv.status === 'SUSPENDED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            drv.status === 'AVAILABLE' ? 'bg-emerald-600 animate-pulse' :
                            drv.status === 'ON_DELIVERY' ? 'bg-blue-600 animate-pulse' :
                            drv.status === 'SUSPENDED' ? 'bg-rose-600' : 'bg-slate-400'
                          }`} />
                          <span>{drv.status.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Scorecard & Active Jobs */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{drv.rating ? drv.rating.toFixed(1) : '5.0'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span>{drv.completed_deliveries_count || 0} completed</span>
                          {drv.active_deliveries_count > 0 && (
                            <span className="ml-1 text-blue-600 font-medium">({drv.active_deliveries_count} active)</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openDriverDetail(drv)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            title="View Scorecard & Deep Dive"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedDriver(drv);
                              setNewStatus(drv.status);
                              setStatusModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                            title="Update Duty Status"
                          >
                            <Activity className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedDriver(drv);
                              setSelectedVehicleId(drv.vehicle_id || '');
                              setVehicleModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-emerald-600 transition-colors"
                            title="Assign Vehicle"
                          >
                            <Truck className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedDriver(drv);
                              setIncidentModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Log Safety Incident"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL: Onboard New Driver */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Onboard Fleet Driver</h3>
                  <p className="text-xs text-slate-500">Government identity, NTSA driving license & depot assignment</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-5 gap-4">
              <button
                type="button"
                onClick={() => setCreateTab('basic')}
                className={`py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  createTab === 'basic' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                1. Profile & Contacts
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('id_license')}
                className={`py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  createTab === 'id_license' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                2. Government ID & NTSA License
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('depot_vehicle')}
                className={`py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  createTab === 'depot_vehicle' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                3. Depot & Vehicle Assignment
              </button>
            </div>

            <form onSubmit={handleCreateDriver} className="p-6 overflow-y-auto flex-1 space-y-4">
              {createTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mwangi Kamau"
                        value={createForm.full_name}
                        onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Phone *</label>
                      <input
                        type="text"
                        required
                        placeholder="+254 712 345 678"
                        value={createForm.phone}
                        onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="driver@swifttrack.co.ke"
                        value={createForm.email}
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Alternate Phone</label>
                      <input
                        type="text"
                        placeholder="+254 733 999 888"
                        value={createForm.alt_phone}
                        onChange={(e) => setCreateForm({ ...createForm, alt_phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Type</label>
                      <select
                        value={createForm.employment_type}
                        onChange={(e) => setCreateForm({ ...createForm, employment_type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      >
                        <option value="FULL_TIME">Full Time</option>
                        <option value="CONTRACTOR">Contractor</option>
                        <option value="CASUAL">Casual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group</label>
                      <select
                        value={createForm.blood_group}
                        onChange={(e) => setCreateForm({ ...createForm, blood_group: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      >
                        <option value="O+">O+</option>
                        <option value="A+">A+</option>
                        <option value="B+">B+</option>
                        <option value="AB+">AB+</option>
                        <option value="O-">O-</option>
                        <option value="A-">A-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={createForm.city}
                        onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Emergency Contact</span>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <input
                          type="text"
                          placeholder="Contact Name"
                          value={createForm.emergency_contact_name}
                          onChange={(e) => setCreateForm({ ...createForm, emergency_contact_name: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Phone Number"
                          value={createForm.emergency_contact_phone}
                          onChange={(e) => setCreateForm({ ...createForm, emergency_contact_phone: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Relationship (e.g. Spouse)"
                          value={createForm.emergency_contact_relation}
                          onChange={(e) => setCreateForm({ ...createForm, emergency_contact_relation: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {createTab === 'id_license' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">National ID Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ID-28938102"
                        value={createForm.national_id}
                        onChange={(e) => setCreateForm({ ...createForm, national_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">KRA PIN Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. A00198234K"
                        value={createForm.kra_pin}
                        onChange={(e) => setCreateForm({ ...createForm, kra_pin: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NSSF Number</label>
                      <input
                        type="text"
                        placeholder="NSSF-XXXXX"
                        value={createForm.nssf_number}
                        onChange={(e) => setCreateForm({ ...createForm, nssf_number: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">NHIF / SHA Number</label>
                      <input
                        type="text"
                        placeholder="NHIF-XXXXX"
                        value={createForm.nhif_number}
                        onChange={(e) => setCreateForm({ ...createForm, nhif_number: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50/40 border border-blue-200/80 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      NTSA Driving License Governance
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">License Number *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. DL-NRB-88219"
                          value={createForm.license_number}
                          onChange={(e) => setCreateForm({ ...createForm, license_number: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Authorized License Classes *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. A2, B, C1, CE"
                          value={createForm.license_classes}
                          onChange={(e) => setCreateForm({ ...createForm, license_classes: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">License Issue Date</label>
                        <input
                          type="date"
                          value={createForm.license_issue_date}
                          onChange={(e) => setCreateForm({ ...createForm, license_issue_date: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">License Expiry Date *</label>
                        <input
                          type="date"
                          required
                          value={createForm.license_expiry_date}
                          onChange={(e) => setCreateForm({ ...createForm, license_expiry_date: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {createTab === 'depot_vehicle' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Branch Depot *</label>
                      <select
                        required
                        value={createForm.branch_id}
                        onChange={(e) => setCreateForm({ ...createForm, branch_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      >
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Vehicle Pairing</label>
                      <select
                        value={createForm.vehicle_id}
                        onChange={(e) => setCreateForm({ ...createForm, vehicle_id: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      >
                        <option value="">No Vehicle (Assign Later)</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.registration_number} — {v.model || v.vehicle_type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Driver Mobile Portal Account</span>
                    <p className="text-xs text-slate-500">
                      A staff account with DRIVER role is automatically created with temporary password <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">Driver@SwiftTrack2026!</code> allowing immediate login to the Courier Driver Portal.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Notes</label>
                    <textarea
                      rows="3"
                      placeholder="Special endorsements, routes, experience, certifications..."
                      value={createForm.notes}
                      onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {createTab !== 'basic' && (
                    <button
                      type="button"
                      onClick={() => setCreateTab(createTab === 'depot_vehicle' ? 'id_license' : 'basic')}
                      className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 font-medium"
                    >
                      Back
                    </button>
                  )}

                  {createTab !== 'depot_vehicle' ? (
                    <button
                      type="button"
                      onClick={() => setCreateTab(createTab === 'basic' ? 'id_license' : 'depot_vehicle')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-semibold"
                    >
                      Next Step
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-semibold shadow-xs flex items-center gap-2"
                    >
                      {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>Save & Provision Driver</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: Driver Scorecard & Profile Drawer */}
      {/* ========================================================================= */}
      {detailModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 text-white flex items-center justify-center font-bold text-xl shadow-inner">
                  {selectedDriver.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'DR'}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold tracking-tight">{selectedDriver.full_name}</h2>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {selectedDriver.employee_code}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedDriver.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      selectedDriver.status === 'ON_DELIVERY' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {selectedDriver.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                    <span>Depot: {selectedDriver.branch_name}</span>
                    <span>•</span>
                    <span>License: {selectedDriver.license_number}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{selectedDriver.rating ? selectedDriver.rating.toFixed(1) : '5.0'} / 5.0</span>
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-6">
              <button
                type="button"
                onClick={() => setDetailTab('overview')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Overview & Compliance</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('scorecard')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'scorecard' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>Performance Scorecard</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('deliveries')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'deliveries' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Delivery Runs ({driverDeliveries.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('incidents')}
                className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'incidents' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Status & Incidents ({driverIncidents.length})</span>
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: Overview & Compliance */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  {/* Compliance Banner */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    selectedDriver.compliance?.status === 'VALID'
                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                      : selectedDriver.compliance?.status === 'EXPIRING_SOON'
                      ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                      : 'bg-rose-50/50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-6 h-6" />
                      <div>
                        <div className="font-bold text-sm">
                          License Compliance: {selectedDriver.compliance?.status?.replace('_', ' ')}
                        </div>
                        <div className="text-xs opacity-90">{selectedDriver.compliance?.message}</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-sm">
                      {selectedDriver.compliance?.days_left > 0 ? `${selectedDriver.compliance?.days_left} days left` : 'Expired'}
                    </span>
                  </div>

                  {/* 2 Column Details */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Government Identity</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500">National ID:</span>
                        <span className="font-semibold text-slate-900 font-mono">{selectedDriver.national_id || 'Not recorded'}</span>
                        <span className="text-slate-500">KRA PIN:</span>
                        <span className="font-semibold text-slate-900 font-mono">{selectedDriver.kra_pin || 'Not recorded'}</span>
                        <span className="text-slate-500">NSSF Number:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.nssf_number || 'Not recorded'}</span>
                        <span className="text-slate-500">NHIF / SHA:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.nhif_number || 'Not recorded'}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">NTSA License Record</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500">License Number:</span>
                        <span className="font-semibold text-slate-900 font-mono">{selectedDriver.license_number}</span>
                        <span className="text-slate-500">Allowed Classes:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.license_classes || 'B, C1'}</span>
                        <span className="text-slate-500">Issue Date:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.license_issue_date || 'N/A'}</span>
                        <span className="text-slate-500">Expiry Date:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.license_expiry_date || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Emergency */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact & Residential</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500">Primary Phone:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.phone}</span>
                        <span className="text-slate-500">Alt Phone:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.alt_phone || 'None'}</span>
                        <span className="text-slate-500">Email:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.email || 'None'}</span>
                        <span className="text-slate-500">Address:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.residential_address || 'Nairobi'}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Emergency Contact</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500">Contact Name:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.emergency_contact_name || 'Not recorded'}</span>
                        <span className="text-slate-500">Emergency Phone:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.emergency_contact_phone || 'Not recorded'}</span>
                        <span className="text-slate-500">Relationship:</span>
                        <span className="font-semibold text-slate-900">{selectedDriver.emergency_contact_relation || 'Next of Kin'}</span>
                        <span className="text-slate-500">Blood Group:</span>
                        <span className="font-semibold text-slate-900 font-mono">{selectedDriver.blood_group || 'O+'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Performance Scorecard */}
              {detailTab === 'scorecard' && (
                <div className="space-y-6">
                  {driverScorecard ? (
                    <>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl text-center">
                          <div className="text-2xl font-bold text-blue-900">{driverScorecard.metrics.success_rate_pct}%</div>
                          <div className="text-xs text-blue-700 font-medium mt-1">Delivery Success Rate</div>
                        </div>

                        <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-center">
                          <div className="text-2xl font-bold text-emerald-900">{driverScorecard.metrics.on_time_rate_pct}%</div>
                          <div className="text-xs text-emerald-700 font-medium mt-1">On-Time Arrival Rate</div>
                        </div>

                        <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl text-center">
                          <div className="text-2xl font-bold text-purple-900">{driverScorecard.metrics.avg_turnaround_minutes}m</div>
                          <div className="text-xs text-purple-700 font-medium mt-1">Avg Turnaround Time</div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <div className="text-2xl font-bold text-slate-900">{driverScorecard.metrics.incident_count}</div>
                          <div className="text-xs text-slate-600 font-medium mt-1">Safety Incidents</div>
                        </div>
                      </div>

                      {/* Drop volumes */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Historical Job Tally</h4>
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-lg font-bold text-slate-900">{driverScorecard.metrics.total_assigned}</div>
                            <div className="text-xs text-slate-500">Total Assigned</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-emerald-600">{driverScorecard.metrics.total_completed}</div>
                            <div className="text-xs text-slate-500">Delivered</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-rose-600">{driverScorecard.metrics.total_failed}</div>
                            <div className="text-xs text-slate-500">Failed / Returned</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-blue-600">{driverScorecard.metrics.total_active}</div>
                            <div className="text-xs text-slate-500">Active Transit</div>
                          </div>
                        </div>
                      </div>

                      {/* Priority breakdown */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Priority Distribution</h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-xs font-semibold text-rose-600">Urgent Runs</span>
                            <div className="text-lg font-bold text-slate-900">{driverScorecard.priority_breakdown?.urgent || 0}</div>
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-xs font-semibold text-amber-600">High Priority</span>
                            <div className="text-lg font-bold text-slate-900">{driverScorecard.priority_breakdown?.high || 0}</div>
                          </div>
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <span className="text-xs font-semibold text-slate-600">Standard Normal</span>
                            <div className="text-lg font-bold text-slate-900">{driverScorecard.priority_breakdown?.normal || 0}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 text-slate-400">Loading scorecard telemetry...</div>
                  )}
                </div>
              )}

              {/* TAB 3: Delivery History */}
              {detailTab === 'deliveries' && (
                <div className="space-y-4">
                  {driverDeliveries.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p>No delivery runs logged for this driver yet.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 font-semibold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="py-2.5 px-3">Delivery #</th>
                            <th className="py-2.5 px-3">Customer & Address</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Turnaround</th>
                            <th className="py-2.5 px-3">POD Verification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {driverDeliveries.map(del => (
                            <tr key={del.delivery_id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                                {del.delivery_number}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-800">{del.customer_name}</div>
                                <div className="text-[11px] text-slate-400">{del.delivery_address}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  del.delivery_status === 'DELIVERED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {del.delivery_status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div>{del.turnaround_minutes ? `${del.turnaround_minutes} mins` : 'In transit'}</div>
                                {del.is_on_time !== null && (
                                  <span className={`text-[10px] font-semibold ${del.is_on_time ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {del.is_on_time ? '✓ On Time' : '⚠ Delayed'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="text-[11px] font-medium text-slate-800">{del.recipient_name || 'Direct'}</div>
                                <div className="text-[10px] text-slate-400">
                                  {del.has_signature ? 'Signature verified' : 'No signature'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Status & Incidents */}
              {detailTab === 'incidents' && (
                <div className="space-y-6">
                  {/* Incidents Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Safety & Incident Logs</h4>
                      <button
                        onClick={() => setIncidentModalOpen(true)}
                        className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded border border-rose-200 flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Log New Incident</span>
                      </button>
                    </div>

                    {driverIncidents.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs">
                        Clean safety record. No incidents logged.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 border-b border-slate-200 font-semibold uppercase text-slate-500">
                            <tr>
                              <th className="py-2.5 px-3">Type & Severity</th>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Description</th>
                              <th className="py-2.5 px-3">Action Taken</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {driverIncidents.map(inc => (
                              <tr key={inc.id}>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-800">{inc.incident_type}</div>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    inc.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                                    inc.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                    inc.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                                    'bg-slate-100 text-slate-700'
                                  }`}>
                                    {inc.severity}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  {new Date(inc.incident_date).toLocaleDateString()}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700">{inc.description}</td>
                                <td className="py-2.5 px-3 text-slate-500">{inc.action_taken || 'None'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Status Timeline */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Status Transition Timeline</h4>
                    <div className="space-y-2">
                      {driverHistory.map((hist, i) => (
                        <div key={hist.id || i} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-800">{hist.from_status || 'INITIAL'} &rarr; {hist.to_status}</span>
                            {hist.reason && <p className="text-[11px] text-slate-500 mt-0.5">{hist.reason}</p>}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(hist.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: Update Status */}
      {/* ========================================================================= */}
      {statusModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Update Driver Status</h3>
              <button onClick={() => setStatusModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateStatus} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {DRIVER_STATUS_OPTIONS.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. End of shift, leave authorization, vehicle breakdown..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  {actionLoading ? 'Saving...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: Assign Vehicle */}
      {/* ========================================================================= */}
      {vehicleModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Assign Fleet Vehicle</h3>
              <button onClick={() => setVehicleModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAssignVehicle} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fleet Vehicle</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="">-- Unassigned (No Vehicle) --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.registration_number} — {v.model || v.vehicle_type}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVehicleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  {actionLoading ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL: Log Safety Incident */}
      {/* ========================================================================= */}
      {incidentModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span>Log Safety / Traffic Incident</span>
              </div>
              <button onClick={() => setIncidentModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleLogIncident} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Incident Type *</label>
                  <select
                    value={incidentForm.incident_type}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incident_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    <option value="TRAFFIC_VIOLATION">Traffic Violation</option>
                    <option value="ACCIDENT">Accident</option>
                    <option value="CUSTOMER_COMPLAINT">Customer Complaint</option>
                    <option value="VEHICLE_BREAKDOWN">Vehicle Breakdown</option>
                    <option value="DELAY">Unscheduled Delay</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Severity Rating *</label>
                  <select
                    value={incidentForm.severity}
                    onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Incident Description *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Detail the circumstances, location, and nature of the incident..."
                  value={incidentForm.description}
                  onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Corrective Action Taken</label>
                <input
                  type="text"
                  placeholder="e.g. Warning letter, speed governor check, retraining..."
                  value={incidentForm.action_taken}
                  onChange={(e) => setIncidentForm({ ...incidentForm, action_taken: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIncidentModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700"
                >
                  {actionLoading ? 'Logging...' : 'Save Incident Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriversView;
