import React from 'react';
import { Search } from 'lucide-react';

export function DiscrepanciesTab({
  discrepancies,
  discrepancySeverityFilter,
  setDiscrepancySeverityFilter,
  discrepancySearch,
  setDiscrepancySearch,
  onOpenResolve
}) {
  const filteredDiscrepancies = discrepancies.filter((d) => {
    if (discrepancySeverityFilter !== 'ALL' && d.severity !== discrepancySeverityFilter) return false;
    if (discrepancySearch.trim()) {
      const q = discrepancySearch.toLowerCase();
      const numMatch = (d.discrepancy_number || '').toLowerCase().includes(q);
      const shpMatch = String(d.shipment_id || '').toLowerCase().includes(q);
      const typeMatch = (d.discrepancy_type || '').toLowerCase().includes(q);
      if (!numMatch && !shpMatch && !typeMatch) return false;
    }
    return true;
  });

  return (
    <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#222834]">
        <div>
          <h3 className="font-bold text-white text-sm font-mono uppercase tracking-wider flex items-center gap-2">
            <span>Operational Discrepancy Tickets</span>
            {discrepancies.length > 0 && (
              <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {discrepancies.length} Active
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400">Missing, damaged, overage or misrouted parcels under active investigation</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0b0e14] p-0.5 rounded-lg border border-[#1e2433] text-xs font-mono">
            {['ALL', 'CRITICAL', 'WARNING'].map((sev) => (
              <button
                key={sev}
                onClick={() => setDiscrepancySeverityFilter(sev)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  discrepancySeverityFilter === sev
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-[#0b0e14] border border-[#1e2433] px-2.5 py-1 rounded-lg text-xs">
            <Search className="w-3 h-3 text-slate-400" />
            <input
              type="text"
              placeholder="Filter ticket or #..."
              value={discrepancySearch}
              onChange={(e) => setDiscrepancySearch(e.target.value)}
              className="bg-transparent text-white text-xs font-mono focus:outline-none w-36"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#181d28] text-slate-400 font-semibold border-b border-[#222834]">
            <tr>
              <th className="py-2 px-3">Ticket Number</th>
              <th className="py-2 px-3">Discrepancy Type</th>
              <th className="py-2 px-3">Severity</th>
              <th className="py-2 px-3">Shipment #</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222834] text-slate-300">
            {filteredDiscrepancies.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-8 text-center text-slate-500">
                  No operational discrepancies matching filter criteria.
                </td>
              </tr>
            ) : (
              filteredDiscrepancies.map((d) => (
                <tr key={d.id} className="hover:bg-white/[0.02]">
                  <td className="py-2 px-3 font-mono font-bold text-white">{d.discrepancy_number}</td>
                  <td className="py-2 px-3">{d.discrepancy_type}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      d.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {d.severity}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-400">Shipment #{d.shipment_id || 'N/A'}</td>
                  <td className="py-2 px-3 font-semibold text-blue-400">{d.status}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => onOpenResolve(d)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-[11px] font-bold text-white cursor-pointer"
                    >
                      Resolve
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
