// Expert review on the public mirror. The published site is static, so a
// reviewer's correction is kept in this browser (localStorage) and can be
// exported as JSON for the management site. Nothing here is uploaded, and the
// published snapshot is never modified by it.

export type LocalReview = {
  score_id: string;
  site_id: string;
  indicator: string;
  original: number | null;
  score: number;
  note: string;
  reviewed_at: string;
};

const KEY = 'herisk.local-reviews.v1';

function read(): Record<string, LocalReview> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed as Record<string, LocalReview> : {};
  } catch {
    return {};
  }
}

function write(data: Record<string, LocalReview>) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function localReviewCount() {
  return Object.keys(read()).length;
}

export function allLocalReviews(): LocalReview[] {
  return Object.values(read()).sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at));
}

export function saveLocalReview(review: LocalReview) {
  const data = read();
  data[review.score_id] = review;
  write(data);
}

export function removeLocalReview(scoreId: string) {
  const data = read();
  delete data[scoreId];
  write(data);
}

/** Overlay locally scored indicators and their history onto a site snapshot. */
export function mergeLocalReviews(detail: Record<string, any> | null) {
  if (!detail || !Array.isArray(detail.scores)) return detail;
  const stored = read();
  const scores = detail.scores.map((score: Record<string, any>) => {
    const local = stored[score.id];
    return local
      ? { ...score, expert_score: local.score, review_note: local.note, reviewed_at: local.reviewed_at, local_review: true }
      : score;
  });
  const siteId = detail.site?.id;
  const localHistory = Object.values(stored)
    .filter(review => review.site_id === siteId)
    .map(review => ({
      id: 'local-' + review.score_id,
      indicator: review.indicator,
      score: review.score,
      original: review.original,
      note: review.note,
      created_at: review.reviewed_at,
      local: true,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { ...detail, scores, reviews: [...localHistory, ...(detail.reviews || [])] };
}
