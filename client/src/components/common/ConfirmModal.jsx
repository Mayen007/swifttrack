import React from 'react';
import { AlertTriangle, AlertCircle, X } from 'lucide-react';

export function ConfirmModal({
  isOpen,
  title = 'Please Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onClose
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121622] border border-[#2a3447] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 flex items-start gap-3.5">
          <div className={`p-2.5 rounded-xl border shrink-0 ${
            isDestructive 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            {isDestructive ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white tracking-wide">{title}</h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3.5 bg-[#161c28] border-t border-[#222834] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
