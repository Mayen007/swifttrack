import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import { ParcelCounterBooking } from '../components/pos/ParcelCounterBooking.jsx';
import { ShiftStatusBar } from '../components/pos/ShiftStatusBar.jsx';
import { ShiftGateCard } from '../components/pos/ShiftGateCard.jsx';
import { OpenShiftModal } from '../components/pos/OpenShiftModal.jsx';
import { CloseShiftModal } from '../components/pos/CloseShiftModal.jsx';
import { CashMovementModal } from '../components/pos/CashMovementModal.jsx';
import { ReprintReceiptModal } from '../components/pos/ReprintReceiptModal.jsx';
import { PosReceiptModal } from '../components/pos/PosReceiptModal.jsx';

export function PosView({ onNavigate }) {
  const { user, selectedBranch } = useAuth();

  // Shift & Cash Drawer State
  const [activeShift, setActiveShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [openShiftModalOpen, setOpenShiftModalOpen] = useState(false);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Shift Form Fields
  const [openingFloat, setOpeningFloat] = useState(5000);
  const [openShiftNotes, setOpenShiftNotes] = useState('Morning parcel counter shift');
  const [countedCash, setCountedCash] = useState(0);
  const [closeShiftNotes, setCloseShiftNotes] = useState('');
  const [movementType, setMovementType] = useState('PAYOUT');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  // Receipt Lookup State
  const [reprintQuery, setReprintQuery] = useState('');
  const [reprintData, setReprintData] = useState(null);
  const [reprintLoading, setReprintLoading] = useState(false);

  const loadActiveShift = async () => {
    try {
      setShiftLoading(true);
      const res = await api.get('/api/pos/shift/current');
      setActiveShift(res.shift || null);
      if (res.shift) {
        setCountedCash(res.shift.expected_cash || 0);
      }
    } catch (err) {
      console.error('Failed to load active shift:', err);
      setActiveShift(null);
    } finally {
      setShiftLoading(false);
    }
  };

  useEffect(() => {
    loadActiveShift();
  }, [selectedBranch]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setReceiptModalOpen(false);
        setOpenShiftModalOpen(false);
        setCloseShiftModalOpen(false);
        setMovementModalOpen(false);
        setReprintModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenShift = async (e) => {
    e?.preventDefault();
    try {
      const res = await api.post('/api/pos/shift/open', {
        opening_float: Number(openingFloat),
        notes: openShiftNotes,
      });
      sound.playSuccess();
      api.toast(`Shift #${res.shift?.shift_number} opened with KES ${Number(openingFloat).toLocaleString()}`, 'success');
      setActiveShift(res.shift);
      setOpenShiftModalOpen(false);
    } catch (err) {
      sound.playError();
      api.toast(`Failed to open shift: ${err.message}`, 'error');
    }
  };

  const handleCloseShift = async (e) => {
    e?.preventDefault();
    if (!activeShift) return;
    try {
      const res = await api.post('/api/pos/shift/close', {
        shift_id: activeShift.id,
        closing_cash_counted: Number(countedCash),
        notes: closeShiftNotes,
      });
      sound.playSuccess();
      api.toast(`Shift #${activeShift.shift_number} closed successfully`, 'success');
      setActiveShift(null);
      setCloseShiftModalOpen(false);
    } catch (err) {
      sound.playError();
      api.toast(`Failed to close shift: ${err.message}`, 'error');
    }
  };

  const handleDrawerMovement = async (e) => {
    e?.preventDefault();
    if (!activeShift) {
      api.toast('No active shift', 'error');
      return;
    }
    const amt = Number(movementAmount);
    if (!amt || amt <= 0) {
      api.toast('Enter valid movement amount', 'error');
      return;
    }
    if (!movementReason.trim()) {
      api.toast('Please provide a reason', 'error');
      return;
    }
    try {
      const res = await api.post('/api/pos/shift/movement', {
        shift_id: activeShift.id,
        movement_type: movementType,
        amount: amt,
        reason: movementReason,
      });
      sound.playSuccess();
      api.toast(`Drawer ${movementType} of KES ${amt.toLocaleString()} recorded`, 'success');
      setActiveShift(res.shift);
      setMovementModalOpen(false);
      setMovementAmount('');
      setMovementReason('');
    } catch (err) {
      sound.playError();
      api.toast(`Movement failed: ${err.message}`, 'error');
    }
  };

  const handleLookupReceipt = async (queryParam) => {
    const q = (queryParam || reprintQuery).trim();
    if (!q) {
      api.toast('Enter receipt or waybill number', 'error');
      return;
    }
    try {
      setReprintLoading(true);
      const res = await api.get(`/api/pos/receipt/${encodeURIComponent(q)}`);
      if (res && res.sale) {
        setReprintData(res);
      } else {
        api.toast('Receipt record not found', 'error');
      }
    } catch (err) {
      api.toast(`Receipt lookup failed: ${err.message}`, 'error');
    } finally {
      setReprintLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-120px)] lg:h-[calc(100vh-115px)] select-none">
      {/* Shift & Cash Register Status Bar */}
      <ShiftStatusBar
        activeShift={activeShift}
        onOpenMovement={() => setMovementModalOpen(true)}
        onOpenReprint={() => setReprintModalOpen(true)}
        onOpenCloseShift={() => {
          setCountedCash(activeShift?.expected_cash || 0);
          setCloseShiftModalOpen(true);
        }}
        onOpenOpenShift={() => setOpenShiftModalOpen(true)}
      />

      {/* Counter Parcel Intake or Shift Gate */}
      {!activeShift && !shiftLoading ? (
        <ShiftGateCard onOpenShift={() => setOpenShiftModalOpen(true)} />
      ) : (
        <ParcelCounterBooking
          user={user}
          selectedBranch={selectedBranch}
          activeShift={activeShift}
          onOpenShiftRequest={() => setOpenShiftModalOpen(true)}
          onRefreshShift={loadActiveShift}
          onNavigate={onNavigate}
        />
      )}

      {/* Drawer Management Modals */}
      <OpenShiftModal
        isOpen={openShiftModalOpen}
        onClose={() => setOpenShiftModalOpen(false)}
        user={user}
        selectedBranch={selectedBranch}
        openingFloat={openingFloat}
        setOpeningFloat={setOpeningFloat}
        shiftNotes={openShiftNotes}
        setShiftNotes={setOpenShiftNotes}
        onSubmit={handleOpenShift}
      />

      <CloseShiftModal
        isOpen={closeShiftModalOpen}
        onClose={() => setCloseShiftModalOpen(false)}
        activeShift={activeShift}
        countedCash={countedCash}
        setCountedCash={setCountedCash}
        closeShiftNotes={closeShiftNotes}
        setCloseShiftNotes={setCloseShiftNotes}
        onSubmit={handleCloseShift}
      />

      <CashMovementModal
        isOpen={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        activeShift={activeShift}
        movementType={movementType}
        setMovementType={setMovementType}
        movementAmount={movementAmount}
        setMovementAmount={setMovementAmount}
        movementReason={movementReason}
        setMovementReason={setMovementReason}
        onSubmit={handleDrawerMovement}
      />

      <ReprintReceiptModal
        isOpen={reprintModalOpen}
        onClose={() => setReprintModalOpen(false)}
        reprintQuery={reprintQuery}
        setReprintQuery={setReprintQuery}
        onLookupReceipt={handleLookupReceipt}
        reprintLoading={reprintLoading}
        reprintData={reprintData}
        setReprintData={setReprintData}
      />

      <PosReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        receiptData={receiptData}
      />
    </div>
  );
}
