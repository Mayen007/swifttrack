// client/src/components/inventory/InventorySerialsModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Hash, Plus, CheckCircle, Search, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api.js';

export function InventorySerialsModal({ isOpen, onClose, item, onSerialsUpdated }) {
  const [serials, setSerials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showAddForm, setShowAddForm] = useState(false);

  const [bulkSerialsText, setBulkSerialsText] = useState('');
  const [unitCost, setUnitCost] = useState('');

  useEffect(() => {
    if (isOpen && item) {
      loadSerials();
    }
  }, [isOpen, item]);

  async function loadSerials() {
    try {
      setLoading(true);
      const data = await api.get(`/api/v1/inventory/serials?product_id=${item.product_id}&warehouse_id=${item.warehouse_id}`);
      setSerials(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load serials:', err);
      api.toast('Error loading serials: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSerials(e) {
    e.preventDefault();
    const rawList = bulkSerialsText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (rawList.length === 0) {
      api.toast('Please provide at least one serial number', 'warning');
      return;
    }

    try {
      await api.post('/api/v1/inventory/serials', {
        product_id: item.product_id,
        warehouse_id: item.warehouse_id,
        branch_id: item.branch_id,
        serial_numbers: rawList,
        unit_cost: Number(unitCost) || item.cost_price || 0
      });
      api.toast(`Registered ${rawList.length} serial numbers successfully`, 'success');
      setShowAddForm(false);
      setBulkSerialsText('');
      setUnitCost('');
      loadSerials();
      if (onSerialsUpdated) onSerialsUpdated();
    } catch (err) {
      api.toast('Failed to register serials: ' + err.message, 'error');
    }
  }

  if (!isOpen || !item) return null;

  const filteredSerials = serials.filter(s => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (searchFilter && !s.serial_number.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#222834] rounded-lg w-full max-w-3xl shadow-2xl font-mono text-xs overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222834] bg-[#0e121a]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                SERIAL NUMBER TRACKING
              </span>
              <h2 className="text-sm font-bold text-white uppercase">{item.product_name}</h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              SKU: <span className="text-emerald-400 font-semibold">{item.sku}</span> | Hub:{' '}
              <span className="text-slate-200">{item.warehouse_name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1f2636] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Filters */}
        <div className="px-5 py-3 border-b border-[#222834] bg-[#151923] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search serial #..."
                className="w-full bg-[#12161f] border border-[#2e3748] rounded pl-8 pr-2.5 py-1 text-xs text-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#12161f] border border-[#2e3748] rounded px-2.5 py-1 text-xs text-slate-300"
            >
              <option value="ALL">ALL STATUS</option>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="RESERVED">RESERVED</option>
              <option value="SOLD">SOLD</option>
              <option value="DEFECTIVE">DEFECTIVE</option>
            </select>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {showAddForm ? 'Cancel' : 'Register Serials'}
          </button>
        </div>

        {/* Registration Inline Form */}
        {showAddForm && (
          <form onSubmit={handleRegisterSerials} className="p-4 bg-[#181d28] border-b border-[#222834] space-y-3">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                Serial Numbers (comma or newline separated) *
              </label>
              <textarea
                required
                rows={3}
                value={bulkSerialsText}
                onChange={e => setBulkSerialsText(e.target.value)}
                placeholder="e.g.&#10;SN-88219-A&#10;SN-88219-B&#10;SN-88219-C"
                className="w-full bg-[#12161f] border border-[#2e3748] rounded p-2 text-xs text-white font-mono"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Unit Cost (KES):</label>
                <input
                  type="number"
                  step="0.01"
                  value={unitCost}
                  onChange={e => setUnitCost(e.target.value)}
                  placeholder={String(item.cost_price || '0.00')}
                  className="w-32 bg-[#12161f] border border-[#2e3748] rounded px-2.5 py-1 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Register Units
              </button>
            </div>
          </form>
        )}

        {/* Serials List Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading serial records...</div>
          ) : filteredSerials.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No serial numbers matching filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#222834] text-slate-400 text-[10px] uppercase">
                  <th className="pb-2">Serial Number</th>
                  <th className="pb-2">Batch Linked</th>
                  <th className="pb-2 text-right">Unit Cost</th>
                  <th className="pb-2 text-center">Status</th>
                  <th className="pb-2 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2430]">
                {filteredSerials.map(s => (
                  <tr key={s.id} className="hover:bg-[#181d28]/60">
                    <td className="py-2.5 font-bold text-white tracking-wider">{s.serial_number}</td>
                    <td className="py-2.5 text-slate-400">{s.batch_number || '—'}</td>
                    <td className="py-2.5 text-right text-slate-300">KES {(s.unit_cost || 0).toFixed(2)}</td>
                    <td className="py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        s.status === 'AVAILABLE'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : s.status === 'RESERVED'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : s.status === 'SOLD'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-slate-500 text-[10px]">
                      {new Date(s.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
