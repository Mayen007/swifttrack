import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { sound } from '../services/sound.js';
import {
  Truck,
  MapPin,
  Bell,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Shield,
  Building2,
  ShoppingCart,
  Bike,
  Check,
  Lock,
  Volume2,
  VolumeX,
  Search,
  Clock,
  Radio,
  User,
  Sun,
  Moon,
  Monitor,
  LogOut,
} from 'lucide-react';

export function Navbar({
  onToggleNotifications,
  unreadCount = 0,
  onToggleSidebar,
  isSidebarOpen,
  onToggleCollapse,
  isSidebarCollapsed = false,
}) {
  const { user, branches, selectedBranch, selectBranch, quickSwitch, logout, demoMode, isSuperAdmin } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');
  const [audioMuted, setAudioMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const branchRef = useRef(null);
  const profileRef = useRef(null);

  // Precision 1-second interval clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (branchRef.current && !branchRef.current.contains(event.target)) {
        setBranchDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Canonical role definitions for switching personas (consolidated in profile menu only)
  const personaRoles = [
    { role: 'SUPER_ADMIN', label: 'Super Admin', desc: 'HQ Full Oversight', icon: Shield, badge: 'HQ' },
    { role: 'BRANCH_MANAGER_NAIROBI', label: 'Branch Manager (NBO)', desc: 'Nairobi Central Hub', icon: Building2, badge: 'NBO' },
    { role: 'BRANCH_MANAGER_MOMBASA', label: 'Branch Manager (MBA)', desc: 'Mombasa Port Hub', icon: Building2, badge: 'MBA' },
    { role: 'DISPATCHER', label: 'Dispatcher', desc: 'Fleet Operations', icon: Truck, badge: 'FLT' },
    { role: 'CASHIER', label: 'Cashier', desc: 'POS Counter Terminal', icon: ShoppingCart, badge: 'POS' },
    { role: 'DRIVER', label: 'Courier Driver', desc: 'Mobile Delivery & POD', icon: Bike, badge: 'DRV' },
  ];

  const handleRoleSelect = (targetRole) => {
    if (!audioMuted) sound.playScan();
    quickSwitch(targetRole);
    setProfileDropdownOpen(false);
  };

  const handleBranchSelect = (branch) => {
    if (!audioMuted) sound.playScan();
    selectBranch(branch);
    setBranchDropdownOpen(false);
  };

  const toggleAudio = () => {
    const nextState = !audioMuted;
    setAudioMuted(nextState);
    if (!nextState) sound.playSuccess();
  };

  const filteredBranches = branches.filter((b) =>
    !branchFilter ||
    b.name.toLowerCase().includes(branchFilter.toLowerCase()) ||
    b.code.toLowerCase().includes(branchFilter.toLowerCase()) ||
    b.city.toLowerCase().includes(branchFilter.toLowerCase())
  );

  return (
    <header className="h-14 px-3 sm:px-5 bg-[#0c0e14] border-b border-[#222834] flex items-center justify-between sticky top-0 z-40 select-none">
      {/* 1. LEFT SECTION: Mobile Toggle + Brand Lockup + Single Branch Context Dial */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Sidebar Toggle: Mobile Drawer on < lg, Desktop Collapse on lg: */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              onToggleSidebar();
            } else if (onToggleCollapse) {
              onToggleCollapse();
            }
          }}
          aria-label={isSidebarCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
          title={isSidebarCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
          className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded bg-[#141822] border border-[#222834] text-slate-300 hover:text-white hover:bg-[#1a202d] transition-colors cursor-pointer shrink-0"
        >
          {isSidebarOpen ? (
            <X className="w-4 h-4" />
          ) : isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-amber-400" />
          ) : (
            <Menu className="w-4 h-4" />
          )}
        </button>

        {/* Brand Mark: Functionalist Geometric Monogram */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded bg-[#161c28] border border-[#273347] flex items-center justify-center text-amber-400 font-mono font-bold text-xs shrink-0">
            <Truck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xs font-bold tracking-tight text-white uppercase font-sans">
              SwiftTrack
            </span>
            <span className="text-[9px] font-mono font-semibold tracking-widest text-slate-400 border border-[#222834] px-1 py-0.2 rounded bg-[#12161f]">
              KE
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-[#222834] shrink-0" />

        {/* Unified Hub / Station Context Selector */}
        <div className="relative shrink-0" ref={branchRef}>
          <button
            onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded bg-[#12161f] hover:bg-[#181d28] border border-[#222834] hover:border-[#354054] text-xs text-slate-300 transition-colors cursor-pointer"
            aria-label="Switch operational branch"
            title="Switch Operational Branch / Station"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block"></span>
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            <span className="font-medium text-slate-100 tracking-tight max-w-[100px] sm:max-w-[140px] md:max-w-[180px] truncate">
              {selectedBranch ? selectedBranch.name : 'All Kenya Hubs'}
            </span>
            <span className="text-[10px] font-mono text-slate-400 hidden md:inline shrink-0">
              [{selectedBranch?.code || 'HQ'}]
            </span>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
                branchDropdownOpen ? 'rotate-180 text-amber-400' : ''
              }`}
            />
          </button>

          {/* Branch Dropdown Popover */}
          {branchDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-76 sm:w-84 bg-[#12161f] border border-[#222834] rounded shadow-2xl py-1 z-50 animate-in fade-in duration-100">
              <div className="p-2 border-b border-[#222834] bg-[#0c0e14]">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5 px-1">
                  <span>HUB STATIONS</span>
                  <span className="text-amber-400 tabular-nums">{branches.length} NODES</span>
                </div>
                {/* Search branch filter */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Filter hub by name, city, code..."
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded bg-[#161c28] border border-[#222834] text-white text-xs font-sans placeholder-slate-400 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Consolidated Enterprise Hub Option */}
              {(!branchFilter || 'all kenya hubs consolidated hq enterprise'.includes(branchFilter.toLowerCase())) && (
                <button
                  onClick={() => handleBranchSelect(null)}
                  className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors cursor-pointer border-b border-[#181e2b] ${
                    !selectedBranch
                      ? 'bg-[#18202d] text-amber-300 font-medium'
                      : 'hover:bg-[#161b26] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 font-mono text-[10px] ${
                        !selectedBranch
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-400 font-bold'
                          : 'border-[#222834] bg-[#161c28] text-slate-400'
                      }`}
                    >
                      HQ
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">All Kenya Hubs</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        ENTERPRISE CONSOLIDATED • HQ
                      </p>
                    </div>
                  </div>
                  {!selectedBranch && (
                    <span className="text-[10px] font-mono font-bold text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded bg-amber-400/10">
                      ACTIVE
                    </span>
                  )}
                </button>
              )}

              <div className="max-h-60 overflow-y-auto py-1 divide-y divide-[#181e2b] [scrollbar-gutter:stable]">
                {filteredBranches.map((b) => {
                  const isSelected = selectedBranch?.id === b.id;
                  const isUserHome = user?.branch_id === b.id;

                  return (
                    <button
                      key={b.id}
                      onClick={() => handleBranchSelect(b)}
                      className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#18202d] text-amber-300 font-medium'
                          : 'hover:bg-[#161b26] text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 font-mono text-[10px] ${
                            isSelected
                              ? 'border-amber-400/40 bg-amber-400/10 text-amber-400 font-bold'
                              : 'border-[#222834] bg-[#161c28] text-slate-400'
                          }`}
                        >
                          {b.code}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{b.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            {b.city} • OPERATIONAL
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isSelected ? (
                          <span className="text-[10px] font-mono font-bold text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded bg-amber-400/10">
                            ACTIVE
                          </span>
                        ) : isUserHome ? (
                          <span className="text-[9px] font-mono text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded bg-emerald-500/10">
                            HOME
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-2 mx-2 my-1.5 rounded bg-[#0c0e14] border border-[#222834] text-[10px] text-slate-400 flex items-center justify-between font-mono">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{isSuperAdmin ? 'CROSS-HUB AUTHORITY: ACTIVE' : `STATION CONTEXT: ${user?.role || 'OPERATOR'}`}</span>
                </div>
                <span className="text-slate-400 text-[9px]">CLICK TO SWITCH</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. CENTER SECTION: Clean, uncluttered functional space (no repeated role pills) */}
      <div className="flex-1" />

      {/* 3. RIGHT SECTION: Unified Telemetry Capsule + Audio Toggle + Notifications + Operator Menu */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Unified Live Telemetry Capsule (Clock + Network Latency in one clean badge) */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#12161f] border border-[#222834] text-[11px] font-mono text-slate-300">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="tabular-nums font-medium text-slate-200">
              {currentTime.toLocaleTimeString('en-KE', { hour12: false })}
            </span>
            <span className="text-slate-500 text-[10px]">EAT</span>
          </div>

          <div className="h-3 w-px bg-[#222834]" />

          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400 text-[10px]">12ms</span>
          </div>
        </div>

        {/* Dieter Rams 3-State Theme Selector Instrument (Light / Dark / System) */}
        <div
          className="flex items-center p-0.5 rounded bg-[#12161f] border border-[#222834]"
          role="group"
          aria-label="Theme selector"
        >
          <button
            onClick={() => {
              if (!audioMuted) sound.playScan();
              setTheme('light');
            }}
            title="Light Mode (Braun Porcelain)"
            aria-label="Light mode"
            className={`p-1.5 rounded transition-colors cursor-pointer flex items-center justify-center ${theme === 'light'
              ? 'bg-[#18202d] text-amber-400 font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c28]'
              }`}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (!audioMuted) sound.playScan();
              setTheme('dark');
            }}
            title="Dark Mode (Obsidian Matte)"
            aria-label="Dark mode"
            className={`p-1.5 rounded transition-colors cursor-pointer flex items-center justify-center ${theme === 'dark'
              ? 'bg-[#18202d] text-amber-400 font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c28]'
              }`}
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (!audioMuted) sound.playScan();
              setTheme('system');
            }}
            title={`System Mode (${resolvedTheme === 'dark' ? 'Dark OS' : 'Light OS'})`}
            aria-label="System theme"
            className={`p-1.5 rounded transition-colors cursor-pointer flex items-center justify-center ${theme === 'system'
              ? 'bg-[#18202d] text-amber-400 font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c28]'
              }`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tactile Audio Feedback Switch */}
        <button
          onClick={toggleAudio}
          className={`p-1.5 rounded border transition-colors cursor-pointer ${audioMuted
            ? 'bg-[#12161f] border-[#222834] text-slate-400 hover:text-slate-200'
            : 'bg-[#161c28] border-[#273347] text-amber-400 hover:text-amber-300'
            }`}
          title={audioMuted ? 'System Audio: Muted' : 'System Audio: Active'}
          aria-label="Toggle system audio"
        >
          {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Notifications Instrument Trigger */}
        <button
          onClick={onToggleNotifications}
          className="relative p-1.5 rounded bg-[#12161f] hover:bg-[#181d28] border border-[#222834] hover:border-[#354054] text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Notification Center"
          aria-label="Toggle notifications"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-bold font-mono flex items-center justify-center border border-[#0c0e14]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Single Operator Profile & Persona Switcher Capsule */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1 sm:pr-2.5 rounded bg-[#12161f] hover:bg-[#181d28] border border-[#222834] hover:border-[#354054] transition-colors cursor-pointer"
            aria-label="Operator options"
          >
            <div className="w-6 h-6 rounded bg-[#1c2333] border border-[#2c374d] flex items-center justify-center text-slate-200 font-mono font-bold text-xs shrink-0">
              {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>

            <div className="hidden md:block text-left leading-none">
              <p className="text-xs font-medium text-slate-200 truncate max-w-[110px]">
                {user?.full_name?.split(' ')[0] || user?.username}
              </p>
              <p className="text-[9px] font-mono text-amber-400 mt-0.5 uppercase tracking-wider font-semibold">
                {user?.role || 'HQ'}
              </p>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${profileDropdownOpen ? 'rotate-180 text-amber-400' : ''
                }`}
            />
          </button>

          {/* Profile & Role Persona Dropdown Popover */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-68 sm:w-72 bg-[#12161f] border border-[#222834] rounded shadow-2xl py-2 z-50 animate-in fade-in duration-100">
              {/* Operator Identification */}
              <div className="px-3 pb-2.5 border-b border-[#222834]">
                <p className="text-xs font-bold text-white truncate">{user?.full_name || user?.username}</p>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  {user?.email || `${user?.username}@swifttrack.co.ke`}
                </p>

                <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-[#18202d] text-amber-300 border border-[#222834]">
                    {user?.role}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#18202d] text-emerald-400 border border-[#222834]">
                    {selectedBranch?.code || 'HQ'}
                  </span>
                </div>
              </div>

              {/* Theme Selection in Profile Menu */}
              <div className="p-2 border-b border-[#222834]">
                <div className="px-1 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center justify-between">
                  <span>INTERFACE THEME</span>
                  <span className="text-amber-400 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#18202d] border border-[#222834]">
                    {theme} {theme === 'system' ? `(${resolvedTheme})` : ''}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => {
                      if (!audioMuted) sound.playScan();
                      setTheme('light');
                    }}
                    className={`px-2 py-1.5 rounded flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer ${theme === 'light'
                      ? 'bg-[#18202d] text-amber-300 font-medium border border-amber-400/30'
                      : 'hover:bg-[#161b26] text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!audioMuted) sound.playScan();
                      setTheme('dark');
                    }}
                    className={`px-2 py-1.5 rounded flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer ${theme === 'dark'
                      ? 'bg-[#18202d] text-amber-300 font-medium border border-amber-400/30'
                      : 'hover:bg-[#161b26] text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Dark</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!audioMuted) sound.playScan();
                      setTheme('system');
                    }}
                    className={`px-2 py-1.5 rounded flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer ${theme === 'system'
                      ? 'bg-[#18202d] text-amber-300 font-medium border border-amber-400/30'
                      : 'hover:bg-[#161b26] text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>System</span>
                  </button>
                </div>
              </div>

              {/* Single Consolidated Persona Switcher (Demo / Evaluation Mode Only) */}
              {demoMode && (
                <div className="p-2 border-b border-[#222834]">
                  <div className="px-1 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center justify-between">
                    <span>SWITCH DEMO PERSONA</span>
                    <Radio className="w-3 h-3 text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    {personaRoles.map((p) => {
                      const isCurrentRole =
                        user?.role === p.role ||
                        (user?.role === 'BRANCH_MANAGER' &&
                          ((p.role === 'BRANCH_MANAGER_NAIROBI' && user.branch_id === 1) ||
                            (p.role === 'BRANCH_MANAGER_MOMBASA' && user.branch_id === 2)));

                      const Icon = p.icon;

                      return (
                        <button
                          key={p.role}
                          onClick={() => handleRoleSelect(p.role)}
                          className={`w-full px-2.5 py-1.5 rounded flex items-center justify-between text-left text-xs transition-colors cursor-pointer ${isCurrentRole
                            ? 'bg-[#18202d] text-amber-300 font-medium border border-amber-400/30'
                            : 'hover:bg-[#161b26] text-slate-300 hover:text-white'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${isCurrentRole ? 'text-amber-400' : 'text-slate-400'}`} />
                            <div className="min-w-0">
                              <span className="truncate block leading-tight">{p.label}</span>
                              <span className="text-[9px] text-slate-500 font-mono block leading-tight">{p.desc}</span>
                            </div>
                          </div>
                          {isCurrentRole && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => handleRoleSelect('SUPER_ADMIN')}
                      className="w-full px-2.5 py-1.5 rounded text-left text-xs text-slate-400 hover:text-white hover:bg-[#161b26] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Reset to Super Admin HQ</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Enterprise Operator Sign Out */}
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    logout();
                  }}
                  className="w-full px-2.5 py-1.5 rounded text-left text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="font-semibold">Sign Out Operator</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
