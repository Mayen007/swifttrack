import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { sound } from '../services/sound.js';
import { CommunicationsHeader } from '../components/communications/CommunicationsHeader.jsx';
import { OutboxTab } from '../components/communications/OutboxTab.jsx';
import { TemplatesTab } from '../components/communications/TemplatesTab.jsx';
import { GatewaysTab } from '../components/communications/GatewaysTab.jsx';
import { TestDispatchModal } from '../components/communications/TestDispatchModal.jsx';
import { EditTemplateModal } from '../components/communications/EditTemplateModal.jsx';

export function CommunicationsView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('outbox');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [testForm, setTestForm] = useState({
    channel: 'SMS',
    destination: user?.phone || '',
    template_code: 'BOOKED_CONFIRMATION',
    custom_message: ''
  });

  const [templateForm, setTemplateForm] = useState({
    sms_template: '',
    whatsapp_template: '',
    email_template: '',
    email_subject: '',
    is_active: 1
  });

  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_MANAGER';

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

  const handleResendItem = async (itemId) => {
    sound.playClick();
    try {
      await api.post(`/api/v1/notifications-engine/outbox/${itemId}/retry`);
      sound.playSuccess();
      api.toast(`Dispatched notification ${itemId} successfully`, 'success');
      await fetchData();
    } catch (err) {
      sound.playError();
      api.toast(err.message || 'Resend attempt failed', 'error');
    }
  };

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

  return (
    <div className="space-y-6">
      <CommunicationsHeader
        stats={stats}
        loading={loading}
        actionLoading={actionLoading}
        canManage={canManage}
        onRefresh={fetchData}
        onProcessQueue={handleProcessQueue}
        onOpenTest={() => setTestModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        outboxCount={outboxPagination.total || outbox.length}
        templatesCount={templates.length}
      />

      {activeTab === 'outbox' && (
        <OutboxTab
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          channelFilter={channelFilter}
          setChannelFilter={setChannelFilter}
          outbox={outbox}
          outboxPagination={outboxPagination}
          copiedId={copiedId}
          copyToClipboard={copyToClipboard}
          canManage={canManage}
          onResendItem={handleResendItem}
        />
      )}

      {activeTab === 'templates' && (
        <TemplatesTab
          templates={templates}
          canManage={canManage}
          onOpenEditTemplate={handleOpenEditTemplate}
        />
      )}

      {activeTab === 'gateways' && (
        <GatewaysTab />
      )}

      <TestDispatchModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        testForm={testForm}
        setTestForm={setTestForm}
        templates={templates}
        actionLoading={actionLoading}
        onSubmit={handleSendTest}
      />

      <EditTemplateModal
        isOpen={editTemplateModalOpen}
        onClose={() => setEditTemplateModalOpen(false)}
        selectedTemplate={selectedTemplate}
        templateForm={templateForm}
        setTemplateForm={setTemplateForm}
        actionLoading={actionLoading}
        onSubmit={handleSaveTemplate}
      />
    </div>
  );
}
