// client/src/views/ProductsView.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';

import { ProductHeader } from '../components/products/ProductHeader.jsx';
import { ProductKpis } from '../components/products/ProductKpis.jsx';
import { ProductFilters } from '../components/products/ProductFilters.jsx';
import { ProductTable } from '../components/products/ProductTable.jsx';
import { ProductCreateModal } from '../components/products/ProductCreateModal.jsx';
import { ProductVariantModal } from '../components/products/ProductVariantModal.jsx';
import { ProductPricingModal } from '../components/products/ProductPricingModal.jsx';
import { PromotionsModal } from '../components/products/PromotionsModal.jsx';

export function ProductsView() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [taxFilter, setTaxFilter] = useState('ALL');

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [variantsModalOpen, setVariantsModalOpen] = useState(false);
  const [selectedVariantProduct, setSelectedVariantProduct] = useState(null);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [selectedPricingProduct, setSelectedPricingProduct] = useState(null);
  const [promotionsModalOpen, setPromotionsModalOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [prodRes, brandRes, supRes, branchRes, promoRes] = await Promise.all([
        api.get(`/api/v1/products${showArchived ? '?include_archived=true' : ''}`),
        api.get('/api/v1/brands').catch(() => []),
        api.get('/api/v1/suppliers').catch(() => []),
        api.get('/api/branches').catch(() => []),
        api.get('/api/v1/promotions').catch(() => []),
      ]);
      setProducts(Array.isArray(prodRes) ? prodRes : prodRes.data || []);
      setBrands(Array.isArray(brandRes) ? brandRes : brandRes.data || []);
      setSuppliers(Array.isArray(supRes) ? supRes : supRes.data || []);
      setBranches(Array.isArray(branchRes) ? branchRes : branchRes.data || []);
      setPromos(Array.isArray(promoRes) ? promoRes : promoRes.data || []);
    } catch (e) {
      console.error('Failed to load commerce data:', e);
      api.toast('Error fetching product catalog: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalVariants = products.reduce((acc, p) => acc + (Number(p.variant_count) || 0), 0);
    const lowStockCount = products.filter(
      (p) => p.reorder_threshold > 0 && (p.total_stock ?? 0) <= p.reorder_threshold
    ).length;
    const activePromotionsCount = promos.length;
    return { totalProducts, totalVariants, lowStockCount, activePromotionsCount };
  }, [products, promos]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (showArchived ? !p.is_archived : p.is_archived) return false;
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (brandFilter !== 'ALL' && String(p.brand_id) !== String(brandFilter)) return false;
      if (taxFilter !== 'ALL' && p.tax_category !== taxFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    });
  }, [products, showArchived, categoryFilter, brandFilter, taxFilter, searchQuery]);

  const handleSaveProduct = async (productData) => {
    if (editingProduct?.id) {
      await api.put(`/api/v1/products/${editingProduct.id}`, productData);
      api.toast('Master product updated', 'success');
    } else {
      await api.post('/api/v1/products', productData);
      api.toast('Master product created', 'success');
    }
    sound.playSuccess();
    await fetchProducts();
  };

  const handleToggleArchive = async (p) => {
    sound.playScan();
    try {
      if (p.is_archived) {
        await api.post(`/api/v1/products/${p.id}/restore`);
        api.toast(`Restored ${p.sku} to active catalog`, 'success');
      } else {
        await api.post(`/api/v1/products/${p.id}/archive`);
        api.toast(`Archived ${p.sku}`, 'success');
      }
      sound.playSuccess();
      await fetchProducts();
    } catch (err) {
      api.toast(err.message || 'Action failed', 'error');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <ProductHeader
        loading={loading}
        onRefresh={() => {
          sound.playScan();
          fetchProducts();
        }}
        onCreateProduct={() => {
          setEditingProduct(null);
          setCreateModalOpen(true);
        }}
        onOpenPromotions={() => setPromotionsModalOpen(true)}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived(!showArchived)}
      />

      <ProductKpis stats={stats} />

      <ProductFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        brandFilter={brandFilter}
        setBrandFilter={setBrandFilter}
        taxFilter={taxFilter}
        setTaxFilter={setTaxFilter}
        categories={categories}
        brands={brands}
        onResetFilters={() => {
          setSearchQuery('');
          setCategoryFilter('ALL');
          setBrandFilter('ALL');
          setTaxFilter('ALL');
        }}
      />

      <ProductTable
        loading={loading}
        products={filteredProducts}
        onOpenVariants={(p) => {
          setSelectedVariantProduct(p);
          setVariantsModalOpen(true);
        }}
        onOpenPricing={(p) => {
          setSelectedPricingProduct(p);
          setPricingModalOpen(true);
        }}
        onEditProduct={(p) => {
          setEditingProduct(p);
          setCreateModalOpen(true);
        }}
        onToggleArchive={handleToggleArchive}
      />

      <ProductCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
        brands={brands}
        suppliers={suppliers}
      />

      <ProductVariantModal
        isOpen={variantsModalOpen}
        onClose={() => setVariantsModalOpen(false)}
        product={selectedVariantProduct}
        onVariantUpdated={fetchProducts}
      />

      <ProductPricingModal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        product={selectedPricingProduct}
        branches={branches}
      />

      <PromotionsModal
        isOpen={promotionsModalOpen}
        onClose={() => setPromotionsModalOpen(false)}
      />
    </div>
  );
}
