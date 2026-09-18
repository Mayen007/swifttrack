// client/src/views/LoginView.jsx
// Dieter Rams Functionalist Production Login Interface with 2FA & Password Recovery
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Truck,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Radio,
  CheckCircle2,
  Building2,
  KeyRound,
  Key,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  Smartphone
} from 'lucide-react';

export function LoginView() {
  const { login, verify2FA, forgotPassword, resetPassword, quickSwitch, demoMode, isSwitching } = useAuth();

  // Mode / Step: 'CREDENTIALS' | '2FA' | 'FORGOT'
  const [viewStep, setViewStep] = useState('CREDENTIALS');

  // Credentials State
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('swifttrack_remember_user') || 'superadmin';
    } catch {
      return 'superadmin';
    }
  });
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 2FA Challenge State
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorUsername, setTwoFactorUsername] = useState('');

  // Forgot Password State
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState('REQUEST'); // 'REQUEST' | 'SUBMIT'
  const [devResetToken, setDevResetToken] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');

  // --- Password Strength Rules for Reset Form ---
  const passwordRules = [
    { label: 'Minimum 10 characters', test: (p) => p.length >= 10 },
    { label: 'Uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
    { label: 'Lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
    { label: 'Numeric digit (0-9)', test: (p) => /[0-9]/.test(p) },
    { label: 'Special character (!@#$%^&*)', test: (p) => /[^A-Za-z0-9]/.test(p) },
  ];

  // 1. Submit Credentials
  const handleCredentialsSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both your staff username and security password.');
      return;
    }

    setError(null);
    setIsLocked(false);
    setSubmitting(true);

    try {
      const res = await login(username.trim(), password, rememberMe);

      // Handle 2FA Challenge
      if (res && res.require2FA) {
        setTwoFactorToken(res.tempToken);
        setTwoFactorUsername(res.username || username.trim());
        setTwoFactorCode('');
        setViewStep('2FA');
        setError(null);
      }
    } catch (err) {
      const msg = err.message || 'Invalid credentials or account locked.';
      setError(msg);
      if (err.status === 423 || msg.toLowerCase().includes('locked')) {
        setIsLocked(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Submit 2FA Code
  const handleTwoFactorSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!twoFactorCode.trim()) {
      setError('Please enter your 6-digit authenticator code or 8-character recovery code.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await verify2FA(twoFactorToken, twoFactorCode.trim(), twoFactorUsername, rememberMe);
    } catch (err) {
      setError(err.message || 'Verification code failed or expired. Please check and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Request Password Reset Token
  const handleForgotRequest = async (e) => {
    if (e) e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setError('Please enter your operator username or work email.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await forgotPassword(forgotIdentifier.trim());
      if (res.resetToken) {
        setDevResetToken(res.resetToken);
        setForgotToken(res.resetToken);
      }
      setForgotStep('SUBMIT');
      setForgotSuccessMsg('If an active account was found, a security reset token has been issued.');
    } catch (err) {
      setError(err.message || 'Failed to request password reset instructions.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Submit Reset with Token & New Password
  const handleForgotReset = async (e) => {
    if (e) e.preventDefault();
    if (!forgotToken.trim()) {
      setError('Reset token is required.');
      return;
    }
    if (!forgotNewPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const failedRule = passwordRules.find((r) => !r.test(forgotNewPassword));
    if (failedRule) {
      setError(`Password policy requirement: ${failedRule.label}`);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await resetPassword(forgotToken.trim(), forgotNewPassword, forgotConfirmPassword);
      setForgotSuccessMsg('Password reset successfully. You may now sign in with your new credentials.');
      setUsername(forgotIdentifier.trim() || username);
      setPassword(forgotNewPassword);
      setViewStep('CREDENTIALS');
      setForgotStep('REQUEST');
      setForgotToken('');
      setDevResetToken('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to reset password. The token may be expired or invalid.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectDemoPersona = async (personaUsername, personaRole, branchId) => {
    setUsername(personaUsername);
    setPassword('Password123!');
    setError(null);
    setIsLocked(false);
    setViewStep('CREDENTIALS');

    // If quickSwitch is available in demo mode, invoke it directly
    if (demoMode) {
      try {
        await quickSwitch(personaRole, branchId);
      } catch (err) {
        setError(err.message || 'Could not switch to demo persona.');
      }
    }
  };

  const demoPersonas = [
    { label: 'Super Admin', username: 'superadmin', role: 'SUPER_ADMIN', branch: 'Global HQ', branchId: null, color: 'text-amber-400' },
    { label: 'Branch Manager', username: 'manager.nairobi', role: 'BRANCH_MANAGER', branch: 'Nairobi Hub', branchId: 1, color: 'text-blue-400' },
    { label: 'Dispatcher', username: 'dispatcher.nairobi', role: 'DISPATCHER', branch: 'Nairobi Logistics', branchId: 1, color: 'text-indigo-400' },
    { label: 'POS Cashier', username: 'cashier.nairobi', role: 'CASHIER', branch: 'Nairobi Retail', branchId: 1, color: 'text-emerald-400' },
    { label: 'Delivery Driver', username: 'driver.nairobi', role: 'DRIVER', branch: 'Nairobi Fleet', branchId: 1, color: 'text-purple-400' },
    { label: 'Mombasa Manager', username: 'manager.mombasa', role: 'BRANCH_MANAGER', branch: 'Coast Port', branchId: 2, color: 'text-cyan-400' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Top Functional Header */}
      <header className="h-14 border-b border-[#1b2230] px-4 sm:px-8 flex items-center justify-between bg-[#0e1320]/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#161c28] border border-[#273347] flex items-center justify-center text-amber-400 font-mono font-bold text-xs">
            <Truck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-bold tracking-tight text-white uppercase font-sans">SwiftTrack</span>
            <span className="text-[9px] font-mono font-semibold tracking-widest text-slate-400 border border-[#222834] px-1 py-0.2 rounded bg-[#12161f]">
              KE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>SYSTEM ONLINE</span>
          </div>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline text-[11px] text-slate-500">v1.0.0 Enterprise</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md space-y-6">
          {/* Card Container */}
          <div className="bg-[#111622] border border-[#202738] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-500 opacity-80" />

            {/* Header / Mode Indicator */}
            {viewStep === 'CREDENTIALS' && (
              <div className="space-y-1.5 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase">
                    OPERATOR AUTHENTICATION
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#161c28]">
                    {demoMode ? 'SANDBOX / EVALUATION' : 'PRODUCTION'}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Sign in to SwiftTrack
                </h1>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter your terminal operator credentials to access branch inventory, POS checkout, and dispatch telemetry.
                </p>
              </div>
            )}

            {viewStep === '2FA' && (
              <div className="space-y-1.5 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-blue-400 uppercase flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                    TWO-FACTOR VERIFICATION
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#161c28]">
                    RFC 6238 TOTP
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Enter 2FA Security Code
                </h1>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Authentication requires secondary verification. Enter the 6-digit code from your authenticator app or an 8-character recovery code for <span className="text-amber-400 font-mono font-medium">@{twoFactorUsername}</span>.
                </p>
              </div>
            )}

            {viewStep === 'FORGOT' && (
              <div className="space-y-1.5 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    CREDENTIAL RECOVERY
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#161c28]">
                    SELF-SERVICE
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {forgotStep === 'REQUEST' ? 'Reset Operator Password' : 'Set New Security Password'}
                </h1>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {forgotStep === 'REQUEST'
                    ? 'Enter your operator username or work email to generate a time-limited 15-minute recovery token.'
                    : 'Provide the 32-character recovery token and define a strong replacement password.'}
                </p>
              </div>
            )}

            {/* Success Notification Banner */}
            {forgotSuccessMsg && (
              <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-normal font-medium">{forgotSuccessMsg}</div>
              </div>
            )}

            {/* Error / Lockout Banner */}
            {error && (
              <div
                className={`mb-5 p-3 rounded-lg flex items-start gap-2.5 text-xs ${
                  isLocked
                    ? 'bg-amber-500/10 border border-amber-500/40 text-amber-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isLocked ? 'text-amber-400' : 'text-rose-400'}`} />
                <div className="flex-1 leading-normal font-medium">
                  {error}
                  {isLocked && (
                    <div className="mt-1 text-[11px] text-amber-400/90 font-mono">
                      Protection policy: 5 consecutive failures triggers a 15-minute freeze. Contact your Super Admin or Branch Manager if immediate unlock is needed.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* VIEW STEP 1: CREDENTIALS LOGIN                               */}
            {/* ------------------------------------------------------------- */}
            {viewStep === 'CREDENTIALS' && (
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                {/* Username Input */}
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

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
                      Security Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setForgotIdentifier(username);
                        setViewStep('FORGOT');
                      }}
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

                {/* Remember Me Checkbox */}
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

                {/* Submit Button */}
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
            )}

            {/* ------------------------------------------------------------- */}
            {/* VIEW STEP 2: 2FA TOTP CHALLENGE                              */}
            {/* ------------------------------------------------------------- */}
            {viewStep === '2FA' && (
              <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
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
                      className="w-full pl-9 pr-3 py-2.5 bg-[#161c28] border border-[#252f44] focus:border-blue-400 focus:ring-1 focus:ring-blue-400 rounded-lg text-sm text-white placeholder-slate-500 font-mono tracking-widest text-center transition-colors outline-none uppercase"
                      autoComplete="one-time-code"
                      maxLength={12}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-slate-400">
                    Codes refresh every 30 seconds. Time drift tolerance: ±30s.
                  </p>
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
                    onClick={() => {
                      setViewStep('CREDENTIALS');
                      setError(null);
                    }}
                    className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Credentials</span>
                  </button>
                </div>
              </form>
            )}

            {/* ------------------------------------------------------------- */}
            {/* VIEW STEP 3: FORGOT / RESET PASSWORD                         */}
            {/* ------------------------------------------------------------- */}
            {viewStep === 'FORGOT' && (
              <div className="space-y-4">
                {forgotStep === 'REQUEST' && (
                  <form onSubmit={handleForgotRequest} className="space-y-4">
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
                          onClick={() => {
                            setForgotStep('SUBMIT');
                            setError(null);
                          }}
                          className="text-[11px] font-mono text-slate-400 hover:text-amber-300 transition-colors"
                        >
                          Already have a recovery token?
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setViewStep('CREDENTIALS');
                            setError(null);
                            setForgotSuccessMsg('');
                          }}
                          className="text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {forgotStep === 'SUBMIT' && (
                  <form onSubmit={handleForgotReset} className="space-y-4">
                    {/* Dev/Demo Helper Token Display */}
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

                    {/* Reset Token */}
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

                    {/* New Password */}
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
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                        >
                          {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
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

                    {/* Password Policy Checklist */}
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

                    {/* Actions */}
                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-bold text-xs tracking-wider uppercase font-mono transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
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
                        onClick={() => {
                          setForgotStep('REQUEST');
                          setError(null);
                        }}
                        className="w-full py-1 text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center justify-center gap-1.5"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Request Token</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Demo Mode Quick Persona Drawer */}
            {demoMode && (
              <div className="mt-6 pt-5 border-t border-[#1e2536] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>DEMO PERSONA PRE-FILL</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">Click to instantly test</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {demoPersonas.map((p) => (
                    <button
                      key={p.username}
                      type="button"
                      onClick={() => handleSelectDemoPersona(p.username, p.role, p.branchId)}
                      className="p-2 rounded-lg bg-[#141a27] hover:bg-[#1a2233] border border-[#222a3b] hover:border-amber-400/40 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold font-mono ${p.color}`}>{p.label}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono block truncate mt-0.5">{p.branch}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Compliance & Security Footer Badges */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-2.5 rounded-xl bg-[#0e1320] border border-[#1b2232] flex items-center justify-center gap-2 text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-left">
                <div className="text-[10px] font-bold font-mono text-slate-300">KRA eTIMS Validated</div>
                <div className="text-[8px] font-mono text-slate-500">Automated Tax Compliant</div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0e1320] border border-[#1b2232] flex items-center justify-center gap-2 text-slate-400">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-left">
                <div className="text-[10px] font-bold font-mono text-slate-300">Multi-Hub Fleet</div>
                <div className="text-[8px] font-mono text-slate-500">NBO • MBA • KSM</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Industrial Bottom Metadata Bar */}
      <footer className="h-10 border-t border-[#181f2c] px-4 sm:px-8 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-[#0c101b]">
        <span>© 2026 SwiftTrack Kenya Logistics Ltd</span>
        <span className="hidden sm:inline">Enterprise POS & Dispatch System • RFC 6238 TOTP</span>
      </footer>
    </div>
  );
}
