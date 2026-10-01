import React from 'react';
import { User, ArrowRight, ArrowLeft, Copy, Check, Eye, EyeOff } from 'lucide-react';

export function LoginFormForgot({
  forgotStep,
  setForgotStep,
  forgotIdentifier,
  setForgotIdentifier,
  forgotToken,
  setForgotToken,
  forgotNewPassword,
  setForgotNewPassword,
  forgotConfirmPassword,
  setForgotConfirmPassword,
  showForgotNewPassword,
  setShowForgotNewPassword,
  devResetToken,
  copiedToken,
  setCopiedToken,
  submitting,
  passwordRules,
  onRequest,
  onReset,
  onCancel
}) {
  return (
    <div className="space-y-4">
      {forgotStep === 'REQUEST' && (
        <form onSubmit={onRequest} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
              Operator Username or Work Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={forgotIdentifier}
                onChange={(e) => setForgotIdentifier(e.target.value)}
                placeholder="e.g. superadmin or staff@swifttrack.co.ke"
                className="w-full pl-9 pr-3 py-2.5 bg-[#161c28] border border-[#252f44] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg text-xs text-white placeholder-slate-500 font-mono transition-colors outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold text-xs tracking-wider uppercase font-mono transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Issuing Token...</span>
                </>
              ) : (
                <>
                  <span>Generate Recovery Token</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setForgotStep('SUBMIT')}
                className="text-[11px] font-mono text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                Already have a recovery token?
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {forgotStep === 'SUBMIT' && (
        <form onSubmit={onReset} className="space-y-4">
          {devResetToken && (
            <div className="p-2.5 rounded-lg bg-[#161c28] border border-amber-500/30 text-xs">
              <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 font-bold mb-1">
                <span>SANDBOX RECOVERY TOKEN</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(devResetToken);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                >
                  {copiedToken ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono text-[10px] text-slate-300 break-all select-all bg-[#0e1320] p-1.5 rounded border border-[#222834]">
                {devResetToken}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
              32-Character Recovery Token
            </label>
            <input
              type="text"
              required
              value={forgotToken}
              onChange={(e) => setForgotToken(e.target.value)}
              placeholder="Paste reset token here..."
              className="w-full px-3 py-2 bg-[#161c28] border border-[#252f44] focus:border-amber-400 rounded-lg text-xs text-white placeholder-slate-500 font-mono transition-colors outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
              New Security Password
            </label>
            <div className="relative">
              <input
                type={showForgotNewPassword ? 'text' : 'password'}
                required
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 pr-10 py-2 bg-[#161c28] border border-[#252f44] focus:border-amber-400 rounded-lg text-xs text-white placeholder-slate-500 font-mono transition-colors outline-none"
              />
              <button
                type="button"
                onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={forgotConfirmPassword}
              onChange={(e) => setForgotConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 bg-[#161c28] border border-[#252f44] focus:border-amber-400 rounded-lg text-xs text-white placeholder-slate-500 font-mono transition-colors outline-none"
            />
          </div>

          <div className="p-2.5 rounded-lg bg-[#0e1320] border border-[#222834] space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1">
              Strong Password Standards
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] font-mono">
              {passwordRules.map((rule, idx) => {
                const met = rule.test(forgotNewPassword);
                return (
                  <div key={idx} className={`flex items-center gap-1.5 ${met ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${met ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    <span>{rule.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs tracking-wider uppercase font-mono transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating Security Password...</span>
                </>
              ) : (
                <>
                  <span>Set Password & Return to Login</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setForgotStep('REQUEST')}
              className="w-full py-1 text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Request Token</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
