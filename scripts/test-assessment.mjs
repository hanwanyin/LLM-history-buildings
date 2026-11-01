import assert from 'node:assert/strict';
import { summarize,DIMENSIONS } from '../lib/assessment.ts';
const empty=summarize([]);assert.equal(empty.average,null);assert.equal(empty.complete,false);
const rows=[{dimension:DIMENSIONS[0],score:null},{dimension:DIMENSIONS[0],score:5},{dimension:DIMENSIONS[1],score:1},{dimension:DIMENSIONS[1],score:3,expert_score:4}];
const summary=summarize(rows);assert.equal(summary.dimensions[0].average,5);assert.equal(summary.dimensions[0].missing,1);assert.equal(summary.average,3.75);assert.equal(summary.valid,3);assert.equal(summary.complete,false);
assert.equal(summarize([{dimension:DIMENSIONS[0],score:0}]).average,null);
assert.equal(summarize([{dimension:DIMENSIONS[0],score:5,expert_score:1}]).average,1);
console.log('Assessment calculations: passed (null handling, expert priority, equal dimensions, incomplete data, out-of-range values).');
