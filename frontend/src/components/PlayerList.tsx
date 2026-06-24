import React, { useState } from 'react';
import { AppState } from '../App';
import { Player } from '../types/Player';
import {
  mainOverall, score100, posFit, POS, POS_SHORT, secondFit,
  battingScore, pitcherManualScore
} from '../logic/evaluation';

interface Props {
  appState: AppState;
  onEdit: (id: string) => void;
}

export default function PlayerList({ appState, onEdit }: Props) {
  const { config, specialAbilityMap, players } = appState;
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [sortSelect, setSortSelect] = useState<string>('grade');

  if (!config) return null;

  let list = [...players];
  if (gradeFilter !== 'all') list = list.filter(p => String(p.grade) === gradeFilter);

  list.sort((a, b) => {
    if (sortSelect === 'overall') return mainOverall(config, b) - mainOverall(config, a);
    if (sortSelect === 'main') return posFit(config, b, b.main) - posFit(config, a, a.main);
    if (sortSelect.startsWith('pos_')) {
      const pos = sortSelect.slice(4);
      return posFit(config, b, pos) - posFit(config, a, pos);
    }
    return b.grade - a.grade || POS.indexOf(a.main as typeof POS[number]) - POS.indexOf(b.main as typeof POS[number]);
  });

  return (
    <div>
      <div className="row">
        <h2>選手一覧</h2>
        <button onClick={() => onEdit(null as unknown as string)}>＋ 新規</button>
      </div>
      <div className="filters">
        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
          <option value="all">全学年</option>
          <option value="3">3年</option>
          <option value="2">2年</option>
          <option value="1">1年</option>
        </select>
        <select value={sortSelect} onChange={e => setSortSelect(e.target.value)}>
          <option value="grade">学年順</option>
          <option value="overall">総合力順</option>
          <option value="main">メイン適性順</option>
          <option value="pos_投手">投手適性順</option>
          <option value="pos_捕手">捕手適性順</option>
          <option value="pos_一塁">一塁適性順</option>
          <option value="pos_二塁">二塁適性順</option>
          <option value="pos_三塁">三塁適性順</option>
          <option value="pos_遊撃">遊撃適性順</option>
          <option value="pos_外野">外野適性順</option>
        </select>
      </div>
      <div>
        {list.length === 0 ? (
          <div className="card">選手が未登録です。</div>
        ) : (
          list.map(p => {
            const second = secondFit(config, p);
            const battingSc = p.main === '投手'
              ? pitcherManualScore(config, specialAbilityMap, p)
              : battingScore(config, specialAbilityMap, p);
            const battingLabel = p.main === '投手' ? '投球' : '打撃';
            return (
              <div key={p.id} className="player-card" onClick={() => onEdit(p.id)}>
                <div className="player-head">
                  <strong>{p.grade}年 {POS_SHORT[p.main]} {p.name}</strong>
                  <span>総合{score100(mainOverall(config, p))}</span>
                </div>
                <div className="scores">
                  <span className="badge">{POS_SHORT[p.main]}{score100(posFit(config, p, p.main))}</span>
                  <span className="badge">→{POS_SHORT[second.pos]}{score100(second.fit)}</span>
                  <span className="badge">{battingLabel}{score100(battingSc)}</span>
                </div>
                {(p.specialAbilities ?? []).length > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(p.specialAbilities ?? []).map(name => {
                      const def = specialAbilityMap[name] as { type?: string } | undefined;
                      const isMinus = def?.type === '赤特';
                      const isGold = def?.type === '金特';
                      const color = isMinus ? 'var(--danger)' : isGold ? 'var(--warn)' : 'var(--primary)';
                      return (
                        <span key={name} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${color}`, color }}>
                          {name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
