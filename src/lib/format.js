export function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function fmtDuration(seconds) {
  const total = Number(seconds || 0);
  if (!total) return '0s';
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export function reviewScore(review) {
  if (!review || typeof review !== 'object') return null;
  return review.score ?? review.overall_score ?? review.rating ?? null;
}

export function reviewSummary(review) {
  if (!review || typeof review !== 'object') return 'No review';
  return review.summary || review.feedback || review.notes || JSON.stringify(review).slice(0, 80);
}

export function badgeClass(score) {
  if (score == null) return 'muted';
  if (score >= 4) return 'good';
  if (score >= 3) return 'warn';
  return 'bad';
}
