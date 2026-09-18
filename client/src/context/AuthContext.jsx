// client/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [config, setConfig] = useState({
    demoMode: true,
    currency: 'KES',
    etimsEnabled: true,
    passwordMinLength: 10,
    twoFactorAvailable: true,
  });

  // Load available branches
  const loadBranches = useCallback(async () => {
    try {
      const data = await api.get('/api/branches');
      if (Array.isArray(data)) {
        setBranches(data);
        return data;
      }
    } catch (e) {
      console.error('Failed to load branches:', e);
    }
    return [];
  }, []);

  const handleAuthSuccess = useCallback(async (res, username, rememberMe) => {
    if (res.token) {
      api.setToken(res.token);
      if (res.refreshToken) {
        api.setRefreshToken(res.refreshToken);
      }

      if (rememberMe && username) {
        localStorage.setItem('swifttrack_remember_user', username);
      } else if (!rememberMe) {
        localStorage.removeItem('swifttrack_remember_user');
      }

      const normUser = {
        ...res.user,
        role: res.user.roleName || res.user.role,
        full_name: res.user.fullName || res.user.full_name,
        branch_id: res.user.branchId ?? res.user.branch_id,
        mustChangePassword: Boolean(res.user.mustChangePassword),
        twoFactorEnabled: Boolean(res.user.twoFactorEnabled),
      };

      setUser(normUser);
      setMustChangePassword(Boolean(normUser.mustChangePassword));

      const bList = await loadBranches();
      if (normUser.branch_id) {
        const b = bList.find(item => item.id === normUser.branch_id);
        setSelectedBranch(b || null);
        if (b) localStorage.setItem('swifttrack_selected_branch_id', String(b.id));
      } else {
        const savedBranchId = localStorage.getItem('swifttrack_selected_branch_id');
        if (savedBranchId === 'all') {
          setSelectedBranch(null);
        } else if (savedBranchId) {
          const b = bList.find(item => String(item.id) === savedBranchId);
          setSelectedBranch(b || null);
        } else {
          setSelectedBranch(null);
        }
      }

      api.toast(`Welcome back, ${normUser.full_name}`, 'success');
      return normUser;
    }
  }, [loadBranches]);

  // Standard Credential Login
  const login = useCallback(async (username, password, rememberMe = false) => {
    setIsSwitching(true);
    try {
      const res = await api.post('/api/auth/login', { username, password });

      // If 2FA challenge triggered, pass result to view
      if (res && res.require2FA) {
        return res;
      }

      if (res && res.token) {
        return await handleAuthSuccess(res, username, rememberMe);
      }

      throw new Error(res?.error || 'Authentication failed');
    } finally {
      setIsSwitching(false);
    }
  }, [handleAuthSuccess]);

  // Complete 2FA Verification
  const verify2FA = useCallback(async (tempToken, code, username = '', rememberMe = false) => {
    setIsSwitching(true);
    try {
      const res = await api.post('/api/auth/2fa/verify', { tempToken, code });
      if (res && res.token) {
        return await handleAuthSuccess(res, username, rememberMe);
      }
      throw new Error(res?.error || 'Two-factor verification failed');
    } finally {
      setIsSwitching(false);
    }
  }, [handleAuthSuccess]);

  // Clean Logout
  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {}
    api.clearAuth();
    localStorage.removeItem('swifttrack_selected_branch_id');
    setUser(null);
    setSelectedBranch(null);
    setMustChangePassword(false);
    api.toast('Signed out successfully', 'info');
  }, []);

  // Password Change
  const changePassword = useCallback(async (current_password, new_password, confirm_password) => {
    const res = await api.post('/api/auth/change-password', {
      current_password,
      new_password,
      confirm_password,
    });

    if (res && res.token) {
      api.setToken(res.token);
      if (res.refreshToken) {
        api.setRefreshToken(res.refreshToken);
      }
      setMustChangePassword(false);
      setUser(prev => prev ? { ...prev, mustChangePassword: false } : null);
      api.toast('Password updated successfully', 'success');
      return res;
    }
    throw new Error(res?.error || 'Failed to update password');
  }, []);

  // Self-Service Forgot Password Request
  const forgotPassword = useCallback(async (identifier) => {
    return await api.post('/api/auth/forgot-password', { identifier });
  }, []);

  // Self-Service Reset Password Submission
  const resetPassword = useCallback(async (token, new_password, confirm_password) => {
    return await api.post('/api/auth/reset-password', { token, new_password, confirm_password });
  }, []);

  // 2FA Setup
  const setup2FA = useCallback(async () => {
    return await api.post('/api/auth/2fa/setup');
  }, []);

  // 2FA Enable
  const enable2FA = useCallback(async (secret, code, hashedRecoveryCodes) => {
    const res = await api.post('/api/auth/2fa/enable', { secret, code, hashedRecoveryCodes });
    setUser(prev => prev ? { ...prev, twoFactorEnabled: true } : null);
    api.toast('Two-factor authentication enabled', 'success');
    return res;
  }, []);

  // 2FA Disable
  const disable2FA = useCallback(async (password, code) => {
    const res = await api.post('/api/auth/2fa/disable', { password, code });
    setUser(prev => prev ? { ...prev, twoFactorEnabled: false } : null);
    api.toast('Two-factor authentication disabled', 'info');
    return res;
  }, []);

  // Regenerate Recovery Codes
  const regenerateRecoveryCodes = useCallback(async (password) => {
    return await api.post('/api/auth/2fa/recovery-codes', { password });
  }, []);

  // Session Management
  const getSessions = useCallback(async () => {
    return await api.get('/api/auth/sessions');
  }, []);

  const terminateSession = useCallback(async (sessionId) => {
    const res = await api.delete(`/api/auth/sessions/${sessionId}`);
    api.toast('Session terminated', 'info');
    return res;
  }, []);

  const terminateOtherSessions = useCallback(async () => {
    const res = await api.delete('/api/auth/sessions');
    api.toast('All other sessions terminated', 'info');
    return res;
  }, []);

  // Login History
  const getLoginHistory = useCallback(async () => {
    return await api.get('/api/auth/login-history');
  }, []);

  // Quick switch role (demo/evaluation environments)
  const quickSwitch = useCallback(async (role, branchId = null) => {
    try {
      setIsSwitching(true);

      let targetRole = role;
      if (role === 'BRANCH_MANAGER' && branchId === 2) {
        targetRole = 'BRANCH_MANAGER_MOMBASA';
      }

      let res = null;
      try {
        res = await api.post('/api/auth/demo-switch', { role: targetRole, branch_id: branchId });
      } catch (e) {
        console.warn('demo-switch endpoint failed or disabled:', e.message);
      }

      if (!res || !res.token) {
        const roleCredentials = {
          SUPER_ADMIN: { username: 'superadmin', password: 'Password123!' },
          BRANCH_MANAGER: { username: branchId === 2 ? 'manager.mombasa' : branchId === 3 ? 'manager.kisumu' : 'manager.nairobi', password: 'Password123!' },
          BRANCH_MANAGER_NAIROBI: { username: 'manager.nairobi', password: 'Password123!' },
          BRANCH_MANAGER_MOMBASA: { username: 'manager.mombasa', password: 'Password123!' },
          DISPATCHER: { username: 'dispatcher.nairobi', password: 'Password123!' },
          CASHIER: { username: branchId === 2 ? 'cashier.mombasa' : 'cashier.nairobi', password: 'Password123!' },
          DRIVER: { username: branchId === 2 ? 'driver.mombasa' : 'driver.nairobi', password: 'Password123!' },
        };

        const creds = roleCredentials[targetRole] || roleCredentials.SUPER_ADMIN;
        res = await api.post('/api/auth/login', creds);
      }

      if (res && res.token) {
        api.setToken(res.token);
        if (res.refreshToken) {
          api.setRefreshToken(res.refreshToken);
        }

        const normUser = {
          ...res.user,
          role: res.user.roleName || res.user.role,
          full_name: res.user.fullName || res.user.full_name,
          branch_id: res.user.branchId ?? res.user.branch_id,
          mustChangePassword: Boolean(res.user.mustChangePassword),
          twoFactorEnabled: Boolean(res.user.twoFactorEnabled),
        };
        setUser(normUser);
        setMustChangePassword(Boolean(normUser.mustChangePassword));

        const bList = await loadBranches();
        if (normUser.branch_id) {
          const b = bList.find(item => item.id === normUser.branch_id);
          setSelectedBranch(b || null);
          if (b) localStorage.setItem('swifttrack_selected_branch_id', String(b.id));
        } else {
          const savedBranchId = localStorage.getItem('swifttrack_selected_branch_id');
          if (savedBranchId === 'all') {
            setSelectedBranch(null);
          } else if (savedBranchId) {
            const b = bList.find(item => String(item.id) === savedBranchId);
            setSelectedBranch(b || null);
          } else {
            setSelectedBranch(null);
          }
        }
        api.toast(`Switched persona to ${normUser.role} (${normUser.full_name})`, 'success');
        return normUser;
      }
    } catch (err) {
      console.error('Failed to switch role:', err);
      api.toast(`Failed to switch role: ${err.message}`, 'error');
    } finally {
      setIsSwitching(false);
    }
  }, [loadBranches]);

  // Initial load on mount
  useEffect(() => {
    let isMounted = true;
    async function initAuth() {
      try {
        const savedBranchId = localStorage.getItem('swifttrack_selected_branch_id');

        // Fetch auth config
        try {
          const cfg = await api.get('/api/auth/config');
          if (cfg && isMounted) {
            setConfig(cfg);
            setDemoMode(cfg.demoMode === true);
          }
        } catch (e) {
          console.warn('Could not load auth configuration:', e.message);
        }

        // Check existing token
        if (api.token) {
          try {
            const me = await api.get('/api/auth/me');
            if (me && me.user && isMounted) {
              const normUser = {
                ...me.user,
                role: me.user.roleName || me.user.role,
                full_name: me.user.fullName || me.user.full_name,
                branch_id: me.user.branchId ?? me.user.branch_id,
                mustChangePassword: Boolean(me.user.mustChangePassword),
                twoFactorEnabled: Boolean(me.user.twoFactorEnabled),
              };
              setUser(normUser);
              setMustChangePassword(Boolean(normUser.mustChangePassword));

              const bList = await loadBranches();
              if (normUser.branch_id) {
                const b = bList.find(item => item.id === normUser.branch_id);
                setSelectedBranch(b || null);
              } else if (savedBranchId === 'all') {
                setSelectedBranch(null);
              } else if (savedBranchId) {
                const b = bList.find(item => String(item.id) === savedBranchId);
                setSelectedBranch(b || null);
              } else {
                setSelectedBranch(null);
              }
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Existing token invalid, clearing session:', e);
            api.clearAuth();
          }
        }
      } catch (e) {
        console.error('Auth initialization error:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    initAuth();

    // Listen for auth cleared event
    const handleAuthCleared = () => {
      setUser(null);
      setSelectedBranch(null);
      setMustChangePassword(false);
    };
    window.addEventListener('swifttrack:auth_cleared', handleAuthCleared);

    return () => {
      isMounted = false;
      window.removeEventListener('swifttrack:auth_cleared', handleAuthCleared);
    };
  }, [loadBranches]);

  const selectBranch = useCallback(async (branch) => {
    if (!branch) {
      setSelectedBranch(null);
      localStorage.setItem('swifttrack_selected_branch_id', 'all');
      api.toast('Active branch context: All Kenya Hubs (Consolidated)', 'info');
      return;
    }

    setSelectedBranch(branch);
    localStorage.setItem('swifttrack_selected_branch_id', String(branch.id));

    if (user?.role === 'SUPER_ADMIN') {
      api.toast(`Active branch context: ${branch.name}`, 'info');
      return;
    }

    if (user?.branch_id && user.branch_id !== branch.id) {
      if (demoMode) {
        await quickSwitch(user.role, branch.id);
      } else {
        api.toast(`Switched branch context to ${branch.name}`, 'info');
      }
    } else {
      api.toast(`Active branch context: ${branch.name}`, 'info');
    }
  }, [user, quickSwitch, demoMode]);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isBranchManager = user?.role === 'BRANCH_MANAGER';
  const isDispatcher = user?.role === 'DISPATCHER';
  const isCashier = user?.role === 'CASHIER';
  const isDriver = user?.role === 'DRIVER';

  return (
    <AuthContext.Provider
      value={{
        user,
        branches,
        selectedBranch,
        selectBranch,
        login,
        verify2FA,
        logout,
        quickSwitch,
        changePassword,
        forgotPassword,
        resetPassword,
        setup2FA,
        enable2FA,
        disable2FA,
        regenerateRecoveryCodes,
        getSessions,
        terminateSession,
        terminateOtherSessions,
        getLoginHistory,
        mustChangePassword,
        setMustChangePassword,
        loading,
        isSwitching,
        demoMode,
        config,
        isSuperAdmin,
        isBranchManager,
        isDispatcher,
        isCashier,
        isDriver,
        refreshBranches: loadBranches,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
