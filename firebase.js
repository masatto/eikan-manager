/* =========================================================
 * firebase.js - Firebase同期モジュール
 *
 * FIREBASE_CONFIGのprojectIdを設定すると同期機能が有効になります。
 * 未設定時はlocalStorageのみで動作し、UIも表示されません。
 * ========================================================= */

// TODO: Firebase コンソール(https://console.firebase.google.com)から
//       プロジェクトの設定値をコピーしてここに貼り付けてください。
//       projectId を入力するとGoogle認証とデータ同期が有効になります。
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAic9IefT6f40Fx-3_3AFptAlsZmQ1PV0c",
  authDomain: "eikan-manager.firebaseapp.com",
  projectId: "eikan-manager",
  storageBucket: "eikan-manager.firebasestorage.app",
  messagingSenderId: "308121789051",
  appId: "1:308121789051:web:58cbd4b724aee8ad4ef8de"
};

const FB_ENABLED = !!FIREBASE_CONFIG.projectId;

let _auth = null;
let _db   = null;
let _fbUser = null;  // 現在ログイン中のユーザー(未ログイン時はnull)

/* ---------- SDK動的ロード ---------- */

function _loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ---------- 初期化 ---------- */

async function fbInit() {
  if (!FB_ENABLED) return;

  const base = 'https://www.gstatic.com/firebasejs/10.12.0';
  await _loadScript(`${base}/firebase-app-compat.js`);
  await _loadScript(`${base}/firebase-auth-compat.js`);
  await _loadScript(`${base}/firebase-firestore-compat.js`);

  firebase.initializeApp(FIREBASE_CONFIG);
  _auth = firebase.auth();
  _db   = firebase.firestore();

  _auth.onAuthStateChanged(async user => {
    _fbUser = user;
    renderSyncUI();
    if (user) {
      await fbMergeAndSync();
    }
  });
}

/* ---------- 認証 ---------- */

async function fbLogin() {
  if (!_auth) return;
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await _auth.signInWithPopup(provider);
  } catch (e) {
    alert('ログインに失敗しました: ' + e.message);
  }
}

async function fbLogout() {
  if (!_auth) return;
  await _auth.signOut();
  renderSyncUI();
}

/* ---------- Firestore 書き込み(fire-and-forget) ---------- */

// 選手1件をFirestoreに保存する。失敗してもローカルには影響しない。
function fbSavePlayer(player) {
  if (!_db || !_fbUser) return;
  _db.collection('users').doc(_fbUser.uid).collection('players').doc(player.id)
    .set({ ...player, _deleted: false })
    .catch(e => console.warn('[Firebase] 保存エラー', e));
}

// 選手1件を論理削除フラグでFirestoreに記録する。
// 実際のドキュメントは残し、他端末でのマージ時に削除として扱われる。
function fbDeletePlayer(playerId) {
  if (!_db || !_fbUser) return;
  _db.collection('users').doc(_fbUser.uid).collection('players').doc(playerId)
    .set({ id: playerId, _deleted: true, updatedAt: Date.now() })
    .catch(e => console.warn('[Firebase] 削除エラー', e));
}

/* ---------- 双方向マージ ---------- */

// ローカルとFirestoreをupdatedAt基準でマージし、両方を最新状態に更新する。
// ログイン直後と手動同期ボタンから呼ばれる。
async function fbMergeAndSync() {
  if (!_db || !_fbUser) return;

  const colRef = _db.collection('users').doc(_fbUser.uid).collection('players');

  let snap;
  try {
    snap = await colRef.get();
  } catch (e) {
    console.warn('[Firebase] 取得エラー', e);
    alert('同期に失敗しました: ' + e.message);
    return;
  }

  // Firestoreのデータ(削除済みを含む全件)
  const cloudMap = {};
  snap.forEach(d => { cloudMap[d.id] = d.data(); });

  // ローカルのデータ
  const localMap = {};
  (players || []).forEach(p => { localMap[p.id] = p; });

  const allIds = new Set([...Object.keys(localMap), ...Object.keys(cloudMap)]);
  const merged = [];
  const pushToCloud = [];

  for (const id of allIds) {
    const local = localMap[id];
    const cloud = cloudMap[id];
    const localAt = local?.updatedAt || 0;
    const cloudAt = cloud?.updatedAt || 0;

    // updatedAtが新しい方を正とする
    const winner = localAt >= cloudAt ? local : cloud;

    if (!winner || winner._deleted) {
      // 削除済み: ローカルに残っていれば相手側に削除を伝える
      if (local && !local._deleted) {
        pushToCloud.push({ id, _deleted: true, updatedAt: Math.max(localAt, cloudAt) });
      }
      continue;
    }

    merged.push(winner);

    // Firestoreに存在しない、またはローカルの方が新しければFirestoreを更新
    if (!cloud || localAt > cloudAt) {
      pushToCloud.push({ ...winner, _deleted: false });
    }
  }

  // ローカルに反映
  players = merged;
  save();
  renderAll();

  // Firestoreに差分をプッシュ
  for (const p of pushToCloud) {
    colRef.doc(p.id).set(p).catch(e => console.warn('[Firebase] sync push エラー', e));
  }
}

/* ---------- 同期UI ---------- */

// ヘッダー内の #syncArea にログイン状態に応じたUIを描画する。
function renderSyncUI() {
  const el = document.getElementById('syncArea');
  if (!el) return;

  if (!FB_ENABLED) {
    el.style.display = 'none';
    return;
  }

  if (_fbUser) {
    const name = _fbUser.displayName || _fbUser.email || 'ユーザー';
    el.innerHTML =
      `<span class="sync-user">${name}</span>` +
      `<button class="sync-btn" onclick="fbMergeAndSync()">↑↓ 同期</button>` +
      `<button class="sync-btn" onclick="fbLogout()">ログアウト</button>`;
  } else {
    el.innerHTML =
      `<button class="sync-btn" onclick="fbLogin()">Googleでログイン</button>`;
  }
}
