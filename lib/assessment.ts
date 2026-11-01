export const DIMENSIONS = ['历史价值敏感性', '活动利用敏感性', '开发建设敏感性', '环境污染敏感性', '舆论传播敏感性'];
export type ScoreRecord = { dimension: string; score: number | null; expert_score?: number | null; confidence?: string; [key: string]: unknown };
export function summarize(rows: ScoreRecord[]) {
  const dimensions = DIMENSIONS.map(dimension => {
    const all = rows.filter(r => r.dimension === dimension);
    const values = all.map(r => r.expert_score ?? r.score).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 5);
    return { dimension, count: all.length, valid: values.length, missing: all.length-values.length, average: values.length ? values.reduce((a,b)=>a+b,0)/values.length : null };
  });
  const validDimensions = dimensions.filter(d => d.average !== null);
  return { dimensions, average: validDimensions.length ? validDimensions.reduce((s,d)=>s+d.average!,0)/validDimensions.length : null,
    valid: dimensions.reduce((s,d)=>s+d.valid,0), total: rows.length, complete: rows.length===27 && dimensions.every(d=>d.missing===0),
    method: '各维度内对有效明细分值取算术均值，再对有数据的维度等权平均。专家分值优先；空值不计为0。此结果为明细描述统计，不替代CSV原始综合评分，也不代表已验证的风险模型。' };
}
