import React, { useState } from 'react';
import { AppState } from '../App';
import {
  roster, totalFieldScore, totalFieldScoreIdeal, score100, dhScore,
  posBonus, evalPosition, evalMark, POS_SHORT,
} from '../logic/evaluation';
import { calcIdealPlan, solveLineup, FIELD_POS, LABELS } from '../logic/lineup';

interface Props {
  appState: AppState;
}

export default function Lineup({ appState }: Props) {
  const { config, specialAbilityMap, players } = appState;
  const [yearView, setYearView] = useState(0);
  const [activeTab, setActiveTab] = useState<'real' | 'ideal'>('real');
  const [idealFixed, setIdealFixed] = useState<Map<string, number | 'dh'>>(new Map());
  const [idealTemp, setIdealTemp] = useState<Map<string, number | 'dh'>>(new Map());

  if (!config) return null;
  const rs = roster(players, yearView);
  const fielders = rs.filter(p => p.main !== '投手');

  if (fielders.length < 9) {
    return (
      <div>
        <div className="row">
          <h2>スタメン考案</h2>
          <select value={yearView} onChange={e => setYearView(Number(e.target.value))}>
            <option value={0}>現在</option>
            <option value={1}>来年</option>
            <option value={2}>再来年</option>
          </select>
        </div>
        <div className="card muted">野手が9人未満のため、スタメンを組めません。</div>
      </div>
    );
  }

  const realPlan = solveLineup(rs, (p, pos) => totalFieldScore(config, specialAbilityMap, p, pos));
  const idealPlan = calcIdealPlan(config, specialAbilityMap, rs, idealFixed, idealTemp);

  const toggleFixed = (playerId: string, posIndex: number | 'dh') => {
    setIdealFixed(prev => {
      const next = new Map(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.set(playerId, posIndex);
        setIdealTemp(t => { const nt = new Map(t); nt.delete(playerId); return nt; });
      }
      return next;
    });
  };

  const onIdealChange = (posIndex: number, playerId: string) => {
    setIdealTemp(prev => {
      const next = new Map(prev);
      next.delete(playerId);
      if (playerId) next.set(playerId, posIndex);
      return next;
    });
    setIdealFixed(prev => { const next = new Map(prev); next.delete(playerId); return next; });
  };

  const onIdealDhChange = (playerId: string) => {
    if (playerId) {
      setIdealTemp(prev => {
        const next = new Map(prev);
        next.delete(playerId);
        next.set('dh', playerId);
        return next;
      });
      setIdealFixed(prev => { const next = new Map(prev); next.delete(playerId); return next; });
    } else {
      setIdealTemp(prev => { const next = new Map(prev); next.delete('dh'); return next; });
      setIdealFixed(prev => { const next = new Map(prev); next.delete('dh'); return next; });
    }
  };

  const clearFixed = () => {
    setIdealFixed(new Map());
    setIdealTemp(new Map());
  };

  const realTotal = FIELD_POS.reduce((sum, fpos, fi) => {
    const fp = realPlan.assigned.get(fi);
    return sum + (fp ? score100(totalFieldScore(config, specialAbilityMap, fp, fpos)) : 0);
  }, 0);
  const idealTotal = FIELD_POS.reduce((sum, fpos, fi) => {
    const fp = idealPlan.assigned.get(fi);
    return sum + (fp ? score100(totalFieldScoreIdeal(config, specialAbilityMap, fp, fpos)) : 0);
  }, 0);
  const totalDiff = idealTotal - realTotal;

  return (
    <div>
      <div className="row">
        <h2>スタメン考案</h2>
        <select value={yearView} onChange={e => setYearView(Number(e.target.value))}>
          <option value={0}>現在</option>
          <option value={1}>来年</option>
          <option value={2}>再来年</option>
        </select>
      </div>
      <p className="muted">投手を除く野手から最適な9人+DHを自動選出します。</p>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {(['real', 'ideal'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={activeTab === t ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : {}}>
            {t === 'real' ? '現実案' : '理想案'}
          </button>
        ))}
        {activeTab === 'ideal' && (idealFixed.size > 0 || idealTemp.size > 0) && (
          <button onClick={clearFixed} style={{ marginLeft: 'auto', fontSize: '12px', padding: '6px 10px', color: 'var(--muted)' }}>
            固定をリセット
          </button>
        )}
      </div>

      <div className="analysis-card">
        {activeTab === 'real' && (
          <div>
            {FIELD_POS.map((pos, i) => {
              const p = realPlan.assigned.get(i);
              if (!p) return <div key={i} className="lineup-row"><span className="lineup-pos">{LABELS[i]}</span><span className="muted">未割当</span></div>;
              const s = score100(totalFieldScore(config, specialAbilityMap, p, pos));
              const bonus = posBonus(config, p, pos);
              const { mark, cls } = evalPosition(config, specialAbilityMap, rs, pos);
              return (
                <div key={i} className="lineup-row">
                  <span className="lineup-pos">{LABELS[i]}</span>
                  <span className="lineup-name">
                    {p.name}<span className="muted" style={{ fontSize: '11px', marginLeft: '4px' }}>{p.grade}年</span>
                    {bonus < 1 && <span className="lineup-bonus">×{bonus}</span>}
                  </span>
                  <span className={`eval ${cls}`} style={{ fontSize: '16px' }}>{mark}</span>
                  <span className="lineup-score">{s}</span>
                </div>
              );
            })}
            {realPlan.dh && (
              <div className="lineup-row" style={{ borderTop: '1px solid var(--border)', marginTop: '6px', paddingTop: '8px' }}>
                <span className="lineup-pos">DH</span>
                <span className="lineup-name">{realPlan.dh.name}<span className="muted" style={{ fontSize: '11px', marginLeft: '4px' }}>{realPlan.dh.grade}年</span></span>
                <span></span>
                <span className="lineup-score">{score100(dhScore(config, realPlan.dh))}</span>
              </div>
            )}
            {realPlan.bench.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <h3>控え・出場機会なし</h3>
                {realPlan.bench.map(p => <span key={p.id} className="badge">{p.name} {p.grade}年({POS_SHORT[p.main]})</span>)}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ideal' && (
          <div>
            <div style={{ fontSize: '13px', padding: '6px 10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--muted)' }}>チーム総合スコア</span>
              <span>現実 <strong>{realTotal}</strong></span>
              <span style={{ color: 'var(--muted)' }}>→</span>
              <span>理想 <strong style={{ color: 'var(--primary)' }}>{idealTotal}</strong></span>
              <span style={{ color: totalDiff >= 0 ? 'var(--ok)' : 'var(--danger)', fontWeight: 700 }}>
                ({totalDiff >= 0 ? '+' : ''}{totalDiff})
              </span>
            </div>
            {FIELD_POS.map((pos, i) => {
              const p = idealPlan.assigned.get(i);
              const curId = p?.id ?? '';
              const isFixed = curId ? idealFixed.has(curId) : false;
              const sIdeal = p ? score100(totalFieldScoreIdeal(config, specialAbilityMap, p, pos)) : 0;
              const sCurrent = p ? score100(totalFieldScore(config, specialAbilityMap, p, pos)) : 0;
              const needConvert = p && p.main !== pos && !(p.subsHigh ?? []).includes(pos);
              const topCount = config.topCounts[pos] ?? 2;
              const th = config.positionThresholds[pos];
              const perPersonTh = { excellent: th.excellent / topCount, good: th.good / topCount, warning: th.warning / topCount };
              const [mark, cls] = p ? evalMark(totalFieldScoreIdeal(config, specialAbilityMap, p, pos), perPersonTh) : ['−', 'mid'] as const;

              return (
                <div key={i} className="lineup-row" style={{ gridTemplateColumns: '48px 1fr auto 32px 36px' }}>
                  <span className="lineup-pos">{LABELS[i]}</span>
                  <div>
                    <select style={{ width: '100%', padding: '5px 8px', fontSize: '12px' }}
                      value={curId}
                      onChange={e => onIdealChange(i, e.target.value)}>
                      <option value="">-- 未割当 --</option>
                      {fielders.map(fp => (
                        <option key={fp.id} value={fp.id}>{fp.name}({fp.grade}年・{POS_SHORT[fp.main]})</option>
                      ))}
                    </select>
                    {needConvert && <span style={{ fontSize: '10px', color: 'var(--danger)', marginLeft: '4px' }}>コンバート</span>}
                  </div>
                  <button onClick={() => curId && toggleFixed(curId, i)}
                    style={{ fontSize: '11px', padding: '3px 8px', ...(isFixed ? { color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 700 } : { color: 'var(--muted)' }) }}>
                    {isFixed ? '固定中' : '固定'}
                  </button>
                  <span className={`eval ${cls}`} style={{ fontSize: '16px' }}>{mark}</span>
                  <span className="lineup-score">{p ? (needConvert ? `${sCurrent}→${sIdeal}` : sIdeal) : '-'}</span>
                </div>
              );
            })}
            <div className="lineup-row" style={{ borderTop: '1px solid var(--border)', marginTop: '6px', paddingTop: '8px', gridTemplateColumns: '48px 1fr auto 32px 36px' }}>
              <span className="lineup-pos">DH</span>
              <select style={{ width: '100%', padding: '5px 8px', fontSize: '12px' }}
                value={idealFixed.get('dh') ?? idealTemp.get('dh') ?? ''}
                onChange={e => onIdealDhChange(e.target.value)}>
                <option value="">-- 自動選出 --</option>
                {fielders.map(p => (
                  <option key={p.id} value={p.id}>{p.name}({p.grade}年・{POS_SHORT[p.main]})</option>
                ))}
              </select>
              <button style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--muted)' }}>固定</button>
              <span></span>
              <span className="lineup-score">-</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
