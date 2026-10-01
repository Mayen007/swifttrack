import React from 'react';
import { Edit3, X, CheckCircle2 } from 'lucide-react';

export function EditTemplateModal({
  isOpen,
  onClose,
  selectedTemplate,
  templateForm,
  setTemplateForm,
  actionLoading,
  onSubmit
}) {
  if (!isOpen || !selectedTemplate) return null;

  return (
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
              <CheckCircle2 className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Save Template</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
