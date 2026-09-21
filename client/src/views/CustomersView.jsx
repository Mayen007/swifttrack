// client/src/views/CustomersView.jsx
// SwiftTrack Kenya: Customer Directory & Relationship Management
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import { CustomerDetailModal } from '../components/customers/CustomerDetailModal.jsx';
import { CustomerFormModal } from '../components/customers/CustomerFormModal.jsx';
import {
  Users,
  Search,
  Plus,
  Filter,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Eye,
  Edit2,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  MoreVertical,
  ShieldCheck
} from 'lucide-react';

export function CustomersView() {
  const { user, selectedBranch } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE, SUSPENDED, BLOCKED
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Modals state
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState(null);

  const searchInputRef = useRef(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedBranch?.id) params.append('branch_id', selectedBranch.id);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', '100');

      const res = await api.get(`/api/customers?${params.toString()}`);
      setCustomers(res.customers || []);
      setTotalCount(res.total || 0);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (err) {
      sound.playError();
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [selectedBranch?.id, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenDetail = (cust) => {
    sound.playScan();
    setSelectedCustomerId(cust.id);
    setDetailModalOpen(true);
  };

  const handleOpenCreate = () => {
    sound.playScan();
    setCustomerToEdit(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (cust) => {
    sound.playScan();
    setCustomerToEdit(cust);
    setFormModalOpen(true);
  };

  // Metrics computation from loaded list
  const metrics = React.useMemo(() => {
    const total = totalCount;
    const active = customers.filter((c) => c.status === 'ACTIVE').length;
    const flagged = customers.filter((c) => c.status === 'BLOCKED' || c.status === 'SUSPENDED').length;
    const totalSpend = customers.reduce((sum, c) => sum + Number(c.total_spent || 0), 0);
    return { total, active, flagged, totalSpend };
  }, [customers, totalCount]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'SUSPENDED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'BLOCKED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'INACTIVE':
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Customer Directory & CRM
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-medium">
                  Phase 4.1
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Multi-branch customer registry, delivery locations, notes ledger, and order history
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              sound.playScan();
              fetchCustomers();
            }}
            disabled={loading}
            className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Register Customer
          </button>
        </div>
      </div>

      {/* KPI Top Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Registered</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-white">{metrics.total}</p>
          <span className="text-[11px] text-gray-400 mt-1 block">Nationwide client base</span>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Commercial</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{metrics.active}</p>
          <span className="text-[11px] text-emerald-400/80 mt-1 block">Normal checkout authorized</span>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Suspended / Blocked</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400">{metrics.flagged}</p>
          <span className="text-[11px] text-rose-400/80 mt-1 block">Sales prohibited</span>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Customer Spend</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-black text-amber-400 font-mono">
            KES {metrics.totalSpend.toLocaleString()}
          </p>
          <span className="text-[11px] text-gray-400 mt-1 block">Recorded sales & fulfillment</span>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by customer name, phone (+254...), email, or customer number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  sound.playScan();
                  setStatusFilter(st);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-950 text-gray-400 hover:text-gray-200 border border-gray-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {lastSyncTime && (
          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-800/60">
            <span>Showing {customers.length} of {totalCount} profiles</span>
            <span>Last synced at {lastSyncTime}</span>
          </div>
        )}
      </div>

      {/* Customer Registry Table */}
      <div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-400">Loading Customer Registry...</p>
          </div>
        ) : customers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900 text-gray-400 font-semibold border-b border-gray-800">
                <tr>
                  <th className="p-4">Customer Entity</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Delivery Locations</th>
                  <th className="p-4">Hub Branch</th>
                  <th className="p-4">Total Orders</th>
                  <th className="p-4">Total Spend</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {customers.map((cust) => (
                  <tr
                    key={cust.id}
                    onClick={() => handleOpenDetail(cust)}
                    className="hover:bg-gray-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold shrink-0">
                          {cust.full_name ? cust.full_name.slice(0, 2).toUpperCase() : 'CU'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors block">
                            {cust.full_name}
                          </span>
                          <span className="font-mono text-[11px] text-gray-400">{cust.customer_number}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="space-y-0.5">
                        <span className="font-mono font-medium text-slate-200 block">{cust.phone}</span>
                        <span className="text-[11px] text-gray-400 block">{cust.email || '—'}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="space-y-0.5 max-w-xs">
                        <span className="text-slate-200 font-medium block truncate">
                          {cust.default_address || cust.address || '—'}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                          <span>{cust.default_city || cust.city || 'Nairobi'}</span>
                          {cust.address_count > 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-gray-800 text-blue-400 font-mono text-[10px] font-bold">
                              +{cust.address_count - 1} more
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-gray-300 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-500" />
                        {cust.branch_name}
                      </span>
                    </td>

                    <td className="p-4 text-slate-200 font-semibold font-mono">
                      {cust.order_count}
                    </td>

                    <td className="p-4 font-mono font-bold text-amber-400">
                      KES {Number(cust.total_spent || 0).toLocaleString()}
                    </td>

                    <td className="p-4">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadge(cust.status)}`}>
                        {cust.status}
                      </span>
                    </td>

                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(cust)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-800 transition-colors"
                          title="View 360° Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(cust)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-gray-800 transition-colors"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-gray-800/80 flex items-center justify-center text-gray-500 mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No Customers Found</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              {searchQuery
                ? `No customers match search "${searchQuery}". Try a different keyword.`
                : 'No customer profiles have been added for this branch yet.'}
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Register First Customer
            </button>
          </div>
        )}
      </div>

      {/* Customer 360° Deep Dive Modal / Drawer */}
      <CustomerDetailModal
        customerId={selectedCustomerId}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedCustomerId(null);
        }}
        onCustomerUpdated={fetchCustomers}
        onOpenEdit={(cust) => {
          setCustomerToEdit(cust);
          setFormModalOpen(true);
        }}
      />

      {/* Customer Create / Edit Form Modal */}
      <CustomerFormModal
        isOpen={formModalOpen}
        customerToEdit={customerToEdit}
        onClose={() => {
          setFormModalOpen(false);
          setCustomerToEdit(null);
        }}
        onSaved={fetchCustomers}
      />
    </div>
  );
}
