import type { Source, RangeResponse } from 'pmtiles';
type Manifest = { bytes: number; chunk_size: number; sha256: string; shards: { file: string; bytes: number; sha256: string }[] };
// GitHub Pages does not need byte-range support: each request loads a small,
// checksum-verified shard, with bounded memory and shared in-flight requests.
export class ShardedPMTilesSource implements Source {
  private manifestPromise?: Promise<Manifest>;
  private chunks = new Map<number, Promise<Uint8Array>>();
  constructor(private url: string, private baseUrl: string) {}
  getKey() { return this.url; }
  private manifest() {
    this.manifestPromise ??= fetch(this.url).then(async response => {
      if (!response.ok) throw Error('建筑地图清单加载失败');
      return response.json() as Promise<Manifest>;
    }).catch(error => { this.manifestPromise = undefined; throw error; });
    return this.manifestPromise;
  }
  private chunk(index: number, manifest: Manifest) {
    let result = this.chunks.get(index);
    if (result) { this.chunks.delete(index); this.chunks.set(index, result); return result; }
    const shard = manifest.shards[index];
    if (!shard) throw Error('建筑地图分块编号无效');
    result = fetch(new URL(shard.file, this.baseUrl)).then(async response => {
      if (!response.ok) throw Error('建筑地图分块加载失败');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== shard.bytes) throw Error('建筑地图分块长度不符');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
      if (hash !== shard.sha256) throw Error('建筑地图分块校验失败，请刷新页面');
      return new Uint8Array(bytes);
    }).catch(error => { this.chunks.delete(index); throw error; });
    this.chunks.set(index, result);
    while (this.chunks.size > 12) this.chunks.delete(this.chunks.keys().next().value!);
    return result;
  }
  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    signal?.throwIfAborted();
    const manifest = await this.manifest();
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 1 || length > 8 * 1024 * 1024 || offset + length > manifest.bytes) throw Error('建筑地图读取范围无效');
    const first = Math.floor(offset / manifest.chunk_size), last = Math.floor((offset + length - 1) / manifest.chunk_size);
    const chunks = await Promise.all(Array.from({ length: last - first + 1 }, (_, i) => this.chunk(first + i, manifest)));
    signal?.throwIfAborted();
    const data = new Uint8Array(length);
    for (let i = 0; i < chunks.length; i++) {
      const start = (first + i) * manifest.chunk_size;
      const from = Math.max(offset, start), to = Math.min(offset + length, start + chunks[i].length);
      data.set(chunks[i].subarray(from - start, to - start), from - offset);
    }
    return { data: data.buffer, etag: manifest.sha256, cacheControl: 'public, max-age=3600' };
  }
}
