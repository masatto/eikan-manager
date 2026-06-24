import React, { useState, useRef } from 'react';
import { AppState } from '../App';
import { Player } from '../types/Player';
import { createPlayer, updatePlayer } from '../api/playerApi';

interface Props {
  appState: AppState;
  onImported: () => void;
}

export default function Tools({ appState, onImported }: Props) {
  const { players } = appState;
  const [jsonText, setJsonText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const json = JSON.stringify(players, null, 2);
    setJsonText(json);
  };

  const importJson = async () => {
    if (!jsonText.trim()) {
      alert('JSONを貼り付けてください');
      return;
    }
    try {
      const imported: Player[] = JSON.parse(jsonText);
      if (!Array.isArray(imported)) throw new Error('配列ではありません');
      for (const p of imported) {
        try {
          await createPlayer(p);
        } catch {
          await updatePlayer(p);
        }
      }
      alert(`${imported.length}件をインポートしました`);
      onImported();
    } catch (e) {
      alert('インポートに失敗しました: ' + (e as Error).message);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setJsonText(ev.target?.result as string ?? '');
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <h2>入出力</h2>
      <div className="panel">
        <button onClick={exportJson}>JSONバックアップ出力</button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileImport} />
        <button onClick={importJson}>JSON読込</button>
      </div>
      <textarea
        value={jsonText}
        onChange={e => setJsonText(e.target.value)}
        placeholder="ここにバックアップJSONが表示されます"
        style={{ height: '180px', fontFamily: 'ui-monospace, monospace', fontSize: '12px', width: '100%', marginTop: '12px' }}
      />
      <h3>設定ファイル</h3>
      <p>評価ロジックは /api/config で取得できます。</p>
    </div>
  );
}
