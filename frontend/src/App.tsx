import React, { useState, useEffect, useCallback } from 'react';
import { Player, AuthUser, AppConfig } from './types/Player';
import { getMe, getPlayers, getConfig, getWeights, getRoles, loginWithGoogle, logout } from './api/playerApi';
import Dashboard from './components/Dashboard';
import PlayerList from './components/PlayerList';
import PlayerForm from './components/PlayerForm';
import Lineup from './components/Lineup';
import Training from './components/Training';
import Tools from './components/Tools';
import Settings from './components/Settings';

export type Screen = 'dashboard' | 'players' | 'edit' | 'lineup' | 'training' | 'tools' | 'settings';

export interface AppState {
  config: AppConfig | null;
  specialAbilityMap: Record<string, { manualWeight: number; type: string }>;
  players: Player[];
  user: AuthUser | null;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [appState, setAppState] = useState<AppState>({
    config: null,
    specialAbilityMap: {},
    players: [],
    user: null,
  });
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('読み込み中...');

  const loadData = useCallback(async () => {
    try {
      const [user, cfg, players] = await Promise.all([
        getMe().catch(() => ({ authenticated: false } as AuthUser)),
        getConfig(),
        getPlayers().catch(() => [] as Player[]),
      ]);

      const specialAbilityMap = Object.fromEntries(
        (cfg.specialAbilities ?? []).map(a => [a.name, a])
      );

      if (user.authenticated) {
        const [weights, roles] = await Promise.all([
          getWeights().catch(() => ({})),
          getRoles().catch(() => ({})),
        ]);
        Object.entries(weights).forEach(([pos, w]) => {
          if (cfg.positionWeights) cfg.positionWeights[pos] = w;
        });
        Object.entries(roles).forEach(([pos, r]) => {
          if (cfg.positionRoles) cfg.positionRoles[pos] = r as { defense: number; batting: number };
        });
      }

      setAppState({ config: cfg, specialAbilityMap, players, user });
      setSaveStatus('読み込み完了');
    } catch (e) {
      setSaveStatus('読み込みエラー');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const refreshPlayers = useCallback(async () => {
    try {
      const players = await getPlayers();
      setAppState(prev => ({ ...prev, players }));
      setSaveStatus('保存済 ' + new Date().toLocaleString('ja-JP'));
    } catch {
      setSaveStatus('保存エラー');
    }
  }, []);

  const openEdit = (id: string | null = null) => {
    setEditingPlayerId(id);
    setScreen('edit');
  };

  const nav: Array<{ id: Screen; label: string }> = [
    { id: 'dashboard', label: '分析' },
    { id: 'players', label: '一覧' },
    { id: 'edit', label: '登録' },
    { id: 'lineup', label: 'スタメン' },
    { id: 'training', label: '育成' },
    { id: 'tools', label: '入出力' },
    { id: 'settings', label: '設定' },
  ];

  if (!appState.config) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', color: 'var(--muted)' }}>
        読み込み中...
      </div>
    );
  }

  return (
    <>
      <header>
        <h1>栄冠ナイン<span>育成管理</span></h1>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {appState.user?.authenticated ? (
            <>
              <span className="sync-user">{appState.user.name}</span>
              <button className="sync-btn" onClick={loadData}>↑↓ 同期</button>
              <button className="sync-btn" onClick={logout}>ログアウト</button>
            </>
          ) : (
            <button className="sync-btn" onClick={loginWithGoogle}>Googleでログイン</button>
          )}
          <div id="saveStatus">{saveStatus}</div>
        </div>
      </header>

      <main>
        {screen === 'dashboard' && (
          <Dashboard appState={appState} />
        )}
        {screen === 'players' && (
          <PlayerList appState={appState} onEdit={openEdit} />
        )}
        {screen === 'edit' && (
          <PlayerForm
            appState={appState}
            editingPlayerId={editingPlayerId}
            onSaved={() => { refreshPlayers(); setScreen('players'); }}
            onClear={() => setEditingPlayerId(null)}
          />
        )}
        {screen === 'lineup' && (
          <Lineup appState={appState} />
        )}
        {screen === 'training' && (
          <Training appState={appState} />
        )}
        {screen === 'tools' && (
          <Tools appState={appState} onImported={loadData} />
        )}
        {screen === 'settings' && (
          <Settings appState={appState} onSaved={loadData} />
        )}
      </main>

      <nav>
        {nav.map(({ id, label }) => (
          <button
            key={id}
            data-screen={id}
            className={screen === id ? 'active' : ''}
            onClick={() => setScreen(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
