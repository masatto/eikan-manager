import React, { useState, useEffect, useRef } from 'react';
import { AppState } from '../App';
import { Player } from '../types/Player';
import { createPlayer, updatePlayer, deletePlayer } from '../api/playerApi';
import { RANKS, POS, FIELD_ABIL, SPECIAL, PITCH_RANK, PITCH_SPECIAL } from '../logic/evaluation';

interface Props {
  appState: AppState;
  editingPlayerId: string | null;
  onSaved: () => void;
  onClear: () => void;
}

interface FormState {
  grade: number;
  main: string;
  subs: string[];
  subsHigh: string[];
  弾道: number;
  specialAbilities: string[];
  _specialAbilityFilter: string;
  [key: string]: string | number | string[];
}

const defaultForm = (): FormState => {
  const fs: FormState = {
    grade: 1, main: '投手', subs: [], subsHigh: [], 弾道: 1,
    specialAbilities: [], _specialAbilityFilter: '',
  };
  [...FIELD_ABIL, ...SPECIAL, ...PITCH_RANK].forEach(a => { fs[a] = 'G'; });
  PITCH_SPECIAL.forEach(a => { fs['投' + a] = 'G'; });
  return fs;
};

export default function PlayerForm({ appState, editingPlayerId, onSaved, onClear }: Props) {
  const { config } = appState;
  const [form, setForm] = useState<FormState>(defaultForm());
  const [name, setName] = useState('');
  const [speed, setSpeed] = useState(130);
  const [pitchTypes, setPitchTypes] = useState(0);
  const [totalBreak, setTotalBreak] = useState(0);
  const [memo, setMemo] = useState('');
  const [filterText, setFilterText] = useState('');
  const filterInputRef = useRef<HTMLInputElement>(null);

  const editing = editingPlayerId !== null;

  useEffect(() => {
    if (editingPlayerId && appState.players.length > 0) {
      const p = appState.players.find(x => x.id === editingPlayerId);
      if (!p) return;
      const fs = defaultForm();
      fs.grade = p.grade;
      fs.main = p.main;
      fs.subs = [...(p.subs ?? [])];
      fs.subsHigh = [...(p.subsHigh ?? [])];
      fs['弾道'] = (p.abilities?.['弾道'] as number) || 1;
      [...FIELD_ABIL, ...SPECIAL].forEach(a => { fs[a] = (p.abilities?.[a] as string) || 'G'; });
      PITCH_RANK.forEach(a => { fs[a] = (p.pitch?.[a] as string) || 'G'; });
      PITCH_SPECIAL.forEach(a => { fs['投' + a] = (p.pitch?.[a] as string) || 'G'; });
      fs.specialAbilities = [...(p.specialAbilities ?? [])];
      setForm(fs);
      setName(p.name);
      setSpeed((p.pitch?.['球速'] as number) || 130);
      setPitchTypes((p.pitch?.['球種数'] as number) || 0);
      setTotalBreak((p.pitch?.['総変化量'] as number) || 0);
      setMemo(p.memo || '');
    } else {
      setForm(defaultForm());
      setName('');
      setSpeed(130);
      setPitchTypes(0);
      setTotalBreak(0);
      setMemo('');
    }
    setFilterText('');
  }, [editingPlayerId, appState.players]);

  const setField = (key: string, val: string | number | string[]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const toggleSub = (p: string) => {
    setForm(prev => {
      const subs = [...prev.subs];
      const subsHigh = [...prev.subsHigh];
      if (!subs.includes(p)) {
        return { ...prev, subs: [...subs, p] };
      } else if (!subsHigh.includes(p)) {
        return { ...prev, subsHigh: [...subsHigh, p] };
      } else {
        return {
          ...prev,
          subs: subs.filter(x => x !== p),
          subsHigh: subsHigh.filter(x => x !== p),
        };
      }
    });
  };

  const toggleSpecialAbility = (abilName: string, checked: boolean) => {
    setForm(prev => {
      const sa = [...prev.specialAbilities];
      if (checked && !sa.includes(abilName)) return { ...prev, specialAbilities: [...sa, abilName] };
      if (!checked) return { ...prev, specialAbilities: sa.filter(n => n !== abilName) };
      return prev;
    });
    // Restore focus to filter input after state update
    setTimeout(() => filterInputRef.current?.focus(), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert('名前を入力してください'); return; }

    const abilities: Record<string, string | number> = { 弾道: form['弾道'] as number };
    [...FIELD_ABIL, ...SPECIAL].forEach(a => { abilities[a] = (form[a] as string) || 'G'; });

    const pitch: Record<string, string | number> = {
      球速: speed,
      球種数: pitchTypes,
      総変化量: totalBreak,
    };
    PITCH_RANK.forEach(a => { pitch[a] = (form[a] as string) || 'G'; });
    PITCH_SPECIAL.forEach(a => { pitch[a] = (form['投' + a] as string) || 'G'; });

    const p: Player = {
      id: editingPlayerId || '',
      name: name.trim(),
      grade: form.grade as number,
      main: form.main as string,
      subs: form.subs as string[],
      subsHigh: form.subsHigh as string[],
      abilities,
      pitch,
      specialAbilities: form.specialAbilities as string[],
      memo,
      updatedAt: Date.now(),
    };

    try {
      if (editing && editingPlayerId) {
        await updatePlayer(p);
      } else {
        await createPlayer(p);
      }
      onSaved();
    } catch (e) {
      alert('保存に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!editingPlayerId) { onClear(); return; }
    if (confirm('削除しますか？')) {
      try {
        await deletePlayer(editingPlayerId);
        onSaved();
      } catch {
        alert('削除に失敗しました');
      }
    }
  };

  const RankButtons = ({ abilKey }: { abilKey: string }) => (
    <div className="ability-row">
      <strong>{abilKey.startsWith('投') ? abilKey.slice(1) : abilKey}</strong>
      <div className="choice">
        {RANKS.map(r => (
          <button
            key={r} type="button"
            className={(form[abilKey] as string) === r ? 'selected' : ''}
            onClick={() => setField(abilKey, r)}
          >{r}</button>
        ))}
      </div>
    </div>
  );

  const specialAbilities = config?.specialAbilities ?? [];
  const isPitcher = form.main === '投手';
  const filteredAbils = specialAbilities.filter(a =>
    a.target === '共通' || (isPitcher ? a.target === '投手' : a.target === '野手')
  );
  const groups: Record<string, typeof filteredAbils> = {};
  filteredAbils.forEach(a => {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
  });
  const q = filterText.trim();

  return (
    <div>
      <h2>{editing ? '選手編集' : '選手登録'}</h2>
      <form onSubmit={handleSubmit}>
        <label>
          名前
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="山田 太郎" />
        </label>

        <div className="field">
          <span>学年</span>
          <div className="choice">
            {[1, 2, 3].map(g => (
              <button key={g} type="button"
                className={form.grade === g ? 'selected' : ''}
                onClick={() => setField('grade', g)}>{g}年</button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>メインポジション</span>
          <div className="choice">
            {POS.map(pos => (
              <button key={pos} type="button"
                className={form.main === pos ? 'selected' : ''}
                onClick={() => {
                  setForm(prev => ({
                    ...prev,
                    main: pos,
                    subs: (prev.subs as string[]).filter(s => s !== pos),
                  }));
                }}>{pos}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>サブポジション</span>
          <div className="choice multi">
            {POS.filter(p => p !== form.main).map(p => {
              const isHigh = (form.subsHigh as string[]).includes(p);
              const isLow = (form.subs as string[]).includes(p) && !isHigh;
              return (
                <button key={p} type="button"
                  className={isHigh ? 'selected high' : isLow ? 'selected' : ''}
                  onClick={() => toggleSub(p)}>
                  {isHigh ? p + '◎' : isLow ? p + '○' : p}
                </button>
              );
            })}
          </div>
        </div>

        <h3>野手能力</h3>
        <div>
          <div className="ability-row">
            <strong>弾道</strong>
            <div className="choice">
              {[1, 2, 3, 4].map(v => (
                <button key={v} type="button"
                  className={(form['弾道'] as number) === v ? 'selected' : ''}
                  onClick={() => setField('弾道', v)}>{v}</button>
              ))}
            </div>
          </div>
          {FIELD_ABIL.map(a => <RankButtons key={a} abilKey={a} />)}
        </div>

        <h3>右上能力</h3>
        <div>
          {SPECIAL.map(a => <RankButtons key={a} abilKey={a} />)}
        </div>

        {isPitcher && (
          <div>
            <h3>投手能力</h3>
            <div className="two">
              <label>球速<input type="number" min={100} max={170} value={speed} onChange={e => setSpeed(Number(e.target.value))} /></label>
              <label>球種数<input type="number" min={0} max={7} value={pitchTypes} onChange={e => setPitchTypes(Number(e.target.value))} /></label>
              <label>総変化量<input type="number" min={0} max={25} value={totalBreak} onChange={e => setTotalBreak(Number(e.target.value))} /></label>
            </div>
            {PITCH_RANK.map(a => <RankButtons key={a} abilKey={a} />)}
            {PITCH_SPECIAL.map(a => <RankButtons key={a} abilKey={'投' + a} />)}
          </div>
        )}

        <h3>特殊能力</h3>
        <div>
          <div style={{ marginBottom: '10px' }}>
            <input
              ref={filterInputRef}
              type="text"
              placeholder="特殊能力を検索…"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
          </div>
          <div>
            {Object.entries(groups).map(([cat, items]) => {
              const selected = form.specialAbilities as string[];
              const visible = items.filter(a => selected.includes(a.name) || !q || a.name.includes(q));
              if (!visible.length) return null;
              return (
                <div key={cat} style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, marginBottom: '6px' }}>{cat}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {visible.map(a => {
                      const checked = selected.includes(a.name);
                      const color = a.type === '赤特' ? 'var(--danger)' : a.type === '金特' ? 'var(--warn)' : 'var(--primary)';
                      return (
                        <label key={a.name} style={{
                          display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                          fontSize: '14px', padding: '7px 12px', borderRadius: '8px',
                          border: `1px solid ${checked ? color : 'var(--border)'}`,
                          background: checked ? color + '22' : 'var(--surface)',
                          color: checked ? color : 'var(--text)',
                          userSelect: 'none',
                        }}>
                          <input type="checkbox" style={{ display: 'none' }} checked={checked}
                            onChange={ev => toggleSpecialAbility(a.name, ev.target.checked)} />
                          {a.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <label>メモ<textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} /></label>

        <div className="actions">
          <button type="submit" className="primary">{editing ? '更新' : '保存'}</button>
          <button type="button" className="danger" onClick={handleDelete}>削除</button>
          <button type="button" onClick={() => { onClear(); setForm(defaultForm()); setName(''); setMemo(''); setSpeed(130); setPitchTypes(0); setTotalBreak(0); }}>クリア</button>
        </div>
      </form>
    </div>
  );
}
