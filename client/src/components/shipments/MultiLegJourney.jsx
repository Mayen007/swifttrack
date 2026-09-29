// client/src/components/shipments/MultiLegJourney.jsx
// SwiftTrack Logistics: Interactive Multi-Leg Corridor Visualizer & Cross-Border Customs Console
import React, { useState } from 'react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';
import {
  MapPin,
  ArrowRight,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  FileText,
  FileCheck2,
  X,
  Send,
  Loader2,
  ChevronDown,
  Layers
} from 'lucide-react';

export function MultiLegJourney({ shipment, legs = [], onUpdate }) {
  const [selectedLegForCustoms, setSelectedLegForCustoms] = useState(null);
  const [customsAction, setCustomsAction] = useState(null); // 'SUBMIT' | 'INSPECT' | 'HOLD' | 'CLEAR' | 'RELEASE'
  const [actionForm, setActionForm] = useState({
    declaration_number: '',
    certificate_number: '',
    hold_reason: 'VALUATION_DISCREPANCY',
    notes: '',
    documents_verified: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (!legs || legs.length === 0) {
    return (
      <div className="bg-[#12161f] border border-[#222834] p-4 rounded-xl text-center">
        <p className="text-xs text-slate-400">Single-leg direct transfer. No multi-leg routing segments configured.</p>
      </div>
    );
  }

  const openCustomsModal = (leg, actionType) => {
    setSelectedLegForCustoms(leg);
    setCustomsAction(actionType);
    setActionError(null);
    setActionForm({
      declaration_number: leg.customs_declaration_number || `DEC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      certificate_number: `CC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      hold_reason: 'DOCUMENTATION_MISSING',
      notes: '',
      documents_verified: true
    });
    sound.playClick();
  };

  const handleExecuteCustomsAction = async (e) => {
    e.preventDefault();
    if (!selectedLegForCustoms || !customsAction) return;

    setSubmitting(true);
    setActionError(null);

    try {
      let endpoint = '';
      let payload = {};

      switch (customsAction) {
        case 'SUBMIT':
          endpoint = `/api/transport/legs/${selectedLegForCustoms.id}/customs/submit`;
          payload = {
            declaration_number: actionForm.declaration_number,
            documents_verified: actionForm.documents_verified,
            notes: actionForm.notes
          };
          break;
        case 'INSPECT':
          endpoint = `/api/transport/legs/${selectedLegForCustoms.id}/customs/inspect`;
          payload = {
            inspection_result: 'SATISFACTORY',
            notes: actionForm.notes || 'Border post physical inspection completed. Cargo and seals verified.'
          };
          break;
        case 'HOLD':
          endpoint = `/api/transport/legs/${selectedLegForCustoms.id}/customs/hold`;
          payload = {
            hold_reason: actionForm.hold_reason,
            notes: actionForm.notes || 'Cargo detained by border customs pending audit.'
          };
          break;
        case 'CLEAR':
          endpoint = `/api/transport/legs/${selectedLegForCustoms.id}/customs/clear`;
          payload = {
            certificate_number: actionForm.certificate_number,
            notes: actionForm.notes || 'Customs clearance duty assessment cleared.'
          };
          break;
        case 'RELEASE':
          endpoint = `/api/transport/legs/${selectedLegForCustoms.id}/customs/release`;
          payload = {
            notes: actionForm.notes || 'Gate pass authorized. Released to continue transit.'
          };
          break;
        default:
          throw new Error('Unrecognized customs action');
      }

      await api.post(endpoint, payload);
      sound.playSuccess();
      setSelectedLegForCustoms(null);
      setCustomsAction(null);
      if (onUpdate) onUpdate();
    } catch (err) {
      sound.playError();
      setActionError(err.message || 'Customs operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const getLegStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
            <Truck className="w-3 h-3" />
            IN TRANSIT
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" />
            ACTIVE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Clock className="w-3 h-3" />
            PENDING
          </span>
        );
    }
  };

  const getCustomsBadge = (customsStatus, holdReason) => {
    switch (customsStatus) {
      case 'RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Customs Released
          </span>
        );
      case 'CLEARED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
            <ShieldCheck className="w-3 h-3" />
            Customs Cleared
          </span>
        );
      case 'INSPECTION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
            <Clock className="w-3 h-3" />
            Under Inspection
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <AlertTriangle className="w-3 h-3" />
            Hold: {holdReason || 'Flagged'}
          </span>
        );
      case 'DECLARED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <FileText className="w-3 h-3" />
            Declaration Filed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            <FileCheck2 className="w-3 h-3" />
            Awaiting Declaration
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          Multi-Leg Corridor Journey ({legs.length} Segments)
        </h3>
        <span className="text-[10px] font-mono text-slate-400">
          Routing Sequence 1 $\to$ {legs.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {legs.map((leg, index) => {
          const isCurrentActive = leg.status === 'IN_TRANSIT' || leg.status === 'ACTIVE' || (leg.status === 'PENDING' && index === 0);
          const isCrossBorder = Boolean(leg.is_cross_border);

          return (
            <div
              key={leg.id || index}
              className={`p-3.5 rounded-xl border transition-all ${
                isCurrentActive
                  ? 'bg-[#151a24] border-blue-500/40 shadow-lg shadow-blue-500/5'
                  : 'bg-[#11141c] border-[#222834]'
              }`}
            >
              {/* Top Leg Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#181d28] text-slate-300 border border-[#262d3d]">
                    LEG {String(leg.leg_sequence || index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {leg.origin_hub_name || `Hub #${leg.origin_hub_id}`} $\to$ {leg.destination_hub_name || `Hub #${leg.destination_hub_id}`}
                  </span>
                </div>
                {getLegStatusBadge(leg.status)}
              </div>

              {/* Manifest & Vehicle Details */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 bg-[#0e1117] p-2.5 rounded-lg border border-[#1b202c]">
                <div>
                  <span className="text-slate-500 text-[10px]">Manifest Assignment:</span>
                  <p className="font-mono text-slate-200">
                    {leg.manifest_id ? `MF-${String(leg.manifest_id).padStart(5, '0')}` : 'Awaiting Manifest'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px]">Leg Type:</span>
                  <p className="font-medium text-slate-200">
                    {isCrossBorder ? '🌍 Cross-Border Corridor' : '🚛 Domestic Linehaul'}
                  </p>
                </div>
                {leg.actual_departure && (
                  <div>
                    <span className="text-slate-500 text-[10px]">Departed:</span>
                    <p className="text-slate-300 font-mono text-[10px]">
                      {new Date(leg.actual_departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                )}
                {leg.actual_arrival && (
                  <div>
                    <span className="text-slate-500 text-[10px]">Arrived Hub:</span>
                    <p className="text-slate-300 font-mono text-[10px]">
                      {new Date(leg.actual_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                )}
              </div>

              {/* Cross-Border Customs Section */}
              {isCrossBorder && (
                <div className="mt-2.5 pt-2.5 border-t border-[#1e2330] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-amber-400">🛂 {leg.border_post_name || 'Border Post Checkpoint'}</span>
                    </div>
                    {getCustomsBadge(leg.customs_status, leg.customs_hold_reason)}
                  </div>

                  {leg.customs_declaration_number && (
                    <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between bg-[#181d28] px-2.5 py-1 rounded">
                      <span>Declaration: {leg.customs_declaration_number}</span>
                      {leg.cleared_at && <span className="text-emerald-400">Cleared</span>}
                    </div>
                  )}

                  {/* Customs Operator Actions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {(!leg.customs_status || leg.customs_status === 'PENDING') && (
                      <button
                        onClick={() => openCustomsModal(leg, 'SUBMIT')}
                        className="px-2.5 py-1 rounded text-[10px] font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition"
                      >
                        Submit Declaration
                      </button>
                    )}

                    {leg.customs_status === 'DECLARED' && (
                      <button
                        onClick={() => openCustomsModal(leg, 'INSPECT')}
                        className="px-2.5 py-1 rounded text-[10px] font-bold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition"
                      >
                        Start Inspection
                      </button>
                    )}

                    {['DECLARED', 'INSPECTION'].includes(leg.customs_status) && (
                      <>
                        <button
                          onClick={() => openCustomsModal(leg, 'CLEAR')}
                          className="px-2.5 py-1 rounded text-[10px] font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition"
                        >
                          Clear Customs
                        </button>
                        <button
                          onClick={() => openCustomsModal(leg, 'HOLD')}
                          className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition"
                        >
                          Place Hold
                        </button>
                      </>
                    )}

                    {leg.customs_status === 'ON_HOLD' && (
                      <button
                        onClick={() => openCustomsModal(leg, 'CLEAR')}
                        className="px-2.5 py-1 rounded text-[10px] font-bold bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 transition"
                      >
                        Resolve & Clear
                      </button>
                    )}

                    {leg.customs_status === 'CLEARED' && (
                      <button
                        onClick={() => openCustomsModal(leg, 'RELEASE')}
                        className="px-2.5 py-1 rounded text-[10px] font-bold bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 transition flex items-center gap-1"
                      >
                        <Truck className="w-3 h-3" />
                        Release to Transit
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Customs Workflow Execution Modal */}
      {selectedLegForCustoms && customsAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-[#0e1219] border border-[#222834] rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#222834]">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  Customs Action: {customsAction}
                </h4>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Border Post: {selectedLegForCustoms.border_post_name || 'Checkpoint'} (Leg #{selectedLegForCustoms.leg_sequence})
                </p>
              </div>
              <button
                onClick={() => setSelectedLegForCustoms(null)}
                className="p-1.5 rounded-lg bg-[#181d28] text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteCustomsAction} className="space-y-3 text-xs">
              {customsAction === 'SUBMIT' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Customs Declaration Number (Single Custom Declaration)
                  </label>
                  <input
                    type="text"
                    value={actionForm.declaration_number}
                    onChange={(e) => setActionForm({ ...actionForm, declaration_number: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-[#262c3c] text-white font-mono"
                    placeholder="e.g. DEC-2026-88192"
                  />
                </div>
              )}

              {customsAction === 'CLEAR' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Customs Clearance Certificate #
                  </label>
                  <input
                    type="text"
                    value={actionForm.certificate_number}
                    onChange={(e) => setActionForm({ ...actionForm, certificate_number: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-[#262c3c] text-white font-mono"
                    placeholder="e.g. CC-2026-4491"
                  />
                </div>
              )}

              {customsAction === 'HOLD' && (
                <div>
                  <label className="block text-[11px] font-medium text-rose-300 mb-1">
                    Customs Detention / Hold Reason (Creates Operational Exception)
                  </label>
                  <select
                    value={actionForm.hold_reason}
                    onChange={(e) => setActionForm({ ...actionForm, hold_reason: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-[#262c3c] text-white"
                  >
                    <option value="DOCUMENTATION_MISSING">DOCUMENTATION_MISSING — Invoice / Origin Missing</option>
                    <option value="VALUATION_DISCREPANCY">VALUATION_DISCREPANCY — Tariff Code Audit Required</option>
                    <option value="PHYSICAL_INSPECTION_FAILED">PHYSICAL_INSPECTION_FAILED — Seal Broken / Mismatch</option>
                    <option value="SECURITY_FLAG">SECURITY_FLAG — Border Security Directive</option>
                    <option value="DUTY_UNPAID">DUTY_UNPAID — Cross-Border Duty Assessment Pending</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Operator Notes / Verification Comments
                </label>
                <textarea
                  value={actionForm.notes}
                  onChange={(e) => setActionForm({ ...actionForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-[#141822] border border-[#262c3c] text-white"
                  placeholder="Official observations recorded at border clearance post..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222834]">
                <button
                  type="button"
                  onClick={() => setSelectedLegForCustoms(null)}
                  className="px-3 py-2 rounded-xl bg-[#181d28] hover:bg-[#202737] text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow ${
                    customsAction === 'HOLD'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Confirm {customsAction}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
