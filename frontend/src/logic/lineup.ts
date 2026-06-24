import { Player, AppConfig, LineupResult } from '../types/Player';
import { totalFieldScore, totalFieldScoreIdeal, dhScore } from './evaluation';

export const FIELD_POS = ['捕手', '一塁', '二塁', '三塁', '遊撃', '外野', '外野', '外野'] as const;
export const LABELS = ['捕手', '一塁', '二塁', '三塁', '遊撃', '左翼', '中堅', '右翼'] as const;

export function hungarian(costMatrix: number[][]): Map<number, number> {
  const n = costMatrix.length;
  const m = costMatrix[0]?.length ?? 0;
  const size = Math.max(n, m);

  const mat: number[][] = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i < n && j < m ? costMatrix[i][j] : 0))
  );

  const maxVal = Math.max(...mat.flat());
  const cost = mat.map(row => row.map(v => maxVal - v));

  const u = new Array(size + 1).fill(0);
  const v = new Array(size + 1).fill(0);
  const p = new Array(size + 1).fill(0);
  const way = new Array(size + 1).fill(0);

  for (let i = 1; i <= size; i++) {
    p[0] = i;
    let j0 = 0;
    const minDist: number[] = new Array(size + 1).fill(Infinity);
    const used: boolean[] = new Array(size + 1).fill(false);
    do {
      used[j0] = true;
      let i0 = p[j0], delta = Infinity, j1 = -1;
      for (let j = 1; j <= size; j++) {
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minDist[j]) { minDist[j] = cur; way[j] = j0; }
          if (minDist[j] < delta) { delta = minDist[j]; j1 = j; }
        }
      }
      for (let j = 0; j <= size; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minDist[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }

  const result = new Map<number, number>();
  for (let j = 1; j <= m; j++) {
    if (p[j] > 0 && p[j] <= n) result.set(p[j] - 1, j - 1);
  }
  return result;
}

export function solveLineup(
  rs: Player[],
  scoreFn: (p: Player, pos: string) => number
): LineupResult {
  const fielders = rs.filter(p => p.main !== '投手');
  const assigned = new Map<number, Player>();
  const usedIds = new Set<string>();

  FIELD_POS.forEach((pos, i) => {
    const pre = fielders.find(p => !usedIds.has(p.id) && scoreFn(p, pos) === 999);
    if (pre) {
      assigned.set(i, pre);
      usedIds.add(pre.id);
    }
  });

  const remainPlayers = fielders.filter(p => !usedIds.has(p.id));
  const remainSlots = FIELD_POS.map((pos, i) => ({ pos, i })).filter(({ i }) => !assigned.has(i));

  if (remainPlayers.length > 0 && remainSlots.length > 0) {
    const matrix = remainPlayers.map(p =>
      remainSlots.map(({ pos }) => {
        const s = scoreFn(p, pos);
        return s === 999 ? 0 : s;
      })
    );

    const assignment = hungarian(matrix);
    assignment.forEach((slotIdx, playerIdx) => {
      if (playerIdx < remainPlayers.length && slotIdx < remainSlots.length) {
        const pl = remainPlayers[playerIdx];
        const { i } = remainSlots[slotIdx];
        assigned.set(i, pl);
        usedIds.add(pl.id);
      }
    });
  }

  const dhBest = fielders
    .filter(p => !usedIds.has(p.id))
    .sort((a, b) => {
      const sa = (a.abilities?.['ミート'] as number || 0) + (a.abilities?.['パワー'] as number || 0);
      const sb = (b.abilities?.['ミート'] as number || 0) + (b.abilities?.['パワー'] as number || 0);
      return sb - sa;
    })[0] ?? null;

  const bench = fielders.filter(p => !usedIds.has(p.id) && p !== dhBest);

  return { assigned, dh: dhBest, bench };
}

export function calcIdealPlan(
  config: AppConfig,
  specialAbilityMap: Record<string, { manualWeight: number }>,
  rs: Player[],
  idealFixed: Map<string, number | 'dh'>,
  idealTemp: Map<string, number | 'dh'>
): LineupResult {
  const merged = new Map([...idealTemp, ...idealFixed]);
  const preAssigned = new Map<number, string>();
  for (const [playerId, posIndex] of merged) {
    if (posIndex !== 'dh') preAssigned.set(posIndex as number, playerId);
  }
  const preUsedIds = new Set(preAssigned.values());
  const dhFixedId = idealFixed.get('dh') || idealTemp.get('dh') || null;
  if (dhFixedId) preUsedIds.add(dhFixedId as string);

  return solveLineup(rs, (p, pos) => {
    if (preUsedIds.has(p.id)) {
      for (const [i, id] of preAssigned.entries()) {
        if (id === p.id && FIELD_POS[i] === pos) return 999;
      }
      return 0;
    }
    return totalFieldScoreIdeal(config, specialAbilityMap, p, pos);
  });
}
