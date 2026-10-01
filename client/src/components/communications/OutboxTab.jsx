import React from 'react';
import {
  Search,
  MessageSquare,
  Package,
  Check,
  Copy,
  AlertTriangle,
  RotateCw
} from 'lucide-react';
import { sound } from '../../services/sound.js';
import { getEventBadge, getChannelBadge, getStatusBadge } from './constants.jsx';

export function OutboxTab({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  channelFilter,
  setChannelFilter,
  outbox,
  outboxPagination,
  copiedId,
  copyToClipboard,
  canManage,
  onResendItem
}) {
  return (
    <div className="space-y-4">
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
            onChange={(e) => {
              sound.playClick();
              setStatusFilter(e.target.value);
            }}
            className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>

          <select
            value={channelFilter}
            onChange={(e) => {
              sound.playClick();
              setChannelFilter(e.target.value);
            }}
            className="bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
          >
            <option value="ALL">All Channels</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
          </select>
        </div>
      </div>

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
                              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
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
                          onClick={() => onResendItem(item.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-all flex items-center gap-1 ml-auto cursor-pointer"
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

        <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span>Showing {outbox.length} of {outboxPagination.total || outbox.length} records</span>
          <span>Rule NTF-002: Outbox guarantees zero blocking of core business mutations</span>
        </div>
      </div>
    </div>
  );
}
