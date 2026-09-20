// client/src/components/products/ProductCreateModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Sparkles, AlertCircle } from 'lucide-react';

export function ProductCreateModal({
  isOpen,
  onClose,
  onSave,
  product = null,
  brands = [],
  suppliers = [],
}) {
  const isEdit = Boolean(product);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'Packaging Materials',
    brand_id: '',
    supplier_id: '',
    unit_of_measure: 'PIECE',
    cost_price: '0.00',
    selling_price: '0.00',
    wholesale_price: '0.00',
    tax_category: 'STANDARD_16',
    reorder_threshold: '10',
    reorder_quantity: '50',
    description: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        category: product.category || 'Packaging Materials',
        brand_id: product.brand_id ? String(product.brand_id) : '',
        supplier_id: product.supplier_id ? String(product.supplier_id) : '',
        unit_of_measure: product.unit_of_measure || 'PIECE',
        cost_price: String(product.cost_price ?? '0.00'),
        selling_price: String(product.selling_price ?? '0.00'),
        wholesale_price: String(product.wholesale_price ?? product.selling_price ?? '0.00'),
        tax_category: product.tax_category || 'STANDARD_16',
        reorder_threshold: String(product.reorder_threshold ?? '10'),
        reorder_quantity: String(product.reorder_quantity ?? '50'),
        description: product.description || '',
      });
    } else {
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        category: 'Packaging Materials',
        brand_id: '',
        supplier_id: '',
        unit_of_measure: 'PIECE',
        cost_price: '0.00',
        selling_price: '0.00',
        wholesale_price: '0.00',
        tax_category: 'STANDARD_16',
        reorder_threshold: '10',
        reorder_quantity: '50',
        description: '',
      });
    }
    setError('');
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleAutoSku = () => {
    const prefix = formData.category.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PRD');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const sku = `${prefix}-${rnd}`;
    const barcode = `600${Math.floor(100000000 + Math.random() * 900000000)}`;
    setFormData((prev) => ({ ...prev, sku, barcode }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim() || !formData.sku.trim()) {
      setError('Product Name and SKU are required.');
      return;
    }
    try {
      setSubmitting(true);
      await onSave({
        ...formData,
        cost_price: parseFloat(formData.cost_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        wholesale_price: parseFloat(formData.wholesale_price) || 0,
        reorder_threshold: parseInt(formData.reorder_threshold, 10) || 0,
        reorder_quantity: parseInt(formData.reorder_quantity, 10) || 0,
        brand_id: formData.brand_id ? parseInt(formData.brand_id, 10) : null,
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id, 10) : null,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12161f] border border-[#2b3548] rounded w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#151a24]">
          <div>
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {isEdit ? 'Edit Master Product' : 'Create Master Product'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Enter SKU details, tax category, wholesale, and reorder metrics
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Corrugated Packaging Box"
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono text-slate-400">SKU Code *</label>
                {!isEdit && (
                  <button
                    type="button"
                    onClick={handleAutoSku}
                    className="text-[10px] font-mono text-amber-400 hover:underline cursor-pointer"
                  >
                    Auto Generate
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g. PKG-BOX-001"
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="e.g. 600123456789"
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Brand</label>
              <select
                value={formData.brand_id}
                onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="">No Brand (Generic)</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Supplier</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="">No Supplier Assigned</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Unit of Measure</label>
              <select
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="PIECE">Piece (PC)</option>
                <option value="BOX">Box</option>
                <option value="ROLL">Roll</option>
                <option value="BAG">Bag</option>
                <option value="KG">Kilogram (KG)</option>
                <option value="CANISTER">Canister / Tin</option>
                <option value="PAIR">Pair</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Tax Category (KRA)</label>
              <select
                value={formData.tax_category}
                onChange={(e) => setFormData({ ...formData, tax_category: e.target.value })}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="STANDARD_16">Standard (16% VAT)</option>
                <option value="ZERO_RATED_0">Zero-Rated (0% VAT)</option>
                <option value="EXEMPT">Exempt from Tax</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Cost Price (KES)</label>
              <input
                type="number"
                step="0.01"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Selling Retail Price (KES) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Wholesale Price (KES)</label>
              <input
                type="number"
                step="0.01"
                value={formData.wholesale_price}
                onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Reorder Threshold (Min Units)</label>
              <input
                type="number"
                value={formData.reorder_threshold}
                onChange={(e) => setFormData({ ...formData, reorder_threshold: e.target.value })}
                className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed specifications, storage handling instructions, or dimensions..."
              className="w-full bg-[#181d28] border border-[#2b3548] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-[#222834] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-[#2b3548] bg-[#181d28] hover:bg-[#202736] text-xs font-mono text-slate-300"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'SAVING...' : isEdit ? 'UPDATE PRODUCT' : 'CREATE PRODUCT'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
