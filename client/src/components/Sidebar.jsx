import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { sound } from '../services/sound.js';
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Bike,
  Package,
  Receipt,
  RotateCcw,
  Banknote,
  TrendingUp,
  Building2,
  Users,
  ShieldCheck,
  X,
  Sparkles,
  MapPin,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

export function Sidebar({
  currentView,
  setView,
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const { user, selectedBranch } = useAuth();
  const role = user?.role;

  const navSections = [
    {
      title: 'Core Operations',
      items: [
        {
          id: 'dashboard',
          label: 'Command Center',
          icon: LayoutDashboard,
          roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER', 'CASHIER', 'DRIVER'],
        },
        {
          id: 'pos',
          label: 'POS Cashier Terminal',
          icon: ShoppingCart,
          roles: ['CASHIER', 'SUPER_ADMIN', 'BRANCH_MANAGER'],
        },
        {
          id: 'dispatch',
          label: 'Logistics Dispatch',
          icon: Truck,
          roles: ['DISPATCHER', 'SUPER_ADMIN', 'BRANCH_MANAGER'],
        },
        {
          id: 'driver',
          label: 'Courier Driver Portal',
          icon: Bike,
          roles: ['DRIVER', 'SUPER_ADMIN', 'DISPATCHER'],
        },
      ],
    },
    {
      title: 'Warehouse & Sales',
      items: [
        {
          id: 'inventory',
          label: 'Multi-Branch Inventory',
          icon: Package,
          roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'DISPATCHER'],
        },
        {
          id: 'orders',
          label: 'Orders & Receipts',
          icon: Receipt,
          roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'DISPATCHER'],
        },
        {
          id: 'approvals',
          label: 'Refund Approvals',
          icon: RotateCcw,
          roles: ['BRANCH_MANAGER', 'SUPER_ADMIN'],
        },
        {
          id: 'expenses',
          label: 'Petty Cash Ledger',
          icon: Banknote,
          roles: ['BRANCH_MANAGER', 'SUPER_ADMIN', 'CASHIER'],
        },
      ],
    },
    {
      title: 'Governance & Analytics',
      items: [
        {
          id: 'reports',
          label: 'P&L & KRA VAT Schedule',
          icon: TrendingUp,
          roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'],
        },
        {
          id: 'branches',
          label: 'Regional Hub Network',
          icon: Building2,
          roles: ['SUPER_ADMIN'],
        },
        {
          id: 'users',
          label: 'Staff Directory',
          icon: Users,
          roles: ['SUPER_ADMIN'],
        },
        {
          id: 'audit',
          label: 'Immutable Audit Trail',
          icon: ShieldCheck,
          roles: ['SUPER_ADMIN'],
        },
      ],
    },
  ];

  const handleItemClick = (id) => {
    if (id !== currentView) {
      sound.playScan();
    }
    setView(id);
    if (onClose) onClose();
  };

  const renderNavContent = (collapsed = false) => (
    <div
      className={`flex-1 overflow-y-auto py-3 space-y-4 [scrollbar-gutter:stable] overflow-x-hidden ${collapsed ? 'px-2' : 'px-3'
        }`}
    >
      {/* Active Operational Context Instrument */}
      {collapsed ? (
        <div
          className="w-10 h-10 mx-auto rounded bg-[#141822] border border-[#222834] flex flex-col items-center justify-center relative group cursor-default shrink-0"
          title={`${selectedBranch?.name || 'Enterprise HQ'} (${role || 'HQ'})`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-1.5 right-1.5" />
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[8px] font-mono font-bold text-slate-400 mt-0.5 uppercase">
            {selectedBranch?.code || 'HQ'}
          </span>

          {/* Hover Floating Tooltip */}
          <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded bg-[#181d28] border border-[#222834] text-xs font-mono text-white whitespace-nowrap shadow-2xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="font-bold text-white font-sans">
              {selectedBranch?.name || 'Enterprise HQ'}
            </div>
            <div className="text-[10px] text-amber-400">Context: {role || 'HQ'}</div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded bg-[#141822] border border-[#222834]">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-emerald-400" />
              CONTEXT
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs font-bold text-white truncate max-w-[130px] font-sans">
              {selectedBranch?.name || 'Enterprise HQ'}
            </p>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#1c2333] text-amber-300 border border-[#2c374d]">
              {role || 'HQ'}
            </span>
          </div>
        </div>
      )}

      {/* Structured Functional Navigation Sections */}
      {navSections.map((section) => {
        const visibleItems = section.items.filter((item) => item.roles.includes(role));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title} className="space-y-1">
            {collapsed ? (
              <div className="border-t border-[#1e2535] my-2 mx-1" title={section.title} />
            ) : (
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono border-b border-[#1b212c] mb-1.5">
                {section.title}
              </div>
            )}

            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              if (collapsed) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item.id)}
                    aria-label={item.label}
                    className={`relative w-full h-10 flex items-center justify-center cursor-pointer rounded transition-colors duration-150 group select-none ${isActive
                        ? 'bg-[#181f2c] text-amber-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
                      }`}
                  >
                    {/* Active Indicator Bar on left */}
                    <span
                      className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r transition-opacity duration-150 ${isActive ? 'bg-amber-400 opacity-100' : 'bg-transparent opacity-0'
                        }`}
                    />

                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors duration-150 ${isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                    />

                    {/* Floating Tooltip in Collapsed Mode */}
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded bg-[#181d28] border border-[#222834] text-xs font-mono text-white whitespace-nowrap shadow-2xl z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-2">
                      <span className="font-sans font-medium text-slate-100">{item.label}</span>
                      <span className="text-[10px] text-amber-400 font-mono">
                        [{section.title}]
                      </span>
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  className={`relative w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer rounded text-left select-none ${isActive
                      ? 'bg-[#181f2c] text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#141822]'
                    }`}
                >
                  {/* Fixed left active amber indicator bar - zero layout shift */}
                  <span
                    className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r transition-opacity duration-150 ${isActive ? 'bg-amber-400 opacity-100' : 'bg-transparent opacity-0'
                      }`}
                  />

                  <div className="flex items-center gap-2.5 min-w-0 pl-0.5">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors duration-150 ${isActive ? 'text-amber-400' : 'text-slate-400'
                        }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {/* Right active signal dot - always present in DOM to prevent flexbox jitter */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 transition-opacity duration-150 ${isActive ? 'opacity-100' : 'opacity-0'
                      }`}
                  />
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* 1. DESKTOP INSTRUMENT SIDEBAR (COLLAPSIBLE w-16 <-> w-64) */}
      <aside
        className={`hidden lg:flex ${isCollapsed ? 'w-16' : 'w-64'
          } bg-[#0f1219] border-r border-[#222834] flex-col shrink-0 h-full select-none z-20 transition-[width] duration-200 ease-in-out`}
      >
        {renderNavContent(isCollapsed)}

        {/* Telemetry Status & Collapse Control Footer */}
        {isCollapsed ? (
          <div className="p-2 border-t border-[#222834] bg-[#0c0e12] flex flex-col items-center justify-center gap-1">
            <button
              onClick={onToggleCollapse}
              title="Expand Sidebar (Ctrl+B)"
              aria-label="Expand sidebar"
              className="w-10 h-8 rounded bg-[#141822] hover:bg-[#1e2535] border border-[#222834] flex items-center justify-center text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-3 border-t border-[#222834] bg-[#0c0e12] flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              SYS_ONLINE
            </span>
            <button
              onClick={onToggleCollapse}
              title="Collapse Sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-400 cursor-pointer font-mono px-1.5 py-0.5 rounded hover:bg-[#141822] transition-colors"
            >
              <span>COLLAPSE</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </aside>

      {/* 2. MOBILE & TABLET DRAWER OVERLAY (ALWAYS FULL WIDTH) */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Blur Overlay */}
          <div className="fixed inset-0 bg-black/80 transition-opacity" onClick={onClose} />

          {/* Slide-out Panel */}
          <div className="relative w-72 max-w-[85vw] bg-[#0f1219] border-r border-[#222834] flex flex-col h-full z-50 animate-in slide-in-from-left duration-200">
            {/* Mobile Header */}
            <div className="h-14 px-4 border-b border-[#222834] flex items-center justify-between shrink-0 bg-[#121620]">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  NAVIGATION
                </span>
              </div>

              <button
                onClick={onClose}
                aria-label="Close navigation"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content (Always non-collapsed on mobile) */}
            {renderNavContent(false)}

            {/* Mobile Drawer Footer */}
            <div className="p-3 border-t border-[#222834] bg-[#0c0e12] flex items-center justify-between text-[10px] text-slate-400 font-mono shrink-0">
              <span>HUB: {selectedBranch?.code || 'ALL'}</span>
              <span className="text-emerald-400 font-bold">READY</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
