// client/src/components/auth/SecuritySettingsModal.jsx
// Enterprise Account Security Center: Password, 2FA Setup, Active Sessions, and Login History
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  ShieldCheck,
  Key,
  Smartphone,
  Laptop,
  History,
  X,
  Lock,
  CheckCircle2,
  AlertCircle,
  Copy,
  RotateCcw,
  Trash2,
  LogOut,
  QrCode
} from 'lucide-react';

export function SecuritySettingsModal({ isOpen, onClose }) {
  const {
    user,
    changePassword,
    setup2FA,
    enable2FA,
    disable2FA,
    regenerateRecoveryCodes,
    getSessions,
    terminateSession,
    terminateOtherSessions,
    getLoginHistory,
    config
  } = useAuth();

  const [activeTab, setActiveTab] = useState('password'); // 'password', '2fa', 'sessions', 'history'

  // Password tab state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);

  // 2FA tab state
  const [setupData, setSetupData] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState(null);
  const [disablePassword, setDisablePassword] = useState('');

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch data when switching tabs
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === 'sessions') {
      setSessionsLoading(true);
      getSessions()
        .then(setSessions)
        .catch(console.error)
        .finally(() => setSessionsLoading(false));
    } else if (activeTab === 'history') {
      setHistoryLoading(true);
      getLoginHistory()
        .then(setHistory)
        .catch(console.error)
        .finally(() => setHistoryLoading(false));
    }
  }, [activeTab, isOpen, getSessions, getLoginHistory]);

  if (!isOpen) return null;

  // Handle password change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    setPwdSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setPwdMsg({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.message });
    } finally {
      setPwdSubmitting(false);
    }
  };

  // Handle 2FA setup trigger
  const handleStartSetup2FA = async () => {
    setTwoFaLoading(true);
    setTwoFaMsg(null);
    try {
      const data = await setup2FA();
      setSetupData(data);
    } catch (err) {
      setTwoFaMsg({ type: 'error', text: err.message });
    } finally {
      setTwoFaLoading(false);
    }
  };

  // Handle 2FA enable submit
  const handleEnable2FA = async (e) => {
    e.preventDefault();
    setTwoFaLoading(true);
    setTwoFaMsg(null);
    try {
      await enable2FA(setupData.secret, totpCode, setupData.hashedRecoveryCodes);
      setTwoFaMsg({ type: 'success', text: 'Two-factor authentication is now active!' });
      setSetupData(null);
      setTotpCode('');
    } catch (err) {
      setTwoFaMsg({ type: 'error', text: err.message });
    } finally {
      setTwoFaLoading(false);
    }
  };

  // Handle 2FA disable
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setTwoFaLoading(true);
    setTwoFaMsg(null);
    try {
      await disable2FA(disablePassword);
      setTwoFaMsg({ type: 'success', text: 'Two-factor authentication has been disabled.' });
      setDisablePassword('');
    } catch (err) {
      setTwoFaMsg({ type: 'error', text: err.message });
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#111622] border border-[#222a3b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Accent Line */}
        <div className="h-1 bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-500 shrink-0" />

        {/* Modal Header */}
        <div className="p-5 border-b border-[#1c2436] flex items-center justify-between shrink-0 bg-[#0d121c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Security & Sessions Center</h2>
              <p className="text-xs text-slate-400">Manage credentials, device sessions, and two-factor authentication.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#1c2436] bg-[#0f1420] px-4 shrink-0 overflow-x-auto">
          {[
            { id: 'password', label: 'Password', icon: Key },
            { id: '2fa', label: 'Two-Factor Auth', icon: Smartphone, badge: user?.twoFactorEnabled ? 'ON' : 'OFF' },
            { id: 'sessions', label: 'Active Sessions', icon: Laptop },
            { id: 'history', label: 'Login History', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 text-xs font-mono font-medium border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-amber-400 text-amber-300 font-bold bg-[#141a27]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      tab.badge === 'ON' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Change Security Password</h3>
                <p className="text-xs text-slate-400">Enter your current password followed by a compliant new password.</p>
              </div>

              {pwdMsg && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                    pwdMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {pwdMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{pwdMsg.text}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono text-slate-300 uppercase">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-[#161c28] border border-[#252f44] focus:border-amber-400 rounded-lg text-xs text-white outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono text-slate-300 uppercase">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 10 characters, 1 uppercase, 1 symbol"
                  className="w-full px-3 py-2 bg-[#161c28] border border-[#252f44] focus:border-amber-400 rounded-lg text-xs text-white outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono text-slate-300 uppercase">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 bg-[#161c28] border border-[#252f44] focus:border-amber-400 rounded-lg text-xs text-white outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={pwdSubmitting || !currentPassword || !newPassword}
                className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg uppercase font-mono cursor-pointer transition-all"
              >
                {pwdSubmitting ? 'Updating...' : 'Save New Password'}
              </button>
            </form>
          )}

          {/* TAB 2: TWO-FACTOR AUTHENTICATION */}
          {activeTab === '2fa' && (
            <div className="space-y-5 max-w-lg">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Two-Factor Authentication (TOTP)</h3>
                <p className="text-xs text-slate-400">
                  Protect your operator account with an extra layer of security using Google Authenticator, Authy, or 1Password.
                </p>
              </div>

              {twoFaMsg && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                    twoFaMsg.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {twoFaMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{twoFaMsg.text}</span>
                </div>
              )}

              {user?.twoFactorEnabled ? (
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>2FA IS ACTIVE ON THIS ACCOUNT</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    You will be prompted for a 6-digit verification code whenever logging into SwiftTrack terminal stations.
                  </p>

                  <form onSubmit={handleDisable2FA} className="pt-2 border-t border-[#222a3b] space-y-3">
                    <span className="text-[11px] font-mono text-slate-400 uppercase block font-semibold">Disable Two-Factor Auth</span>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        required
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Enter account password to confirm"
                        className="flex-1 px-3 py-1.5 bg-[#161c28] border border-[#252f44] focus:border-rose-400 rounded-lg text-xs text-white outline-none font-mono"
                      />
                      <button
                        type="submit"
                        disabled={twoFaLoading || !disablePassword}
                        className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-mono text-xs font-bold rounded-lg cursor-pointer transition-all disabled:opacity-40"
                      >
                        {twoFaLoading ? 'Disabling...' : 'Disable 2FA'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : setupData ? (
                <div className="space-y-4 p-4 rounded-xl bg-[#141a27] border border-[#222a3b]">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-amber-400 font-mono uppercase">Step 1: Scan / Enter Secret</h4>
                    <p className="text-xs text-slate-300">
                      Add this secret key to your authenticator app (Google Authenticator, Authy):
                    </p>
                  </div>

                  <div className="p-3 bg-[#0d111a] border border-[#1f2637] rounded-lg flex items-center justify-between font-mono text-xs text-amber-300">
                    <span className="select-all tracking-wider font-bold">{setupData.secret}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(setupData.secret)}
                      className="p-1 hover:text-white cursor-pointer"
                      title="Copy secret"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Backup Recovery Codes */}
                  <div className="space-y-1.5 pt-2">
                    <h4 className="text-xs font-bold text-white font-mono uppercase">Step 2: Save Recovery Codes</h4>
                    <p className="text-[11px] text-slate-400">
                      Save these single-use codes in a safe place. If you lose access to your authenticator device, you can use these to sign in:
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 p-2 bg-[#0d111a] border border-[#1f2637] rounded-lg font-mono text-[10px] text-slate-300">
                      {setupData.recoveryCodes.map((code, idx) => (
                        <span key={idx} className="select-all">{code}</span>
                      ))}
                    </div>
                  </div>

                  {/* Verification Form */}
                  <form onSubmit={handleEnable2FA} className="space-y-3 pt-2 border-t border-[#1f2637]">
                    <h4 className="text-xs font-bold text-white font-mono uppercase">Step 3: Confirm 6-Digit Code</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-36 px-3 py-2 bg-[#161c28] border border-[#252f44] focus:border-amber-400 rounded-lg text-center font-mono font-bold text-sm tracking-widest text-white outline-none"
                      />
                      <button
                        type="submit"
                        disabled={twoFaLoading || totpCode.length !== 6}
                        className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg uppercase font-mono cursor-pointer transition-all"
                      >
                        {twoFaLoading ? 'Verifying...' : 'Activate 2FA'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#141a27] border border-[#222a3b] space-y-3">
                  <div className="flex items-center gap-2 text-slate-300 text-xs font-mono">
                    <Smartphone className="w-4 h-4 text-amber-400" />
                    <span>Two-Factor Authentication is currently not enabled.</span>
                  </div>
                  <button
                    onClick={handleStartSetup2FA}
                    disabled={twoFaLoading}
                    className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg uppercase font-mono cursor-pointer transition-all"
                  >
                    {twoFaLoading ? 'Generating Secret...' : 'Set Up Two-Factor Auth'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVE SESSIONS */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Active Device Sessions</h3>
                  <p className="text-xs text-slate-400">Sessions authorized to interact with the SwiftTrack terminal.</p>
                </div>
                {sessions.length > 1 && (
                  <button
                    onClick={async () => {
                      await terminateOtherSessions();
                      const updated = await getSessions();
                      setSessions(updated);
                    }}
                    className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Terminate Other Sessions</span>
                  </button>
                )}
              </div>

              {sessionsLoading ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">Loading active sessions...</div>
              ) : sessions.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">No other active sessions found.</div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl bg-[#141a27] border border-[#222a3b] flex items-center justify-between"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-white truncate max-w-xs">
                            {s.user_agent}
                          </span>
                          {s.isCurrent && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                              CURRENT DEVICE
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-3">
                          <span>IP: {s.ip_address}</span>
                          <span>•</span>
                          <span>Last Active: {new Date(s.last_activity_at).toLocaleString()}</span>
                        </div>
                      </div>

                      {!s.isCurrent && (
                        <button
                          onClick={async () => {
                            await terminateSession(s.id);
                            setSessions(sessions.filter(item => item.id !== s.id));
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                          title="Terminate session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LOGIN HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Recent Authentication History</h3>
                <p className="text-xs text-slate-400">Audit log of your recent login attempts across all devices.</p>
              </div>

              {historyLoading ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">Loading audit history...</div>
              ) : history.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-slate-400">No login records found.</div>
              ) : (
                <div className="border border-[#1f2637] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#0e131d] text-[10px] text-slate-400 uppercase tracking-wider border-b border-[#1f2637]">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">IP Address</th>
                        <th className="py-2.5 px-3">Client Device</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#18202d] text-slate-300">
                      {history.map((row) => {
                        const isSuccess = row.status === 'SUCCESS';
                        return (
                          <tr key={row.id} className="hover:bg-[#151c2a]">
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">
                              {new Date(row.created_at).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isSuccess
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">{row.ip_address}</td>
                            <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs">{row.user_agent}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
