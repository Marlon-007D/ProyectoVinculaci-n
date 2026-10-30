import test from 'node:test';
import assert from 'node:assert/strict';
import { pageWindow } from './pagination.ts';

test('shows the real range for 14 students', () => {
  assert.deepEqual(pageWindow(14, 0, 10), { size: 10, page: 0, pageCount: 2, start: 0, end: 10, first: 1, last: 10 });
  assert.deepEqual(pageWindow(14, 1, 10), { size: 10, page: 1, pageCount: 2, start: 10, end: 14, first: 11, last: 14 });
});

test('invalid page or size never produces NaN and the rows stay visible', () => {
  for (const [page, size] of [[NaN, 10], [0, NaN], [undefined, undefined], [0, 0], [-3, 10], [99, 10], [1.5, 10]]) {
    const window = pageWindow(14, page, size);
    for (const value of Object.values(window)) assert.ok(Number.isFinite(value), `${page}/${size}`);
    assert.ok(window.end > window.start);
  }
  assert.deepEqual(pageWindow(0, 0, 10), { size: 10, page: 0, pageCount: 1, start: 0, end: 0, first: 0, last: 0 });
});
