// client/src/components/charts/SvgDonutChart.jsx
import React, { useState } from 'react';

export function SvgDonutChart({
  data = [],
  centerValue,
  centerLabel = 'Total Volume',
  size = 180,
  strokeWidth = 26,
  showLegend = true,
  formatValue = (v) => (typeof v === 'number' ? v.toLocaleString() : v),
  unit = '',
  emptyMessage = 'No outcome distribution data available',
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-[#222834] rounded h-40">
        {emptyMessage}
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Compute total count
  const totalCount = data.reduce((acc, item) => acc + (Number(item.count) || 0), 0);

  // Normalize percentages if missing or sum != 100
  const totalPct = data.reduce((acc, item) => acc + (Number(item.percentage) || 0), 0);
  const normalizedData = data.map((item) => {
    const computedPct = totalCount > 0
      ? (Number(item.count || 0) / totalCount) * 100
      : (totalPct > 0 ? (Number(item.percentage || 0) / totalPct) * 100 : 0);
    return {
      ...item,
      normalizedPct: computedPct,
    };
  });

  // Calculate cumulative offsets
  let cumulativeOffset = 0;
  const slices = normalizedData.map((item, idx) => {
    const slicePct = Math.max(item.normalizedPct, 0);
    const strokeDash = (slicePct / 100) * circumference;
    const strokeDasharray = `${strokeDash} ${circumference - strokeDash}`;
    const strokeDashoffset = -cumulativeOffset;
    cumulativeOffset += strokeDash;

    return {
      ...item,
      idx,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  // Active slice when hovering
  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;
  const displayCenterValue = activeSlice
    ? formatValue(activeSlice.count)
    : centerValue !== undefined
    ? centerValue
    : formatValue(totalCount);
  const displayCenterLabel = activeSlice ? activeSlice.label : centerLabel;
  const displayCenterSub = activeSlice ? `${activeSlice.normalizedPct.toFixed(1)}% of total` : `${totalCount} ${unit}`.trim();

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center select-none py-1">
      {/* SVG Circular Ring */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          {/* Background Track Ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#19202c"
            strokeWidth={strokeWidth}
          />

          {/* Data Slices */}
          {slices.map((slice) => {
            const isHovered = hoveredIndex === slice.idx;
            return (
              <circle
                key={slice.idx}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={slice.color || '#60a5fa'}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${center} ${center})`}
                className="cursor-pointer transition-all duration-200 ease-out"
                style={{
                  filter: isHovered ? `drop-shadow(0 0 6px ${slice.color})` : 'none',
                  opacity: hoveredIndex === null || isHovered ? 1 : 0.45,
                }}
                onMouseEnter={() => setHoveredIndex(slice.idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Central Telemetry Callout */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2"
          style={{ padding: strokeWidth }}
        >
          <div className="text-xl font-bold font-mono tracking-tight text-white tabular-nums">
            {displayCenterValue}
          </div>
          <div className="text-[10px] text-slate-400 font-sans font-medium line-clamp-1 max-w-[95px] mt-0.5">
            {displayCenterLabel}
          </div>
          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
            {displayCenterSub}
          </div>
        </div>
      </div>

      {/* Legend & Breakdown Badges */}
      {showLegend && (
        <div className="flex-1 w-full space-y-2 max-w-sm">
          {slices.map((slice) => {
            const isHovered = hoveredIndex === slice.idx;
            return (
              <div
                key={slice.idx}
                onMouseEnter={() => setHoveredIndex(slice.idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                  isHovered
                    ? 'bg-[#18202d] border-[#38455e] shadow-lg shadow-black/40'
                    : 'bg-[#10141c] border-[#1e2430] hover:bg-[#151a24]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color || '#60a5fa' }}
                  />
                  <span className="font-medium text-slate-200 truncate text-[11px]">
                    {slice.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] tabular-nums">
                  <span className="text-slate-300 font-semibold">
                    {formatValue(slice.count)}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold border"
                    style={{
                      backgroundColor: `${slice.color}15`,
                      color: slice.color,
                      borderColor: `${slice.color}35`,
                    }}
                  >
                    {slice.normalizedPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
