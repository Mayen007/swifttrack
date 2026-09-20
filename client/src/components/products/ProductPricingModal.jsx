// client/src/components/products/ProductPricingModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Sliders, Calculator, Building2, Users, Layers, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function ProductPricingModal({ isOpen, onClose, product, branches = [] }) {
  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'branches' | 'bulk'
  const [branchOverrides, setBranchOverrides] = useState([]);
  const [bulkBreaks, setBulkBreaks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Simulator State
  const [simBranch, setSimBranch] = useState('');
  const [simQty, setSimQty] = useState('1');
  const [simPromo, setSimPromo] = useState('');
  const [simQuote, setSimQuote] = useState(null);
  const [simCalculating, setSimCalculating] = useState(false);

  // Add Branch Override Form
  const [newBranchId, setNewBranchId] = useState('');
  const [newBranchPrice, setNewBranchPrice] = useState('');

  // Add Bulk Break Form
  const [newMinQty, setNewMinQty] = useState('');
  const [newBulkPrice, setNewBulkPrice] = useState('');
  const [newTierName, setNewTierName] = useState('');

  const loadPricingData = async () => {
    if (!product?.id) return;
    try {
      setLoading(true);
      const [bRes, bulkRes] = await Promise.all([
        api.get(`/api/v1/products/${product.id}/branch-pricing`).catch(() => []),
        api.get(`/api/v1/products/${product.id}/bulk-pricing`).catch(() => []),
      ]);
      setBranchOverrides(Array.isArray(bRes) ? bRes : bRes.data || []);
      setBulkBreaks(Array.isArray(bulkRes) ? bulkRes : bulkRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && product?.id) {
      loadPricingData();
      setSimQuote(null);
      if (branches.length > 0) setSimBranch(String(branches[0].id));
    }
  }, [isOpen, product, branches]);

  if (!isOpen || !product) return null;

  const handleSimulate = async () => {
    try {
      setSimCalculating(true);
      sound.playScan();
      const res = await api.post('/api/v1/products/resolve-price', {
        productId: product.id,
        branchId: simBranch ? parseInt(simBranch, 10) : undefined,
        quantity: parseInt(simQty, 10) || 1,
        promoCode: simPromo.trim() || undefined,
      });
      setSimQuote(res.pricing || res);
      sound.playSuccess();
    } catch (err) {
      api.toast(err.message || 'Simulation failed', 'error');
    } finally {
      setSimCalculating(false);
    }
  };

  const handleSaveBranchOverride = async (e) => {
    e.preventDefault();
    if (!newBranchId || !newBranchPrice) return;
    try {
      await api.post(`/api/v1/products/${product.id}/branch-pricing`, {
        branch_id: parseInt(newBranchId, 10),
        selling_price: parseFloat(newBranchPrice),
      });
      api.toast('Branch price override saved', 'success');
      setNewBranchPrice('');
      await loadPricingData();
    } catch (err) {
      api.toast(err.message, 'error');
    }
  };

  const handleSaveBulkBreak = async (e) => {
    e.preventDefault();
    if (!newMinQty || !newBulkPrice) return;
    try {
      await api.post(`/api/v1/products/${product.id}/bulk-pricing`, {
        min_quantity: parseInt(newMinQty, 10),
        discount_price: parseFloat(newBulkPrice),
        tier_name: newTierName || undefined,
      });
      api.toast('Bulk volume tier saved', 'success');
      setNewMinQty('');
      setNewBulkPrice('');
      setNewTierName('');
      await loadPricingData();
    } catch (err) {
      api.toast(err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#2b3548] rounded w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#151a24]">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-amber-400 font-bold uppercase">{product.sku}</span>
              <span className="text-slate-400">/</span>
              <span className="text-emerald-400 font-bold">KES {Number(product.selling_price).toFixed(2)} Base</span>
            </div>
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 mt-0.5">
              <Sliders className="w-4 h-4 text-amber-400" />
              Multi-Tier Dynamic Pricing Engine
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#222834] bg-[#0e121a] px-4 font-mono text-xs">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-2.5 px-3 flex items-center gap-1.5 border-b-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'simulator' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            LIVE PRICE SIMULATOR
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`py-2.5 px-3 flex items-center gap-1.5 border-b-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'branches' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            BRANCH OVERRIDES ({branchOverrides.length})
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`py-2.5 px-3 flex items-center gap-1.5 border-b-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'bulk' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            BULK BREAKS ({bulkBreaks.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: LIVE SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#161b26] p-3 rounded border border-[#222834]">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Target Branch</label>
                  <select
                    value={simBranch}
                    onChange={(e) => setSimBranch(e.target.value)}
                    className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Default (No Branch Override)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={simQty}
                    onChange={(e) => setSimQty(e.target.value)}
                    className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Promo Code (Optional)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. LOGISTICS10"
                      value={simPromo}
                      onChange={(e) => setSimPromo(e.target.value.toUpperCase())}
                      className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={handleSimulate}
                      disabled={simCalculating}
                      className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {simCalculating ? 'CALC...' : 'QUOTE'}
                    </button>
                  </div>
                </div>
              </div>

              {simQuote && (
                <div className="bg-[#141923] border border-amber-500/40 rounded p-4 space-y-3 font-mono">
                  <div className="flex items-center justify-between border-b border-[#222834] pb-2">
                    <span className="text-xs font-bold text-amber-400 uppercase">Resolved Quotation Breakdown</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      RULE: {simQuote.priceSource}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">BASE RETAIL</span>
                      <span className="text-white font-bold">KES {Number(simQuote.basePrice).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">EFFECTIVE UNIT PRICE</span>
                      <span className="text-amber-400 font-bold">KES {Number(simQuote.unitPrice).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">DISCOUNT SAVINGS</span>
                      <span className="text-rose-400 font-bold">- KES {Number(simQuote.discountAmount || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">TOTAL PAYABLE (INC. VAT)</span>
                      <span className="text-emerald-400 font-bold text-sm">KES {Number(simQuote.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BRANCH OVERRIDES */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              <form onSubmit={handleSaveBranchOverride} className="bg-[#161b26] p-3 rounded border border-[#222834] flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Select Branch</label>
                  <select
                    required
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Choose Branch...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-40">
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Branch Price (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newBranchPrice}
                    onChange={(e) => setNewBranchPrice(e.target.value)}
                    className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-emerald-400 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <button type="submit" className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono cursor-pointer shrink-0">
                  SET OVERRIDE
                </button>
              </form>

              <div className="bg-[#161b26] border border-[#222834] rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase bg-[#0e121a]">
                      <th className="py-2 px-3">Branch Name</th>
                      <th className="py-2 px-3 text-right">Selling Price Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2430]">
                    {branchOverrides.length === 0 ? (
                      <tr><td colSpan="2" className="py-4 text-center text-slate-500">No branch-specific price overrides configured.</td></tr>
                    ) : (
                      branchOverrides.map((bo) => (
                        <tr key={bo.id} className="hover:bg-[#1c2230]">
                          <td className="py-2.5 px-3 text-white">{bo.branch_name || `Branch #${bo.branch_id}`}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">KES {Number(bo.selling_price).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BULK BREAKS */}
          {activeTab === 'bulk' && (
            <div className="space-y-4">
              <form onSubmit={handleSaveBulkBreak} className="bg-[#161b26] p-3 rounded border border-[#222834] flex gap-2.5 items-end">
                <div className="w-28">
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Min Qty</label>
                  <input
                    type="number"
                    min="2"
                    required
                    value={newMinQty}
                    onChange={(e) => setNewMinQty(e.target.value)}
                    className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="w-36">
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Tier Unit Price (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newBulkPrice}
                    onChange={(e) => setNewBulkPrice(e.target.value)}
                    className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-amber-400 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Tier Label (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 50+ Wholesale Pack"
                    value={newTierName}
                    onChange={(e) => setNewTierName(e.target.value)}
                    className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <button type="submit" className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono cursor-pointer shrink-0">
                  ADD TIER
                </button>
              </form>

              <div className="bg-[#161b26] border border-[#222834] rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase bg-[#0e121a]">
                      <th className="py-2 px-3">Tier Label</th>
                      <th className="py-2 px-3 text-center">Minimum Threshold</th>
                      <th className="py-2 px-3 text-right">Discounted Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2430]">
                    {bulkBreaks.length === 0 ? (
                      <tr><td colSpan="3" className="py-4 text-center text-slate-500">No bulk quantity breaks defined.</td></tr>
                    ) : (
                      bulkBreaks.map((bb) => (
                        <tr key={bb.id} className="hover:bg-[#1c2230]">
                          <td className="py-2.5 px-3 text-white">{bb.tier_name || 'Volume Tier'}</td>
                          <td className="py-2.5 px-3 text-center text-slate-300 font-bold">{bb.min_quantity}+ Units</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">KES {Number(bb.discount_price).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
