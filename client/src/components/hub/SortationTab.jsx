import React from 'react';
import { Layers } from 'lucide-react';

export function SortationTab({
  sortScanInput,
  setSortScanInput,
  onSortScan,
  sortedItem
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl space-y-5">
        <div>
          <h3 className="font-bold text-white text-base">Origin Parcel Sortation Console</h3>
          <p className="text-xs text-slate-400 mt-1">
            Scan outgoing parcels to determine automated linehaul destination bay
          </p>
        </div>

        <form onSubmit={onSortScan} className="space-y-3">
          <input
            type="text"
            placeholder="Scan parcel barcode for bay assignment..."
            value={sortScanInput}
            onChange={(e) => setSortScanInput(e.target.value)}
            className="w-full px-4 py-3 bg-[#181d28] border border-[#222834] rounded-xl text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow cursor-pointer"
          >
            Sort & Allocate Staging Bay
          </button>
        </form>
      </div>

      <div className="bg-[#12161f] border border-[#222834] p-3.5 sm:p-4 rounded-xl flex flex-col justify-center items-center text-center space-y-4">
        {sortedItem ? (
          <div className="space-y-3 animate-fade-in">
            <span className="inline-block p-4 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="w-10 h-10" />
            </span>
            <p className="text-xs text-slate-400 font-mono">Barcode: {sortedItem.barcode}</p>
            <div className="p-4 bg-[#181d28] border border-[#222834] rounded-xl">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Allocated Linehaul Bay</p>
              <p className="text-xl font-bold text-blue-400 mt-1">{sortedItem.allocatedBay}</p>
            </div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400">
              Status: SORTED
            </span>
          </div>
        ) : (
          <div className="text-slate-500 space-y-2">
            <Layers className="w-12 h-12 mx-auto opacity-30" />
            <p className="text-xs">Scan a parcel barcode to view automated bay allocation</p>
          </div>
        )}
      </div>
    </div>
  );
}
