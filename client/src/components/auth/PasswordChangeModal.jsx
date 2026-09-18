// client/src/components/auth/PasswordChangeModal.jsx
// Dieter Rams Functionalist Password Security Modal with Real-time Strength Meter
import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Lock,
  Key,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export function PasswordChangeModal({ isOpen, onClose, isMandatory = false }) {
  const { changePassword, user, config } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const minLength = config?.passwordMinLength || 10;

  // Real-time strength checks
  const checks = useMemo(() => {
    return [
      { label: `At least ${minLength} characters`, passed: newPassword.length >= minLength },
      { label: 'One uppercase letter (A-Z)', passed: /[A-Z]/.test(newPassword) },
      { label: 'One lowercase letter (a-z)', passed: /[a-z]/.test(newPassword) },
      { label: 'One numerical digit (0-9)', passed: /[0-9]/.test(newPassword) },
      { label: 'One special symbol (!@#$%^&*)', passed: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?~`]/.test(newPassword) },
      { label: 'Passwords match', passed: newPassword.length > 0 && newPassword === confirmPassword },
    ];
  }, [newPassword, confirmPassword, minLength]);

  const passedCount = checks.filter(c => c.passed).length;
  const isAllValid = checks.every(c => c.passed);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isAllValid) {
      setError('Please satisfy all password security requirements before saving.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from your current temporary password.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Failed to change password. Please verify current password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#111622] border border-[#222a3b] rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5">
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-500" />

        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
                {isMandatory ? 'MANDATORY PASSWORD UPDATE' : 'UPDATE SECURITY PASSWORD'}
              </span>
            </div>
            {!isMandatory && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                aria-label="Close dialog"
              >
                ✕
              </button>
            )}
          </div>

          <h2 className="text-lg font-bold text-white tracking-tight">
            {isMandatory ? 'Establish Your Secure Password' : 'Change Operator Password'}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isMandatory
              ? 'You are signed in with a temporary or first-login password. For company security compliance, establish a unique password to proceed.'
              : 'Choose a strong password meeting SwiftTrack enterprise security criteria.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
              Current / Temporary Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full pl-9 pr-10 py-2 bg-[#161c28] border border-[#252f44] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg text-xs text-white placeholder-slate-500 font-mono transition-colors outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
              New Security Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter strong password"
                className="w-full pl-9 pr-10 py-2 bg-[#161c28] border border-[#252f44] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg text-xs text-white placeholder-slate-500 font-mono transition-colors outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-mono font-medium text-slate-300 uppercase tracking-wider">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full pl-9 pr-10 py-2 bg-[#161c28] border border-[#252f44] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg text-xs text-white placeholder-slate-500 font-mono transition-colors outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password Strength Checklist */}
          <div className="p-3 rounded-lg bg-[#141a27] border border-[#222a3b] space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="uppercase font-bold tracking-wider">Security Requirements</span>
              <span className={`font-bold ${isAllValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                {passedCount} / {checks.length} Met
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {checks.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono">
                  {c.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  )}
                  <span className={c.passed ? 'text-slate-200' : 'text-slate-500'}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !isAllValid}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 rounded-lg font-bold text-xs tracking-wider uppercase font-mono shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <span>Commit New Password</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
