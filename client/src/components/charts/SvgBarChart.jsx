// client/src/components/charts/SvgBarChart.jsx
import React, { useState } from 'react';

export function SvgBarChart({
  data = [],
  dataKey = 'value',
  labelKey = 'label',
  sublabelKey,
  color = '#38bdf8',
  colorKey,
  formatValue = (v) => (typeof v === 'number' ? v.toLocaleString() : v),
  unit = '',
  layout = 'horizontal', // 'horizontal' | 'vertical'
  height = 240,
  maxBarSize = 36,
  showPercentage = true,
  emptyMessage = 'No comparative data available',
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-[#222834] rounded"
        style={{ height: typeof height === 'number' ? height : 180 }}
      >
        {emptyMessage}
      </div>
    );
  }

  // Calculate max value for scaling
  const values = data.map((d) => Number(d[dataKey] || 0));
  const maxVal = Math.max(...values, 1);
  const totalSum = values.reduce((a, b) => a + b, 0);

  // 1. HORIZONTAL BAR CHART LAYOUT
  if (layout === 'horizontal') {
    return (
      <div className="space-y-2.5 select-none w-full">
        {data.map((item, i) => {
          const val = Number(item[dataKey] || 0);
          const ratio = Math.min(100, Math.max(0, (val / maxVal) * 100));
          const pctOfTotal = totalSum > 0 ? Math.round((val / totalSum) * 100) : 0;
          const barColor = colorKey && item[colorKey] ? item[colorKey] : (item.color || color);
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`p-2 rounded border transition-all cursor-pointer ${
                isHovered
                  ? 'bg-[#18202d] border-[#38455e] shadow-lg shadow-black/40'
                  : 'bg-[#10141c] border-[#1e2430] hover:bg-[#151a24]'
              }`}
            >
              {/* Header Row: Label, Sublabel & Value */}
              <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] text-slate-400 font-bold shrink-0">
                    [{i + 1}]
                  </span>
                  <span className="font-medium text-slate-200 truncate text-[11px]">
                    {item[labelKey] || item.name || item.title}
                  </span>
                  {sublabelKey && item[sublabelKey] && (
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 hidden sm:inline">
                      • {item[sublabelKey]}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums shrink-0">
                  <span className="font-bold text-white">
                    {formatValue(val)} {unit}
                  </span>
                  {showPercentage && (
                    <span
                      className="px-1.5 py-0.2 rounded text-[9px] font-bold border"
                      style={{
                        backgroundColor: `${barColor}15`,
                        color: barColor,
                        borderColor: `${barColor}35`,
                      }}
                    >
                      {item.percentage !== undefined ? `${item.percentage}%` : `${pctOfTotal}%`}
                    </span>
                  )}
                </div>
              </div>

              {/* Bar Progress Track */}
              <div className="w-full h-2 rounded-full bg-[#181e29] overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${Math.max(ratio, 2)}%`,
                    backgroundColor: barColor,
                    boxShadow: isHovered ? `0 0 8px ${barColor}` : 'none',
                  }}
                />
              </div>

              {/* Extra Details Row if available */}
              {(item.subtext || item.extra) && (
                <div className="mt-1 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                  <span>{item.subtext}</span>
                  {item.extra && <span className="text-slate-300">{item.extra}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // 2. VERTICAL COLUMN BAR CHART LAYOUT
  const width = 600;
  const padding = { top: 25, right: 20, bottom: 40, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const colWidth = Math.min(maxBarSize, (chartW / data.length) * 0.65);
  const colGap = chartW / data.length;

  return (
    <div className="relative w-full select-none" style={{ minHeight: height }}>
      {/* Floating Tooltip Card */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div
          className="absolute z-20 pointer-events-none transition-all duration-75 ease-out -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${((padding.left + hoveredIdx * colGap + colGap / 2) / width) * 100}%`,
            top: '20%',
          }}
        >
          <div className="bg-[#141923] border border-[#2a3447] text-slate-100 rounded px-2.5 py-1.5 shadow-xl shadow-black/60 font-mono text-[11px] whitespace-nowrap space-y-0.5">
            <div className="text-[10px] text-slate-400 font-sans font-medium">
              {data[hoveredIdx][labelKey]}
            </div>
            <div className="text-xs font-bold text-white tracking-tight">
              {formatValue(Number(data[hoveredIdx][dataKey] || 0))} {unit}
            </div>
            {data[hoveredIdx].subtext && (
              <div className="text-[10px] text-slate-400 border-t border-[#222834] pt-0.5 mt-1">
                {data[hoveredIdx].subtext}
              </div>
            )}
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        style={{ maxHeight: height }}
      >
        {/* Horizontal Background Grid */}
        {[0, 0.33, 0.66, 1].map((ratio, i) => {
          const y = padding.top + chartH * (1 - ratio);
          const val = maxVal * ratio;
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#1f2633"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-slate-400 font-mono text-[9px]"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Vertical Columns */}
        {data.map((item, i) => {
          const val = Number(item[dataKey] || 0);
          const barHeight = Math.max((val / maxVal) * chartH, 4);
          const x = padding.left + i * colGap + (colGap - colWidth) / 2;
          const y = padding.top + chartH - barHeight;
          const barColor = colorKey && item[colorKey] ? item[colorKey] : (item.color || color);
          const isHovered = hoveredIdx === i;

          return (
            <g
              key={i}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Background Column Track */}
              <rect
                x={x}
                y={padding.top}
                width={colWidth}
                height={chartH}
                rx="4"
                fill="#161c26"
              />

              {/* Active Column Bar */}
              <rect
                x={x}
                y={y}
                width={colWidth}
                height={barHeight}
                rx="4"
                fill={barColor}
                opacity={isHovered ? 1 : 0.85}
                style={{
                  filter: isHovered ? `drop-shadow(0 0 8px ${barColor})` : 'none',
                }}
                className="transition-all duration-200"
              />

              {/* Value Callout on Top of Bar */}
              <text
                x={x + colWidth / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-slate-300 font-mono text-[9px] font-bold"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              </text>

              {/* Category Label at Bottom */}
              <text
                x={x + colWidth / 2}
                y={height - 12}
                textAnchor="middle"
                className="fill-slate-400 font-mono text-[10px]"
              >
                {item[labelKey]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
