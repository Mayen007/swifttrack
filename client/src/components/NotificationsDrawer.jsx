// client/src/components/NotificationsDrawer.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Bell, AlertTriangle, RotateCcw, Truck, X, CheckCheck, ArrowRight, Package, ShoppingBag, ShieldCheck } from 'lucide-react';

export function NotificationsDrawer({ isOpen, onClose, onRefreshCount, onNavigate }) {
  const { user } = useAuth();
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

  const handleNotificationClick = async (n) => {
    // 1. Mark as read
    if (!n.is_read) {
      markOneRead(n.id);
    }

    // 2. Resolve destination view and focus ID
    let targetView = null;
    let focusId = n.reference_id || null;

    const refType = (n.reference_type || '').toUpperCase();
    const notifType = (n.type || '').toUpperCase();

    const role = (user?.role || user?.roleName || '').toUpperCase();

    if (refType === 'DELIVERY' || notifType.includes('DELIVERY') || notifType.includes('DISPATCH')) {
      // If user is a driver or supervisor viewing driver operations
      if (role === 'DRIVER') {
        targetView = 'driver';
      } else {
        targetView = 'dispatch';
      }
    } else if (refType === 'ORDER' || notifType.includes('ORDER')) {
      targetView = 'orders';
    } else if (refType === 'SHIPMENT') {
      targetView = 'shipments';
    } else if (refType === 'INVENTORY' || notifType === 'LOW_STOCK') {
      targetView = 'inventory';
    } else if (refType === 'APPROVAL' || notifType === 'REFUND_REQUEST') {
      targetView = 'approvals';
    } else if (refType === 'COMMUNICATION') {
      targetView = 'communications';
    }

    if (targetView && onNavigate) {
      if (focusId) {
        try {
          sessionStorage.setItem('swifttrack_focus_delivery_id', String(focusId));
        } catch {}

        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('swifttrack:focus_delivery', { detail: { deliveryId: focusId } }));
        }, 150);
      }

      const navParams = focusId && targetView === 'driver' ? { delivery_id: focusId } : {};
      onNavigate(targetView, navParams);
      if (onClose) onClose();
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
              <p className="text-xs text-gray-400 mt-1">Real-time alerts, courier dispatches & system logs</p>
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
                  if (n.type === 'REFUND_REQUEST') return <RotateCcw className="w-4 h-4 text-rose-400" />;
                  if (n.type?.includes('DELIVERY') || n.type?.includes('DISPATCH') || n.reference_type === 'DELIVERY') {
                    return <Truck className="w-4 h-4 text-cyan-400" />;
                  }
                  if (n.reference_type === 'SHIPMENT') return <Package className="w-4 h-4 text-indigo-400" />;
                  if (n.reference_type === 'ORDER') return <ShoppingBag className="w-4 h-4 text-emerald-400" />;
                  return <Bell className="w-4 h-4 text-blue-400" />;
                };

                const hasTaskTarget = Boolean(n.reference_type || n.type?.includes('DELIVERY') || n.type?.includes('ORDER'));

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 rounded-xl border transition-all duration-200 group cursor-pointer ${
                      n.is_read
                        ? 'bg-gray-800/40 border-gray-800 text-gray-400 hover:border-gray-700 hover:bg-gray-800/60'
                        : 'bg-blue-950/20 border-blue-900/40 text-white shadow-sm hover:border-blue-500/60 hover:bg-blue-950/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-gray-800 border border-gray-700/60 shrink-0 group-hover:border-blue-500/40 transition-colors">
                        {getIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            {!n.is_read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 animate-pulse" />
                            )}
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                              {n.title}
                            </h4>
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                            {new Date(n.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1 leading-relaxed">{n.message}</p>

                        {hasTaskTarget && (
                          <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-blue-400 group-hover:text-cyan-300 flex items-center gap-1 font-semibold transition-colors">
                              <span>Open Assigned Task</span>
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                            {n.reference_id && (
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.2 rounded border border-[#222834]">
                                #{n.reference_id}
                              </span>
                            )}
                          </div>
                        )}
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
