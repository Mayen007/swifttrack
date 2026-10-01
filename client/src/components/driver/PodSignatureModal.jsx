import React, { useRef, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  KeyRound,
  PenTool,
  Trash2,
  CheckCircle2
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
              <button
                type="button"
                onClick={() => setOtpCode('1234')}
                className="text-[10px] text-blue-400 hover:text-blue-300 underline cursor-pointer"
              >
                Fill Mock PIN (1234)
              </button>
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
            <button
              onClick={onSubmit}
              className="flex-1 py-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/40 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Complete POD</span>
            </button>
            <button
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
