// client/src/App.jsx
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { NotificationsDrawer } from './components/NotificationsDrawer.jsx';
import { ToastContainer } from './components/ToastContainer.jsx';

import { DashboardView } from './views/DashboardView.jsx';
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

function MainApp() {
  const { user, loading, quickSwitch } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);
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
      } catch {}
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

  // Set default view based on user role
  useEffect(() => {
    if (!user) return;
    if (user.role === 'CASHIER') setCurrentView('pos');
    else if (user.role === 'DRIVER') setCurrentView('driver');
    else if (user.role === 'DISPATCHER') setCurrentView('dispatch');
    else setCurrentView('dashboard');
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
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto text-blue-400">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">SwiftTrack Kenya</h2>
            <p className="text-xs text-gray-400 mt-2">Select a demo profile to initialize your authenticated enterprise session.</p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => quickSwitch('SUPER_ADMIN')}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-xs tracking-wide shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              Sign In as Super Admin
            </button>
            <button
              onClick={() => quickSwitch('CASHIER')}
              className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-semibold text-xs tracking-wide border border-gray-700 transition-all cursor-pointer"
            >
              Sign In as Cashier (POS)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;
      case 'pos':
        return <PosView />;
      case 'dispatch':
        return <DispatchView />;
      case 'driver':
        return <DriverView />;
      case 'inventory':
        return <InventoryView />;
      case 'orders':
        return <OrdersView />;
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
          className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 [scrollbar-gutter:stable]"
        >
          <div className="max-w-7xl mx-auto">{renderView()}</div>
        </main>
      </div>

      {/* Slide-out Notifications Drawer */}
      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onRefreshCount={setUnreadCount}
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
        <CartProvider>
          <MainApp />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
