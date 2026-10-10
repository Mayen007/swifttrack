import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { NotificationsDrawer } from './components/NotificationsDrawer.jsx';
import { ToastContainer } from './components/ToastContainer.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import { ShieldOff } from 'lucide-react';
import { api } from './services/api.js';

import { DashboardView } from './views/DashboardView.jsx';
import { OperationsControlTower } from './components/dashboard/OperationsControlTower.jsx';
import { PosView } from './views/PosView.jsx';
import { DispatchView } from './views/DispatchView.jsx';
import { DriverView } from './views/DriverView.jsx';
import { InventoryView } from './views/InventoryView.jsx';
import { OrdersView } from './views/OrdersView.jsx';
import { ApprovalsView } from './views/ApprovalsView.jsx';
import { ExpensesView } from './views/ExpensesView.jsx';
import { ReportsView } from './views/ReportsView.jsx';
import { BranchesView } from './views/BranchesView.jsx';
import { UsersView } from './views/UsersView.jsx';
import { AuditView } from './views/AuditView.jsx';
import { ProductsView } from './views/ProductsView.jsx';
import { CustomersView } from './views/CustomersView.jsx';
import { PaymentsView } from './views/PaymentsView.jsx';
import { ProcurementView } from './views/ProcurementView.jsx';
import { DriversView } from './views/DriversView.jsx';
import { VehiclesView } from './views/VehiclesView.jsx';
import { CommunicationsView } from './views/CommunicationsView.jsx';
import { ShipmentsView } from './views/ShipmentsView.jsx';
import { HubOperationsView } from './views/HubOperationsView.jsx';
import { CodReconciliationView } from './views/CodReconciliationView.jsx';
import { LoginView } from './views/LoginView.jsx';
const VIEW_PERMISSIONS = {
  audit: ['SUPER_ADMIN'],
  users: ['SUPER_ADMIN', 'BRANCH_MANAGER'],
  branches: ['SUPER_ADMIN'],
  reports: ['SUPER_ADMIN', 'BRANCH_MANAGER'],
  procurement: ['SUPER_ADMIN', 'BRANCH_MANAGER'],
  approvals: ['SUPER_ADMIN', 'BRANCH_MANAGER'],
  'control-tower': ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'],
  dashboard: ['SUPER_ADMIN', 'BRANCH_MANAGER'],
  'hub-operations': ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'],
  communications: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'],
  dispatch: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'],
  drivers: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'],
  vehicles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'],
  driver: ['DRIVER'],
  pos: ['CASHIER', 'SUPER_ADMIN', 'BRANCH_MANAGER'],
  'cod-finance': ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'],
  shipments: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER'],
  payments: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'],
  expenses: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER'],
  products: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER'],
  inventory: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER'],
  orders: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER'],
  customers: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER'],
};

function AccessDeniedView({ currentView, userRole, onNavigateHome }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-[420px]">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-500/10">
        <ShieldOff className="w-8 h-8" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h2 className="text-lg font-bold text-white tracking-tight font-mono uppercase">Access Restricted</h2>
        <p className="text-xs text-slate-400 font-mono leading-relaxed">
          Your role (<span className="text-amber-400 font-bold">{userRole || 'ANONYMOUS'}</span>) does not have permission to view the{' '}
          <span className="text-white font-bold">{currentView}</span> module.
        </p>
        {currentView === 'Courier Driver Portal' && (
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            To evaluate or test last-mile delivery, switch to a Driver persona (e.g. Courier Driver Nairobi) via the top right profile menu.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onNavigateHome}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1c2230] hover:bg-[#252d40] border border-[#2c3548] text-slate-200 hover:text-white text-xs font-mono font-bold transition-all cursor-pointer"
      >
        <span>Return to Workspace</span>
      </button>
    </div>
  );
}

function MainApp() {
  const { user, loading, quickSwitch } = useAuth();
  const [currentView, setCurrentViewState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const view = new URLSearchParams(window.location.search).get('view');
        if (view) return view;
      } catch { }
    }
    return 'dashboard';
  });

  const setCurrentView = useCallback((newView, extraParams = {}, options = {}) => {
    if (typeof newView === 'function') {
      setCurrentViewState(newView);
      return;
    }
    if (!newView) return;
    setCurrentViewState(newView);

    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        const currentTheme = url.searchParams.get('theme');

        // Reset query string completely so old tab parameters are not preserved
        url.search = '';
        url.searchParams.set('view', newView);

        // Keep global app preferences like theme intact
        if (currentTheme) {
          url.searchParams.set('theme', currentTheme);
        }

        // Attach any explicitly passed parameters for this new view
        if (extraParams && typeof extraParams === 'object') {
          Object.entries(extraParams).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') {
              url.searchParams.set(k, String(v));
            }
          });
        }

        if (options?.replace) {
          window.history.replaceState({ view: newView }, '', url.toString());
        } else {
          window.history.pushState({ view: newView }, '', url.toString());
        }
      } catch (err) {
        console.warn('URL routing notice:', err);
      }
    }
  }, []);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll/fetch real unread notification count
  useEffect(() => {
    // Don't poll at all if there's no authenticated user/token
    if (!user || !api.token) {
      setUnreadCount(0);
      return;
    }

    let isMounted = true;
    let interval = null;

    async function fetchUnreadCount() {
      if (!isMounted || !api.token || (typeof document !== 'undefined' && document.hidden)) return;
      try {
        const res = await api.get('/api/notifications');
        if (isMounted && res) {
          setUnreadCount(typeof res.unread_count === 'number' ? res.unread_count : 0);
        }
      } catch (e) {
        if (isMounted && (e?.status === 401 || e?.message?.includes('Session expired'))) {
          setUnreadCount(0);
          // Stop polling — session is gone, AuthContext will handle logout
          clearInterval(interval);
        }
      }
    }

    fetchUnreadCount();
    interval = setInterval(fetchUnreadCount, 30000);

    const handleVisibility = () => {
      if (!document.hidden && user && api.token) {
        fetchUnreadCount();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [user]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('swifttrack_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const mainScrollRef = React.useRef(null);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('swifttrack_sidebar_collapsed', String(next));
      } catch { }
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Instantly reset scroll to top on view change to prevent layout jumping or clamping
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [currentView]);

  const getDefaultHomeView = (role) => {
    if (role === 'CASHIER') return 'pos';
    if (role === 'DRIVER') return 'driver';
    if (role === 'DISPATCHER') return 'control-tower';
    return 'dashboard';
  };

  // Synchronize view on browser back / forward navigation
  useEffect(() => {
    const handlePopState = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const view = urlParams.get('view') || getDefaultHomeView(user?.role);
        if (view) {
          if (user?.role !== 'SUPER_ADMIN') {
            const allowedRoles = VIEW_PERMISSIONS[view];
            if (allowedRoles && !allowedRoles.includes(user?.role)) {
              return;
            }
          }
          setCurrentViewState(view);
        }
      } catch { }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user?.role]);

  // Set default view based on user role (respecting URL ?view= param if provided)
  useEffect(() => {
    if (!user) return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlView = urlParams.get('view');
      if (urlView) {
        if (urlView === 'dashboard' && user.role === 'CASHIER') {
          setCurrentView('pos', {}, { replace: true });
          return;
        }
        if (urlView === 'dashboard' && user.role === 'DRIVER') {
          setCurrentView('driver', {}, { replace: true });
          return;
        }
        if (urlView === 'dashboard' && user.role === 'DISPATCHER') {
          setCurrentView('control-tower', {}, { replace: true });
          return;
        }
        const allowed = user.role === 'SUPER_ADMIN' || (VIEW_PERMISSIONS[urlView] && VIEW_PERMISSIONS[urlView].includes(user.role));
        if (allowed) {
          setCurrentViewState(urlView);
          return;
        }
      }
    } catch { }

    const home = getDefaultHomeView(user.role);
    setCurrentView(home, {}, { replace: true });
  }, [user?.role]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-400 font-medium">Initializing SwiftTrack Kenya Platform...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const renderView = () => {
    // Courier Driver Portal is strictly restricted to DRIVER role
    if (currentView === 'driver' && user?.role !== 'DRIVER') {
      return (
        <AccessDeniedView
          currentView="Courier Driver Portal"
          userRole={user?.role}
          onNavigateHome={() => setCurrentView(getDefaultHomeView(user?.role))}
        />
      );
    }

    if (user?.role !== 'SUPER_ADMIN') {
      const allowedRoles = VIEW_PERMISSIONS[currentView];
      if (allowedRoles && !allowedRoles.includes(user?.role)) {
        return (
          <AccessDeniedView
            currentView={currentView}
            userRole={user?.role}
            onNavigateHome={() => setCurrentView(getDefaultHomeView(user?.role))}
          />
        );
      }
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;
      case 'control-tower':
        return <OperationsControlTower onNavigate={setCurrentView} />;
      case 'shipments':
        return <ShipmentsView onNavigate={setCurrentView} />;
      case 'hub-operations':
        return <HubOperationsView />;
      case 'cod-finance':
        return <CodReconciliationView />;
      case 'communications':
        return <CommunicationsView />;
      case 'pos':
        return <PosView onNavigate={setCurrentView} />;
      case 'dispatch':
        return <DispatchView />;
      case 'drivers':
        return <DriversView />;
      case 'vehicles':
        return <VehiclesView />;
      case 'driver':
        return <DriverView />;
      case 'products':
        return <ProductsView />;
      case 'inventory':
        return <InventoryView />;
      case 'orders':
        return <OrdersView />;
      case 'payments':
        return <PaymentsView />;
      case 'procurement':
        return <ProcurementView />;
      case 'customers':
        return <CustomersView />;
      case 'approvals':
        return <ApprovalsView />;
      case 'expenses':
        return <ExpensesView />;
      case 'reports':
        return <ReportsView />;
      case 'branches':
        return <BranchesView />;
      case 'users':
        return <UsersView />;
      case 'audit':
        return <AuditView />;
      default:
        return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0c0e12] text-slate-200 flex flex-col overflow-hidden selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navigation Bar */}
      <Navbar
        onToggleNotifications={() => setNotificationsOpen(!notificationsOpen)}
        unreadCount={unreadCount}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        isSidebarOpen={sidebarOpen}
        onToggleCollapse={toggleSidebarCollapse}
        isSidebarCollapsed={sidebarCollapsed}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          currentView={currentView}
          setView={setCurrentView}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />

        <main
          ref={mainScrollRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 [scrollbar-gutter:stable]"
        >
          <div className={`w-full ${currentView === 'vehicles' || currentView === 'drivers' ? '' : 'max-w-[1760px] mx-auto'}`}>
            <ErrorBoundary key={currentView}>
              {renderView()}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Slide-out Notifications Drawer */}
      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onRefreshCount={setUnreadCount}
        onNavigate={setCurrentView}
      />

      {/* Floating System Toasts */}
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
