// client/src/components/products/PromotionsModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Percent, Plus, Calendar, Tag, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function PromotionsModal({ isOpen, onClose }) {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    promo_code: '',
    discount_type: 'PERCENTAGE',
    discount_value: '10',
    min_spend: '0',
    category: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });
  const [error, setError] = useState('');

  const fetchPromos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/promotions');
      setPromos(Array.isArray(res) ? res : res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPromos();
      setCreating(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      sound.playScan();
      await api.post('/api/v1/promotions', {
        ...formData,
        promo_code: formData.promo_code.trim() ? formData.promo_code.toUpperCase().trim() : null,
        discount_value: parseFloat(formData.discount_value),
        min_spend: parseFloat(formData.min_spend) || 0,
        category: formData.category.trim() || null,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
      });
      sound.playSuccess();
      api.toast('Promotion campaign created', 'success');
      setCreating(false);
      await fetchPromos();
    } catch (err) {
      setError(err.message || 'Failed to create promotion');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#2b3548] rounded w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#151a24]">
          <div>
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Scheduled Discounts</span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mt-0.5">
              <Percent className="w-4 h-4 text-purple-400" />
              Campaigns & Promotional Rules
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-bold uppercase">Active Promotion Roster ({promos.length})</span>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                NEW CAMPAIGN
              </button>
            )}
          </div>

          {/* Creation Form */}
          {creating && (
            <form onSubmit={handleCreate} className="bg-[#161b26] p-3 rounded border border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between border-b border-[#222834] pb-1.5">
                <span className="text-xs text-purple-300 font-bold uppercase">Launch Campaign</span>
                <button type="button" onClick={() => setCreating(false)} className="text-slate-400 hover:text-white text-xs">Cancel</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                <div className="col-span-2">
                  <label className="block text-[10px] text-slate-400 mb-1">Campaign Name *</label>
                  <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-white focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Voucher Code (Optional)</label>
                  <input type="text" placeholder="e.g. LOGISTICS10" value={formData.promo_code} onChange={(e) => setFormData({ ...formData, promo_code: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-amber-300 focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Discount Type</label>
                  <select value={formData.discount_type} onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-white focus:outline-none focus:border-purple-500">
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed KES Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Value (% or KES)</label>
                  <input type="number" step="0.01" required value={formData.discount_value} onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-purple-300 font-bold focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Min Spend (KES)</label>
                  <input type="number" step="0.01" value={formData.min_spend} onChange={(e) => setFormData({ ...formData, min_spend: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-white focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Start Date</label>
                  <input type="date" required value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-white focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">End Date</label>
                  <input type="date" required value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-white focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button type="submit" className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer">
                  LAUNCH CAMPAIGN
                </button>
              </div>
            </form>
          )}

          {/* Promos Table */}
          <div className="bg-[#161b26] border border-[#222834] rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase bg-[#0e121a]">
                  <th className="py-2 px-3">Promotion / Voucher</th>
                  <th className="py-2 px-3">Discount Benefit</th>
                  <th className="py-2 px-3">Scope / Min Spend</th>
                  <th className="py-2 px-3">Validity Window</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2430]">
                {promos.map((pr) => (
                  <tr key={pr.id} className="hover:bg-[#1c2230]">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{pr.name}</div>
                      <div className="text-[10px] text-amber-400 mt-0.5">
                        {pr.promo_code ? `CODE: ${pr.promo_code}` : 'Automatic Sale Rule'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                        {pr.discount_type === 'PERCENTAGE' ? `${pr.discount_value}% OFF` : `KES ${pr.discount_value} OFF`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-400">
                      <div>Category: {pr.category || 'All Categories'}</div>
                      <div>Min Spend: KES {Number(pr.min_spend || 0).toFixed(2)}</div>
                    </td>
                    <td className="py-2.5 px-3 text-[10px] text-slate-400">
                      <div>{pr.start_date ? pr.start_date.slice(0, 10) : 'Start'} to</div>
                      <div>{pr.end_date ? pr.end_date.slice(0, 10) : 'Ongoing'}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
