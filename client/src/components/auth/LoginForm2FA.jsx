import React, { useState, useEffect } from 'react';
import { Smartphone, ArrowRight, ArrowLeft } from 'lucide-react';

export function LoginForm2FA({
  twoFactorCode,
  setTwoFactorCode,
  submitting,
  onBack,
  onSubmit
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    return 30 - (Math.floor(Date.now() / 1000) % 30);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining(30 - (Math.floor(Date.now() / 1000) % 30));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const ringColor = secondsRemaining > 15
    ? 'text-emerald-400'
    : secondsRemaining >= 10
    ? 'text-amber-400'
    : 'text-rose-400';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
          6-Digit TOTP / 8-Character Recovery Code
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Smartphone className="w-4 h-4 text-blue-400" />
          </div>
          <input
            type="text"
            required
            autoFocus
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value)}
            placeholder="e.g. 123456 or a1b2c3d4"
            className="w-full pl-9 pr-10 py-2.5 bg-[#161c28] border border-[#252f44] focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded-lg text-sm text-white placeholder-slate-500 font-mono tracking-widest text-center transition-colors outline-none uppercase"
            autoComplete="one-time-code"
            maxLength={12}
          />
          {/* Dynamic SVG Countdown Ring inside Input */}
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <div className="relative w-5 h-5 flex items-center justify-center">
              <svg className="w-5 h-5 -rotate-90 transform" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-slate-800"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray={56.55}
                  strokeDashoffset={56.55 * (1 - secondsRemaining / 30)}
                  strokeLinecap="round"
                  className={`transition-all duration-300 ${ringColor}`}
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-slate-400">
          <span>
            Code refreshes in <strong className={`font-bold ${ringColor}`}>{secondsRemaining}s</strong> — check your authenticator app
          </span>
        </div>
      </div>

      <div className="pt-2 flex flex-col gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 px-4 bg-blue-500 hover:bg-blue-400 text-white rounded-lg font-bold text-xs tracking-wider uppercase font-mono shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Validating Code...</span>
            </>
          ) : (
            <>
              <span>Verify & Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Credentials</span>
        </button>
      </div>
    </form>
  );
}
