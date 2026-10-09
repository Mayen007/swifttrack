import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Truck,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Building2,
  Smartphone,
  Key
} from 'lucide-react';
import { LoginFormCredentials } from '../components/auth/LoginFormCredentials.jsx';
import { LoginForm2FA } from '../components/auth/LoginForm2FA.jsx';
import { LoginFormForgot } from '../components/auth/LoginFormForgot.jsx';
import { LoginDemoPersonas } from '../components/auth/LoginDemoPersonas.jsx';

export function LoginView() {
  const { login, verify2FA, forgotPassword, resetPassword, quickSwitch, demoMode, isSwitching } = useAuth();

  const [viewStep, setViewStep] = useState('CREDENTIALS');

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

  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorUsername, setTwoFactorUsername] = useState('');

  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState('REQUEST');
  const [devResetToken, setDevResetToken] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');

  const passwordRules = [
    { label: 'Minimum 10 characters', test: (p) => p.length >= 10 },
    { label: 'Uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
    { label: 'Lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
    { label: 'Numeric digit (0-9)', test: (p) => /[0-9]/.test(p) },
    { label: 'Special character (!@#$%^&*)', test: (p) => /[^A-Za-z0-9]/.test(p) },
  ];

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

  const handleForgotReset = async (e) => {
    if (e) e.preventDefault();
    if (!forgotToken.trim()) {
      setError('Please enter your 32-character recovery token.');
      return;
    }
    if (!forgotNewPassword) {
      setError('Please provide a new security password.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    const failedRules = passwordRules.filter((r) => !r.test(forgotNewPassword));
    if (failedRules.length > 0) {
      setError(`Password policy requirement: ${failedRules[0].label}`);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await resetPassword(forgotToken.trim(), forgotNewPassword);
      setForgotSuccessMsg('Password successfully changed. You can now authenticate with your new credentials.');
      setViewStep('CREDENTIALS');
      setPassword(forgotNewPassword);
      setForgotStep('REQUEST');
      setForgotToken('');
      setDevResetToken('');
    } catch (err) {
      setError(err.message || 'Failed to reset password. The recovery token may have expired or is invalid.');
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
    { label: 'Counter Cashier', username: 'cashier.nairobi', role: 'CASHIER', branch: 'Nairobi Station Hub', branchId: 1, color: 'text-emerald-400' },
    { label: 'Delivery Driver', username: 'driver.nairobi', role: 'DRIVER', branch: 'Nairobi Fleet', branchId: 1, color: 'text-sky-400' },
    { label: 'Mombasa Manager', username: 'manager.mombasa', role: 'BRANCH_MANAGER', branch: 'Coast Port', branchId: 2, color: 'text-cyan-400' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
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
          <span className="hidden sm:inline text-[11px] text-slate-400">ENTERPRISE PORTAL</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md space-y-6">
          <div className="bg-[#111622] border border-[#202738] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-500 opacity-80" />

            {viewStep === 'CREDENTIALS' && (
              <div className="space-y-1.5 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase">
                    OPERATOR AUTHENTICATION
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 border border-[#222834] px-1.5 py-0.5 rounded bg-[#161c28]">
                    {demoMode ? 'DEMO ACCESS' : 'SECURE PRODUCTION'}
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
                    AUTHENTICATOR APP
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

            {forgotSuccessMsg && (
              <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-normal font-medium">{forgotSuccessMsg}</div>
              </div>
            )}

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

            {viewStep === 'CREDENTIALS' && (
              <LoginFormCredentials
                username={username}
                setUsername={setUsername}
                password={password}
                setPassword={setPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                rememberMe={rememberMe}
                setRememberMe={setRememberMe}
                submitting={submitting}
                isSwitching={isSwitching}
                onForgotPassword={() => {
                  setError(null);
                  setForgotIdentifier(username);
                  setViewStep('FORGOT');
                }}
                onSubmit={handleCredentialsSubmit}
              />
            )}

            {viewStep === '2FA' && (
              <LoginForm2FA
                twoFactorCode={twoFactorCode}
                setTwoFactorCode={setTwoFactorCode}
                submitting={submitting}
                onBack={() => {
                  setViewStep('CREDENTIALS');
                  setError(null);
                }}
                onSubmit={handleTwoFactorSubmit}
              />
            )}

            {viewStep === 'FORGOT' && (
              <LoginFormForgot
                forgotStep={forgotStep}
                setForgotStep={setForgotStep}
                forgotIdentifier={forgotIdentifier}
                setForgotIdentifier={setForgotIdentifier}
                forgotToken={forgotToken}
                setForgotToken={setForgotToken}
                forgotNewPassword={forgotNewPassword}
                setForgotNewPassword={setForgotNewPassword}
                forgotConfirmPassword={forgotConfirmPassword}
                setForgotConfirmPassword={setForgotConfirmPassword}
                showForgotNewPassword={showForgotNewPassword}
                setShowForgotNewPassword={setShowForgotNewPassword}
                devResetToken={devResetToken}
                copiedToken={copiedToken}
                setCopiedToken={setCopiedToken}
                submitting={submitting}
                passwordRules={passwordRules}
                onRequest={handleForgotRequest}
                onReset={handleForgotReset}
                onCancel={() => {
                  setViewStep('CREDENTIALS');
                  setError(null);
                  setForgotSuccessMsg('');
                }}
              />
            )}

            {demoMode && (
              <LoginDemoPersonas
                demoPersonas={demoPersonas}
                onSelectPersona={handleSelectDemoPersona}
              />
            )}
          </div>

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
                <div className="text-[10px] font-bold font-mono text-slate-300">Multi-Hub Network</div>
                <div className="text-[8px] font-mono text-slate-500">Regional Distribution</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="h-10 border-t border-[#181f2c] px-4 sm:px-8 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-[#0c101b]">
        <span>© 2026 SwiftTrack Kenya Logistics Ltd</span>
        <span className="hidden sm:inline">Enterprise Logistics, Parcel & Courier Platform • 2FA Protected</span>
      </footer>
    </div>
  );
}
