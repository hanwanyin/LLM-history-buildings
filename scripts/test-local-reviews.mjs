import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// The public mirror keeps expert scoring in this browser only. The store is a
// browser module, so the test provides a minimal localStorage before importing it.
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
};
const js = ts.transpileModule(fs.readFileSync('lib/local-reviews.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const reviews = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const detail = {
  site: { id: 'G-6', name: '豫园' },
  scores: [
    { id: 's1', indicator: '本体可接触性', score: 3, expert_score: null, review_note: null },
    { id: 's2', indicator: '装饰复杂度', score: null, expert_score: null, review_note: null },
  ],
  reviews: [{ id: 'cloud-1', indicator: '历史价值', score: 4, note: '云端记录', created_at: '2026-01-01T00:00:00.000Z' }],
};

assert.equal(reviews.localReviewCount(), 0);
assert.deepEqual(reviews.mergeLocalReviews(detail).scores, detail.scores, 'nothing is changed before scoring');

reviews.saveLocalReview({ score_id: 's1', site_id: 'G-6', indicator: '本体可接触性', original: 3, score: 4, note: '现场照片核对', reviewed_at: '2026-11-05T08:00:00.000Z' });
reviews.saveLocalReview({ score_id: 's2', site_id: 'G-6', indicator: '装饰复杂度', original: null, score: 2, note: '补充资料', reviewed_at: '2026-11-05T08:05:00.000Z' });
assert.equal(reviews.localReviewCount(), 2);

const merged = reviews.mergeLocalReviews(detail);
assert.equal(merged.scores[0].expert_score, 4);
assert.equal(merged.scores[0].review_note, '现场照片核对');
assert.equal(merged.scores[0].local_review, true);
assert.equal(merged.scores[0].score, 3, 'the original score is preserved');
assert.equal(merged.scores[1].expert_score, 2);
assert.equal(merged.reviews[0].score, 2, 'local history is newest first');
assert.equal(merged.reviews[0].local, true);
assert.equal(merged.reviews[2].id, 'cloud-1', 'cloud history is kept');
assert.equal(detail.scores[0].expert_score, null, 'the source snapshot object is not mutated');

// Another heritage object does not inherit these corrections.
const other = reviews.mergeLocalReviews({ site: { id: 'G-1' }, scores: [{ id: 'x1', indicator: '本体可接触性', score: 1 }], reviews: [] });
assert.equal(other.scores[0].expert_score, undefined);
assert.equal(other.reviews.length, 0);

reviews.removeLocalReview('s1');
assert.equal(reviews.localReviewCount(), 1);
assert.equal(reviews.mergeLocalReviews(detail).scores[0].expert_score, null);
assert.equal(reviews.allLocalReviews()[0].score_id, 's2');

// Corrupt storage must not break the page.
store.set('herisk.local-reviews.v1', '{not json');
assert.equal(reviews.localReviewCount(), 0);
assert.equal(reviews.mergeLocalReviews(detail).scores[0].expert_score, null);

console.log(JSON.stringify({ passed: true, checks: 'local-only expert scores; original values preserved; history merge; per-site isolation; removal; corrupt storage' }));
