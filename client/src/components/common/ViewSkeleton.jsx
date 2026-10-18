// client/src/components/common/ViewSkeleton.jsx
// SwiftTrack Matte Obsidian Loading Skeleton for Lazy-Loaded Module Chunks
import React from 'react';
import { Loader2 } from 'lucide-react';

export function ViewSkeleton({ view = 'Workspace' }) {
  const formattedView = typeof view === 'string'
    ? view.replace(/-/g, ' ').toUpperCase()
    : 'WORKSPACE';

  return (
    <div className="space-y-4 font-mono animate-pulse w-full">
      {/* 1. Header Skeleton */}
      <div className="bg-[#12161f] border border-[#222834] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500/80 animate-ping" />
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              MODULE INITIALIZING &bull; {formattedView}
            </span>
          </div>
          <div className="h-6 w-48 bg-[#1e2430] rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-[#1e2430] rounded" />
          <div className="h-8 w-32 bg-[#1e2430] rounded" />
        </div>
      </div>

      {/* 2. KPI Cards Grid Skeleton (4 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#12161f] border border-[#222834] rounded p-3.5 flex flex-col justify-between min-h-[96px]">
            <div className="flex items-center justify-between">
              <div className="h-2.5 w-20 bg-[#1e2430] rounded" />
              <div className="w-4 h-4 bg-[#1e2430] rounded" />
            </div>
            <div className="my-2 h-7 w-24 bg-[#1e2430] rounded" />
            <div className="pt-2 border-t border-[#222834] flex items-center justify-between">
              <div className="h-2 w-16 bg-[#1e2430] rounded" />
              <div className="h-2 w-12 bg-[#1e2430] rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Main Content Skeleton (Filter Bar & Table Matrix) */}
      <div className="bg-[#12161f] border border-[#222834] rounded overflow-hidden">
        {/* Filter bar */}
        <div className="p-3 border-b border-[#222834] flex items-center justify-between gap-3">
          <div className="h-8 w-64 bg-[#1e2430] rounded" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 bg-[#1e2430] rounded" />
            <div className="h-8 w-20 bg-[#1e2430] rounded" />
          </div>
        </div>

        {/* Table placeholder rows */}
        <div className="divide-y divide-[#1e2430]">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="p-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-6 h-6 rounded bg-[#1e2430] shrink-0" />
                <div className="space-y-1.5 flex-1 max-w-sm">
                  <div className="h-3 w-40 bg-[#1e2430] rounded" />
                  <div className="h-2 w-28 bg-[#181d28] rounded" />
                </div>
              </div>
              <div className="h-3 w-24 bg-[#1e2430] rounded hidden sm:block" />
              <div className="h-3 w-20 bg-[#1e2430] rounded hidden md:block" />
              <div className="h-6 w-16 bg-[#1e2430] rounded shrink-0" />
            </div>
          ))}
        </div>

        {/* Footer loader bar */}
        <div className="p-3 border-t border-[#222834] bg-[#0e121a] flex items-center justify-center gap-2 text-slate-500 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          <span>Synchronizing module telemetry from PostgreSQL...</span>
        </div>
      </div>
    </div>
  );
}
