import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import { ExpenseTelemetryCards } from '../components/expenses/ExpenseTelemetryCards.jsx';
import { ExpenseFilterBar } from '../components/expenses/ExpenseFilterBar.jsx';
import { ExpenseTable } from '../components/expenses/ExpenseTable.jsx';
import { RecordExpenseModal } from '../components/expenses/RecordExpenseModal.jsx';
import { InspectExpenseModal } from '../components/expenses/InspectExpenseModal.jsx';

export function ExpensesView() {
  const { user, selectedBranch } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState('Fuel');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectExpense, setInspectExpense] = useState(null);

  const searchInputRef = useRef(null);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const branchParam = selectedBranch ? `?branch_id=${selectedBranch.id}` : '';
      const data = await api.get(`/api/expenses${branchParam}`);
      setExpenses(Array.isArray(data) ? data : []);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load expenses:', e);
      api.toast('Failed to load operating expenses: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedBranch]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        sound.playScan();
      }
      if (e.key === 'Escape') {
        setModalOpen(false);
        setInspectModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCreateExpense = async () => {
    if (!amount || !description.trim() || !payee.trim()) {
      api.toast('Please provide merchant/payee, amount, and description', 'error');
      sound.playError();
      return;
    }

    try {
      const res = await api.post('/api/expenses', {
        branch_id: selectedBranch?.id || 1,
        category,
        payee: payee.trim(),
        amount: Number(amount),
        description: description.trim(),
        payment_method: paymentMethod,
      });

      sound.playSuccess();
      api.toast(res.message || 'Petty cash expense voucher recorded', 'success');
      setModalOpen(false);
      setAmount('');
      setPayee('');
      setDescription('');
      fetchExpenses();
    } catch (e) {
      sound.playError();
      api.toast(`Failed to record expense: ${e.message}`, 'error');
    }
  };

  const handleApproveExpense = async (expenseId) => {
    try {
      await api.post(`/api/expenses/${expenseId}/approve`, {});
      sound.playSuccess();
      api.toast('Expense voucher approved and cleared', 'success');
      fetchExpenses();
    } catch (e) {
      sound.playError();
      api.toast(`Approval failed: ${e.message}`, 'error');
    }
  };

  const openInspectModal = (exp) => {
    setInspectExpense(exp);
    setInspectModalOpen(true);
    sound.playScan();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedMethod('ALL');
    setSelectedStatus('ALL');
    sound.playScan();
  };

  const filteredExpenses = expenses.filter((e) => {
    if (selectedCategory !== 'ALL' && e.category !== selectedCategory) return false;
    if (selectedMethod !== 'ALL' && e.payment_method !== selectedMethod) return false;
    if (selectedStatus !== 'ALL' && e.status !== selectedStatus) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = e.expense_number?.toLowerCase().includes(q);
      const matchPayee = e.payee?.toLowerCase().includes(q);
      const matchDesc = e.description?.toLowerCase().includes(q);
      const matchCat = e.category?.toLowerCase().includes(q);
      const matchUser = e.created_by_name?.toLowerCase().includes(q);

      if (!matchNum && !matchPayee && !matchDesc && !matchCat && !matchUser) return false;
    }
    return true;
  });

  const totalSettled = expenses.filter((e) => e.status === 'APPROVED').reduce((sum, e) => sum + (e.amount || 0), 0);
  const fuelMaintenanceTotal = expenses
    .filter((e) => ['Fuel', 'Maintenance'].includes(e.category))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const utilitiesTotal = expenses
    .filter((e) => ['Utilities', 'Packaging', 'Sundry'].includes(e.category))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingVouchers = expenses.filter((e) => e.status === 'PENDING_APPROVAL');
  const pendingValue = pendingVouchers.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 space-y-3.5">
        <ExpenseTelemetryCards
          selectedBranch={selectedBranch}
          lastSyncTime={lastSyncTime}
          loading={loading}
          onOpenRecordModal={() => {
            setModalOpen(true);
            sound.playScan();
          }}
          onRefresh={() => {
            fetchExpenses();
            sound.playScan();
          }}
          totalSettled={totalSettled}
          fuelMaintenanceTotal={fuelMaintenanceTotal}
          utilitiesTotal={utilitiesTotal}
          totalVouchers={expenses.length}
          pendingVouchers={pendingVouchers}
          pendingValue={pendingValue}
        />

        <ExpenseFilterBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedMethod={selectedMethod}
          setSelectedMethod={setSelectedMethod}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          searchInputRef={searchInputRef}
          onReset={handleResetFilters}
        />
      </div>

      <ExpenseTable
        expenses={filteredExpenses}
        user={user}
        onInspect={openInspectModal}
        onApprove={handleApproveExpense}
      />

      <RecordExpenseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        category={category}
        setCategory={setCategory}
        payee={payee}
        setPayee={setPayee}
        amount={amount}
        setAmount={setAmount}
        description={description}
        setDescription={setDescription}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        onSubmit={handleCreateExpense}
      />

      <InspectExpenseModal
        isOpen={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        expense={inspectExpense}
      />
    </div>
  );
}
