import React, { useState } from 'react';
import { AppState } from '../App';
import { DEFENSE_ABIL } from '../logic/evaluation';
import { saveWeights, saveRoles } from '../api/playerApi';

interface Props {
  appState: AppState;
  onSaved: () => void;
}

export default function Settings({ appState, onSaved }: Props) {
  const { config } = appState;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successes, setSuccesses] = useState<Record<string, string>>({});

  if (!config) return null;

  const FIELD_POSITIONS = ['捕手', '一塁', '二塁', '三塁', '遊撃', '外野'] as const;

  const handleSave = async (pos: string) => {
    const newWeights: Record<string, number> = {};
    let total = 0;
    for (const ability of DEFENSE_ABIL) {
      const el = document.getElementById(`w-${pos}-${ability}`) as HTMLInputElement;
      const val = Number(el?.value) || 0;
      if (val > 0) newWeights[ability] = val / 100;
      total += val;
    }
    if (total !== 100) {
      setErrors(prev => ({ ...prev, [pos]: `守備重みの合計が${total}%です。100%になるよう調整してください。` }));
      setSuccesses(prev => { const n = {...prev}; delete n[pos]; return n; });
      return;
    }

    const defEl = document.getElementById(`role-def-${pos}`) as HTMLInputElement;
    const defPct = Number(defEl?.value) || 0;
    if (defPct < 1 || defPct > 99) {
      setErrors(prev => ({ ...prev, [pos]: '守備比率は1〜99%で設定してください。' }));
      return;
    }
    const newRoles = { defense: defPct / 100, batting: (100 - defPct) / 100 };

    try {
      await saveWeights({ [pos]: newWeights });
      await saveRoles({ [pos]: newRoles });
      config.positionWeights[pos] = newWeights;
      config.positionRoles[pos] = newRoles;
      setErrors(prev => { const n = {...prev}; delete n[pos]; return n; });
      setSuccesses(prev => ({ ...prev, [pos]: '保存しました。' }));
      onSaved();
    } catch {
      setErrors(prev => ({ ...prev, [pos]: '保存に失敗しました。' }));
    }
  };

  const handleReset = async (pos: string) => {
    setErrors(prev => { const n = {...prev}; delete n[pos]; return n; });
    setSuccesses(prev => { const n = {...prev}; delete n[pos]; return n; });
    try {
      await saveWeights({ [pos]: {} });
      await saveRoles({ [pos]: {} });
      onSaved();
    } catch {
      setErrors(prev => ({ ...prev, [pos]: 'リセットに失敗しました。' }));
    }
  };

  return (
    <div>
      <h2>評価設定</h2>
      <p className="muted">各ポジションの適性計算に使う能力値の重みを変更できます。合計が100%になるように設定してください。</p>
      {FIELD_POSITIONS.map(pos => {
        const weights = config.positionWeights[pos] ?? {};
        const roles = config.positionRoles?.[pos] ?? { defense: 0.55, batting: 0.45 };
        const defPct = Math.round(roles.defense * 100);
        const batPct = 100 - defPct;
        const totalPct = DEFENSE_ABIL.reduce((a, ab) => a + Math.round((weights[ab] ?? 0) * 100), 0);

        return (
          <div key={pos} className="analysis-card" data-pos={pos}>
            <strong style={{ fontSize: '15px' }}>{pos}</strong>

            <div style={{ marginTop: '10px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>守備適性の重み</span>
              <span style={{ fontSize: '12px', color: totalPct === 100 ? 'var(--ok)' : 'var(--danger)' }}>合計 {totalPct}%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', marginBottom: '10px' }}>
              {DEFENSE_ABIL.map(ability => {
                const pct = Math.round((weights[ability] ?? 0) * 100);
                return (
                  <div key={ability} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', minWidth: '80px', color: pct > 0 ? 'var(--text)' : 'var(--muted)' }}>{ability}</span>
                    <input type="number" id={`w-${pos}-${ability}`} min={0} max={100} defaultValue={pct} style={{ width: '52px', padding: '5px 6px' }} />
                    <span style={{ fontSize: '13px' }}>%</span>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>守備 / 打撃 の比率</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px' }}>守備</span>
              <input type="number" id={`role-def-${pos}`} min={1} max={99} defaultValue={defPct} style={{ width: '56px', padding: '5px 6px' }} />
              <span style={{ fontSize: '13px' }}>%</span>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>打撃 {batPct}%</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="primary" onClick={() => handleSave(pos)}>保存</button>
              <button onClick={() => handleReset(pos)}>リセット</button>
            </div>
            {errors[pos] && <div style={{ fontSize: '13px', marginTop: '6px', color: 'var(--danger)' }}>{errors[pos]}</div>}
            {successes[pos] && <div style={{ fontSize: '13px', marginTop: '6px', color: 'var(--ok)' }}>{successes[pos]}</div>}
          </div>
        );
      })}
    </div>
  );
}
