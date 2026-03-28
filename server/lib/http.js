export function ok(res, data, status = 200) {
  return res.status(status).json(data);
}

export function fail(res, message, status = 500, extra = {}) {
  return res.status(status).json({ error: message, ...extra });
}

export function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return value;
}

export function safeJsonParse(value, fallback = null) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value ?? fallback;
  } catch {
    return fallback;
  }
}

export function getReviewScore(review) {
  if (!review || typeof review !== 'object') return null;
  return review.score ?? review.overall_score ?? review.rating ?? null;
}

export function uniqueStrings(values) {
  return [...new Set((values || []).map((item) => String(item || '').trim()).filter(Boolean))];
}
