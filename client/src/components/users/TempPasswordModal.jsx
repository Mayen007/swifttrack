import React from 'react';
import { X, KeyRound, Check, Copy } from 'lucide-react';
import { sound } from '../../services/sound.js';

export function TempPasswordModal({
  isOpen,
  onClose,
  data,
  tempPasswordCopied,
  setTempPasswordCopied,
}) {
  if (!isOpen || !data) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#12161f] border border-[#222834] rounded w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#222834] flex items-center justify-between bg-[#181d28]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
                  TEMPORARY PASSWORD ISSUED
                </h3>
              </div>
              <button
                onClick={() => onClose()}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 font-mono text-xs">
              <p className="text-slate-300">
                A temporary replacement password has been generated for{' '}
                <span className="text-white font-bold">@{data.username}</span>.
              </p>

              <div className="p-3 rounded-lg bg-[#0e1320] border border-amber-500/40">
                <div className="flex items-center justify-between text-[10px] text-amber-400 font-bold mb-1.5">
                  <span>TEMPORARY CREDENTIAL</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(data.temporaryPassword);
                      setTempPasswordCopied(true);
                      setTimeout(() => setTempPasswordCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                  >
                    {tempPasswordCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{tempPasswordCopied ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>
                <div className="text-base font-bold text-white tracking-wider select-all py-1">
                  {data.temporaryPassword}
                </div>
              </div>

              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
                <span className="font-bold block text-amber-400">MANDATORY ROTATION ENFORCED:</span>
                Existing sessions for this user were invalidated. When @{data.username} signs in with this password, SwiftTrack will immediately prompt them to define a new private password before operational access is unlocked.
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => onClose()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs uppercase tracking-wider"
                >
                  DISMISS & COPY TO CLIPBOARD
                </button>
              </div>
            </div>
          </div>
        </div>
  );
}
