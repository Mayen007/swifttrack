// client/src/components/NotificationsDrawer.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Bell, AlertTriangle, RotateCcw, Truck, X, CheckCheck } from 'lucide-react';

export function NotificationsDrawer({ isOpen, onClose, onRefreshCount }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/notifications');
      if (res && res.notifications) {
        setNotifications(res.notifications);
        if (onRefreshCount) onRefreshCount(res.unread_count || 0);
      }
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const markAllRead = async () => {
    try {
      await api.post('/api/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      if (onRefreshCount) onRefreshCount(0);
      api.toast('All notifications marked as read', 'success');
    } catch (e) {
      api.toast('Failed to mark notifications read', 'error');
    }
  };

  const markOneRead = async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`, {});
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n));
        if (onRefreshCount) {
          const unread = next.filter((n) => !n.is_read).length;
          onRefreshCount(unread);
        }
        return next;
      });
    } catch (e) {
      console.error('Failed to mark notification read:', e);
    }
  };

  if (!isOpen) return null;

  const unreadTotal = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-950/60">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-400" />
                <span>Notifications</span>
                {unreadTotal > 0 && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {unreadTotal} new
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400 mt-1">Real-time alerts and system logs</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={markAllRead}
                disabled={unreadTotal === 0}
                className={`text-xs font-medium flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  unreadTotal > 0
                    ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-950/40'
                    : 'text-gray-500 cursor-not-allowed opacity-50'
                }`}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                No notifications found.
              </div>
            ) : (
              notifications.map((n) => {
                const getIcon = () => {
                  if (n.type === 'LOW_STOCK') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
                  if (n.type === 'REFUND_REQUEST') return <RotateCcw className="w-4 h-4 text-purple-400" />;
                  if (n.type === 'DISPATCH_ASSIGNED') return <Truck className="w-4 h-4 text-blue-400" />;
                  return <Bell className="w-4 h-4 text-blue-400" />;
                };

                return (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markOneRead(n.id)}
                    title={!n.is_read ? 'Click to mark as read' : ''}
                    className={`p-4 rounded-xl border transition-all duration-200 ${n.is_read
                        ? 'bg-gray-800/40 border-gray-800 text-gray-400'
                        : 'bg-blue-950/20 border-blue-900/40 text-white shadow-sm cursor-pointer hover:border-blue-700/60'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gray-800 border border-gray-700/60 shrink-0">
                        {getIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            {!n.is_read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            )}
                            <h4 className="text-xs font-bold text-white truncate">{n.title}</h4>
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                            {new Date(n.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1 leading-relaxed">{n.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
