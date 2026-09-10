import { expect, test } from 'bun:test';
import { collectPages } from '../src/services/pagination';
test('catalog loads every page and deduplicates overlapping records', async () => {
  const calls: number[] = [];
  const items = await collectPages(async page => { calls.push(page); return { data: page === 1 ? [{id:'1'},{id:'2'}] : [{id:'2'},{id:'3'}], pagination:{page,totalPages:2} }; });
  expect(calls).toEqual([1,2]); expect(items.map(i => i.id)).toEqual(['1','2','3']);
});
test('missing pagination or inconsistent empty page fails instead of hiding missing records', async () => {
  await expect(collectPages(async () => ({ data: [] }))).rejects.toThrow('tidak lengkap');
  await expect(collectPages(async page => ({ data:[], pagination:{page,totalPages:2} }))).rejects.toThrow('berubah');
});
