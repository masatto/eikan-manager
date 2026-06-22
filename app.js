/* =========================================================
 * 栄冠ナイン育成管理アプリ - app.js
 * 役割: 選手データの登録・編集・評価計算・画面描画
 * 評価ロジックの重み付けは config.json に外出ししている
 * ========================================================= */

/* ---------- 定数定義 ---------- */

// 能力ランクの並び(低い順)
const RANKS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];

// ポジション一覧(投手を含む全7ポジション)
const POS = ['投手', '捕手', '一塁', '二塁', '三塁', '遊撃', '外野'];

// ポジションの短縮表記(選手一覧カードで使用)
const POS_SHORT = { 投手: '投', 捕手: '捕', 一塁: '一', 二塁: '二', 三塁: '三', 遊撃: '遊', 外野: '外' };

// 野手能力(ランク制、G〜S)
const FIELD_ABIL = ['ミート', 'パワー', '走力', '肩力', '守備力', '捕球'];

// 野手の右上能力(ランク制、G〜S)
const SPECIAL = ['チャンス', '対左投手', 'キャッチャー', 'ケガしにくさ', '盗塁', '走塁', '送球', '回復'];

// 投手の主要能力のうちランク制のもの(球速・球種数・総変化量は数値入力のため別管理)
const PITCH_RANK = ['コントロール', 'スタミナ'];

// 投手の右上能力(ランク制、G〜S)。野手用SPECIALと「ケガしにくさ」「回復」が同名だが値は別管理。
const PITCH_SPECIAL = ['対ピンチ', '対左打者', '打たれ強さ', 'ケガしにくさ', 'ノビ', 'クイック', '回復'];

// localStorageの保存キー
const KEY = 'eikan_manager_players_v13';
const WEIGHT_KEY = 'eikan_manager_weights_v1'; // ポジション別重み設定の保存キー

// グローバルな状態
let config = null;      // config.jsonの内容(評価ロジックの重み付け等)
let specialAbilityMap = {}; // config.specialAbilities をname→定義でO(1)参照するためのキャッシュ
let players = [];        // 全選手データ
let current = null;      // 編集中の選手ID(新規登録時はnull)
let formState = { grade: 1, main: '投手', subs: [], 弾道: 1 }; // 選手登録フォームの入力状態


/* ---------- 初期化 ---------- */

async function init() {
  try {
    config = await (await fetch('config.json', { cache: 'no-store' })).json();
  } catch (e) {
    config = defaultConfig();
  }
  checkConfig();
  specialAbilityMap = Object.fromEntries((config.specialAbilities || []).map(a => [a.name, a]));
  applyCustomWeights(); // localStorageに保存されたカスタム重みをconfig.positionWeightsに上書きする
  players = JSON.parse(localStorage.getItem(KEY) || '[]');
  buildForm();
  bind();
  renderAll();
}

// localStorageのカスタム重みをconfig.positionWeightsに反映する。
// 保存値が存在するポジションのみ上書きし、ないポジションはconfig.jsonの値をそのまま使う。
function applyCustomWeights() {
  try {
    const saved = JSON.parse(localStorage.getItem(WEIGHT_KEY) || '{}');
    Object.entries(saved).forEach(([pos, weights]) => {
      config.positionWeights[pos] = weights;
    });
  } catch (e) {
    // 不正なデータは無視
  }
}

// app.jsの評価ロジックが依存する必須キー。config.jsonに無い場合はdefaultConfig()で補う。
const REQUIRED_CONFIG_KEYS = [
  'rankValues', 'positionBonus', 'topCounts', 'positionThresholds',
  'positionWeights', 'overallWeights', 'pitcherWeights', 'pitcherThresholds',
  'speedScale', 'pitchTypeScale', 'totalBreakScale',
  'positionRoles', 'manualBaseWeights'
];

// config.jsonの構造不備を検知し、不足キーがあれば標準値で補完しつつ画面上に警告を出す。
// (config.jsonのキー名がapp.jsの期待と異なると評価ロジックが例外で止まり、
//  一覧描画が全て空白になるという事故が過去にあったため、その再発防止策)
function checkConfig() {
  const def = defaultConfig();
  const missing = REQUIRED_CONFIG_KEYS.filter(k => !(k in config));
  missing.forEach(k => config[k] = def[k]);
  if (missing.length) {
    const box = document.createElement('div');
    box.style = 'position:fixed;top:0;left:0;right:0;background:#fff3cd;color:#7a4a00;font-size:13px;padding:10px 14px;z-index:9999;border-bottom:2px solid #d97706;';
    box.textContent = 'config.jsonに不足項目があります（' + missing.join('、') + '）。標準設定で補って動作しています。config.jsonを確認してください。';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '閉じる';
    closeBtn.style = 'margin-left:10px;';
    closeBtn.onclick = () => box.remove();
    box.appendChild(closeBtn);
    document.body.appendChild(box);
  }
}

// config.jsonが読み込めない場合のフォールバック標準設定
function defaultConfig() {
  return {
    rankValues: { S: 8, A: 7, B: 6, C: 5, D: 4, E: 3, F: 2, G: 1 },
    positionBonus: { main: 1, subHigh: 1, sub: .7, none: .45 },
    topCounts: { 投手: 4, 捕手: 2, 一塁: 2, 二塁: 2, 三塁: 2, 遊撃: 2, 外野: 4 },
    startingCounts: { 捕手: 1, 一塁: 1, 二塁: 1, 三塁: 1, 遊撃: 1, 外野: 3 },
    positionThresholds: {
      捕手: { excellent: 13, good: 10, warning: 7 },
      一塁: { excellent: 13, good: 10, warning: 7 },
      二塁: { excellent: 13, good: 10, warning: 7 },
      三塁: { excellent: 13, good: 10, warning: 7 },
      遊撃: { excellent: 13, good: 10, warning: 7 },
      外野: { excellent: 24, good: 18, warning: 12 }
    },
    positionWeights: {
      捕手: { キャッチャー: .4, 肩力: .25, 捕球: .2, 送球: .15 },
      一塁: { 捕球: .55, ミート: .15, パワー: .15, 守備力: .15 },
      二塁: { 守備力: .4, 送球: .35, 捕球: .15, 走力: .1 },
      三塁: { 肩力: .3, 送球: .3, 捕球: .25, 守備力: .15 },
      遊撃: { 守備力: .35, 送球: .3, 肩力: .2, 捕球: .15 },
      外野: { 肩力: .35, 捕球: .3, 走力: .2, 送球: .15 }
    },
    overallWeights: { ミート: .18, パワー: .18, 走力: .14, 肩力: .1, 守備力: .1, 捕球: .1, 送球: .07, チャンス: .05, 盗塁: .04, 走塁: .04 },
    pitcherWeights: {
      ace: { 球速: .15, コントロール: .3, スタミナ: .25, 総変化量: .2, 球種数: .1 },
      relief: { 球速: .3, コントロール: .25, 総変化量: .3, 球種数: .1, スタミナ: .05 },
      overall: { 球速: .2, コントロール: .3, スタミナ: .2, 総変化量: .2, 球種数: .1 }
    },
    pitcherThresholds: { ace: 5.2, relief: 4.8 },
    speedScale: { min: 120, max: 165 },
    pitchTypeScale: { min: 0, max: 7 },
    totalBreakScale: { min: 0, max: 20 },
    positionRoles: {
      捕手: { defense: 0.70, batting: 0.30 },
      一塁: { defense: 0.40, batting: 0.60 },
      二塁: { defense: 0.65, batting: 0.35 },
      三塁: { defense: 0.45, batting: 0.55 },
      遊撃: { defense: 0.70, batting: 0.30 },
      外野: { defense: 0.35, batting: 0.65 }
    },
    manualBaseWeights: {
      野手: { ミート: 0.35, パワー: 0.30, 走力: 0.20, 弾道: 0.15 },
      投手: { 球速: 0.30, コントロール: 0.35, 総変化量: 0.25, 球種数: 0.10 }
    }
  };
}


/* ---------- イベント登録・画面切り替え ---------- */

function bind() {
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => show(b.dataset.screen));
  document.getElementById('playerForm').onsubmit = savePlayer;
  document.getElementById('newPlayerBtn').onclick = () => { clearForm(); show('edit'); };
  document.getElementById('clearBtn').onclick = clearForm;
  document.getElementById('deleteBtn').onclick = deletePlayer;
  document.getElementById('gradeFilter').onchange = renderPlayers;
  document.getElementById('sortSelect').onchange = renderPlayers;
  document.getElementById('yearView').onchange = renderDashboard;
  document.getElementById('lineupYearView').onchange = renderLineup;
  document.getElementById('advanceYearBtn').onclick = advanceYear;
  document.getElementById('exportBtn').onclick = exportJson;
  document.getElementById('importBtn').onclick = importJson;}

// タブ切り替え。切り替え先に応じて該当画面の再描画も行う。
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.screen === id));
  if (id === 'dashboard') renderDashboard();
  if (id === 'players') renderPlayers();
  if (id === 'lineup') renderLineup();
  if (id === 'settings') renderWeightSettings();
}

// localStorageへの保存とヘッダーの保存状況表示の更新
function save() {
  localStorage.setItem(KEY, JSON.stringify(players));
  document.getElementById('saveStatus').textContent = '保存済 ' + new Date().toLocaleString('ja-JP');
}


/* ---------- 選手登録フォームの構築 ---------- */

// フォーム全体を formState の内容に合わせて再構築する。
// メインポジション・サブポジションを切り替えた際にも呼ばれる。
function buildForm() {
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.textContent = current ? '更新' : '保存';

  makeChoice('gradeButtons', [1, 2, 3], v => formState.grade = Number(v), () => formState.grade, x => x + '年');
  makeChoice('mainPosButtons', POS, v => {
    formState.main = v;
    formState.subs = formState.subs.filter(s => s !== v); // メインに選んだポジションはサブから除外
    buildSub();
    togglePitcherSection();
  }, () => formState.main);
  buildSub();

  const bf = document.getElementById('battingFields');
  bf.innerHTML = '';
  bf.appendChild(choiceRow('弾道', [1, 2, 3, 4], v => formState.弾道 = Number(v), () => formState.弾道));
  FIELD_ABIL.forEach(a => bf.appendChild(rankRow(a)));

  const sf = document.getElementById('specialFields');
  sf.innerHTML = '';
  SPECIAL.forEach(a => sf.appendChild(rankRow(a)));

  const pf = document.getElementById('pitchRankFields');
  pf.innerHTML = '';
  PITCH_RANK.forEach(a => pf.appendChild(rankRow(a)));
  PITCH_SPECIAL.forEach(a => pf.appendChild(pitchRankRow(a)));

  togglePitcherSection();

  // 特殊能力チェックリストの構築
  buildSpecialAbilityFields();
}


function buildSpecialAbilityFields(preserveFilter) {
  const el = document.getElementById('specialAbilityFields');
  if (!el || !config.specialAbilities) return;
  if (!formState.specialAbilities) formState.specialAbilities = [];
  if (!preserveFilter) formState._specialAbilityFilter = '';

  const q = (formState._specialAbilityFilter || '').trim();
  const isPitcher = formState.main === '投手';
  const abilities = config.specialAbilities.filter(a =>
    a.target === '共通' || (isPitcher ? a.target === '投手' : a.target === '野手')
  );

  const chipStyle = (checked, color) =>
    'display:inline-flex;align-items:center;cursor:pointer;font-size:14px;' +
    'padding:7px 12px;border-radius:8px;border:1px solid ' + (checked ? color : 'var(--border)') + ';' +
    'background:' + (checked ? color + '22' : 'var(--surface)') + ';color:' + (checked ? color : 'var(--text)') + ';' +
    'user-select:none;-webkit-user-select:none;';

  const renderChip = a => {
    const checked = formState.specialAbilities.includes(a.name);
    const color = a.type === '赤特' ? 'var(--danger)' : a.type === '金特' ? 'var(--warn)' : 'var(--primary)';
    return '<label style="' + chipStyle(checked, color) + '">' +
      '<input type="checkbox" style="display:none" ' + (checked ? 'checked' : '') +
      ' onchange="toggleSpecialAbility(\'' + a.name + '\', this.checked)">' +
      a.name + '</label>';
  };

  const groups = {};
  abilities.forEach(a => {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
  });

  const groupsHtml = Object.entries(groups).map(([cat, items]) => {
    const visible = items.filter(a =>
      formState.specialAbilities.includes(a.name) || !q || a.name.includes(q)
    );
    if (!visible.length) return '';
    return `<div style="margin-bottom:10px">
      <div style="font-size:12px;color:var(--muted);font-weight:700;margin-bottom:6px">${cat}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${visible.map(renderChip).join('')}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="margin-bottom:10px">
      <input type="text" placeholder="特殊能力を検索…" value="${q.replace(/"/g, '&quot;')}"
        oninput="filterSpecialAbilities(this.value)"
        style="width:100%;box-sizing:border-box;padding:8px 10px;font-size:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">
    </div>
    ${groupsHtml}
  `;
}

function filterSpecialAbilities(q) {
  formState._specialAbilityFilter = q;
  buildSpecialAbilityFields(true);
  const input = document.querySelector('#specialAbilityFields input[type="text"]');
  if (input) { input.focus(); input.setSelectionRange(q.length, q.length); }
}

function toggleSpecialAbility(name, checked) {
  if (!formState.specialAbilities) formState.specialAbilities = [];
  if (checked) {
    if (!formState.specialAbilities.includes(name)) formState.specialAbilities.push(name);
  } else {
    formState.specialAbilities = formState.specialAbilities.filter(n => n !== name);
  }
  buildSpecialAbilityFields(true);
}

// メインポジションが投手以外の場合、投手能力セクションを非表示にする。
// (運用上、投手ができる選手は必ずメインを投手にするため、野手選手に投手能力欄は不要)
function togglePitcherSection() {
  const sec = document.getElementById('pitcherSection');
  if (sec) sec.style.display = formState.main === '投手' ? '' : 'none';
}

// サブポジションボタンの生成。タップごとに 未選択→○(サブ70%)→◎(メインと同等100%)→未選択 と3段階で切り替わる。
function buildSub() {
  const el = document.getElementById('subPosButtons');
  el.innerHTML = '';
  if (!formState.subsHigh) formState.subsHigh = [];

  POS.filter(p => p !== formState.main).forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    const isHigh = formState.subsHigh.includes(p);
    const isLow = formState.subs.includes(p) && !isHigh;
    b.textContent = isHigh ? p + '◎' : isLow ? p + '○' : p;
    b.className = isHigh ? 'selected high' : isLow ? 'selected' : '';
    b.onclick = () => {
      if (!formState.subs.includes(p)) {
        formState.subs = [...formState.subs, p];
      } else if (!formState.subsHigh.includes(p)) {
        formState.subsHigh = [...formState.subsHigh, p];
      } else {
        formState.subs = formState.subs.filter(x => x !== p);
        formState.subsHigh = formState.subsHigh.filter(x => x !== p);
      }
      buildSub();
    };
    el.appendChild(b);
  });
}

// 横並びボタン群を生成する汎用関数(学年・メインポジション選択などで使用)
function makeChoice(id, vals, on, set, label = x => x) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  vals.forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label(v);
    b.className = String(set()) === String(v) ? 'selected' : '';
    b.onclick = () => { on(v); makeChoice(id, vals, on, set, label); };
    el.appendChild(b);
  });
}

// ラベル付きの横並びボタン行を生成する汎用関数(能力値のランク選択などで使用)
function choiceRow(name, vals, on, set) {
  const div = document.createElement('div');
  div.className = 'ability-row';
  div.innerHTML = `<strong>${name}</strong><div class="choice"></div>`;
  const c = div.querySelector('.choice');
  vals.forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = v;
    b.className = String(set()) === String(v) ? 'selected' : '';
    b.onclick = () => { on(v); div.replaceWith(choiceRow(name, vals, on, set)); };
    c.appendChild(b);
  });
  return div;
}

// 野手能力・野手右上能力用のランク選択行(formStateのキーをそのまま使う)
function rankRow(name) {
  if (!formState[name]) formState[name] = 'G';
  return choiceRow(name, RANKS, v => formState[name] = v, () => formState[name]);
}

// 投手右上能力用のランク選択行。
// 野手側SPECIALと同名キー(ケガしにくさ・回復)が衝突しないよう、formState上は「投」プレフィックスを付けて管理する。
function pitchRankRow(name) {
  const key = '投' + name;
  if (!formState[key]) formState[key] = 'G';
  return choiceRow(name, RANKS, v => formState[key] = v, () => formState[key]);
}


/* ---------- フォームの初期化・保存・編集読み込み ---------- */

// フォームを新規登録状態にリセットする
function clearForm() {
  current = null;
  formState = { grade: 1, main: '投手', subs: [], subsHigh: [], 弾道: 1 };
  [...FIELD_ABIL, ...SPECIAL, ...PITCH_RANK].forEach(a => formState[a] = 'G');
  PITCH_SPECIAL.forEach(a => formState['投' + a] = 'G');

  document.getElementById('playerId').value = '';
  document.getElementById('playerName').value = '';
  document.getElementById('speed').value = 130;
  document.getElementById('pitchTypes').value = 0;
  document.getElementById('totalBreak').value = 0;
  document.getElementById('memo').value = '';
  document.getElementById('editTitle').textContent = '選手登録';
  formState.specialAbilities = [];
  buildForm();
}

// フォームの入力内容を選手データとして保存する(新規登録・更新の両方を担う)
function savePlayer(e) {
  e.preventDefault();

  const speedEl = document.getElementById('speed');
  const pitchTypesEl = document.getElementById('pitchTypes');
  const totalBreakEl = document.getElementById('totalBreak');
  const memoEl = document.getElementById('memo');

  const p = {
    id: document.getElementById('playerId').value || crypto.randomUUID(),
    name: document.getElementById('playerName').value.trim(),
    grade: formState.grade,
    main: formState.main,
    subs: formState.subs,
    subsHigh: formState.subsHigh || [],
    abilities: { 弾道: formState.弾道 },
    pitch: {
      球速: Number(speedEl.value || 130),
      球種数: Number(pitchTypesEl.value || 0),
      総変化量: Number(totalBreakEl.value || 0)
    },
    memo: memoEl.value,
    specialAbilities: formState.specialAbilities || []
  };

  [...FIELD_ABIL, ...SPECIAL].forEach(a => p.abilities[a] = formState[a] || 'G');
  PITCH_RANK.forEach(a => p.pitch[a] = formState[a] || 'G');
  PITCH_SPECIAL.forEach(a => p.pitch[a] = formState['投' + a] || 'G');

  if (!p.name) return alert('名前を入力してください');

  const i = players.findIndex(x => x.id === p.id);
  if (i >= 0) players[i] = p; else players.push(p);

  save();
  clearForm();
  renderAll();
  show('players');
}

// 選手一覧から選手をタップした際、その選手のデータをフォームに読み込んで編集画面を開く
function editPlayer(id) {
  const p = players.find(x => x.id === id);
  if (!p) return;
  current = id;

  formState = {
    grade: p.grade,
    main: p.main,
    subs: [...(p.subs || [])],
    subsHigh: [...(p.subsHigh || [])],
    弾道: p.abilities?.弾道 || 1
  };
  [...FIELD_ABIL, ...SPECIAL].forEach(a => formState[a] = p.abilities?.[a] || 'G');
  PITCH_RANK.forEach(a => formState[a] = p.pitch?.[a] || 'G');
  PITCH_SPECIAL.forEach(a => formState['投' + a] = p.pitch?.[a] || 'G');

  document.getElementById('playerId').value = p.id;
  document.getElementById('playerName').value = p.name;
  document.getElementById('speed').value = p.pitch?.球速 || 130;
  document.getElementById('pitchTypes').value = p.pitch?.球種数 || 0;
  document.getElementById('totalBreak').value = p.pitch?.総変化量 || 0;
  document.getElementById('memo').value = p.memo || '';
  document.getElementById('editTitle').textContent = '選手編集';
  formState.specialAbilities = [...(p.specialAbilities || [])];

  buildForm();
  show('edit');
}

// 編集中の選手を削除する
function deletePlayer() {
  const id = document.getElementById('playerId').value;
  if (!id) return clearForm();
  if (confirm('削除しますか？')) {
    players = players.filter(p => p.id !== id);
    save();
    clearForm();
    renderAll();
    show('players');
  }
}


/* ---------- 評価ロジック ---------- */
/* 選手評価は「①ポジション適性」「②総合戦力」の2軸で構成する方針(引継ぎ仕様より) */

// ランク(G〜S)を数値(1〜8)に変換
function rank(a) { return config.rankValues[a] || 1; }

// 球速を1〜8のスコアに正規化
function normSpeed(v) {
  const s = config.speedScale;
  return Math.max(1, Math.min(8, 1 + (Number(v) - s.min) / (s.max - s.min) * 7));
}

// 球種数・総変化量など数値項目を1〜8のスコアに正規化する汎用関数
function norm(v, scale) {
  return Math.max(1, Math.min(8, 1 + (Number(v) - scale.min) / (scale.max - scale.min) * 7));
}

// ポジション適性(補正前)。投手なら投手総合スコア、野手ならconfig.positionWeightsに基づく加重平均。
function posFit(p, pos) {
  if (pos === '投手') return pitcherScore(p, 'overall');
  const w = config.positionWeights[pos] || {};
  let s = 0;
  Object.entries(w).forEach(([k, v]) => s += rank(p.abilities?.[k] || 'G') * v);
  return s;
}

// メイン/サブ(◎)/サブ(○)/未経験による補正率
// メイン=100%, サブ◎=100%(メインと同様にこなせる扱い), サブ○=70%, 未経験=45%
function posBonus(p, pos) {
  if (p.main === pos) return config.positionBonus.main;
  if ((p.subsHigh || []).includes(pos)) return config.positionBonus.subHigh ?? 1.0;
  if ((p.subs || []).includes(pos)) return config.positionBonus.sub;
  return config.positionBonus.none;
}

// ポジション適性(補正後)。チーム分析で使う「実際の戦力」はこちらを使う。
function posPower(p, pos) { return posFit(p, pos) * posBonus(p, pos); }

// 野手としての総合力(野手能力の加重平均)。投手選手でも野手基礎能力として常に計算する。
function overall(p) {
  let s = 0;
  Object.entries(config.overallWeights).forEach(([k, v]) => s += rank(p.abilities?.[k] || 'G') * v);
  return s;
}

// 表示用の「総合力」。メインが投手なら投手スコア、野手ならoverall()。
// 選手一覧・ダッシュボードなど「その選手の今のメイン仕事としての強さ」を見せる場所で使う。
function mainOverall(p) { return p.main === '投手' ? pitcherScore(p, 'overall') : overall(p); }

// 投手能力の加重合計。数値系(球速/球種数/総変化量)とランク系を統一して扱う共通コア。
function pitcherWeightedSum(p, weights) {
  let s = 0;
  Object.entries(weights).forEach(([k, v]) => {
    let val;
    if (k === '球速') val = normSpeed(p.pitch?.球速 || 120);
    else if (k === '球種数') val = norm(p.pitch?.球種数 || 0, config.pitchTypeScale);
    else if (k === '総変化量') val = norm(p.pitch?.総変化量 || 0, config.totalBreakScale);
    else val = rank(p.pitch?.[k] || 'G');
    s += val * v;
  });
  return s;
}

// 投手の総合力。type='ace'(エース適性)/'relief'(リリーフ適性)/'overall'(総合)で重み付けを切り替える。
function pitcherScore(p, type = 'overall') {
  return pitcherWeightedSum(p, config.pitcherWeights[type]);
}

// 選手の特殊能力リストからmanualWeightの合計ボーナスを算出する
function specialAbilityBonus(p) {
  if (!p.specialAbilities?.length) return 0;
  return p.specialAbilities.reduce((sum, name) => {
    const def = specialAbilityMap[name];
    return sum + (def?.manualWeight || 0);
  }, 0);
}

// 野手の自操作適性(ミート・パワー・走力・弾道の加重平均 + 特殊能力ボーナス)
function battingScore(p) {
  const w = config.manualBaseWeights?.野手 || {};
  let s = 0;
  Object.entries(w).forEach(([k, v]) => {
    if (k === '弾道') {
      const val = p.abilities?.弾道 || 1;
      s += (1 + (val - 1) / 3 * 7) * v;
    } else {
      s += rank(p.abilities?.[k] || 'G') * v;
    }
  });
  s += specialAbilityBonus(p);
  return s;
}

// 投手の打撃スコア(カード表示用)。自操作打撃4指標 + 特殊能力ボーナス。
function pitcherManualScore(p) {
  return pitcherWeightedSum(p, config.manualBaseWeights?.投手 || {}) + specialAbilityBonus(p);
}

// ポジション別の守備・打撃合算スコア。守備側にはposBonus(メイン/サブ/未経験補正)を適用する。
// 投手は既存のpitcherScore(overall)をそのまま返す。
function totalFieldScore(p, pos) {
  if (pos === '投手') return pitcherScore(p, 'overall');
  const roles = config.positionRoles?.[pos] || { defense: 0.55, batting: 0.45 };
  return posPower(p, pos) * roles.defense + battingScore(p) * roles.batting;
}

// 理想案最適化用スコア。posBonus(現状のメイン/サブ/未経験補正)を除いた生の適性で評価する。
// 「コンバートした場合の可能性」でポジションを割り当てることで、
// ①控え選手がコンバートで主力になれるケース
// ②スタメン内のポジション変更で全体底上げできるケース
// を理想案として浮上させる。表示スコアはtotalFieldScore(posBonus込み)を使う。
function totalFieldScoreIdeal(p, pos) {
  if (pos === '投手') return pitcherScore(p, 'overall');
  const roles = config.positionRoles?.[pos] || { defense: 0.55, batting: 0.45 };
  return posFit(p, pos) * roles.defense + battingScore(p) * roles.batting;
}

// 1〜8スケールのスコアを0〜100点満点の表示用スコアに変換
function score100(v) { return Math.round(v / 8 * 100); }

// 指定年数だけ学年を進めた仮の名簿を返す(ダッシュボードの「来年/再来年」表示用)
// 卒業(grade > 3)した選手は除外する。実際のデータは変更しない。
function roster(years = 0) {
  return players.map(p => ({ ...p, grade: p.grade + years })).filter(p => p.grade <= 3);
}

// 戦力スコアをしきい値と比較し、◎○△×の判定記号とCSSクラスを返す
function evalMark(score, th) {
  if (score >= th.excellent) return ['◎', 'good'];
  if (score >= th.good) return ['○', 'good'];
  if (score >= th.warning) return ['△', 'mid'];
  return ['×', 'bad'];
}

// ポジション判定の共通ロジック。実働最弱者のスコアと1人あたりの基準を比較して◎○△×を返す。
function evalPosition(rs, pos) {
  const topCount = config.topCounts[pos] || 2;
  const startingCount = config.startingCounts?.[pos] || 1;
  const list = rs
    .map(p => ({ p, score: totalFieldScore(p, pos), fit: posFit(p, pos), bonus: posBonus(p, pos) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topCount);

  const weakestStarter = list.length >= startingCount ? list[startingCount - 1].score : 0;
  const th = config.positionThresholds[pos];
  const perPersonTh = { excellent: th.excellent / topCount, good: th.good / topCount, warning: th.warning / topCount };
  const [mark, cls] = evalMark(weakestStarter, perPersonTh);
  const pct = Math.round(weakestStarter / perPersonTh.excellent * 100);
  return { list, weakestStarter, perPersonTh, mark, cls, pct };
}


/* ---------- 画面描画 ---------- */

function renderAll() {
  renderDashboard();
  renderPlayers();
}

// 分析タブ全体の描画(選手数サマリー＋各種分析の呼び出し)
function renderDashboard() {
  const y = Number(document.getElementById('yearView').value || 0);
  const rs = roster(y);

  document.getElementById('summaryCards').innerHTML = `
    <div class="card"><div class="big">${rs.length}</div><div class="muted">選手数</div></div>
    <div class="card"><div class="big">${rs.filter(p => p.grade === 3).length}</div><div class="muted">3年</div></div>
    <div class="card"><div class="big">${rs.filter(p => p.grade === 2).length}</div><div class="muted">2年</div></div>
    <div class="card"><div class="big">${rs.filter(p => p.grade === 1).length}</div><div class="muted">1年</div></div>
  `;

  renderPositionAnalysis(rs);
  renderRadarChart(rs);
  renderPitcherAnalysis(rs);
}

// 6ポジションの戦力%をSVGレーダーチャートで描画する。
// 100%=外周、0%=中心の六角形。◎ゾーン(excellent相当)をうっすら表示して目標値を見せる。
function renderRadarChart(rs) {
  const el = document.getElementById('radarChart');
  if (!el) return;

  const POSITIONS = ['捕手', '一塁', '二塁', '三塁', '遊撃', '外野'];
  const N = POSITIONS.length;
  const CX = 160, CY = 155, R = 110; // 中心座標と外径
  const LABEL_R = R + 22; // ラベルの配置半径

  // 各ポジションの戦力%を取得
  const values = POSITIONS.map(pos => {
    const { pct } = evalPosition(rs, pos);
    return Math.min(pct, 130) / 130; // 130%を最大として正規化(100%超えも表現できるよう)
  });

  // N角形の頂点座標を計算するヘルパー
  const point = (i, r) => {
    const angle = (Math.PI * 2 * i / N) - Math.PI / 2;
    return [CX + Math.cos(angle) * r, CY + Math.sin(angle) * r];
  };

  // 背景グリッド(20%刻みの同心六角形)
  const gridLines = [0.2, 0.4, 0.6, 0.8, 1.0].map(ratio => {
    const pts = Array.from({ length: N }, (_, i) => point(i, R * ratio).join(',')).join(' ');
    const opacity = ratio === 1.0 ? 0.3 : 0.15;
    return `<polygon points="${pts}" fill="none" stroke="#3b82f6" stroke-width="${ratio === 1.0 ? 1.5 : 0.8}" opacity="${opacity}"/>`;
  }).join('');

  // 軸線(中心から各頂点へ)
  const axisLines = Array.from({ length: N }, (_, i) => {
    const [x, y] = point(i, R);
    return `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="#2a3a50" stroke-width="1"/>`;
  }).join('');

  // 100%ゾーン(目標ライン)をうっすら塗る
  const excellentPts = Array.from({ length: N }, (_, i) => point(i, R * 0.769).join(',')).join(' '); // 100/130≒0.769
  const excellentZone = `<polygon points="${excellentPts}" fill="#22c55e" opacity="0.06" stroke="#22c55e" stroke-width="1" opacity="0.2"/>`;

  // データ多角形
  const dataPts = values.map((v, i) => point(i, R * v).join(',')).join(' ');
  const dataPolygon = `
    <polygon points="${dataPts}" fill="#3b82f6" fill-opacity="0.2" stroke="#3b82f6" stroke-width="2"/>
    ${values.map((v, i) => {
      const [x, y] = point(i, R * v);
      const color = v >= 0.769 ? '#22c55e' : v >= 0.538 ? '#f59e0b' : '#ef4444';
      return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="#1a2535" stroke-width="1.5"/>`;
    }).join('')}
  `;

  // ラベル(ポジション名と%)
  const labels = POSITIONS.map((pos, i) => {
    const [lx, ly] = point(i, LABEL_R);
    const pct = Math.round(values[i] * 130);
    const anchor = lx < CX - 5 ? 'end' : lx > CX + 5 ? 'start' : 'middle';
    const color = pct >= 100 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';
    return `
      <text x="${lx}" y="${ly - 6}" text-anchor="${anchor}" font-size="12" font-weight="600" fill="#e8edf4">${pos}</text>
      <text x="${lx}" y="${ly + 8}" text-anchor="${anchor}" font-size="11" fill="${color}">${pct}%</text>
    `;
  }).join('');

  el.innerHTML = `
    <svg width="${CX * 2}" height="${CY * 2 - 10}" viewBox="0 0 ${CX * 2} ${CY * 2 - 10}">
      ${gridLines}
      ${axisLines}
      ${excellentZone}
      ${dataPolygon}
      ${labels}
    </svg>
  `;
}

// ポジション状況(捕手〜外野)の戦力分析。
// 「実際に守備位置に入る人数(startingCounts)が、全員十分なレベルでいるか」を判定基準にする。
// (例: 外野は3人が実働なので、上位3人の中で最も弱い選手が基準を満たすかを見る。
//  捕手など実働1人のポジションは、最上位の選手1人だけを見る。topCounts分の控えは参考表示。)
function renderPositionAnalysis(rs) {
  const positionAnalysisEl = document.getElementById('positionAnalysis');
  positionAnalysisEl.innerHTML = '';

  ['捕手', '一塁', '二塁', '三塁', '遊撃', '外野'].forEach(pos => {
    const { list, mark, cls, pct } = evalPosition(rs, pos);
    const row = document.createElement('div');
    row.className = 'analysis-row';
    row.innerHTML = `
      <strong>${pos}</strong>
      <div class="eval ${cls}">${mark}</div>
      <div>
        <div>戦力 ${pct}%</div>
        ${list.map(x => `<span class="badge">${x.p.name} ${score100(x.score)}${x.bonus < 1 ? '×' + x.bonus : ''}</span>`).join('')}
      </div>
    `;
    positionAnalysisEl.appendChild(row);
  });
}

// 投手層の評価(3年/2年/1年エース＋中継ぎ候補の理想形に対する判定)。
function pitcherStaffEval(rs) {
  const ps = rs.filter(p => p.main === '投手' || (p.subs || []).includes('投手') || pitcherScore(p, 'overall') >= 3.5);

  const byGrade = [3, 2, 1].map(g => {
    const arr = ps.filter(p => p.grade === g).sort((a, b) => pitcherScore(b, 'ace') - pitcherScore(a, 'ace'));
    return { g, p: arr[0] };
  });

  // エースに選ばれた選手のIDを集め、中継ぎ候補の選出対象から除外する(同一選手の重複起用を防ぐ)
  const aceIds = new Set(byGrade.filter(x => x.p).map(x => x.p.id));
  const rel = ps.filter(p => !aceIds.has(p.id)).sort((a, b) => pitcherScore(b, 'relief') - pitcherScore(a, 'relief'))[0];

  const aceCount = byGrade.filter(x => x.p && pitcherScore(x.p, 'ace') >= config.pitcherThresholds.ace).length;
  const relOk = rel && pitcherScore(rel, 'relief') >= config.pitcherThresholds.relief;

  let mark = '×', cls = 'bad';
  if (aceCount === 3 && relOk) { mark = '◎'; cls = 'good'; }
  else if (aceCount >= 2 && relOk) { mark = '○'; cls = 'good'; }
  else if (aceCount >= 1 || relOk) { mark = '△'; cls = 'mid'; }

  return { byGrade, rel, mark, cls };
}

function renderPitcherAnalysis(rs) {
  const { byGrade, rel, mark, cls } = pitcherStaffEval(rs);

  document.getElementById('pitcherAnalysis').innerHTML = `
    <div class="analysis-card">
      <div class="row"><strong>投手</strong><span class="eval ${cls}">${mark}</span></div>
      ${byGrade.map(x => `<div>${x.g}年エース：${x.p ? `${x.p.name} ${score100(pitcherScore(x.p, 'ace'))}` : 'なし'}</div>`).join('')}
      <div>中継ぎ候補：${rel ? `${rel.name} ${score100(pitcherScore(rel, 'relief'))}` : 'なし'}</div>
    </div>
  `;
}

// 選手のメインポジション以外で最も適性が高いポジションを返す(コンバート先の可能性の参考値)。
// 補正前のposFitを使うため、未経験ポジションでも能力次第で高く出ることがある。
// (今守れる戦力ではなく、コンバートした場合の可能性を示す値であることに注意)
function secondFit(p) {
  return POS
    .filter(pos => pos !== p.main)
    .map(pos => ({ pos, fit: posFit(p, pos) }))
    .sort((a, b) => b.fit - a.fit)[0];
}

// 選手一覧タブの描画。表示は「名前・学年・メインポジ・総合力・メイン適性・第2適性」のみ(能力値は並べない)。
function renderPlayers() {
  let list = [...players];

  const gf = document.getElementById('gradeFilter').value;
  if (gf !== 'all') list = list.filter(p => String(p.grade) === gf);

  const sort = document.getElementById('sortSelect').value;
  list.sort((a, b) => {
    if (sort === 'overall') return mainOverall(b) - mainOverall(a);
    if (sort === 'main') return posFit(b, b.main) - posFit(a, a.main);
    if (sort.startsWith('pos_')) {
      const pos = sort.slice(4);
      return posFit(b, pos) - posFit(a, pos);
    }
    return b.grade - a.grade || POS.indexOf(a.main) - POS.indexOf(b.main); // デフォルト: 学年順
  });

  const playerListEl = document.getElementById('playerList');
  playerListEl.innerHTML = '';
  if (!list.length) {
    playerListEl.innerHTML = '<div class="card">選手が未登録です。</div>';
    return;
  }

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card';
    const second = secondFit(p);
    const battingSc = p.main === '投手' ? pitcherManualScore(p) : battingScore(p);
    const battingLabel = p.main === '投手' ? '投球' : '打撃';
    card.innerHTML = `
      <div class="player-head">
        <strong>${p.grade}年 ${POS_SHORT[p.main]} ${p.name}</strong>
        <span>総合${score100(mainOverall(p))}</span>
      </div>
      <div class="scores">
        <span class="badge">${POS_SHORT[p.main]}${score100(posFit(p, p.main))}</span>
        <span class="badge">→${POS_SHORT[second.pos]}${score100(second.fit)}</span>
        <span class="badge">${battingLabel}${score100(battingSc)}</span>
      </div>
      ${(p.specialAbilities || []).length ? `
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">
          ${(p.specialAbilities || []).map(name => {
            const def = specialAbilityMap[name];
            const isMinus = def?.type === '赤特';
            const isGold  = def?.type === '金特';
            const color = isMinus ? 'var(--danger)' : isGold ? 'var(--warn)' : 'var(--primary)';
            return `<span style="font-size:11px;padding:2px 6px;border-radius:4px;border:1px solid ${color};color:${color}">${name}</span>`;
          }).join('')}
        </div>` : ''}
    `;
    card.onclick = () => editPlayer(p.id);
    playerListEl.appendChild(card);
  });
}


/* ---------- 設定タブ: ポジション別重み設定 ---------- */

// config.jsonの元の重み値(カスタム重みを反映する前の値)を取得する。
// 設定画面で「リセット」する際の基準値として使う。
// (config自体はapplyCustomWeightsで上書き済みのため、defaultConfig経由では取れない。
//  fetch失敗時はdefaultConfigの値にフォールバックする)
let _originalWeights = null;
async function getOriginalWeights() {
  if (_originalWeights) return _originalWeights;
  try {
    const c = await (await fetch('config.json', { cache: 'no-store' })).json();
    _originalWeights = c.positionWeights;
  } catch (e) {
    _originalWeights = defaultConfig().positionWeights;
  }
  return _originalWeights;
}

// 設定タブ全体の描画。ポジションごとに能力値の重みをパーセント(整数)で入力できる。
// 設定タブ全体の描画。FIELD_ABILとSPECIALの全能力値を表示し、0%以外の項目が評価に使われる。
// 「追加・削除」ボタンは不要で、0%にすれば評価対象から外れる。
function renderWeightSettings() {
  const el = document.getElementById('weightSettings');
  el.innerHTML = '';

  const ALL_ABILITIES = [...FIELD_ABIL, ...SPECIAL]; // 全野手能力値(14項目)
  const FIELD_POSITIONS = ['捕手', '一塁', '二塁', '三塁', '遊撃', '外野'];

  FIELD_POSITIONS.forEach(pos => {
    const weights = config.positionWeights[pos] || {};
    const card = document.createElement('div');
    card.className = 'analysis-card';
    card.dataset.pos = pos;

    const totalPct = Object.values(weights).reduce((a, b) => a + Math.round(b * 100), 0);

    card.innerHTML = `
      <div class="row">
        <strong>${pos}</strong>
        <span id="total-${pos}" style="font-size:13px;color:${totalPct === 100 ? 'var(--ok)' : 'var(--danger)'}">合計 ${totalPct}%</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin:8px 0">
      ${ALL_ABILITIES.map(ability => {
        const pct = Math.round((weights[ability] || 0) * 100);
        return `
          <div style="display:flex;align-items:center;gap:6px">
            <strong style="font-size:13px;min-width:72px;color:${pct > 0 ? 'var(--text)' : 'var(--muted)'}">${ability}</strong>
            <input type="number" id="w-${pos}-${ability}" min="0" max="100" value="${pct}"
              style="width:56px;padding:5px 6px">
            <span style="font-size:13px">%</span>
          </div>
        `;
      }).join('')}
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button onclick="saveWeights('${pos}')" class="primary">保存</button>
        <button onclick="resetWeights('${pos}')">リセット</button>
      </div>
      <div id="err-${pos}" style="font-size:13px;margin-top:6px"></div>
    `;
    el.appendChild(card);

    // 入力値が変わるたびに合計%をリアルタイム更新し、0%の項目名をグレーにする
    ALL_ABILITIES.forEach(ability => {
      const input = document.getElementById(`w-${pos}-${ability}`);
      input.addEventListener('input', () => {
        updateTotal(pos);
        // 0%になった項目名をグレーにする
        const label = input.closest('.ability-row')?.querySelector('strong');
        if (label) label.style.color = Number(input.value) > 0 ? 'var(--text)' : 'var(--muted)';
      });
    });
  });
}

// 入力値の合計%をリアルタイムで表示更新する(全FIELD_ABIL+SPECIALが対象)
function updateTotal(pos) {
  const ALL_ABILITIES = [...FIELD_ABIL, ...SPECIAL];
  const total = ALL_ABILITIES.reduce((sum, ability) => {
    return sum + (Number(document.getElementById(`w-${pos}-${ability}`)?.value) || 0);
  }, 0);
  const el = document.getElementById(`total-${pos}`);
  if (el) {
    el.textContent = `合計 ${total}%`;
    el.style.color = total === 100 ? 'var(--ok)' : 'var(--danger)';
  }
}

// 指定ポジションの重みを保存する。合計が100%でない場合はエラーを表示して保存しない。
// 0%の項目はpositionWeightsに含めない(評価計算側が定義済みキーのみ参照するため)。
function saveWeights(pos) {
  const ALL_ABILITIES = [...FIELD_ABIL, ...SPECIAL];
  const errEl = document.getElementById(`err-${pos}`);
  const newWeights = {};
  let total = 0;

  ALL_ABILITIES.forEach(ability => {
    const val = Number(document.getElementById(`w-${pos}-${ability}`)?.value) || 0;
    if (val > 0) newWeights[ability] = val / 100; // 0%の項目は含めない
    total += val;
  });

  if (total !== 100) {
    errEl.style.color = 'var(--danger)';
    errEl.textContent = `合計が${total}%です。100%になるよう調整してください。`;
    return;
  }
  errEl.textContent = '';

  // config.positionWeightsをリアルタイムに更新し、分析画面にも即反映する
  config.positionWeights[pos] = newWeights;

  // localStorageに保存する
  try {
    const saved = JSON.parse(localStorage.getItem(WEIGHT_KEY) || '{}');
    saved[pos] = newWeights;
    localStorage.setItem(WEIGHT_KEY, JSON.stringify(saved));
  } catch (e) {
    errEl.style.color = 'var(--danger)';
    errEl.textContent = '保存に失敗しました。';
    return;
  }

  errEl.style.color = 'var(--ok)';
  errEl.textContent = '保存しました。';
  renderAll(); // 分析画面を再計算
}

// 指定ポジションの重みをconfig.jsonの値にリセットする
async function resetWeights(pos) {
  const orig = await getOriginalWeights();
  if (!orig[pos]) return;

  // localStorageからそのポジションの設定を削除する
  try {
    const saved = JSON.parse(localStorage.getItem(WEIGHT_KEY) || '{}');
    delete saved[pos];
    localStorage.setItem(WEIGHT_KEY, JSON.stringify(saved));
  } catch (e) { /* 無視 */ }

  // configをconfig.jsonの元の値に戻す
  config.positionWeights[pos] = orig[pos];

  renderWeightSettings(); // 入力欄を元の値で再描画
  renderAll();
}


/* ---------- スタメン考案 ---------- */

// DHのスコア: ミート+パワー+チャンスの加重平均(純粋な打力評価)
function dhScore(p) {
  return rank(p.abilities?.ミート || 'G') * 0.4
       + rank(p.abilities?.パワー || 'G') * 0.4
       + rank(p.abilities?.チャンス || 'G') * 0.2;
}

// ポジションの優先度(×→△→それ以外の順で埋める)
// ハンガリアン法(Munkres法)で最適割り当てを求める。
// 選手×ポジションのスコア行列を受け取り、合計スコアが最大になる1対1割り当てを返す。
// 最大化問題として解くため、スコアを負値に変換して最小化問題として処理する。
function hungarian(costMatrix) {
  const n = costMatrix.length;
  const m = costMatrix[0].length;
  const size = Math.max(n, m);

  // 正方行列にパディング(足りない部分は0)
  const mat = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => (i < n && j < m ? costMatrix[i][j] : 0))
  );

  // 最大化→最小化に変換(全要素を最大値から引く)
  const maxVal = Math.max(...mat.flat());
  const cost = mat.map(row => row.map(v => maxVal - v));

  const u = new Array(size + 1).fill(0);
  const v = new Array(size + 1).fill(0);
  const p = new Array(size + 1).fill(0); // p[j] = 列jに割り当てられた行
  const way = new Array(size + 1).fill(0);

  for (let i = 1; i <= size; i++) {
    p[0] = i;
    let j0 = 0;
    const minDist = new Array(size + 1).fill(Infinity);
    const used = new Array(size + 1).fill(false);
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

  // 割り当て結果を行→列のMapで返す
  const result = new Map();
  for (let j = 1; j <= m; j++) {
    if (p[j] > 0 && p[j] <= n) result.set(p[j] - 1, j - 1);
  }
  return result;
}

// ハンガリアン法でスタメンを割り当てる。
// scoreFn: (player, pos) => number でスコアを計算する関数を外から渡す。
// 事前割り当て(固定・仮配置)がある場合は先に確定させ、残りでハンガリアン法を適用する。
function solveLineup(rs, scoreFn) {
  const FIELD_POS = ['捕手', '一塁', '二塁', '三塁', '遊撃', '外野', '外野', '外野'];
  const fielders = rs.filter(p => p.main !== '投手');
  const assigned = new Map();
  const usedIds = new Set();

  // まず事前割り当て(スコア999)の選手を確定する
  FIELD_POS.forEach((pos, i) => {
    const pre = fielders.find(p => !usedIds.has(p.id) && scoreFn(p, pos) === 999);
    if (pre) {
      assigned.set(i, pre);
      usedIds.add(pre.id);
    }
  });

  // 残りの選手と未割り当てポジションでハンガリアン法を適用する
  const remainPlayers = fielders.filter(p => !usedIds.has(p.id));
  const remainSlots = FIELD_POS.map((pos, i) => ({ pos, i })).filter(({ i }) => !assigned.has(i));

  if (remainPlayers.length > 0 && remainSlots.length > 0) {
    // スコア行列を構築(選手×ポジション枠)
    const matrix = remainPlayers.map(p =>
      remainSlots.map(({ pos }) => {
        const s = scoreFn(p, pos);
        return s === 999 ? 0 : s; // 他のポジションの999は除外
      })
    );

    const assignment = hungarian(matrix);
    assignment.forEach((slotIdx, playerIdx) => {
      if (playerIdx < remainPlayers.length && slotIdx < remainSlots.length) {
        const p = remainPlayers[playerIdx];
        const { i } = remainSlots[slotIdx];
        assigned.set(i, p);
        usedIds.add(p.id);
      }
    });
  }

  // DH: 残った選手の中でミート+パワー+チャンス最大の選手
  const dhBest = fielders
    .filter(p => !usedIds.has(p.id))
    .sort((a, b) => dhScore(b) - dhScore(a))[0] || null;

  // 控え: スタメン・DHに選ばれなかった野手
  const bench = fielders.filter(p => !usedIds.has(p.id) && p !== dhBest);

  return { assigned, dh: dhBest, bench };
}

// 手動スタメン調整の状態(ポジションインデックス→選手ID)
// 理想案の状態管理
// idealFixed: 固定ボタンを押した選手(Map: 選手ID→ポジションインデックス, 'dh'→'dh')
// idealTemp:  ドロップダウンで選択中だが未固定の選手(Map: 選手ID→ポジションインデックス, 'dh'→'dh')
// ※選手IDをキーにすることで、再最適化で別枠に移動しても固定が引き継がれる
let idealFixed = new Map(); // playerId -> posIndex (or 'dh' -> 'dh')
let idealTemp  = new Map(); // playerId -> posIndex (or 'dh' -> 'dh')

function calcIdealPlan(rs) {
  const FIELD_POS = ['捕手', '一塁', '二塁', '三塁', '遊撃', '外野', '外野', '外野'];
  const merged = new Map([...idealTemp, ...idealFixed]);
  const preAssigned = new Map(); // posIndex -> playerId
  for (const [playerId, posIndex] of merged) {
    if (posIndex !== 'dh') preAssigned.set(posIndex, playerId);
  }
  const preUsedIds = new Set(preAssigned.values());
  const dhFixedId = idealFixed.get('dh') || idealTemp.get('dh') || null;
  if (dhFixedId) preUsedIds.add(dhFixedId);

  return solveLineup(rs, (p, pos) => {
    if (preUsedIds.has(p.id)) {
      for (const [i, id] of preAssigned.entries()) {
        if (id === p.id && FIELD_POS[i] === pos) return 999;
      }
      return 0;
    }
    return totalFieldScoreIdeal(p, pos);
  });
}

// スタメン考案タブの描画。現実案・理想案(固定機能付き)の2タブ構成。
function renderLineup() {
  const el = document.getElementById('lineupResult');
  if (!el) return;
  const y = Number(document.getElementById('lineupYearView').value || 0);
  const rs = roster(y);
  const fielders = rs.filter(p => p.main !== '投手');

  if (fielders.length < 9) {
    el.innerHTML = '<div class="card muted">野手が9人未満のため、スタメンを組めません。</div>';
    return;
  }

  const FIELD_POS = ['捕手', '一塁', '二塁', '三塁', '遊撃', '外野', '外野', '外野'];
  const LABELS    = ['捕手', '一塁', '二塁', '三塁', '遊撃', '左翼', '中堅', '右翼'];
  const activeTab = el.dataset.activeTab || 'real';

  // 現実案: 全選手対象
  const realPlan = solveLineup(rs, (p, pos) => totalFieldScore(p, pos));

  const idealPlan = calcIdealPlan(rs);
  window._lineupRs = rs;

  // --- 現実案の描画 ---
  function realPlanHtml() {
    const rows = FIELD_POS.map((pos, i) => {
      const p = realPlan.assigned.get(i);
      if (!p) return `<div class="lineup-row"><span class="lineup-pos">${LABELS[i]}</span><span class="muted">未割当</span></div>`;
      const s = score100(totalFieldScore(p, pos));
      const bonus = posBonus(p, pos);
      const bonusTag = bonus < 1 ? `<span class="lineup-bonus">×${bonus}</span>` : '';
      const { mark, cls } = evalPosition(rs, pos);
      return `
        <div class="lineup-row">
          <span class="lineup-pos">${LABELS[i]}</span>
          <span class="lineup-name">${p.name}<span class="muted" style="font-size:11px;margin-left:4px">${p.grade}年</span>${bonusTag}</span>
          <span class="eval ${cls}" style="font-size:16px">${mark}</span>
          <span class="lineup-score">${s}</span>
        </div>`;
    }).join('');
    const dhRow = realPlan.dh ? `
      <div class="lineup-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:8px">
        <span class="lineup-pos">DH</span>
        <span class="lineup-name">${realPlan.dh.name}<span class="muted" style="font-size:11px;margin-left:4px">${realPlan.dh.grade}年</span></span>
        <span></span>
        <span class="lineup-score">${score100(dhScore(realPlan.dh))}</span>
      </div>` : '';
    const bench = realPlan.bench;
    const benchRows = bench.length
      ? `<h3>控え・出場機会なし</h3>${bench.map(p => `<span class="badge">${p.name} ${p.grade}年(${POS_SHORT[p.main]})</span>`).join('')}`
      : '';
    return `<div style="margin-top:10px">${rows}${dhRow}</div><div style="margin-top:12px">${benchRows}</div>`;
  }

  // --- 理想案の描画 ---
  function idealPlanHtml() {
    // 案A: チーム総合スコア(現実案 vs 理想案)をヘッダーに表示
    const realTotal  = FIELD_POS.reduce((sum, fpos, fi) => {
      const fp = realPlan.assigned.get(fi);
      return sum + (fp ? score100(totalFieldScore(fp, fpos)) : 0);
    }, 0);
    const idealTotal = FIELD_POS.reduce((sum, fpos, fi) => {
      const fp = idealPlan.assigned.get(fi);
      return sum + (fp ? score100(totalFieldScoreIdeal(fp, fpos)) : 0);
    }, 0);
    const totalDiff = idealTotal - realTotal;
    const teamScoreLine = `
      <div style="font-size:13px;padding:6px 10px;margin-bottom:10px;border-radius:6px;border:1px solid var(--border);display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span style="color:var(--muted)">チーム総合スコア</span>
        <span>現実 <strong>${realTotal}</strong></span>
        <span style="color:var(--muted)">→</span>
        <span>理想 <strong style="color:var(--primary)">${idealTotal}</strong></span>
        <span style="color:${totalDiff >= 0 ? 'var(--ok)' : 'var(--danger)'}; font-weight:700">(${totalDiff >= 0 ? '+' : ''}${totalDiff})</span>
      </div>`;

    // 外野の新旧入替を事前に計算する。
    // 「理想案で新たに外野に入った選手」と「現実案から外野を外れた選手」を1対1で対応付けし、
    // 各行の比較表示に使う(インデックス依存の比較ではなく顔ぶれの変化を正確に示す)。
    const _realOF    = [5, 6, 7].map(fi => realPlan.assigned.get(fi)).filter(Boolean);
    const _idealOF   = [5, 6, 7].map(fi => idealPlan.assigned.get(fi)).filter(Boolean);
    const _droppedOF = _realOF.filter(rp => !_idealOF.some(ip => ip.id === rp.id));
    const _newOF     = _idealOF.filter(ip => !_realOF.some(rp => rp.id === ip.id));
    const outfieldReplacement = new Map(_newOF.map((ip, idx) => [ip.id, _droppedOF[idx]]));

    const rows = FIELD_POS.map((pos, i) => {
      const p = idealPlan.assigned.get(i);
      const curId = p ? p.id : '';
      const isFixed = curId ? idealFixed.has(curId) : false;

      // ドロップダウン(全選手選択可能)
      const options = [
        `<option value="">-- 未割当 --</option>`,
        ...fielders.map(fp =>
          `<option value="${fp.id}" ${fp.id === curId ? 'selected' : ''}>${fp.name}(${fp.grade}年・${POS_SHORT[fp.main]})</option>`
        )
      ].join('');

      // 固定ボタン
      const fixBtn = `<button onclick="toggleIdealFixed('${curId}', ${i})"
        style="font-size:11px;padding:3px 8px;${isFixed
          ? 'color:var(--primary);border-color:var(--primary);font-weight:700'
          : 'color:var(--muted)'}">
        ${isFixed ? '固定中' : '固定'}</button>`;

      if (!p) return `
        <div class="lineup-row" style="grid-template-columns:48px 1fr auto 32px 36px">
          <span class="lineup-pos">${LABELS[i]}</span>
          <select style="flex:1;padding:5px 8px;font-size:12px" onchange="onIdealChange(${i},this.value)">${options}</select>
          ${fixBtn}
          <span></span>
          <span class="lineup-score">-</span>
        </div>`;

      const sIdeal   = score100(totalFieldScoreIdeal(p, pos));
      const sCurrent = score100(totalFieldScore(p, pos));
      const needConvert = p.main !== pos && !(p.subsHigh || []).includes(pos);
      const needUpgrade = p.main !== pos && (p.subs || []).includes(pos) && !(p.subsHigh || []).includes(pos);
      const convertTag = needConvert
        ? `<span style="font-size:10px;color:${needUpgrade ? 'var(--warn)' : 'var(--danger)'};margin-left:4px">${needUpgrade ? '◎格上げ' : 'コンバート'}</span>`
        : '';
      const nameColor = needConvert ? 'color:var(--danger)' : '';
      // コンバートが必要な場合は「現状→理想」を表示してギャップを可視化する
      const scoreDisplay = needConvert
        ? `<span style="font-size:10px;color:var(--muted)">${sCurrent}→</span>${sIdeal}`
        : `${sIdeal}`;

      // 案B: 現実案との差分表示
      // 外野は outfieldReplacement(新規→脱落の対応Map)を使い、
      // 「この理想案外野手が誰に取って代わったか」を正確に表示する。
      let realDiff = '';
      if (pos === '外野') {
        const replaced = outfieldReplacement.get(curId);
        if (replaced)
          realDiff = `<span style="font-size:11px;color:var(--muted)">現実外野: ${replaced.name} ${score100(totalFieldScore(replaced, pos))}</span>`;
      } else {
        const realP = realPlan.assigned.get(i);
        if (realP && realP.id !== curId)
          realDiff = `<span style="font-size:11px;color:var(--muted)">現実: ${realP.name} ${score100(totalFieldScore(realP, pos))}</span>`;
      }

      // ◎○△×: コンバート後の理想スコアで評価する
      let mark, cls;
      const topCount = config.topCounts[pos] || 2;
      const th = config.positionThresholds[pos];
      const perPersonTh = { excellent: th.excellent / topCount, good: th.good / topCount, warning: th.warning / topCount };
      if (pos === '外野') {
        const outScores = FIELD_POS.map((fp, fi) => fp === '外野' ? idealPlan.assigned.get(fi) : null)
          .filter(Boolean).map(fp => totalFieldScoreIdeal(fp, '外野')).sort((a, b) => a - b);
        [mark, cls] = evalMark(outScores[0] || 0, perPersonTh);
      } else {
        [mark, cls] = evalMark(totalFieldScoreIdeal(p, pos), perPersonTh);
      }

      return `
        <div class="lineup-row" style="grid-template-columns:48px 1fr auto 32px 36px">
          <span class="lineup-pos">${LABELS[i]}</span>
          <div>
            <select style="width:100%;padding:5px 8px;font-size:12px" onchange="onIdealChange(${i},this.value)">${options}</select>
            <span style="${nameColor}">${convertTag}</span>
            ${realDiff}
          </div>
          ${fixBtn}
          <span class="eval ${cls}" style="font-size:16px">${mark}</span>
          <span class="lineup-score">${scoreDisplay}</span>
        </div>`;
    }).join('');

    // DH: 固定・仮配置があればその選手、なければsolveLineup後の残り選手から自動選出
    const dhFixedId = idealFixed.get('dh') || idealTemp.get('dh') || null;
    const allUsed = new Set([...idealPlan.assigned.values()].filter(Boolean).map(p => p.id));
    const dhPlayer = dhFixedId
      ? fielders.find(p => p.id === dhFixedId)
      : (() => {
          const remaining = fielders.filter(p => !allUsed.has(p.id));
          return remaining.sort((a, b) => dhScore(b) - dhScore(a))[0] || null;
        })();
    if (dhPlayer) allUsed.add(dhPlayer.id);

    const isDhFixed = idealFixed.has('dh');
    const dhPlayerId = idealFixed.get('dh') || idealTemp.get('dh') || dhPlayer?.id || '';
    const dhOptions = [
      `<option value="">-- 自動選出 --</option>`,
      ...fielders.map(p =>
        `<option value="${p.id}" ${p.id === dhPlayerId ? 'selected' : ''}>${p.name}(${p.grade}年・${POS_SHORT[p.main]})</option>`
      )
    ].join('');
    const dhFixBtn = `<button onclick="toggleIdealFixed('dh', '${dhPlayerId}')"
      style="font-size:11px;padding:3px 8px;${isDhFixed
        ? 'color:var(--primary);border-color:var(--primary);font-weight:700'
        : 'color:var(--muted)'}">
      ${isDhFixed ? '固定中' : '固定'}</button>`;

    const dhRow = `
      <div class="lineup-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:8px;grid-template-columns:48px 1fr auto 32px 36px">
        <span class="lineup-pos">DH</span>
        <select style="width:100%;padding:5px 8px;font-size:12px" onchange="onIdealDhChange(this.value)">${dhOptions}</select>
        ${dhFixBtn}
        <span></span>
        <span class="lineup-score">${dhPlayer ? score100(dhScore(dhPlayer)) : '-'}</span>
      </div>`;
    const bench = fielders.filter(p => !allUsed.has(p.id));
    const benchRows = bench.length
      ? `<h3>控え・出場機会なし</h3>${bench.map(p => `<span class="badge">${p.name} ${p.grade}年(${POS_SHORT[p.main]})</span>`).join('')}`
      : '';

    // 必要なコンバート一覧
    const convertNeeded = [];
    FIELD_POS.forEach((pos, i) => {
      const p = idealPlan.assigned.get(i);
      if (!p || p.main === pos || (p.subsHigh || []).includes(pos)) return;
      const type = (p.subs || []).includes(pos) ? 'upgrade' : 'convert';
      convertNeeded.push({ name: p.name, from: p.main, to: pos, type, label: LABELS[i] });
    });

    const convertSection = convertNeeded.length ? `
      <h3>このスタメンを実現するために必要な変更</h3>
      ${convertNeeded.map(c => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <span class="lineup-pos">${c.label}</span>
          <span style="font-size:13px">${c.name}</span>
          <span style="font-size:12px;color:${c.type === 'convert' ? 'var(--danger)' : 'var(--warn)'}">
            ${c.type === 'convert'
              ? `コンバート必要 (${POS_SHORT[c.from]}→${POS_SHORT[c.to]})`
              : `サブ◎への格上げ (${POS_SHORT[c.from]}→${POS_SHORT[c.to]}◎)`}
          </span>
        </div>`).join('')}` : `
      <h3>このスタメンを実現するために必要な変更</h3>
      <div class="muted" style="font-size:13px">コンバート不要です。</div>`;

    return `<div style="margin-top:10px">${teamScoreLine}${rows}${dhRow}</div><div style="margin-top:12px">${benchRows}${convertSection}</div>`;
  }

  // --- タブバー ---
  const tabs = [{ id: 'real', label: '現実案' }, { id: 'ideal', label: '理想案' }];
  const hasFixed = idealFixed.size > 0 || idealTemp.size > 0;  const tabBar = `
    <div style="display:flex;gap:4px;margin-bottom:12px;align-items:center;flex-wrap:wrap">
      ${tabs.map(t => `<button onclick="switchLineupTab('${t.id}')"
        style="${activeTab===t.id?'background:var(--primary);color:#fff;border-color:var(--primary)':''}">${t.label}</button>`).join('')}
      ${activeTab === 'ideal' && hasFixed
        ? `<button onclick="clearIdealFixed()" style="margin-left:auto;font-size:12px;padding:6px 10px;color:var(--muted)">固定をリセット</button>`
        : ''}
    </div>`;

  let content = '';
  if (activeTab === 'real')  content = realPlanHtml();
  if (activeTab === 'ideal') content = idealPlanHtml();

  el.innerHTML = `${tabBar}<div class="analysis-card">${content}</div>`;
  el.dataset.activeTab = activeTab;
}

// タブ切り替え
function switchLineupTab(tabId) {
  const el = document.getElementById('lineupResult');
  if (el) el.dataset.activeTab = tabId;
  renderLineup();
}

// 理想案: ドロップダウンで選手を選択(仮配置。固定ボタンを押すまでは再最適化で変わる可能性あり)
// 選手IDをキーにして管理する(再最適化で別枠に移動しても仮配置・固定が引き継がれる)
function onIdealChange(posIndex, playerId) {
  // 既に他のポジションに同じ選手が仮配置・固定されていれば除去(1人1枠)
  idealTemp.delete(playerId);
  idealFixed.delete(playerId);
  if (playerId) idealTemp.set(playerId, posIndex);
  renderLineup();
}

// 理想案: DHドロップダウン変更
function onIdealDhChange(playerId) {
  // 既に守備ポジションに仮配置・固定されていれば除去
  if (playerId) {
    idealTemp.delete(playerId);
    idealFixed.delete(playerId);
    idealTemp.set('dh', playerId);
  } else {
    idealTemp.delete('dh');
    idealFixed.delete('dh');
  }
  renderLineup();
}

// 理想案: 固定ボタンのトグル(選手IDをキーに管理することで再最適化でも固定が引き継がれる)
function toggleIdealFixed(playerId, posIndex) {
  if (!playerId) return;
  if (idealFixed.has(playerId)) {
    idealFixed.delete(playerId); // 固定解除
  } else {
    idealFixed.set(playerId, posIndex); // 固定(選手IDに紐付け)
    idealTemp.delete(playerId); // 仮配置から昇格
  }
  renderLineup();
}

// 固定・仮配置を全リセット
function clearIdealFixed() {
  idealFixed.clear();
  idealTemp.clear();
  renderLineup();
}



/* ---------- 年度進行・入出力 ---------- */

// 年度進行。3年は卒業(配列から除外)、2年→3年、1年→2年に進級する。
// 進行後は能力更新を促す案内を出し、選手一覧に自動遷移する。
function advanceYear() {
  if (!confirm('年度進行します。3年は卒業します。よろしいですか？')) return;

  players = players.filter(p => p.grade < 3).map(p => ({ ...p, grade: p.grade + 1 }));
  save();
  renderAll();

  alert('年度進行しました。各選手の能力を見直して更新してください。選手一覧から選手をタップすると編集できます。');
  show('players');
}

// 選手データをJSONファイルとしてダウンロードする
// 選手データをJSONファイルとしてダウンロードする。
// 重み設定(weightSettings)も含めてエクスポートし、インポート時に完全復元できるようにする。
function exportJson() {
  const weightSettings = JSON.parse(localStorage.getItem(WEIGHT_KEY) || '{}');
  const data = {
    version: '1.4',
    exportedAt: new Date().toISOString(),
    players,
    weightSettings  // カスタム重み設定を含める(デフォルトのままなら空オブジェクト)
  };
  const jsonBoxEl = document.getElementById('jsonBox');
  jsonBoxEl.value = JSON.stringify(data, null, 2);

  const blob = new Blob([jsonBoxEl.value], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'eikan-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

// JSONファイルから選手データ・重み設定を読み込む。
// 旧バージョン(weightSettingsなし)のJSONも引き続き読み込める。
function importJson() {
  const f = document.getElementById('importFile').files[0];
  if (!f) return alert('JSONファイルを選択してください');

  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      const arr = Array.isArray(d) ? d : d.players;
      if (!Array.isArray(arr)) throw new Error();
      players = arr;
      save();

      // 重み設定が含まれていれば復元する(旧バージョンのJSONには含まれないためスキップ)
      if (d.weightSettings && typeof d.weightSettings === 'object') {
        localStorage.setItem(WEIGHT_KEY, JSON.stringify(d.weightSettings));
        // config.positionWeightsにも即時反映する
        Object.entries(d.weightSettings).forEach(([pos, weights]) => {
          config.positionWeights[pos] = weights;
        });
      }

      renderAll();
      alert('読み込みました');
    } catch (e) {
      alert('JSONの形式が不正です');
    }
  };
  r.readAsText(f);
}


/* ---------- 起動 ---------- */
init();
