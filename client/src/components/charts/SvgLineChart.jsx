// client/src/components/charts/SvgLineChart.jsx
import React, { useState, useId } from 'react';

export function SvgLineChart({
  data = [],
  dataKey = 'value',
  labelKey = 'label',
  color = '#38bdf8',
  gradientFrom = '#38bdf8',
  gradientTo = 'rgba(56, 189, 248, 0.02)',
  formatValue = (v) => (typeof v === 'number' ? v.toLocaleString() : v),
  height = 200,
  unit = '',
  emptyMessage = 'No telemetry data available for this range',
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const rawId = useId();
  const gradId = `line-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-[#222834] rounded"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  // Calculate scales
  const values = data.map((d) => Number(d[dataKey] || 0));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const minVal = rawMin > 0 && rawMin === rawMax ? 0 : Math.max(0, rawMin * 0.85);
  const maxVal = rawMax === 0 ? 10 : Math.ceil(rawMax * 1.15);
  const range = maxVal - minVal || 1;

  // ViewBox geometry
  const width = 600;
  const padding = { top: 25, right: 25, bottom: 35, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (idx) => padding.left + (idx / Math.max(data.length - 1, 1)) * chartW;
  const getY = (val) => padding.top + chartH - ((val - minVal) / range) * chartH;

  // Build points
  const points = data.map((d, i) => ({
    x: getX(i),
    y: getY(Number(d[dataKey] || 0)),
    data: d,
    val: Number(d[dataKey] || 0),
  }));

  // Build smooth bezier curve path
  const buildSmoothPath = (pts) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  };

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x},${padding.top + chartH} L ${points[0].x},${padding.top + chartH} Z`;

  // Grid levels
  const gridLines = [0, 0.33, 0.66, 1];

  const activePoint = hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;

  return (
    <div className="relative w-full select-none" style={{ minHeight: height }}>
      {/* Floating Tooltip Card */}
      {activePoint && (
        <div
          className="absolute z-20 pointer-events-none transition-all duration-75 ease-out -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${(activePoint.y / height) * 100}%`,
          }}
        >
          <div className="bg-[#141923] border border-[#2a3447] text-slate-100 rounded px-2.5 py-1.5 shadow-xl shadow-black/60 font-mono text-[11px] whitespace-nowrap space-y-0.5">
            <div className="text-[10px] text-slate-400 font-sans font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} />
              <span>{activePoint.data[labelKey] || activePoint.data.date}</span>
            </div>
            <div className="text-xs font-bold text-white tracking-tight">
              {formatValue(activePoint.val)} {unit}
            </div>
            {activePoint.data.posOrders !== undefined && activePoint.data.deliveryOrders !== undefined && (
              <div className="text-[10px] text-slate-400 border-t border-[#222834] pt-0.5 mt-1 flex gap-2">
                <span>POS: {activePoint.data.posOrders}</span>
                <span>•</span>
                <span>Dispatch: {activePoint.data.deliveryOrders}</span>
              </div>
            )}
            {activePoint.data.netSales !== undefined && (
              <div className="text-[10px] text-slate-400 border-t border-[#222834] pt-0.5 mt-1">
                Net: {formatValue(activePoint.data.netSales)}
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
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} stopOpacity="0.28" />
            <stop offset="85%" stopColor={gradientTo} stopOpacity="0.02" />
            <stop offset="100%" stopColor={gradientTo} stopOpacity="0" />
          </linearGradient>

          <filter id={`glow-${gradId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Horizontal Gridlines & Y-Axis Scale */}
        {gridLines.map((ratio, i) => {
          const y = padding.top + chartH * (1 - ratio);
          const val = minVal + range * ratio;
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

        {/* Gradient Shaded Area */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Main Spline Curve */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Vertical Crosshair Line on Hover */}
        {activePoint && (
          <line
            x1={activePoint.x}
            y1={padding.top}
            x2={activePoint.x}
            y2={padding.top + chartH}
            stroke="#475569"
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />
        )}

        {/* Interactive Hover Hit Zones and Point Rings */}
        {points.map((pt, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <g key={i}>
              {/* Invisible wide mouse hit zone */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r="16"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />

              {/* Data Point Dot */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 5.5 : 2.5}
                fill="#0c0e12"
                stroke={color}
                strokeWidth={isHovered ? 2.5 : 1.75}
                className="pointer-events-none transition-all duration-150"
              />

              {isHovered && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="9"
                  fill="none"
                  stroke={color}
                  strokeOpacity="0.3"
                  strokeWidth="2"
                  className="pointer-events-none animate-ping"
                />
              )}
            </g>
          );
        })}

        {/* X-Axis Date Labels */}
        {points.map((pt, i) => {
          const step = Math.ceil(points.length / 7);
          const showLabel = i === 0 || i === points.length - 1 || i % step === 0;
          if (!showLabel) return null;

          return (
            <text
              key={i}
              x={pt.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-400 font-mono text-[9px]"
            >
              {pt.data[labelKey]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
