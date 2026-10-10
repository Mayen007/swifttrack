// client/src/services/formatters.js
// Universal clean text and dimension formatters (prevents raw LaTeX math rendering in UI)

/**
 * Strips and normalizes any LaTeX math notation into clean human-readable text.
 * e.g. "$25 \times 20 \times 15\text{ cm}$" -> "25 × 20 × 15 cm"
 */
export function cleanLatexText(input) {
  if (typeof input !== 'string') return input;
  let text = input;

  // Replace \times with multiplication sign ×
  text = text.replace(/\\times\b/g, '×');

  // Replace \cdot with dot operator ·
  text = text.replace(/\\cdot\b/g, '·');

  // Replace \text{...} with inner content
  text = text.replace(/\\text\{([^}]*)\}/g, '$1');

  // Replace \mathbf{...}, \mathrm{...}
  text = text.replace(/\\math[a-z]+\{([^}]*)\}/g, '$1');

  // Replace \le, \ge, \approx
  text = text.replace(/\\le\b/g, '≤');
  text = text.replace(/\\ge\b/g, '≥');
  text = text.replace(/\\approx\b/g, '≈');

  // Remove surrounding or inline math delimiters: $$ or $
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  text = text.replace(/\$([^$]+)\$/g, '$1');

  // Clean multiple spaces
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Cleanly format parcel dimensions without raw math notation.
 * e.g. formatDimensions(25, 20, 15) -> "25 × 20 × 15 cm"
 */
export function formatDimensions(l, w, h, unit = 'cm') {
  const len = Number(l) || 0;
  const wid = Number(w) || 0;
  const hei = Number(h) || 0;
  if (!len && !wid && !hei) return '—';
  return `${len} × ${wid} × ${hei} ${unit}`;
}
