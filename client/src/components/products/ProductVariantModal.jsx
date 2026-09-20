// client/src/components/products/ProductVariantModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Layers, Barcode, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function ProductVariantModal({ isOpen, onClose, product, onVariantUpdated }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [formData, setFormData] = useState({
    size: '',
    color: '',
    model: '',
    variant_sku: '',
    barcode: '',
    price_override: '',
    cost_override: '',
  });
  const [error, setError] = useState('');

  const fetchVariants = async () => {
    if (!product?.id) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/products/${product.id}/variants`);
      setVariants(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error('Failed to load variants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && product?.id) {
      fetchVariants();
      setAddingNew(false);
      setError('');
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const handleCreateVariant = async (e) => {
    e.preventDefault();
    setError('');
    try {
      sound.playScan();
      await api.post(`/api/v1/products/${product.id}/variants`, {
        ...formData,
        price_override: formData.price_override ? parseFloat(formData.price_override) : null,
        cost_override: formData.cost_override ? parseFloat(formData.cost_override) : null,
      });
      sound.playSuccess();
      api.toast('Variant created successfully', 'success');
      setFormData({ size: '', color: '', model: '', variant_sku: '', barcode: '', price_override: '', cost_override: '' });
      setAddingNew(false);
      await fetchVariants();
      if (onVariantUpdated) onVariantUpdated();
    } catch (err) {
      setError(err.message || 'Failed to create variant');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#2b3548] rounded w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#151a24]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                {product.sku}
              </span>
              <span className="text-slate-400 text-xs">/</span>
              <span className="text-slate-300 text-xs font-semibold">{product.name}</span>
            </div>
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 mt-0.5">
              <Layers className="w-4 h-4 text-amber-400" />
              Multi-Attribute Product Variants
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Existing Variants Table */}
          <div className="bg-[#161b26] border border-[#222834] rounded overflow-hidden">
            <div className="p-2.5 bg-[#0e121a] border-b border-[#222834] flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                Current Variant Matrix ({variants.length})
              </span>
              {!addingNew && (
                <button
                  onClick={() => setAddingNew(true)}
                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  ADD VARIANT
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-6 text-center text-xs font-mono text-slate-400">Loading variants...</div>
            ) : variants.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-500">
                No variants configured. Product acts as single standard SKU.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-[#222834] text-[10px] text-slate-400 uppercase bg-[#12161f]">
                    <th className="py-2 px-3">Variant SKU / Barcode</th>
                    <th className="py-2 px-3">Attributes (Size / Color / Model)</th>
                    <th className="py-2 px-3 text-right">Price Override</th>
                    <th className="py-2 px-3 text-center">Allocated Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2430]">
                  {variants.map((v) => (
                    <tr key={v.id} className="hover:bg-[#1c2230]">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-200">{v.variant_sku}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Barcode className="w-3 h-3" />
                          {v.barcode || 'N/A'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {v.size && <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px]">Size: {v.size}</span>}
                          {v.color && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px]">Color: {v.color}</span>}
                          {v.model && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px]">Model: {v.model}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {v.price_override ? (
                          <span className="text-emerald-400 font-bold">KES {Number(v.price_override).toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-500">Base Price</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {v.total_allocated_quantity || 0} Units
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* New Variant Subform */}
          {addingNew && (
            <form onSubmit={handleCreateVariant} className="bg-[#161b26] border border-amber-500/30 rounded p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-[#222834] pb-2">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase">New Variant Attributes</span>
                <button type="button" onClick={() => setAddingNew(false)} className="text-slate-400 hover:text-white text-xs font-mono">Cancel</button>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Size (e.g. 50L / XL)</label>
                  <input type="text" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-xs text-white font-mono focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Color (e.g. Amber / Navy)</label>
                  <input type="text" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-xs text-white font-mono focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Model / Spec</label>
                  <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-xs text-white font-mono focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Custom Variant SKU (Optional)</label>
                  <input type="text" placeholder="Auto-generated if empty" value={formData.variant_sku} onChange={(e) => setFormData({ ...formData, variant_sku: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-xs text-white font-mono focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Barcode (Optional)</label>
                  <input type="text" placeholder="Auto-generated if empty" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-xs text-white font-mono focus:border-amber-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">Price Override (KES)</label>
                  <input type="number" step="0.01" placeholder={`Default: ${product.selling_price}`} value={formData.price_override} onChange={(e) => setFormData({ ...formData, price_override: e.target.value })} className="w-full bg-[#12161f] border border-[#2b3548] rounded px-2.5 py-1 text-xs text-emerald-400 font-mono focus:border-amber-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button type="submit" className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono cursor-pointer">
                  SAVE VARIANT
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
