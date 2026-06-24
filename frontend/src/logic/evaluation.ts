import { Player, AppConfig } from '../types/Player';

export const RANKS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
export const POS = ['投手', '捕手', '一塁', '二塁', '三塁', '遊撃', '外野'] as const;
export const POS_SHORT: Record<string, string> = {
  投手: '投', 捕手: '捕', 一塁: '一', 二塁: '二', 三塁: '三', 遊撃: '遊', 外野: '外',
};
export const FIELD_ABIL = ['ミート', 'パワー', '走力', '肩力', '守備力', '捕球'] as const;
export const SPECIAL = ['チャンス', '対左投手', 'キャッチャー', 'ケガしにくさ', '盗塁', '走塁', '送球', '回復'] as const;
export const PITCH_RANK = ['コントロール', 'スタミナ'] as const;
export const PITCH_SPECIAL = ['対ピンチ', '対左打者', '打たれ強さ', 'ケガしにくさ', 'ノビ', 'クイック', '回復'] as const;
export const DEFENSE_ABIL = ['肩力', '守備力', '捕球', '走力', 'キャッチャー', '送球'] as const;

export function rank(config: AppConfig, a: string | number): number {
  if (typeof a === 'number') return a;
  return config.rankValues[a] ?? 1;
}

export function normSpeed(config: AppConfig, v: number): number {
  const s = config.speedScale;
  return Math.max(1, Math.min(8, 1 + (v - s.min) / (s.max - s.min) * 7));
}

export function norm(v: number, scale: { min: number; max: number }): number {
  return Math.max(1, Math.min(8, 1 + (v - scale.min) / (scale.max - scale.min) * 7));
}

export function posFit(config: AppConfig, p: Player, pos: string): number {
  if (pos === '投手') return pitcherScore(config, p, 'overall');
  const w = config.positionWeights[pos] ?? {};
  let s = 0;
  Object.entries(w).forEach(([k, v]) => s += rank(config, (p.abilities?.[k] as string) || 'G') * v);
  return s;
}

export function posBonus(config: AppConfig, p: Player, pos: string): number {
  if (p.main === pos) return config.positionBonus.main;
  if ((p.subsHigh ?? []).includes(pos)) return config.positionBonus.subHigh ?? 1.0;
  if ((p.subs ?? []).includes(pos)) return config.positionBonus.sub;
  return config.positionBonus.none;
}

export function posPower(config: AppConfig, p: Player, pos: string): number {
  return posFit(config, p, pos) * posBonus(config, p, pos);
}

export function overall(config: AppConfig, p: Player): number {
  let s = 0;
  Object.entries(config.overallWeights).forEach(([k, v]) =>
    s += rank(config, (p.abilities?.[k] as string) || 'G') * v
  );
  return s;
}

export function mainOverall(config: AppConfig, p: Player): number {
  return p.main === '投手' ? pitcherScore(config, p, 'overall') : overall(config, p);
}

export function pitcherWeightedSum(
  config: AppConfig,
  p: Player,
  weights: Record<string, number>
): number {
  let s = 0;
  Object.entries(weights).forEach(([k, v]) => {
    let val: number;
    if (k === '球速') val = normSpeed(config, (p.pitch?.['球速'] as number) || 120);
    else if (k === '球種数') val = norm((p.pitch?.['球種数'] as number) || 0, config.pitchTypeScale);
    else if (k === '総変化量') val = norm((p.pitch?.['総変化量'] as number) || 0, config.totalBreakScale);
    else val = rank(config, (p.pitch?.[k] as string) || 'G');
    s += val * v;
  });
  return s;
}

export function pitcherScore(config: AppConfig, p: Player, type = 'overall'): number {
  return pitcherWeightedSum(config, p, config.pitcherWeights[type] ?? {});
}

export function specialAbilityBonus(
  config: AppConfig,
  specialAbilityMap: Record<string, { manualWeight: number }>,
  p: Player
): number {
  if (!p.specialAbilities?.length) return 0;
  return p.specialAbilities.reduce((sum, name) => {
    const def = specialAbilityMap[name];
    return sum + (def?.manualWeight || 0);
  }, 0);
}

export function battingScore(
  config: AppConfig,
  specialAbilityMap: Record<string, { manualWeight: number }>,
  p: Player
): number {
  const w = config.manualBaseWeights?.['野手'] ?? {};
  let s = 0;
  Object.entries(w).forEach(([k, v]) => {
    if (k === '弾道') {
      const val = (p.abilities?.['弾道'] as number) || 1;
      s += (1 + (val - 1) / 3 * 7) * v;
    } else {
      s += rank(config, (p.abilities?.[k] as string) || 'G') * v;
    }
  });
  s += specialAbilityBonus(config, specialAbilityMap, p);
  return s;
}

export function pitcherManualScore(
  config: AppConfig,
  specialAbilityMap: Record<string, { manualWeight: number }>,
  p: Player
): number {
  return pitcherWeightedSum(config, p, config.manualBaseWeights?.['投手'] ?? {})
    + specialAbilityBonus(config, specialAbilityMap, p);
}

export function totalFieldScore(
  config: AppConfig,
  specialAbilityMap: Record<string, { manualWeight: number }>,
  p: Player,
  pos: string
): number {
  if (pos === '投手') return pitcherScore(config, p, 'overall');
  const roles = config.positionRoles?.[pos] ?? { defense: 0.55, batting: 0.45 };
  return posPower(config, p, pos) * roles.defense + battingScore(config, specialAbilityMap, p) * roles.batting;
}

export function totalFieldScoreIdeal(
  config: AppConfig,
  specialAbilityMap: Record<string, { manualWeight: number }>,
  p: Player,
  pos: string
): number {
  if (pos === '投手') return pitcherScore(config, p, 'overall');
  const roles = config.positionRoles?.[pos] ?? { defense: 0.55, batting: 0.45 };
  return posFit(config, p, pos) * roles.defense + battingScore(config, specialAbilityMap, p) * roles.batting;
}

export function score100(v: number): number {
  return Math.round(v / 8 * 100);
}

export function dhScore(config: AppConfig, p: Player): number {
  return rank(config, (p.abilities?.['ミート'] as string) || 'G') * 0.4
    + rank(config, (p.abilities?.['パワー'] as string) || 'G') * 0.4
    + rank(config, (p.abilities?.['チャンス'] as string) || 'G') * 0.2;
}

export function evalMark(score: number, th: { excellent: number; good: number; warning: number }) {
  if (score >= th.excellent) return ['◎', 'good'] as const;
  if (score >= th.good) return ['○', 'good'] as const;
  if (score >= th.warning) return ['△', 'mid'] as const;
  return ['×', 'bad'] as const;
}

export function evalPosition(
  config: AppConfig,
  specialAbilityMap: Record<string, { manualWeight: number }>,
  rs: Player[],
  pos: string
) {
  const topCount = config.topCounts[pos] ?? 2;
  const startingCount = config.startingCounts?.[pos] ?? 1;
  const list = rs
    .map(p => ({
      p,
      score: totalFieldScore(config, specialAbilityMap, p, pos),
      fit: posFit(config, p, pos),
      bonus: posBonus(config, p, pos),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topCount);

  const weakestStarter = list.length >= startingCount ? list[startingCount - 1].score : 0;
  const th = config.positionThresholds[pos];
  const perPersonTh = {
    excellent: th.excellent / topCount,
    good: th.good / topCount,
    warning: th.warning / topCount,
  };
  const [mark, cls] = evalMark(weakestStarter, perPersonTh);
  const pct = Math.round(weakestStarter / perPersonTh.excellent * 100);
  return { list, weakestStarter, perPersonTh, mark, cls, pct };
}

export function secondFit(config: AppConfig, p: Player) {
  return [...POS]
    .filter(pos => pos !== p.main)
    .map(pos => ({ pos, fit: posFit(config, p, pos) }))
    .sort((a, b) => b.fit - a.fit)[0];
}

export function roster(players: Player[], years = 0): Player[] {
  return players.map(p => ({ ...p, grade: p.grade + years })).filter(p => p.grade <= 3);
}

export function withUpgradedAbility(p: Player, ability: string): Player {
  const a = { ...(p.abilities ?? {}) };
  if (ability === '弾道') {
    a['弾道'] = Math.min(4, ((a['弾道'] as number) || 1) + 1);
  } else {
    const cur = (a[ability] as string) || 'G';
    const idx = RANKS.indexOf(cur as typeof RANKS[number]);
    if (idx < RANKS.length - 1) a[ability] = RANKS[idx + 1];
  }
  return { ...p, abilities: a };
}

export function enhancementImpact(
  config: AppConfig,
  specialAbilityMap: Record<string, { manualWeight: number }>,
  p: Player,
  ability: string,
  pos: string
): number {
  if (pos === '投手') return 0;
  return totalFieldScoreIdeal(config, specialAbilityMap, withUpgradedAbility(p, ability), pos)
    - totalFieldScoreIdeal(config, specialAbilityMap, p, pos);
}

export function getTopImpacts(
  config: AppConfig,
  specialAbilityMap: Record<string, { manualWeight: number }>,
  p: Player,
  pos: string,
  n = 3
) {
  if (pos === '投手') return [];
  const abilities = [...new Set([
    ...Object.keys(config.positionWeights[pos] ?? {}),
    ...Object.keys(config.manualBaseWeights?.['野手'] ?? {}),
    '弾道',
  ])];
  return abilities
    .map(ability => ({ ability, impact: enhancementImpact(config, specialAbilityMap, p, ability, pos) }))
    .filter(x => x.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, n);
}
