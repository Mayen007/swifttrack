import React from 'react';
import { User, Lock, Eye, EyeOff, KeyRound, ArrowRight } from 'lucide-react';

export function LoginFormCredentials({
  username,
  setUsername,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  rememberMe,
  setRememberMe,
  submitting,
  isSwitching,
  onForgotPassword,
  onSubmit
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
          Operator Username / ID
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <User className="w-4 h-4" />
          </div>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. superadmin or cashier.nairobi"
            className="w-full pl-9 pr-3 py-2.5 bg-[#161c28] border border-[#252f44] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg text-xs text-white placeholder-slate-500 font-mono transition-colors outline-none"
            autoComplete="username"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
            Security Password
          </label>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[11px] font-mono text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full pl-9 pr-10 py-2.5 bg-[#161c28] border border-[#252f44] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg text-xs text-white placeholder-slate-500 font-mono transition-colors outline-none"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-300">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-3.5 h-3.5 rounded bg-[#161c28] border-[#252f44] text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-[11px] font-mono">Remember operator identity</span>
        </label>
        <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
          <KeyRound className="w-3 h-3" />
          <span>JWT Rotation</span>
        </span>
      </div>

      <button
        type="submit"
        disabled={submitting || isSwitching}
        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold text-xs tracking-wider uppercase font-mono shadow-lg shadow-amber-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {submitting || isSwitching ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            <span>Verifying Credentials...</span>
          </>
        ) : (
          <>
            <span>Authenticate & Enter Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
