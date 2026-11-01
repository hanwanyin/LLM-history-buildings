type Row = Record<string, any>;
declare const __PAGES_MIRROR__: boolean;
declare const __PAGES_BASE__: string;
export const isPages = typeof __PAGES_MIRROR__ !== 'undefined' && __PAGES_MIRROR__;
export const assetBase = isPages && typeof __PAGES_BASE__ !== 'undefined' ? __PAGES_BASE__ : '/';
export const managementOrigin = 'https://heritage-sensitivity-han-2026.wanyinhan98.chatgpt.site';
export const signInUrl = (isPages ? managementOrigin : '') + '/signin-with-chatgpt?return_to=%2F';
export const assetUrl = (file: string) => assetBase + file;
export const sourceDownloadUrl = (id: string, filename: string) => isPages ? assetUrl('originals/' + encodeURIComponent(filename)) : '/api/sources/' + encodeURIComponent(id) + '/download';

async function snapshot(file: string, options: RequestInit = {}): Promise<Row> {
  const response = await fetch(assetUrl('snapshot/' + file + '.json'), { signal: options.signal });
  if (!response.ok) throw Error('公开数据暂未加载，请刷新后重试。');
  return response.json();
}
let evidencePromise: Promise<Row[]> | undefined;
export async function api(path: string, options: RequestInit = {}): Promise<Row> {
  if (!isPages) {
    const response = await fetch('/api/' + path, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
    const data = await response.json() as Row;
    if (!response.ok) throw Error(data.error || '请求失败');
    return data;
  }
  if (options.method && options.method.toUpperCase() !== 'GET') throw Error('此站为公开浏览版。请前往原管理站修改，再同步发布到此站。');
  const url = new URL(path, 'https://snapshot.invalid/');
  const parts = url.pathname.slice(1).split('/').map(decodeURIComponent);
  if (parts[0] === 'bootstrap' || parts[0] === 'sources') return snapshot(parts[0], options);
  if (parts[0] === 'sites' || parts[0] === 'assessments') {
    if (!/^[A-Za-z0-9_-]+$/.test(parts[1] || '')) throw Error('记录编号无效。');
    return snapshot(parts[0] + '/' + parts[1], options);
  }
  if (parts[0] === 'map' && parts[1] === 'match') {
    const detail = await api('sites/' + encodeURIComponent(parts[2]), options);
    if (!detail.spatial) throw Error('该文物尚未完成建筑匹配。');
    return detail.spatial;
  }
  if (parts[0] === 'evidence') {
    const query = (url.searchParams.get('q') || '').trim().slice(0, 100);
    const site = url.searchParams.get('site') || '';
    if (!query && !site) return { results: [], total: 0 };
    evidencePromise ??= snapshot('evidence').then(data => data as Row[]).catch(error => { evidencePromise = undefined; throw error; });
    const rows = await evidencePromise;
    options.signal?.throwIfAborted();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    const matches = rows.filter(row => (!site || row.site_id === site) && terms.every(term => [row.evidence, row.reasoning, row.indicator, row.site_name].some(value => String(value || '').toLowerCase().includes(term))));
    return { results: matches.slice(0, 100), total: matches.length, method: '公开数据关键词检索；结果为同步时的原始 Excel 证据，不生成新的 LLM 结论。' };
  }
  throw Error('此功能请前往原管理站使用。');
}
