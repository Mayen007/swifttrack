// client/src/App.jsx
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { NotificationsDrawer } from './components/NotificationsDrawer.jsx';
import { ToastContainer } from './components/ToastContainer.jsx';
import { api } from './services/api.js';

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
import { ProductsView } from './views/ProductsView.jsx';
import { CustomersView } from './views/CustomersView.jsx';
import { LoginView } from './views/LoginView.jsx';

function MainApp() {
  const { user, loading, quickSwitch } = useAuth();
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const view = new URLSearchParams(window.location.search).get('view');
        if (view) return view;
      } catch {}
    }
    return 'dashboard';
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll/fetch real unread notification count
  useEffect(() => {
    let isMounted = true;
    async function fetchUnreadCount() {
      if (!user) {
        if (isMounted) setUnreadCount(0);
        return;
      }
      try {
        const res = await api.get('/api/notifications');
        if (isMounted && res) {
          setUnreadCount(typeof res.unread_count === 'number' ? res.unread_count : 0);
        }
      } catch (e) {
        // Silently ignore if unauthenticated or network error
      }
    }

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
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

  // Set default view based on user role (respecting URL ?view= param if provided)
  useEffect(() => {
    if (!user) return;
    try {
      const urlView = new URLSearchParams(window.location.search).get('view');
      if (urlView) {
        setCurrentView(urlView);
        return;
      }
    } catch {}
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
    return <LoginView />;
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
      case 'products':
        return <ProductsView />;
      case 'inventory':
        return <InventoryView />;
      case 'orders':
        return <OrdersView />;
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
