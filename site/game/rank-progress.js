/* S-rank progression. Point arithmetic stays in BigInt; public values are decimal strings. */
const MAX_STAGE = 106;

function invalidPoints() {
  return new TypeError('ランクポイントは0以上の整数で指定してください。');
}

/** Accept integer text, BigInt, or a safe integer Number; never round points. */
export function normalizeRankPoints(value) {
  if (typeof value === 'string') {
    if (!/^[0-9]+$/.test(value)) throw invalidPoints();
    return value.replace(/^0+(?=[0-9])/, '');
  }
  if (typeof value === 'bigint') {
    if (value < 0n) throw invalidPoints();
    return value.toString();
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) throw invalidPoints();
    if (!Number.isSafeInteger(value)) {
      throw new RangeError('大きなランクポイントは、数字の文字列かBigIntで指定してください。');
    }
    return String(value);
  }
  throw invalidPoints();
}

function threshold(stage) {
  const n = BigInt(stage);
  return 15n * n * (n + 3n) / 2n;
}

/** stage 0 means S, stage 1 means S1, and stage 106 means S106. */
export function getStageThreshold(stage) {
  if (!Number.isInteger(stage) || stage < 0 || stage > MAX_STAGE) {
    throw new RangeError('Sランク内の段位は0から106の整数で指定してください。');
  }
  return threshold(stage).toString();
}

/** One defeat after reaching S earns one point. S106 caps the label, not the points. */
export function getRankProgress(points) {
  const normalized = normalizeRankPoints(points);
  const total = BigInt(normalized);
  let stage = 0;
  while (stage < MAX_STAGE && total >= threshold(stage + 1)) stage++;
  const rank = stage === 0 ? 'S' : 'S' + stage;
  if (stage === MAX_STAGE) {
    return {
      points: normalized, rank, stage,
      nextRank: null, stageRequired: null, stageEarned: null,
      remaining: null, nextTotal: null, capped: true
    };
  }
  const start = threshold(stage);
  const next = threshold(stage + 1);
  return {
    points: normalized, rank, stage,
    nextRank: 'S' + (stage + 1),
    stageRequired: (next - start).toString(),
    stageEarned: (total - start).toString(),
    remaining: (next - total).toString(),
    nextTotal: next.toString(),
    capped: false
  };
}
