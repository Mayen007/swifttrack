import React from 'react';
import { Send, X } from 'lucide-react';

export function TestDispatchModal({
  isOpen,
  onClose,
  testForm,
  setTestForm,
  templates,
  actionLoading,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Live Test Communication Dispatch</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
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
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
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
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
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
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Send Test Now</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
