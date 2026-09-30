// client/src/views/CommunicationsView.jsx
// SwiftTrack Kenya Logistics: Stage 9 Milestone Notifications & Communications Dispatch Engine
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import {
  MessageSquare,
  Mail,
  Phone,
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Sparkles,
  Radio,
  Layers,
  Settings,
  Edit3,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  RotateCw,
  Hash,
  ChevronRight,
  User,
  Package,
  Calendar,
  Key,
  X
} from 'lucide-react';

export function CommunicationsView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('outbox'); // 'outbox' | 'templates' | 'gateways'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Telemetry & Data
  const [stats, setStats] = useState({
    total_notifications: 0,
    sent_count: 0,
    pending_count: 0,
    failed_count: 0,
    delivery_rate_pct: 100,
    channels: []
  });
  const [outbox, setOutbox] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [outboxPagination, setOutboxPagination] = useState({ total: 0, page: 1, limit: 25, total_pages: 1 });

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Test Dispatch Form
  const [testForm, setTestForm] = useState({
    channel: 'SMS',
    destination: '+254712345678',
    template_code: 'BOOKED_CONFIRMATION',
    custom_message: ''
  });

  // Edit Template Form
  const [templateForm, setTemplateForm] = useState({
    sms_template: '',
    whatsapp_template: '',
    email_template: '',
    email_subject: '',
    is_active: 1
  });

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_MANAGER';

  // Fetch Telemetry & Outbox
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, outboxRes, templatesRes] = await Promise.allSettled([
        api.get('/api/v1/notifications-engine/stats'),
        api.get(`/api/v1/notifications-engine/outbox?status=${statusFilter}&channel=${channelFilter}&search=${encodeURIComponent(searchQuery)}&limit=25`),
        api.get('/api/v1/notifications-engine/templates')
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value);
      }
      if (outboxRes.status === 'fulfilled' && outboxRes.value) {
        setOutbox(outboxRes.value.items || []);
        if (outboxRes.value.pagination) {
          setOutboxPagination(outboxRes.value.pagination);
        }
      }
      if (templatesRes.status === 'fulfilled' && Array.isArray(templatesRes.value)) {
        setTemplates(templatesRes.value);
      }
    } catch (err) {
      console.error('Error fetching communications data:', err);
      api.toast('Failed to refresh communications engine data', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, channelFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Manual Queue Sweep
  const handleProcessQueue = async () => {
    setActionLoading(true);
    sound.playClick();
    try {
      const res = await api.post('/api/v1/notifications-engine/process-queue', { batch_size: 50 });
      sound.playSuccess();
      api.toast(`Queue processed: ${res?.success_count || 0} sent, ${res?.failed_count || 0} failed`, 'success');
      await fetchData();
    } catch (err) {
      sound.playError();
      api.toast(err.message || 'Failed to process outbox queue', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Resend Single Item
  const handleResendItem = async (itemId) => {
    sound.playClick();
    try {
      const res = await api.post(`/api/v1/notifications-engine/outbox/${itemId}/retry`);
      sound.playSuccess();
      api.toast(`Dispatched notification ${itemId} successfully`, 'success');
      await fetchData();
    } catch (err) {
      sound.playError();
      api.toast(err.message || 'Resend attempt failed', 'error');
    }
  };

  // Handle Send Test Dispatch
  const handleSendTest = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    sound.playClick();
    try {
      await api.post('/api/v1/notifications-engine/test-send', {
        channel: testForm.channel,
        destination: testForm.destination,
        template_code: testForm.template_code,
        message: testForm.custom_message || undefined
      });
      sound.playSuccess();
      api.toast(`Test ${testForm.channel} dispatch sent successfully!`, 'success');
      setTestModalOpen(false);
      await fetchData();
    } catch (err) {
      sound.playError();
      api.toast(err.message || 'Test dispatch failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Template Editor
  const handleOpenEditTemplate = (tmpl) => {
    setSelectedTemplate(tmpl);
    setTemplateForm({
      sms_template: tmpl.sms_template || '',
      whatsapp_template: tmpl.whatsapp_template || '',
      email_template: tmpl.email_template || '',
      email_subject: tmpl.email_subject || '',
      is_active: tmpl.is_active ? 1 : 0
    });
    setEditTemplateModalOpen(true);
  };

  // Save Template Changes
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setActionLoading(true);
    sound.playClick();
    try {
      await api.put(`/api/v1/notifications-engine/templates/${selectedTemplate.template_code}`, templateForm);
      sound.playSuccess();
      api.toast(`Template ${selectedTemplate.template_code} updated successfully`, 'success');
      setEditTemplateModalOpen(false);
      await fetchData();
    } catch (err) {
      sound.playError();
      api.toast(err.message || 'Failed to update template', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    sound.playClick();
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getEventBadge = (eventType) => {
    switch (eventType) {
      case 'BOOKED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-900/40 text-blue-300 border border-blue-700/50">BOOKED</span>;
      case 'ACCEPTED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-900/40 text-indigo-300 border border-indigo-700/50">ACCEPTED</span>;
      case 'DISPATCHED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-cyan-900/40 text-cyan-300 border border-cyan-700/50">DISPATCHED</span>;
      case 'OUT_FOR_DELIVERY':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-900/40 text-amber-300 border border-amber-700/50 animate-pulse">OUT FOR DELIVERY</span>;
      case 'DELIVERED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">DELIVERED</span>;
      case 'DELIVERY_FAILED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-900/40 text-rose-300 border border-rose-700/50">FAILED ATTEMPT</span>;
      case 'EXCEPTION':
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-900/40 text-red-300 border border-red-700/50">EXCEPTION</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">{eventType}</span>;
    }
  };

  const getChannelBadge = (channel) => {
    switch (channel) {
      case 'SMS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            <Phone className="w-3 h-3" /> SMS
          </span>
        );
      case 'WHATSAPP':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-950/60 text-green-400 border border-green-800/40">
            <MessageSquare className="w-3 h-3" /> WhatsApp
          </span>
        );
      case 'EMAIL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-950/60 text-blue-400 border border-blue-800/40">
            <Mail className="w-3 h-3" /> Email
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{channel}</span>;
    }
  };

  const getStatusBadge = (status, retryCount, maxRetries) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Sent
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" /> Failed ({retryCount}/{maxRetries})
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP COMMUNICATIONS STATUS INSTRUMENT (STACKED BENTO GRID) */}
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Tier 1: Platform & Communications Engine Identity + Action Toolbar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start relative z-10">
          {/* Identity & Status */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
              </span>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/40">
                Stage 9 Communications Engine Active
              </span>
              <span className="text-xs text-slate-400 font-mono">
                SMS • WhatsApp • Email Relay
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight flex flex-wrap items-center gap-2.5 font-sans">
              Communications Dispatch Engine
              <span className="text-xs px-2.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-medium font-mono">
                Rules NTF-001..004
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Multi-channel transactional outbox with guaranteed zero-blocking dispatch, template interpolation, and milestone lifecycle hooks.
            </p>
          </div>

          {/* Action Toolbar (Stacked Vertically without Squishing) */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-2.5 bg-[#0e1219]/90 border border-[#222834] rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono pb-1 border-b border-[#222834]">
              <span>QUEUE CONTROLS</span>
              <span className="text-emerald-400 font-semibold">Automated SLA Worker Active</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => { sound.playClick(); fetchData(); }}
                disabled={loading}
                className="flex items-center justify-center space-x-1.5 py-2 px-2.5 bg-[#181d28] hover:bg-[#222836] border border-[#263044] text-slate-200 text-xs font-medium rounded transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Refresh Outbox Telemetry"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
                <span className="truncate">Refresh</span>
              </button>

              {canManage && (
                <>
                  <button
                    onClick={handleProcessQueue}
                    disabled={actionLoading}
                    className="flex items-center justify-center space-x-1.5 py-2 px-2.5 bg-[#181d28] hover:bg-[#222836] border border-amber-500/30 text-amber-300 text-xs font-semibold rounded transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    title="Sweep and dispatch all pending outbox records now"
                  >
                    <Zap className={`w-3.5 h-3.5 text-amber-400 ${actionLoading ? 'animate-spin' : ''}`} />
                    <span className="truncate">Process</span>
                  </button>

                  <button
                    onClick={() => { sound.playClick(); setTestModalOpen(true); }}
                    className="flex items-center justify-center space-x-1.5 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/60 text-white font-bold text-xs rounded transition-all active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span className="truncate">Test Send</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tier 2: Stacked Operational Telemetry Bento KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3.5 mt-3.5 border-t border-[#222834] relative z-10">
          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Total Queued</span>
              <div className="text-xl font-bold text-white font-mono">{stats.total_notifications}</div>
              <span className="text-[10px] text-slate-500 block font-mono">Milestones</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Delivery SLA</span>
              <div className="text-xl font-bold text-emerald-400 font-mono">{stats.delivery_rate_pct}%</div>
              <span className="text-[10px] text-emerald-500/80 block font-mono">&gt;98.5% Target</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Delivered</span>
              <div className="text-xl font-bold text-white font-mono">{stats.sent_count}</div>
              <span className="text-[10px] text-slate-500 block font-mono">Carrier ACK</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Pending Outbox</span>
              <div className={`text-xl font-bold font-mono ${stats.pending_count > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
                {stats.pending_count}
              </div>
              <span className="text-[10px] text-slate-500 block font-mono">Worker cycle</span>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stats.pending_count > 0 ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-800/50 border border-slate-700/40 text-slate-400'}`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-[#0e1219]/80 border border-[#222834] rounded-xl p-3 flex items-center justify-between col-span-2 sm:col-span-1">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Failed / Retrying</span>
              <div className={`text-xl font-bold font-mono ${stats.failed_count > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
                {stats.failed_count}
              </div>
              <span className="text-[10px] text-slate-500 block font-mono">Backoff retry</span>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stats.failed_count > 0 ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400' : 'bg-slate-800/50 border border-slate-700/40 text-slate-400'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => { sound.playClick(); setActiveTab('outbox'); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'outbox'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Transactional Outbox & Logs</span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
            {outboxPagination.total || outbox.length}
          </span>
        </button>

        <button
          onClick={() => { sound.playClick(); setActiveTab('templates'); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>Milestone Templates</span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
            {templates.length}
          </span>
        </button>

        <button
          onClick={() => { sound.playClick(); setActiveTab('gateways'); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'gateways'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Gateway Adapters</span>
        </button>
      </div>

      {/* TAB 1: OUTBOX */}
      {activeTab === 'outbox' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/60 p-3 rounded-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search tracking #, recipient name, or phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => { sound.playClick(); setStatusFilter(e.target.value); }}
                className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/60"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
              </select>

              <select
                value={channelFilter}
                onChange={(e) => { sound.playClick(); setChannelFilter(e.target.value); }}
                className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/60"
              >
                <option value="ALL">All Channels</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
          </div>

          {/* Outbox Table */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Milestone & Channel</th>
                    <th className="py-3 px-4">Tracking & Recipient</th>
                    <th className="py-3 px-4">Rendered Content</th>
                    <th className="py-3 px-4">Status & Attempts</th>
                    <th className="py-3 px-4">Queued / Sent</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {outbox.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-500">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        No notification outbox records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    outbox.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            {getEventBadge(item.event_type)}
                            <div className="flex items-center gap-1.5">
                              {getChannelBadge(item.channel)}
                              <span className="text-[11px] font-mono text-slate-500">#{item.id}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {item.tracking_number ? (
                              <div className="flex items-center gap-1 font-mono text-xs font-semibold text-indigo-300">
                                <Package className="w-3 h-3 text-indigo-400" />
                                {item.tracking_number}
                                <button
                                  onClick={() => copyToClipboard(item.tracking_number, `trk-${item.id}`)}
                                  className="text-slate-500 hover:text-slate-300 transition-colors"
                                  title="Copy tracking number"
                                >
                                  {copiedId === `trk-${item.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">System Direct</span>
                            )}
                            <div className="text-xs text-slate-200 font-medium">{item.recipient_name}</div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {item.channel === 'EMAIL' ? item.recipient_email : item.recipient_phone}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-sm">
                          <div className="bg-slate-950/70 border border-slate-800/80 p-2.5 rounded-lg text-xs font-mono text-slate-300 line-clamp-3 leading-relaxed">
                            {item.rendered_content}
                          </div>
                          {item.last_error && (
                            <div className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{item.last_error}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getStatusBadge(item.status, item.retry_count, item.max_retries)}
                          {item.status === 'FAILED' && item.retry_count < item.max_retries && (
                            <div className="text-[10px] text-amber-400/80 mt-1">
                              Next attempt: {new Date(item.next_retry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400">
                          <div>{new Date(item.created_at).toLocaleDateString()}</div>
                          <div className="text-slate-500">{new Date(item.created_at).toLocaleTimeString()}</div>
                          {item.sent_at && (
                            <div className="text-[10px] text-emerald-400 mt-0.5">
                              Sent: {new Date(item.sent_at).toLocaleTimeString()}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {canManage && (
                            <button
                              onClick={() => handleResendItem(item.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-all flex items-center gap-1 ml-auto"
                              title="Resend this notification immediately"
                            >
                              <RotateCw className="w-3 h-3" />
                              <span>{item.status === 'SENT' ? 'Resend' : 'Retry'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Showing {outbox.length} of {outboxPagination.total || outbox.length} records</span>
              <span>Rule NTF-002: Outbox guarantees zero blocking of core business mutations</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="bg-indigo-950/20 border border-indigo-500/20 p-4 rounded-xl flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-300">
              <span className="font-semibold text-white">Dynamic Token Interpolation:</span> All notification templates support dynamic replacement variables including{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 text-xs font-mono">{'{{tracking_number}}'}</code>,{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 text-xs font-mono">{'{{recipient_name}}'}</code>,{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 text-xs font-mono">{'{{otp_code}}'}</code>,{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 text-xs font-mono">{'{{origin_hub}}'}</code>,{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 text-xs font-mono">{'{{destination_hub}}'}</code>, and{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 text-xs font-mono">{'{{driver_name}}'}</code>.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/80 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getEventBadge(tmpl.event_type)}
                      <span className="font-mono text-xs text-slate-400">{tmpl.template_code}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${tmpl.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                      {tmpl.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white">{tmpl.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{tmpl.description}</p>

                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-emerald-400" /> SMS Template</span>
                        <span className="font-mono text-slate-500">{(tmpl.sms_template || '').length} chars (1 SMS = 160)</span>
                      </div>
                      <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg text-xs font-mono text-slate-300">
                        {tmpl.sms_template}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1">
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3 text-green-400" /> WhatsApp Template</span>
                      </div>
                      <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg text-xs font-mono text-slate-300">
                        {tmpl.whatsapp_template}
                      </div>
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => handleOpenEditTemplate(tmpl)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Template</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: GATEWAYS */}
      {activeTab === 'gateways' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Safaricom SMS */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Safaricom & Africa's Talking</h4>
                    <p className="text-xs text-slate-400">Kenya SMS Aggregator Gateway</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Online
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Sender ID</span>
                  <span className="font-mono text-emerald-400 font-bold">SWIFTTRACK</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Number Normalization</span>
                  <span className="font-mono text-slate-300">E.164 (+254...)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Average Latency</span>
                  <span className="font-mono text-emerald-400">1.18s</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Carrier Routing</span>
                  <span className="text-slate-300">Safaricom, Airtel, Telkom</span>
                </div>
              </div>
            </div>

            {/* Meta WhatsApp */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Meta WhatsApp Cloud API</h4>
                    <p className="text-xs text-slate-400">Twilio / Cloud Business Solution</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Online
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Template Namespace</span>
                  <span className="font-mono text-green-400">swifttrack_ke_ops</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Webhook Callbacks</span>
                  <span className="text-emerald-400">Active (Delivered/Read)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Average Latency</span>
                  <span className="font-mono text-emerald-400">0.94s</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Formatting</span>
                  <span className="text-slate-300">Markdown bold, italic, links</span>
                </div>
              </div>
            </div>

            {/* Email SMTP */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Transactional SMTP Relay</h4>
                    <p className="text-xs text-slate-400">Amazon SES / Resend Relay</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Online
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Outbound Address</span>
                  <span className="font-mono text-blue-400">ops@swifttrack.co.ke</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Security</span>
                  <span className="text-slate-300">TLS 1.3 / DKIM / SPF signed</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Average Latency</span>
                  <span className="font-mono text-emerald-400">1.45s</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Waybill Attachments</span>
                  <span className="text-slate-300">PDF automatic generator</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEST DISPATCH MODAL */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Live Test Communication Dispatch</h3>
              </div>
              <button
                onClick={() => setTestModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendTest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Delivery Channel
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['SMS', 'WHATSAPP', 'EMAIL'].map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setTestForm({ ...testForm, channel: ch })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        testForm.channel === ch
                          ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Recipient Destination ({testForm.channel === 'EMAIL' ? 'Email Address' : 'Kenyan Phone Number'})
                </label>
                <input
                  type={testForm.channel === 'EMAIL' ? 'email' : 'text'}
                  required
                  value={testForm.destination}
                  onChange={(e) => setTestForm({ ...testForm, destination: e.target.value })}
                  placeholder={testForm.channel === 'EMAIL' ? 'customer@example.com' : '0712345678 or +254...'}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {testForm.channel !== 'EMAIL' ? 'Automatically normalizes Kenyan 07xx, 01xx to +254 E.164' : 'Direct SMTP delivery'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Select Milestone Template
                </label>
                <select
                  value={testForm.template_code}
                  onChange={(e) => setTestForm({ ...testForm, template_code: e.target.value })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  {templates.map((t) => (
                    <option key={t.template_code} value={t.template_code}>
                      {t.name} ({t.template_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Custom Message Content (Optional Override)
                </label>
                <textarea
                  rows="3"
                  value={testForm.custom_message}
                  onChange={(e) => setTestForm({ ...testForm, custom_message: e.target.value })}
                  placeholder="Leave blank to use default interpolated milestone template..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded shadow-sm flex items-center gap-2"
                >
                  <Send className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span>Send Test Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEMPLATE MODAL */}
      {editTemplateModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Edit Milestone Template</h3>
                  <p className="text-xs text-slate-400">{selectedTemplate.name} ({selectedTemplate.template_code})</p>
                </div>
              </div>
              <button
                onClick={() => setEditTemplateModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  SMS Message Body
                </label>
                <textarea
                  rows="3"
                  required
                  value={templateForm.sms_template}
                  onChange={(e) => setTemplateForm({ ...templateForm, sms_template: e.target.value })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                />
                <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                  <span>Character count: {templateForm.sms_template.length}</span>
                  <span className="text-amber-400">1 SMS segment = 160 characters</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  WhatsApp Message Body (Markdown Formatted)
                </label>
                <textarea
                  rows="3"
                  required
                  value={templateForm.whatsapp_template}
                  onChange={(e) => setTemplateForm({ ...templateForm, whatsapp_template: e.target.value })}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateForm.is_active === 1}
                    onChange={(e) => setTemplateForm({ ...templateForm, is_active: e.target.checked ? 1 : 0 })}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Template active and enabled for automated triggers</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditTemplateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded shadow-sm flex items-center gap-2"
                >
                  <CheckCircle2 className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span>Save Template</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
