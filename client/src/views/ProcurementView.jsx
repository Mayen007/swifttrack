import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Building2,
  FileText,
  PackageCheck,
  Receipt,
  RotateCcw,
  Plus,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';

import { ProcurementTelemetry } from '../components/procurement/ProcurementTelemetry.jsx';
import { ProcurementTabNav } from '../components/procurement/ProcurementTabNav.jsx';
import { PurchaseOrdersTab } from '../components/procurement/PurchaseOrdersTab.jsx';
import { RequisitionsTab } from '../components/procurement/RequisitionsTab.jsx';
import { SuppliersTab } from '../components/procurement/SuppliersTab.jsx';
import { GoodsReceivedNotesTab } from '../components/procurement/GoodsReceivedNotesTab.jsx';
import { InvoicesTab } from '../components/procurement/InvoicesTab.jsx';
import { ReturnsTab } from '../components/procurement/ReturnsTab.jsx';

import { CreatePRModal } from '../components/procurement/CreatePRModal.jsx';
import { CreatePOModal } from '../components/procurement/CreatePOModal.jsx';
import { CreateSupplierModal } from '../components/procurement/CreateSupplierModal.jsx';
import { ReceiveGoodsModal } from '../components/procurement/ReceiveGoodsModal.jsx';
import { CreateInvoiceModal } from '../components/procurement/CreateInvoiceModal.jsx';
import { RecordPaymentModal } from '../components/procurement/RecordPaymentModal.jsx';
import { CreateReturnModal } from '../components/procurement/CreateReturnModal.jsx';
import { SupplierDetailModal } from '../components/procurement/SupplierDetailModal.jsx';
import { PODetailModal } from '../components/procurement/PODetailModal.jsx';

export function ProcurementView() {
  const { user, selectedBranch } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [loading, setLoading] = useState(false);
  const [, setLastSync] = useState(null);

  const [telemetry, setTelemetry] = useState({
    active_pos: 0,
    pending_approval_pos: 0,
    pending_prs: 0,
    total_po_spend: 0,
    open_payable_amount: 0,
    active_suppliers: 0
  });

  const [suppliers, setSuppliers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [grns, setGrns] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [warehousesList, setWarehousesList] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');

  const [showCreatePRModal, setShowCreatePRModal] = useState(false);
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [showCreateSupplierModal, setShowCreateSupplierModal] = useState(false);
  const [showReceiveGoodsModal, setShowReceiveGoodsModal] = useState(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showCreateReturnModal, setShowCreateReturnModal] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [, setSelectedPR] = useState(null);
  const [, setSelectedGRN] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const isManagerOrAdmin = ['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(user?.role);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchParam = selectedBranch && selectedBranch !== 'all' ? `?branch_id=${selectedBranch}` : '';

      const [
        telemRes,
        supsRes,
        prsRes,
        posRes,
        grnsRes,
        invsRes,
        retsRes,
        prodsRes,
        whsRes
      ] = await Promise.all([
        api.get(`/api/v1/procurement/telemetry${branchParam}`).catch(() => ({})),
        api.get('/api/v1/suppliers').catch(() => []),
        api.get(`/api/v1/procurement/requisitions${branchParam}`).catch(() => []),
        api.get(`/api/v1/procurement/orders${branchParam}`).catch(() => []),
        api.get(`/api/v1/procurement/grns${branchParam}`).catch(() => []),
        api.get(`/api/v1/procurement/invoices${branchParam}`).catch(() => []),
        api.get(`/api/v1/procurement/returns${branchParam}`).catch(() => []),
        api.get('/api/products').catch(() => []),
        api.get('/api/warehouses').catch(() => [])
      ]);

      if (telemRes) setTelemetry(telemRes);
      if (Array.isArray(supsRes)) setSuppliers(supsRes);
      if (Array.isArray(prsRes)) setRequisitions(prsRes);
      if (Array.isArray(posRes)) setOrders(posRes);
      if (Array.isArray(grnsRes)) setGrns(grnsRes);
      if (Array.isArray(invsRes)) setInvoices(invsRes);
      if (Array.isArray(retsRes)) setReturns(retsRes);
      if (Array.isArray(prodsRes)) setProductsList(prodsRes);
      if (Array.isArray(whsRes)) setWarehousesList(whsRes);

      setLastSync(new Date());
    } catch (err) {
      console.error('Failed to load procurement data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranch]);

  const tabs = [
    { id: 'orders', label: 'Purchase Orders', icon: ShoppingBag, count: orders.length },
    { id: 'requisitions', label: 'Requisitions (PR)', icon: FileText, count: requisitions.filter(r => r.status === 'SUBMITTED').length, highlight: true },
    { id: 'suppliers', label: 'Suppliers Directory', icon: Building2, count: suppliers.length },
    { id: 'grns', label: 'Goods Receipts (GRN)', icon: PackageCheck, count: grns.length },
    { id: 'invoices', label: 'Invoices & Payments', icon: Receipt, count: invoices.filter(i => i.status === 'PENDING').length },
    { id: 'returns', label: 'Supplier Returns', icon: RotateCcw, count: returns.length }
  ];

  const handleViewPO = async (po) => {
    const full = await api.get(`/api/v1/procurement/orders/${po.id}`);
    setSelectedPO(full);
  };

  const handleReceivePO = async (po) => {
    const full = await api.get(`/api/v1/procurement/orders/${po.id}`);
    setSelectedPO(full);
    setShowReceiveGoodsModal(true);
  };

  const handleSubmitPR = async (pr) => {
    await api.post(`/api/v1/procurement/requisitions/${pr.id}/submit`);
    fetchData();
  };

  const handleApprovePR = async (pr) => {
    await api.post(`/api/v1/procurement/requisitions/${pr.id}/approve`);
    fetchData();
  };

  const handleViewPR = async (pr) => {
    const full = await api.get(`/api/v1/procurement/requisitions/${pr.id}`);
    setSelectedPR(full);
  };

  const handleViewSupplier = async (s) => {
    const full = await api.get(`/api/v1/suppliers/${s.id}`);
    setSelectedSupplier(full);
  };

  const handleInspectGRN = async (g) => {
    const full = await api.get(`/api/v1/procurement/grns/${g.id}`);
    setSelectedGRN(full);
  };

  const handlePayInvoice = (inv) => {
    setSelectedInvoice(inv);
    setShowRecordPaymentModal(true);
  };

  const handleViewInvoice = async (inv) => {
    const full = await api.get(`/api/v1/procurement/invoices/${inv.id}`);
    setSelectedInvoice(full);
  };

  const handleApproveReturn = async (ret) => {
    await api.post(`/api/v1/procurement/returns/${ret.id}/approve`);
    fetchData();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0c0e12] overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800/80 bg-[#12161f]/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Suppliers & Procurement Cockpit
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-md">
                Phase 8
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              End-to-end procurement lifecycle from Requisition to PO, GRN, Invoicing, and Supplier Settlement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { sound.playClick(); fetchData(); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-xs font-medium text-slate-300 transition-all hover:text-white"
            title="Refresh procurement data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            Refresh
          </button>

          {isManagerOrAdmin && (
            <>
              <button
                onClick={() => { sound.playClick(); setShowCreatePRModal(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                New Requisition
              </button>

              <button
                onClick={() => { sound.playClick(); setShowCreatePOModal(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-semibold text-xs shadow-md shadow-amber-500/20 transition-all hover:scale-[1.01]"
              >
                <Plus className="w-4 h-4" />
                Create PO
              </button>
            </>
          )}
        </div>
      </div>

      <ProcurementTelemetry telemetry={telemetry} />

      <ProcurementTabNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'orders' && (
          <PurchaseOrdersTab
            orders={orders}
            searchQuery={searchQuery}
            isManagerOrAdmin={isManagerOrAdmin}
            onViewPO={handleViewPO}
            onReceivePO={handleReceivePO}
          />
        )}

        {activeTab === 'requisitions' && (
          <RequisitionsTab
            requisitions={requisitions}
            searchQuery={searchQuery}
            isManagerOrAdmin={isManagerOrAdmin}
            onRaisePR={() => setShowCreatePRModal(true)}
            onSubmitPR={handleSubmitPR}
            onApprovePR={handleApprovePR}
            onViewPR={handleViewPR}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersTab
            suppliers={suppliers}
            searchQuery={searchQuery}
            isManagerOrAdmin={isManagerOrAdmin}
            onAddSupplier={() => setShowCreateSupplierModal(true)}
            onViewSupplier={handleViewSupplier}
          />
        )}

        {activeTab === 'grns' && (
          <GoodsReceivedNotesTab
            grns={grns}
            searchQuery={searchQuery}
            onInspectGRN={handleInspectGRN}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesTab
            invoices={invoices}
            searchQuery={searchQuery}
            isManagerOrAdmin={isManagerOrAdmin}
            onLogInvoice={() => setShowCreateInvoiceModal(true)}
            onPayInvoice={handlePayInvoice}
            onViewInvoice={handleViewInvoice}
          />
        )}

        {activeTab === 'returns' && (
          <ReturnsTab
            returns={returns}
            searchQuery={searchQuery}
            isManagerOrAdmin={isManagerOrAdmin}
            onReturnStock={() => setShowCreateReturnModal(true)}
            onApproveReturn={handleApproveReturn}
          />
        )}
      </div>

      {showCreatePRModal && (
        <CreatePRModal
          onClose={() => setShowCreatePRModal(false)}
          onSuccess={() => { setShowCreatePRModal(false); fetchData(); }}
          productsList={productsList}
          user={user}
        />
      )}

      {showCreatePOModal && (
        <CreatePOModal
          onClose={() => setShowCreatePOModal(false)}
          onSuccess={() => { setShowCreatePOModal(false); fetchData(); }}
          suppliers={suppliers}
          productsList={productsList}
          warehousesList={warehousesList}
          user={user}
        />
      )}

      {showCreateSupplierModal && (
        <CreateSupplierModal
          onClose={() => setShowCreateSupplierModal(false)}
          onSuccess={() => { setShowCreateSupplierModal(false); fetchData(); }}
        />
      )}

      {showReceiveGoodsModal && selectedPO && (
        <ReceiveGoodsModal
          po={selectedPO}
          onClose={() => setShowReceiveGoodsModal(false)}
          onSuccess={() => { setShowReceiveGoodsModal(false); setSelectedPO(null); fetchData(); }}
        />
      )}

      {showCreateInvoiceModal && (
        <CreateInvoiceModal
          suppliers={suppliers}
          orders={orders}
          onClose={() => setShowCreateInvoiceModal(false)}
          onSuccess={() => { setShowCreateInvoiceModal(false); fetchData(); }}
        />
      )}

      {showRecordPaymentModal && selectedInvoice && (
        <RecordPaymentModal
          invoice={selectedInvoice}
          onClose={() => setShowRecordPaymentModal(false)}
          onSuccess={() => { setShowRecordPaymentModal(false); setSelectedInvoice(null); fetchData(); }}
        />
      )}

      {showCreateReturnModal && (
        <CreateReturnModal
          suppliers={suppliers}
          productsList={productsList}
          warehousesList={warehousesList}
          onClose={() => setShowCreateReturnModal(false)}
          onSuccess={() => { setShowCreateReturnModal(false); fetchData(); }}
        />
      )}

      {selectedSupplier && (
        <SupplierDetailModal
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          onRefresh={async () => {
            const updated = await api.get(`/api/v1/suppliers/${selectedSupplier.id}`);
            setSelectedSupplier(updated);
            fetchData();
          }}
          productsList={productsList}
        />
      )}

      {selectedPO && !showReceiveGoodsModal && (
        <PODetailModal
          po={selectedPO}
          onClose={() => setSelectedPO(null)}
          onRefresh={async () => {
            const updated = await api.get(`/api/v1/procurement/orders/${selectedPO.id}`);
            setSelectedPO(updated);
            fetchData();
          }}
          isManagerOrAdmin={isManagerOrAdmin}
        />
      )}
    </div>
  );
}
