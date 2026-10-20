export function sanitizeDisplay(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .trim();
}
