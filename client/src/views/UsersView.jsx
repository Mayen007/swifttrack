import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  RBAC_CAPABILITY_MATRIX,
  getRoleBadgeStyle,
} from '../components/users/constants.js';
import { UserTelemetryCards } from '../components/users/UserTelemetryCards.jsx';
import { UserFilterBar } from '../components/users/UserFilterBar.jsx';
import { UserTable } from '../components/users/UserTable.jsx';
import { CreateUserModal } from '../components/users/CreateUserModal.jsx';
import { EditUserModal } from '../components/users/EditUserModal.jsx';
import { RbacMatrixDrawer } from '../components/users/RbacMatrixDrawer.jsx';
import { StaffInspectorDrawer } from '../components/users/StaffInspectorDrawer.jsx';
import { TempPasswordModal } from '../components/users/TempPasswordModal.jsx';
import { LoginHistoryModal } from '../components/users/LoginHistoryModal.jsx';
import { SecurityAuditDrawer } from '../components/users/SecurityAuditDrawer.jsx';
import { ConfirmModal } from '../components/common/ConfirmModal.jsx';

export function UsersView() {
  const { user, branches, isSuperAdmin, isBranchManager, quickSwitch, demoMode } = useAuth();

  const [users, setUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMatrixDrawerOpen, setIsMatrixDrawerOpen] = useState(false);
  const [inspectingUser, setInspectingUser] = useState(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);

  const [isLoginHistoryModalOpen, setIsLoginHistoryModalOpen] = useState(false);
  const [loginHistoryTarget, setLoginHistoryTarget] = useState(null);
  const [loginHistoryList, setLoginHistoryList] = useState([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState(null);
  const [tempPasswordCopied, setTempPasswordCopied] = useState(false);
  const [isFailedLoginsDrawerOpen, setIsFailedLoginsDrawerOpen] = useState(false);
  const [failedLoginsLoading, setFailedLoginsLoading] = useState(false);
  const [failedLoginsList, setFailedLoginsList] = useState([]);
  const [adminActionLoading, setAdminActionLoading] = useState(null);

  // Custom confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    isDestructive: false,
    onConfirm: () => {}
  });

  const [createFormData, setCreateFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    role_id: '4',
    branch_id: '1',
    password: 'Password123!',
    license_number: '',
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editFormData, setEditFormData] = useState({
    full_name: '',
    phone: '',
    password: '',
    is_active: 1,
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchUsersAndRoles = useCallback(async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([
        api.get('/api/users'),
        api.get('/api/users/roles').catch(() => []),
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setAvailableRoles(Array.isArray(rolesData) ? rolesData : []);
      setLastSyncTime(new Date().toLocaleTimeString('en-KE', { hour12: false }));
    } catch (e) {
      console.error('Failed to load personnel roster:', e);
      api.toast('Failed to load personnel roster: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsersAndRoles();
  }, [fetchUsersAndRoles]);

  const handleManualRefresh = async () => {
    sound.playScan();
    await fetchUsersAndRoles();
    api.toast('Personnel directory re-synchronized', 'success');
  };

  const openCreateModal = () => {
    sound.playScan();
    setCreateError('');
    const defBranch = isBranchManager ? String(user?.branch_id || (branches[0]?.id || 1)) : String(branches[0]?.id || 1);
    const cashierRole = availableRoles.find((r) => r.name === 'CASHIER') || availableRoles[0];
    setCreateFormData({
      full_name: '',
      username: '',
      email: '',
      phone: '',
      role_id: cashierRole ? String(cashierRole.id) : '',
      branch_id: defBranch,
      password: '',
      license_number: '',
    });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (staff) => {
    sound.playScan();
    setSelectedUserForEdit(staff);
    setEditFormData({
      full_name: staff.full_name || '',
      phone: staff.phone || '',
      password: '',
      is_active: staff.is_active !== undefined ? staff.is_active : 1,
    });
    setEditError('');
    setIsEditModalOpen(true);
  };

  const openInspector = (staff) => {
    sound.playScan();
    setInspectingUser(staff);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (
      !createFormData.full_name.trim() ||
      !createFormData.username.trim() ||
      !createFormData.email.trim() ||
      !createFormData.password.trim() ||
      !createFormData.role_id
    ) {
      sound.playError();
      setCreateError('Full name, username, email, password, and security role are required.');
      return;
    }

    try {
      setIsSubmittingCreate(true);
      const selectedRoleObj = availableRoles.find((r) => String(r.id) === String(createFormData.role_id));
      const isDriverRole = selectedRoleObj?.name === 'DRIVER';

      const payload = {
        full_name: createFormData.full_name.trim(),
        username: createFormData.username.toLowerCase().trim(),
        email: createFormData.email.toLowerCase().trim(),
        phone: createFormData.phone.trim(),
        password: createFormData.password,
        role_id: Number(createFormData.role_id),
        branch_id: selectedRoleObj?.name === 'SUPER_ADMIN' ? null : Number(createFormData.branch_id),
        license_number: isDriverRole ? createFormData.license_number.trim() : undefined,
      };

      await api.post('/api/users', payload);
      sound.playSuccess();
      api.toast(`Account for ${payload.full_name} (${payload.username}) provisioned successfully`, 'success');

      setIsCreateModalOpen(false);
      await fetchUsersAndRoles();
    } catch (err) {
      console.error('Failed to create staff member:', err);
      sound.playError();
      setCreateError(err.message || 'Failed to provision staff member');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');

    if (!selectedUserForEdit) return;

    if (!editFormData.full_name.trim()) {
      sound.playError();
      setEditError('Full name cannot be blank.');
      return;
    }

    try {
      setIsSubmittingEdit(true);
      const payload = {
        full_name: editFormData.full_name.trim(),
        phone: editFormData.phone.trim(),
        is_active: Number(editFormData.is_active),
      };
      if (editFormData.password && editFormData.password.trim().length >= 6) {
        payload.password = editFormData.password.trim();
      }

      await api.put(`/api/users/${selectedUserForEdit.id}`, payload);
      sound.playSuccess();
      api.toast(`User #${selectedUserForEdit.id} profile updated successfully`, 'success');

      setIsEditModalOpen(false);
      setSelectedUserForEdit(null);
      await fetchUsersAndRoles();
    } catch (err) {
      console.error('Failed to update user:', err);
      sound.playError();
      setEditError(err.message || 'Failed to update user record');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const canEditUser = (staff) => {
    if (isSuperAdmin) return true;
    if (isBranchManager) {
      if (staff.branch_id !== user?.branch_id) return false;
      const role = staff.role_name || staff.role;
      if (['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(role)) return false;
      return true;
    }
    return false;
  };

  const handleQuickSwitch = async (roleName, branchId) => {
    sound.playScan();
    try {
      await quickSwitch(roleName, branchId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleForceLogout = (targetUser) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Force Terminate Sessions',
      message: `Force terminate all active sessions for @${targetUser.username}? The user will be immediately logged out across all devices.`,
      confirmText: 'Force Logout',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setAdminActionLoading(targetUser.id);
          await api.post(`/api/users/${targetUser.id}/force-logout`);
          sound.playSuccess();
          api.toast(`All active sessions for @${targetUser.username} terminated`, 'success');
          await fetchUsersAndRoles();
          if (inspectingUser && inspectingUser.id === targetUser.id) {
            setInspectingUser(prev => prev ? { ...prev, token_version: (prev.token_version || 1) + 1 } : null);
          }
        } catch (err) {
          sound.playError();
          api.toast(err.message || 'Failed to force logout user', 'error');
        } finally {
          setAdminActionLoading(null);
        }
      }
    });
  };

  const handleAdminResetPassword = (targetUser) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset User Password',
      message: `Reset password for @${targetUser.username}? A temporary password will be generated, and the operator will be forced to choose a new password on their next login.`,
      confirmText: 'Reset Password',
      isDestructive: false,
      onConfirm: async () => {
        try {
          setAdminActionLoading(targetUser.id);
          const res = await api.post(`/api/users/${targetUser.id}/reset-password`, {});
          sound.playSuccess();
          setTempPasswordCopied(false);
          setTempPasswordModal({
            username: targetUser.username,
            fullName: targetUser.full_name,
            temporaryPassword: res.temporaryPassword,
          });
          await fetchUsersAndRoles();
          if (inspectingUser && inspectingUser.id === targetUser.id) {
            setInspectingUser(prev => prev ? { ...prev, must_change_password: 1, failed_login_attempts: 0, is_locked: 0 } : null);
          }
        } catch (err) {
          sound.playError();
          api.toast(err.message || 'Failed to reset password', 'error');
        } finally {
          setAdminActionLoading(null);
        }
      }
    });
  };

  const handleUnlockAccount = async (targetUser) => {
    try {
      setAdminActionLoading(targetUser.id);
      await api.post(`/api/users/${targetUser.id}/unlock`);
      sound.playSuccess();
      api.toast(`Account for @${targetUser.username} has been unlocked`, 'success');
      await fetchUsersAndRoles();
      if (inspectingUser && inspectingUser.id === targetUser.id) {
        setInspectingUser(prev => prev ? { ...prev, failed_login_attempts: 0, is_locked: 0, locked_until: null } : null);
      }
    } catch (err) {
      sound.playError();
      api.toast(err.message || 'Failed to unlock account', 'error');
    } finally {
      setAdminActionLoading(null);
    }
  };

  const handleOpenLoginHistory = async (targetUser) => {
    sound.playScan();
    setLoginHistoryTarget(targetUser);
    setIsLoginHistoryModalOpen(true);
    setLoginHistoryLoading(true);
    try {
      const data = await api.get(`/api/users/${targetUser.id}/login-history`);
      setLoginHistoryList(Array.isArray(data) ? data : []);
    } catch (err) {
      api.toast('Failed to load login history: ' + err.message, 'error');
      setLoginHistoryList([]);
    } finally {
      setLoginHistoryLoading(false);
    }
  };

  const handleOpenFailedLogins = async () => {
    sound.playScan();
    setIsFailedLoginsDrawerOpen(true);
    setFailedLoginsLoading(true);
    try {
      const data = await api.get('/api/users/security/failed-logins');
      setFailedLoginsList(Array.isArray(data) ? data : []);
    } catch (err) {
      api.toast('Failed to load failed login history: ' + err.message, 'error');
      setFailedLoginsList([]);
    } finally {
      setFailedLoginsLoading(false);
    }
  };

  const kpis = useMemo(() => {
    const totalStaff = users.length;
    const activeStaff = users.filter((u) => u.is_active !== 0).length;
    const roleCounts = users.reduce((acc, u) => {
      const r = u.role_name || u.role || 'UNKNOWN';
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    const branchesRepresented = new Set(users.map((u) => u.branch_id).filter(Boolean)).size;

    return {
      totalStaff,
      activeStaff,
      suspendedStaff: totalStaff - activeStaff,
      activeRate: totalStaff > 0 ? Math.round((activeStaff / totalStaff) * 100) : 100,
      roleCounts,
      branchesRepresented,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === 'ACTIVE' && u.is_active === 0) return false;
      if (statusFilter === 'SUSPENDED' && u.is_active !== 0) return false;

      const userRole = u.role_name || u.role;
      if (roleFilter !== 'ALL' && userRole !== roleFilter) return false;

      if (branchFilter !== 'ALL') {
        if (branchFilter === 'GLOBAL' && u.branch_id) return false;
        if (branchFilter !== 'GLOBAL' && String(u.branch_id) !== String(branchFilter)) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.branch_name?.toLowerCase().includes(q) ||
        userRole?.toLowerCase().includes(q)
      );
    });
  }, [users, statusFilter, roleFilter, branchFilter, searchQuery]);

  const creatableRoles = useMemo(() => {
    if (isSuperAdmin) return availableRoles;
    return availableRoles.filter(
      (r) => !['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(r.name)
    );
  }, [availableRoles, isSuperAdmin]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <UserTelemetryCards
        onOpenMatrix={() => {
          sound.playScan();
          setIsMatrixDrawerOpen(true);
        }}
        onOpenFailedLogins={handleOpenFailedLogins}
        onManualRefresh={handleManualRefresh}
        loading={loading}
        isSuperAdmin={isSuperAdmin}
        isBranchManager={isBranchManager}
        onOpenCreate={openCreateModal}
        kpis={kpis}
        availableRoles={availableRoles}
        branches={branches}
      />

      <UserFilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        branchFilter={branchFilter}
        setBranchFilter={setBranchFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        usersCount={users.length}
        kpis={kpis}
        isSuperAdmin={isSuperAdmin}
        branches={branches}
      />

      <UserTable
        users={users}
        filteredUsers={filteredUsers}
        loading={loading}
        searchQuery={searchQuery}
        canEditUser={canEditUser}
        currentUser={user}
        adminActionLoading={adminActionLoading}
        onUnlockAccount={handleUnlockAccount}
        onOpenLoginHistory={handleOpenLoginHistory}
        onAdminResetPassword={handleAdminResetPassword}
        onForceLogout={handleForceLogout}
        onOpenInspector={openInspector}
        onOpenEdit={openEditModal}
        demoMode={demoMode}
        onQuickSwitch={handleQuickSwitch}
      />

      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        createFormData={createFormData}
        setCreateFormData={setCreateFormData}
        createError={createError}
        isSubmittingCreate={isSubmittingCreate}
        creatableRoles={creatableRoles}
        branches={branches}
        isSuperAdmin={isSuperAdmin}
        currentUser={user}
        onSubmit={handleCreateUser}
      />

      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={selectedUserForEdit}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        editError={editError}
        isSubmittingEdit={isSubmittingEdit}
        onSubmit={handleSaveEdit}
      />

      <RbacMatrixDrawer
        isOpen={isMatrixDrawerOpen}
        onClose={() => {
          sound.playScan();
          setIsMatrixDrawerOpen(false);
        }}
      />

      <StaffInspectorDrawer
        isOpen={Boolean(inspectingUser)}
        onClose={() => {
          sound.playScan();
          setInspectingUser(null);
        }}
        user={inspectingUser}
        canEdit={inspectingUser ? canEditUser(inspectingUser) : false}
        adminActionLoading={adminActionLoading}
        onUnlockAccount={handleUnlockAccount}
        onAdminResetPassword={handleAdminResetPassword}
        onForceLogout={handleForceLogout}
        onOpenLoginHistory={handleOpenLoginHistory}
      />

      <TempPasswordModal
        isOpen={Boolean(tempPasswordModal)}
        onClose={() => setTempPasswordModal(null)}
        data={tempPasswordModal}
        tempPasswordCopied={tempPasswordCopied}
        setTempPasswordCopied={setTempPasswordCopied}
      />

      <LoginHistoryModal
        isOpen={isLoginHistoryModalOpen}
        onClose={() => setIsLoginHistoryModalOpen(false)}
        user={loginHistoryTarget}
        loginHistoryLoading={loginHistoryLoading}
        loginHistoryList={loginHistoryList}
      />

      <SecurityAuditDrawer
        isOpen={isFailedLoginsDrawerOpen}
        onClose={() => setIsFailedLoginsDrawerOpen(false)}
        failedLoginsLoading={failedLoginsLoading}
        failedLoginsList={failedLoginsList}
      />

      <ConfirmModal
        {...confirmDialog}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export { RBAC_CAPABILITY_MATRIX, getRoleBadgeStyle };
