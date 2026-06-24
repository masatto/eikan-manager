import React, { useState } from 'react';
import { AppState } from '../App';
import {
  roster, evalPosition, score100, pitcherScore, evalMark, POS,
} from '../logic/evaluation';

interface Props {
  appState: AppState;
}

export default function Dashboard({ appState }: Props) {
  const { config, specialAbilityMap, players } = appState;
  const [yearView, setYearView] = useState(0);
  const [, setForceUpdate] = useState(0);

  if (!config) return null;
  const rs = roster(players, yearView);

  const FIELD_POSITIONS = ['捕手', '一塁', '二塁', '三塁', '遊撃', '外野'] as const;
  const N = FIELD_POSITIONS.length;
  const CX = 160, CY = 155, R = 110;
  const LABEL_R = R + 22;

  const values = FIELD_POSITIONS.map(pos => {
    const { pct } = evalPosition(config, specialAbilityMap, rs, pos);
    return Math.min(pct, 130) / 130;
  });

  const point = (i: number, r: number): [number, number] => {
    const angle = (Math.PI * 2 * i / N) - Math.PI / 2;
    return [CX + Math.cos(angle) * r, CY + Math.sin(angle) * r];
  };

  const gridLines = [0.2, 0.4, 0.6, 0.8, 1.0].map(ratio => {
    const pts = Array.from({ length: N }, (_, i) => point(i, R * ratio).join(',')).join(' ');
    const opacity = ratio === 1.0 ? 0.3 : 0.15;
    return `<polygon points="${pts}" fill="none" stroke="#3b82f6" stroke-width="${ratio === 1.0 ? 1.5 : 0.8}" opacity="${opacity}"/>`;
  }).join('');

  const axisLines = Array.from({ length: N }, (_, i) => {
    const [x, y] = point(i, R);
    return `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="#2a3a50" stroke-width="1"/>`;
  }).join('');

  const excellentPts = Array.from({ length: N }, (_, i) => point(i, R * 0.769).join(',')).join(' ');
  const dataPts = values.map((v, i) => point(i, R * v).join(',')).join(' ');

  const pitcherAnalysis = (() => {
    const ps = rs.filter(p =>
      p.main === '投手' || (p.subs ?? []).includes('投手') || pitcherScore(config, p, 'overall') >= 3.5
    );
    const byGrade = [3, 2, 1].map(g => {
      const arr = ps.filter(p => p.grade === g).sort((a, b) => pitcherScore(config, b, 'ace') - pitcherScore(config, a, 'ace'));
      return { g, p: arr[0] };
    });
    const aceIds = new Set(byGrade.filter(x => x.p).map(x => x.p.id));
    const rel = ps.filter(p => !aceIds.has(p.id)).sort((a, b) => pitcherScore(config, b, 'relief') - pitcherScore(config, a, 'relief'))[0];
    const aceCount = byGrade.filter(x => x.p && pitcherScore(config, x.p, 'ace') >= config.pitcherThresholds.ace).length;
    const relOk = rel && pitcherScore(config, rel, 'relief') >= config.pitcherThresholds.relief;
    let mark = '×', cls = 'bad';
    if (aceCount === 3 && relOk) { mark = '◎'; cls = 'good'; }
    else if (aceCount >= 2 && relOk) { mark = '○'; cls = 'good'; }
    else if (aceCount >= 1 || relOk) { mark = '△'; cls = 'mid'; }
    return { byGrade, rel, mark, cls };
  })();

  const advanceYear = () => {
    // This modifies the players' grades in the UI only
    alert('年度進行：実際の機能は選手データのグレード変更が必要です。');
  };

  return (
    <div>
      <div className="row">
        <h2>チーム分析</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={yearView} onChange={e => setYearView(Number(e.target.value))}>
            <option value={0}>現在</option>
            <option value={1}>来年</option>
            <option value={2}>再来年</option>
          </select>
          <button className="danger" onClick={advanceYear}>年度進行</button>
        </div>
      </div>

      <div className="grid">
        <div className="card"><div className="big">{rs.length}</div><div className="muted">選手数</div></div>
        <div className="card"><div className="big">{rs.filter(p => p.grade === 3).length}</div><div className="muted">3年</div></div>
        <div className="card"><div className="big">{rs.filter(p => p.grade === 2).length}</div><div className="muted">2年</div></div>
        <div className="card"><div className="big">{rs.filter(p => p.grade === 1).length}</div><div className="muted">1年</div></div>
      </div>

      <div className="radar-wrap">
        <svg width={CX * 2} height={CY * 2 - 10} viewBox={`0 0 ${CX * 2} ${CY * 2 - 10}`}>
          <g dangerouslySetInnerHTML={{ __html: gridLines + axisLines }} />
          <polygon
            points={Array.from({ length: N }, (_, i) => point(i, R * 0.769).join(',')).join(' ')}
            fill="#22c55e" fillOpacity="0.06" stroke="#22c55e" strokeWidth="1" opacity="0.2"
          />
          <polygon points={dataPts} fill="#3b82f6" fillOpacity="0.2" stroke="#3b82f6" strokeWidth="2" />
          {values.map((v, i) => {
            const [x, y] = point(i, R * v);
            const color = v >= 0.769 ? '#22c55e' : v >= 0.538 ? '#f59e0b' : '#ef4444';
            return <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="#1a2535" strokeWidth="1.5" />;
          })}
          {FIELD_POSITIONS.map((pos, i) => {
            const [lx, ly] = point(i, LABEL_R);
            const pct = Math.round(values[i] * 130);
            const anchor = lx < CX - 5 ? 'end' : lx > CX + 5 ? 'start' : 'middle';
            const color = pct >= 100 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';
            return (
              <g key={pos}>
                <text x={lx} y={ly - 6} textAnchor={anchor} fontSize="12" fontWeight="600" fill="#e8edf4">{pos}</text>
                <text x={lx} y={ly + 8} textAnchor={anchor} fontSize="11" fill={color}>{pct}%</text>
              </g>
            );
          })}
        </svg>
      </div>

      <h3>ポジション状況</h3>
      <div>
        {FIELD_POSITIONS.map(pos => {
          const { list, mark, cls, pct } = evalPosition(config, specialAbilityMap, rs, pos);
          return (
            <div key={pos} className="analysis-row">
              <strong>{pos}</strong>
              <div className={`eval ${cls}`}>{mark}</div>
              <div>
                <div>戦力 {pct}%</div>
                {list.map(x => (
                  <span key={x.p.id} className="badge">
                    {x.p.name} {score100(x.score)}{x.bonus < 1 ? `×${x.bonus}` : ''}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <h3>投手分析</h3>
      <div className="analysis-card">
        <div className="row">
          <strong>投手</strong>
          <span className={`eval ${pitcherAnalysis.cls}`}>{pitcherAnalysis.mark}</span>
        </div>
        {pitcherAnalysis.byGrade.map(x => (
          <div key={x.g}>
            {x.g}年エース：{x.p ? `${x.p.name} ${score100(pitcherScore(config, x.p, 'ace'))}` : 'なし'}
          </div>
        ))}
        <div>中継ぎ候補：{pitcherAnalysis.rel ? `${pitcherAnalysis.rel.name} ${score100(pitcherScore(config, pitcherAnalysis.rel, 'relief'))}` : 'なし'}</div>
      </div>
    </div>
  );
}
