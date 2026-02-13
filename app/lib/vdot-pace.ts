/**
 * VDOT 与配速区间换算（基于 Jack Daniels 公式）
 * VO2 = -4.60 + 0.182258*v + 0.000104*v²，v 为米/分钟
 * 由 VDOT * %VO2max = VO2(v) 反解 v，再得配速 秒/公里 = 60000/v
 */

/** 给定 VDOT 与 %VO2max（0-1），返回该强度下的配速（秒/公里） */
export function vdotToPaceSecPerKm(vdot: number, percentVo2max: number): number {
  if (vdot <= 0 || percentVo2max <= 0 || percentVo2max > 1) return 9999;
  const c = 4.60 + vdot * percentVo2max;
  const disc = 0.182258 ** 2 + 4 * 0.000104 * c;
  if (disc < 0) return 9999;
  const v = (-0.182258 + Math.sqrt(disc)) / (2 * 0.000104);
  if (v <= 0) return 9999;
  return 60000 / v; // 秒/公里
}

/** Z1-Z5 对应的 %VO2max（Daniels: E≈59-74%, M≈75-84%, T≈83-92%, I≈95-100%） */
const ZONE_PERCENT: Record<number, number> = {
  1: 0.65,  // Z1 轻松 ≈ E 低端
  2: 0.72,  // Z2 有氧 ≈ E 高端
  3: 0.80,  // Z3 节奏 ≈ M
  4: 0.88,  // Z4 乳酸阈 ≈ T
  5: 0.98,  // Z5 Vo2max ≈ I
};

/** 根据当前跑力 VDOT 计算 Z1-Z5 的目标配速区间 [paceMin, paceMax]（秒/公里），用于将 lap 归入某区 */
export function getPaceZoneBoundsFromVdot(vdot: number): Record<number, { paceMin: number; paceMax: number }> {
  if (vdot <= 0) return {};
  const paces: number[] = [];
  for (let z = 1; z <= 5; z++) {
    const p = ZONE_PERCENT[z] ?? 0.8;
    paces.push(vdotToPaceSecPerKm(vdot, p));
  }
  // paces[0]=Z1(最慢), paces[4]=Z5(最快)。边界取中点，Z1 上限无穷
  const bounds: Record<number, { paceMin: number; paceMax: number }> = {};
  bounds[1] = { paceMin: (paces[0] + paces[1]) / 2, paceMax: 9999 };
  bounds[2] = { paceMin: (paces[1] + paces[2]) / 2, paceMax: (paces[0] + paces[1]) / 2 };
  bounds[3] = { paceMin: (paces[2] + paces[3]) / 2, paceMax: (paces[1] + paces[2]) / 2 };
  bounds[4] = { paceMin: (paces[3] + paces[4]) / 2, paceMax: (paces[2] + paces[3]) / 2 };
  bounds[5] = { paceMin: 0, paceMax: (paces[3] + paces[4]) / 2 };
  return bounds;
}

/** 返回 Z1-Z5 的中心配速（秒/公里），用于展示「该区间建议配速」 */
export function getPaceZoneCenterFromVdot(vdot: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (let z = 1; z <= 5; z++) {
    out[z] = vdotToPaceSecPerKm(vdot, ZONE_PERCENT[z] ?? 0.8);
  }
  return out;
}
