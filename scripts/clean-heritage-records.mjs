import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The cleared heritage-site layer behind 全部建筑地块_含文物属性_SHP.zip lists
// 763 objects. Four point records in the published snapshot repeat an object
// that is already present under its own stable ID, so the public mirror keeps
// one record per heritage object. Nothing else about those objects is dropped:
// each pair keeps the richer record (scores, evidence, spatial link).
export const DUPLICATE_RECORDS = {
  'S-3': { duplicate_of: 'S-1', name: '黄炎培故居', reason: '同一处故居的两条点位记录' },
  'S-11': { duplicate_of: 'G-30', name: '圣三一基督教堂', reason: '同一座教堂的市级与国家级重复记录' },
  'S-159': { duplicate_of: 'G-29', name: '上海工部局宰牲场旧址', reason: '同一处旧址的市级与国家级重复记录' },
  'S-252': { duplicate_of: 'S-2', name: '太平天国烈士墓', reason: '名称笔误（基/墓）造成的重复点位' },
};

const dropped = new Set(Object.keys(DUPLICATE_RECORDS));

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value));
}

/** Rewrites a published snapshot in place so it contains one record per heritage object. */
export async function cleanHeritageRecords(root = 'work/pages-public/snapshot') {
  const bootstrapPath = path.join(root, 'bootstrap.json');
  const boot = await readJson(bootstrapPath);
  const before = boot.sites.length;
  const present = boot.sites.filter(site => dropped.has(site.id)).length;
  const previous = boot.heritage_cleaning;
  const sites = boot.sites.filter(site => !dropped.has(site.id));
  const mapScores = (boot.mapScores || []).filter(score => !dropped.has(score.site_id));

  let evidencePath = path.join(root, 'evidence.json');
  let evidence = null;
  try {
    evidence = await readJson(evidencePath);
    evidence = evidence.filter(row => !dropped.has(row.site_id));
  } catch { evidence = null; }

  const detailCount = sites.reduce((sum, site) => sum + Number(site.detail_count || 0), 0);
  const missingCount = sites.reduce((sum, site) => sum + Number(site.missing_count || 0), 0);
  boot.sites = sites;
  boot.mapScores = mapScores;
  boot.stats = {
    ...boot.stats,
    sites: sites.length,
    scores: detailCount,
    missing: missingCount,
    detailed_sites: sites.filter(site => Number(site.detail_count || 0) > 0).length,
  };
  // Re-running the build must not rewrite the recorded provenance: the first
  // pass sees the duplicates, later passes see an already-cleaned snapshot.
  boot.heritage_cleaning = {
    published_objects: sites.length,
    source_point_records: previous?.source_point_records ?? sites.length + present,
    duplicates_removed: previous?.duplicates_removed ?? present,
    removed: Object.entries(DUPLICATE_RECORDS).map(([id, detail]) => ({ id, ...detail })),
    rule: '每条文物对象只保留一条点位记录；重复记录的对象属性、评分与证据已由保留记录承载。',
  };

  if (mapScores.length !== sites.length * 5) throw Error('维度分值与清理后文物数量不一致：' + mapScores.length);
  if (evidence && evidence.length !== detailCount) throw Error('证据条数与明细数量不一致：' + evidence.length + ' / ' + detailCount);

  for (const id of dropped) await fs.rm(path.join(root, 'sites', id + '.json'), { force: true });
  await writeJson(bootstrapPath, boot);
  if (evidence) await writeJson(evidencePath, evidence);

  try {
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = await readJson(manifestPath);
    manifest.site_count = sites.length;
    manifest.score_count = detailCount;
    manifest.heritage_cleaning = boot.heritage_cleaning;
    await writeJson(manifestPath, manifest);
  } catch { /* a snapshot without a manifest is still cleaned */ }

  return { before, after: sites.length, scores: detailCount, evidence: evidence?.length ?? 0 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await cleanHeritageRecords(process.argv[2]);
  console.log(JSON.stringify(result));
}
