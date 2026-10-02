import React, { useRef, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  KeyRound,
  PenTool,
  Trash2,
  CheckCircle2,
  Camera,
  Image as ImageIcon,
  Banknote,
  AlertTriangle
} from 'lucide-react';
import { sound } from '../../services/sound.js';

export function PodSignatureModal({
  isOpen,
  onClose,
  activeDelivery,
  gpsCoords,
  recipientConfirmedName,
  setRecipientConfirmedName,
  recipientRelation,
  setRecipientRelation,
  otpCode,
  setOtpCode,
  podNotes,
  setPodNotes,
  signatureData,
  setSignatureData,
  photoData = '',
  setPhotoData = () => {},
  codCollected = false,
  setCodCollected = () => {},
  onSubmit
}) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const canvas = canvasRef.current;
    if (!canvas) {
      return () => {
        document.body.style.overflow = originalBodyOverflow;
      };
    }
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : (e.clientX ?? 0);
      const clientY = e.touches ? e.touches[0].clientY : (e.clientY ?? 0);
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const handlePointerDown = (e) => {
      if (e.cancelable) e.preventDefault();
      try {
        if (canvas.setPointerCapture) {
          canvas.setPointerCapture(e.pointerId);
        }
      } catch {}
      isDrawingRef.current = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handlePointerMove = (e) => {
      if (!isDrawingRef.current) return;
      if (e.cancelable) e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const handlePointerUp = (e) => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        try {
          if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
          }
        } catch {}
        setSignatureData(canvas.toDataURL('image/png'));
      }
    };

    const handleTouchStart = (e) => {
      if (e.cancelable) e.preventDefault();
      isDrawingRef.current = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handleTouchMove = (e) => {
      if (!isDrawingRef.current) return;
      if (e.cancelable) e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const handleTouchEnd = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        setSignatureData(canvas.toDataURL('image/png'));
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.body.style.overflow = originalBodyOverflow;

      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);

      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isOpen, setSignatureData]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setSignatureData('');
      sound.playScan();
    }
  };

  if (!isOpen || !activeDelivery) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 overflow-y-auto overscroll-contain">
      <div className="bg-[#12161f] border border-[#222834] rounded p-6 max-w-lg w-full shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 my-auto max-h-[92vh] overflow-y-auto overscroll-contain">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-bold">
            STAGE-05 // PROOF OF DELIVERY (POD)
          </span>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Seal Delivery #{activeDelivery.delivery_number}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Auto-tagged GPS: {gpsCoords.latitude}, {gpsCoords.longitude} ({gpsCoords.accuracy})
          </p>
        </div>

        {/* COD Collection Alert Banner */}
        {(() => {
          const codAmount = Number(activeDelivery?.cod_amount || activeDelivery?.expected_amount || 0);
          const isCod = codAmount > 0 || activeDelivery?.payment_type === 'COD' || activeDelivery?.is_cod;
          if (!isCod) return null;
          return (
            <div className="space-y-2 p-3.5 bg-amber-500/15 border-2 border-amber-500/60 rounded-xl font-mono text-amber-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Banknote className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-amber-400/90 uppercase font-bold block">
                      Cash on Delivery (COD) Required
                    </span>
                    <span className="text-base font-black text-white tracking-tight">
                      COLLECT KES {codAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                  MANDATORY
                </span>
              </div>
              <label className="flex items-start gap-2.5 pt-2 border-t border-amber-500/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={codCollected}
                  onChange={(e) => setCodCollected(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-500 bg-[#0c0e12] border-amber-500/60 focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] text-slate-200 leading-tight">
                  I confirm that I have collected <strong className="text-amber-300">KES {codAmount.toLocaleString()}</strong> in cash or verified M-Pesa reference from recipient.
                </span>
              </label>
            </div>
          );
        })()}

        <div className="space-y-3 text-xs font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Confirmed Recipient Name *
              </label>
              <input
                type="text"
                value={recipientConfirmedName}
                onChange={(e) => setRecipientConfirmedName(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                placeholder="Full name of person receiving"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Recipient Relation
              </label>
              <select
                value={recipientRelation}
                onChange={(e) => setRecipientRelation(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="Self / Customer">Self / Customer</option>
                <option value="Security / Gatekeeper">Security / Gatekeeper</option>
                <option value="Office Reception / Mailroom">Office Reception / Mailroom</option>
                <option value="Family Member / Colleague">Family Member / Colleague</option>
                <option value="Other Proxy">Other Proxy</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                Customer Delivery OTP PIN *
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                Ask customer for 4-digit SMS PIN
              </span>
            </div>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="4-digit SMS OTP code"
              maxLength={6}
              className="w-full px-3 py-2 rounded bg-[#0c0e12] border border-[#222834] text-slate-100 font-mono tracking-widest text-center text-sm font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5 text-blue-400" />
                Recipient Signature Pad (Touch / Pen)
              </label>
              <button
                type="button"
                onClick={clearSignature}
                className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Clear Pad
              </button>
            </div>

            <div 
              className="rounded border border-[#222834] bg-[#f8fafc] p-1 flex justify-center shadow-inner select-none"
              style={{ touchAction: 'none' }}
            >
              <canvas
                ref={canvasRef}
                width={400}
                height={130}
                style={{ touchAction: 'none' }}
                className="w-full h-[130px] cursor-crosshair touch-none bg-[#f8fafc] rounded select-none block"
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">
              Sign directly inside white canvas above. Saved as digital legal ledger proof.
            </span>
          </div>

          {/* Photo Proof of Delivery (Optional / Recommended for Proxy) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                Photo Proof of Delivery (Optional / Proxy Handover)
              </label>
              {photoData && (
                <button
                  type="button"
                  onClick={() => setPhotoData('')}
                  className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove Photo
                </button>
              )}
            </div>

            {photoData ? (
              <div className="relative rounded-lg border border-[#222834] overflow-hidden bg-[#0c0e12] p-2 flex items-center gap-3">
                <img src={photoData} alt="POD Proof" className="w-16 h-16 object-cover rounded border border-[#1e2433]" />
                <div className="text-[11px] space-y-0.5 text-slate-300">
                  <p className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Photo Attached
                  </p>
                  <p className="text-[10px] text-slate-400">Captured package at gate / reception</p>
                </div>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-[#2c3548] hover:border-cyan-500/50 bg-[#0c0e12] hover:bg-[#121622] text-slate-400 hover:text-cyan-300 transition-all cursor-pointer">
                <Camera className="w-4 h-4" />
                <span className="text-[11px] font-mono">Snap Photo of Parcel at Gate / Reception</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => setPhotoData(event.target.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Delivery Gate / Handover Notes (Optional)
            </label>
            <input
              type="text"
              value={podNotes}
              onChange={(e) => setPodNotes(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-[#0c0e12] border border-[#222834] text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              placeholder="e.g. Received in good order, parcel intact"
            />
          </div>

          <div className="pt-2 flex gap-2.5">
            {(() => {
              const codAmount = Number(activeDelivery?.cod_amount || activeDelivery?.expected_amount || 0);
              const isCod = codAmount > 0 || activeDelivery?.payment_type === 'COD' || activeDelivery?.is_cod;
              const canSubmit = recipientConfirmedName.trim() && otpCode.trim() && (!isCod || codCollected);

              return (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                  className={`flex-1 py-2.5 rounded font-bold font-mono text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 ${
                    canSubmit
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Complete POD</span>
                </button>
              );
            })()}
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded bg-[#181d28] hover:bg-slate-700 text-slate-300 font-semibold font-mono text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
