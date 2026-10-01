import React from 'react';
import { Sparkles, Phone, MessageSquare, Edit3 } from 'lucide-react';
import { getEventBadge } from './constants.jsx';

export function TemplatesTab({ templates, canManage, onOpenEditTemplate }) {
  return (
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
                  onClick={() => onOpenEditTemplate(tmpl)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
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
  );
}
