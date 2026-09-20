// client/src/components/inventory/InventoryStocktakeView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, CheckCircle, RefreshCw, AlertCircle, Save, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api.js';
import { sound } from '../../services/sound.js';

export function InventoryStocktakeView({ branchId, onNewSession }) {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/v1/inventory/stocktakes');
      setSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      api.toast('Failed to load stocktake sessions: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSessionDetails = async (id) => {
    try {
      setActionLoading(true);
      const data = await api.get(`/api/v1/inventory/stocktakes/${id}`);
      setSelectedSession(data);
      const initialCounts = {};
      data.items?.forEach(it => {
        initialCounts[it.id] = it.counted_quantity !== null ? it.counted_quantity : '';
      });
      setCounts(initialCounts);
    } catch (e) {
      api.toast('Failed to load session details: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSaveCounts = async () => {
    if (!selectedSession) return;
    try {
      setActionLoading(true);
      const payload = Object.entries(counts)
        .filter(([_, val]) => val !== '' && !isNaN(val))
        .map(([id, val]) => ({ id: Number(id), counted_quantity: Number(val) }));

      await api.post(`/api/v1/inventory/stocktakes/${selectedSession.id}/counts`, { counts: payload });
      sound.playSuccess();
      api.toast('Physical counts saved successfully', 'success');
      await fetchSessionDetails(selectedSession.id);
    } catch (e) {
      sound.playError();
      api.toast('Failed to save counts: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedSession) return;
    if (!window.confirm('Are you sure you want to reconcile this stocktake? All variance adjustments will immediately adjust system inventory.')) return;

    try {
      setActionLoading(true);
      await api.post(`/api/v1/inventory/stocktakes/${selectedSession.id}/reconcile`, {});
      sound.playCheckout();
      api.toast('Stocktake reconciled & inventory synchronized!', 'success');
      await fetchSessionDetails(selectedSession.id);
      fetchSessions();
    } catch (e) {
      sound.playError();
      api.toast('Reconciliation failed: ' + e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (selectedSession) {
    return (
      <div className="bg-[#12161f] border border-[#222834] rounded font-mono text-xs overflow-hidden">
        {/* Detail Header */}
        <div className="p-3 bg-[#181d28] border-b border-[#222834] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedSession(null); fetchSessions(); }}
              className="p-1 rounded bg-[#141923] hover:bg-[#202736] border border-[#222834] text-slate-300"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <span>{selectedSession.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  {selectedSession.stocktake_number}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">{selectedSession.warehouse_name} ({selectedSession.branch_name})</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedSession.status !== 'RECONCILED' && (
              <>
                <button
                  onClick={handleSaveCounts}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded bg-[#141923] hover:bg-[#202736] border border-[#222834] text-emerald-400 font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Counts
                </button>
                <button
                  onClick={handleReconcile}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve & Reconcile
                </button>
              </>
            )}
            {selectedSession.status === 'RECONCILED' && (
              <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[11px]">
                RECONCILED
              </span>
            )}
          </div>
        </div>

        {/* Count Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#161b26] border-b border-[#222834] text-[10px] text-slate-400 uppercase tracking-wider">
                <th className="p-2.5">Product</th>
                <th className="p-2.5">SKU</th>
                <th className="p-2.5 text-right">System Qty</th>
                <th className="p-2.5 text-right w-28">Physical Count</th>
                <th className="p-2.5 text-right">Variance Units</th>
                <th className="p-2.5 text-right">Variance Value (KES)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c222e]">
              {selectedSession.items?.map((it) => {
                const countedVal = counts[it.id];
                const hasCount = countedVal !== '' && !isNaN(countedVal);
                const varUnits = hasCount ? Number(countedVal) - it.system_quantity : it.variance_quantity;
                const varVal = hasCount ? varUnits * it.unit_cost : it.variance_value;

                return (
                  <tr key={it.id} className="hover:bg-[#151a24]">
                    <td className="p-2.5 font-bold text-white">{it.product_name}</td>
                    <td className="p-2.5 text-slate-400">{it.sku}</td>
                    <td className="p-2.5 text-right font-bold text-slate-300">{it.system_quantity}</td>
                    <td className="p-2 text-right">
                      {selectedSession.status === 'RECONCILED' ? (
                        <span className="font-bold text-white">{it.counted_quantity ?? '—'}</span>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          value={countedVal}
                          onChange={(e) => setCounts({ ...counts, [it.id]: e.target.value })}
                          placeholder="—"
                          className="w-20 bg-[#0c0e12] border border-[#222834] rounded px-2 py-1 text-right text-white font-bold"
                        />
                      )}
                    </td>
                    <td className={`p-2.5 text-right font-bold ${varUnits > 0 ? 'text-emerald-400' : varUnits < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                      {hasCount || selectedSession.status === 'RECONCILED' ? (varUnits > 0 ? `+${varUnits}` : varUnits) : '—'}
                    </td>
                    <td className={`p-2.5 text-right font-bold ${varVal > 0 ? 'text-emerald-400' : varVal < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                      {hasCount || selectedSession.status === 'RECONCILED' ? Number(varVal).toFixed(2) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden font-mono text-xs">
      <div className="p-3 bg-[#181d28] border-b border-[#222834] flex items-center justify-between">
        <span className="font-bold text-white uppercase tracking-wider">Physical Stocktake & Audit Sessions</span>
        <button
          onClick={onNewSession}
          className="px-3 py-1.5 rounded bg-indigo-500 hover:bg-indigo-400 text-white font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <ClipboardCheck className="w-3.5 h-3.5" /> Start New Session
        </button>
      </div>

      <div className="divide-y divide-[#1c222e]">
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => fetchSessionDetails(s.id)}
            className="p-3 hover:bg-[#161b26] cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{s.title}</span>
                <span className="text-[10px] text-indigo-400 font-bold">{s.stocktake_number}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  s.status === 'RECONCILED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                  s.status === 'PENDING_APPROVAL' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                  'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                }`}>
                  {s.status}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {s.warehouse_name} • Created by {s.created_by_name} on {new Date(s.created_at).toLocaleDateString('en-KE')}
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Variance Units</div>
                <div className={`font-bold ${s.total_variance_units < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {s.total_variance_units > 0 ? `+${s.total_variance_units}` : s.total_variance_units} units
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Variance Value</div>
                <div className={`font-bold ${s.total_variance_value < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  KES {Number(s.total_variance_value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        ))}

        {sessions.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No stocktake sessions initiated yet. Click "Start New Session" to begin.
          </div>
        )}
      </div>
    </div>
  );
}
