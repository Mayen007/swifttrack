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
  const [config, setConfig] = useState({
    demoMode: true,
    currency: 'KES',
    etimsEnabled: true,
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

  // Standard Credential Login
  const login = useCallback(async (username, password, rememberMe = false) => {
    setIsSwitching(true);
    try {
      const res = await api.post('/api/auth/login', { username, password });
      if (res && res.token) {
        api.setToken(res.token);
        if (rememberMe) {
          localStorage.setItem('swifttrack_remember_user', username);
        } else {
          localStorage.removeItem('swifttrack_remember_user');
        }

        const normUser = {
          ...res.user,
          role: res.user.roleName || res.user.role,
          full_name: res.user.fullName || res.user.full_name,
          branch_id: res.user.branchId ?? res.user.branch_id,
        };
        setUser(normUser);

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
      throw new Error(res?.error || 'Authentication failed');
    } finally {
      setIsSwitching(false);
    }
  }, [loadBranches]);

  // Clean Logout
  const logout = useCallback(() => {
    api.setToken(null);
    localStorage.removeItem('swifttrack_token');
    localStorage.removeItem('swifttrack_selected_branch_id');
    setUser(null);
    setSelectedBranch(null);
    api.toast('Signed out successfully', 'info');
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
      // 1. Try dedicated demo-switch endpoint
      try {
        res = await api.post('/api/auth/demo-switch', { role: targetRole, branch_id: branchId });
      } catch (e) {
        console.warn('demo-switch endpoint failed or disabled:', e.message);
      }

      // 2. Fallback to standard credentials login if demo-switch was unavailable
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
        const normUser = {
          ...res.user,
          role: res.user.roleName || res.user.role,
          full_name: res.user.fullName || res.user.full_name,
          branch_id: res.user.branchId ?? res.user.branch_id,
        };
        setUser(normUser);

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
              };
              setUser(normUser);
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
            api.setToken(null);
          }
        }
      } catch (e) {
        console.error('Auth initialization error:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    initAuth();
    return () => { isMounted = false; };
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
        logout,
        quickSwitch,
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
