import React, { useState } from 'react';
import { AppState } from '../App';
import {
  roster, totalFieldScoreIdeal, score100, getTopImpacts, evalMark, POS_SHORT,
  RANKS,
} from '../logic/evaluation';
import { calcIdealPlan, FIELD_POS, LABELS } from '../logic/lineup';

interface Props {
  appState: AppState;
}

export default function Training({ appState }: Props) {
  const { config, specialAbilityMap, players } = appState;
  const [activeTab, setActiveTab] = useState<'team' | 'player'>('team');

  if (!config) return null;
  const rs = roster(players, 0);
  const fielders = rs.filter(p => p.main !== '投手');

  if (fielders.length < 9) {
    return (
      <div>
        <div className="row"><h2>育成強化推奨</h2></div>
        <div className="card" style={{ color: 'var(--muted)' }}>野手が9人未満のため、育成推奨を計算できません。</div>
      </div>
    );
  }

  const idealPlan = calcIdealPlan(config, specialAbilityMap, rs, new Map(), new Map());
  const allUsedIds = new Set([...idealPlan.assigned.values()].filter(Boolean).map(p => p!.id));
  const benchPlayers = fielders.filter(p => !allUsedIds.has(p.id));

  return (
    <div>
      <div className="row"><h2>育成強化推奨</h2></div>
      <p className="muted">理想スタメンをベースに、各ポジション・各選手の戦力向上に最も効く能力強化を表示します。</p>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {(['team', 'player'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={activeTab === t ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : {}}>
            {t === 'team' ? 'チーム視点' : '選手視点'}
          </button>
        ))}
      </div>

      {activeTab === 'team' && (
        <div>
          {FIELD_POS.map((pos, i) => {
            const p = idealPlan.assigned.get(i);
            if (!p) return null;
            const topCount = config.topCounts[pos] ?? 2;
            const th = config.positionThresholds[pos];
            const perPersonTh = { excellent: th.excellent / topCount, good: th.good / topCount, warning: th.warning / topCount };
            const [mark, cls] = evalMark(totalFieldScoreIdeal(config, specialAbilityMap, p, pos), perPersonTh);
            const impacts = getTopImpacts(config, specialAbilityMap, p, pos, 3);

            return (
              <div key={i} className="analysis-card" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>{LABELS[i]}: {p.name} ({p.grade}年)</strong>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: 'var(--muted)' }}>{score100(totalFieldScoreIdeal(config, specialAbilityMap, p, pos))}点</span>
                    <span className={`eval ${cls}`} style={{ fontSize: '18px' }}>{mark}</span>
                  </div>
                </div>
                {impacts.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>強化推奨なし(全能力が最大)</div>
                ) : (
                  impacts.map((x, idx) => {
                    const curRank = x.ability === '弾道'
                      ? (p.abilities?.['弾道'] as number) || 1
                      : (p.abilities?.[x.ability] as string) || 'G';
                    const nextRank = x.ability === '弾道'
                      ? Math.min(4, Number(curRank) + 1)
                      : RANKS[Math.min(RANKS.indexOf(String(curRank) as typeof RANKS[number]) + 1, RANKS.length - 1)];
                    return (
                      <div key={x.ability} style={{ fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ color: 'var(--muted)', minWidth: '14px' }}>{idx + 1}.</span>
                        <span style={{ fontWeight: 600 }}>{x.ability}</span>
                        <span style={{ color: 'var(--muted)' }}>{curRank}→{nextRank}</span>
                        <span style={{ color: 'var(--ok)', fontWeight: 700 }}>+{score100(x.impact)}点</span>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'player' && (
        <div>
          {[...idealPlan.assigned.values()].filter(Boolean).map(p => {
            const posIndex = [...idealPlan.assigned.entries()].find(([, v]) => v?.id === p!.id)?.[0] ?? 0;
            const pos = FIELD_POS[posIndex];
            const impacts = getTopImpacts(config, specialAbilityMap, p!, pos, 5);
            return (
              <div key={p!.id} className="analysis-card" style={{ marginBottom: '12px' }}>
                <strong>{p!.name} ({p!.grade}年・{POS_SHORT[p!.main]} → {LABELS[posIndex]})</strong>
                <div style={{ marginTop: '6px' }}>
                  {impacts.map((x, idx) => {
                    const curRank = x.ability === '弾道'
                      ? (p!.abilities?.['弾道'] as number) || 1
                      : (p!.abilities?.[x.ability] as string) || 'G';
                    const nextRank = x.ability === '弾道'
                      ? Math.min(4, Number(curRank) + 1)
                      : RANKS[Math.min(RANKS.indexOf(String(curRank) as typeof RANKS[number]) + 1, RANKS.length - 1)];
                    return (
                      <div key={x.ability} style={{ fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ color: 'var(--muted)', minWidth: '14px' }}>{idx + 1}.</span>
                        <span style={{ fontWeight: 600 }}>{x.ability}</span>
                        <span style={{ color: 'var(--muted)' }}>{curRank}→{nextRank}</span>
                        <span style={{ color: 'var(--ok)', fontWeight: 700 }}>+{score100(x.impact)}点</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {benchPlayers.length > 0 && (
            <div>
              <h3>控え選手</h3>
              {benchPlayers.map(p => <span key={p.id} className="badge">{p.name} {p.grade}年({POS_SHORT[p.main]})</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
