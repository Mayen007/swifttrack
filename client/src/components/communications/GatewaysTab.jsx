import React from 'react';
import { Phone, MessageSquare, Mail } from 'lucide-react';

export function GatewaysTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
  );
}
