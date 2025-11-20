// ================================
// 生産進捗トラッキング フロントエンド
// ================================

// ★Apps Script Web App のURLをここに設定
// 例: const API_URL = 'https://script.google.com/macros/s/XXXXX/exec';
const API_URL = 'https://script.google.com/macros/s/AKfycby_U7mv3AavS2AFgRE3mm-1ZKbT9cJodZwq_xayPy_twJQK74wp3nrO-Fgi5-0eO9v1/exec';

// 現在ログイン中のユーザー情報
let currentUser = null;

// 現在選択中の端末情報
let currentTerminal = null;

// Users / Terminals マスターデータ
let masterUsers = [];
let masterTerminals = [];

// html5-qrcode インスタンス
let html5Qrcode = null;
let currentScanMode = null; // 'user' or 'terminal'

// 開始時刻セッション
const ACTIVE_SESSION_KEY = 'active_sessions_v1';

// オフラインキュー（送信待ちログ）
const OFFLINE_QUEUE_KEY = 'offline_log_queue_v1';

// ダッシュボードデータ
let dashboardLogs = [];

// Chart.js インスタンス
let processChart = null;

// --------------------------------
// 初期化
// --------------------------------

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupButtons();
  loadMasterData();
  loadDashboard();
  loadAnalytics();
  setupOnlineOfflineHandlers();
});

// --------------------------------
// タブ切り替え
// --------------------------------

function setupTabs() {
  const buttons = document.querySelectorAll('.nav-button');
  const panels = document.querySelectorAll('.tab-panel');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      buttons.forEach(b => b.classList.toggle('active', b === btn));
      panels.forEach(p => p.classList.toggle('active', p.id === target));
    });
  });
}

// --------------------------------
// ボタンイベント
// --------------------------------

function setupButtons() {
  document.getElementById('btn-start-user-scan').addEventListener('click', () => {
    startQrScan('user');
  });

  document.getElementById('btn-start-terminal-scan').addEventListener('click', () => {
    startQrScan('terminal');
  });

  document.getElementById('btn-save-log').addEventListener('click', handleSaveLog);
  document.getElementById('btn-clear-form').addEventListener('click', clearForm);

  document.getElementById('btn-refresh-dashboard').addEventListener('click', () => {
    loadDashboard();
    loadAnalytics();
  });

  document.getElementById('btn-export-product').addEventListener('click', handleExportProduct);

  document.getElementById('btn-edit-save').addEventListener('click', handleEditSave);
  document.getElementById('btn-edit-cancel').addEventListener('click', closeEditModal);

  document.getElementById('btn-admin-create-user').addEventListener('click', handleCreateUser);
  document.getElementById('btn-admin-create-terminal').addEventListener('click', handleCreateTerminal);
}

// --------------------------------
// オンライン/オフライン表示
// --------------------------------

function setupOnlineOfflineHandlers() {
  const offlineIndicator = document.getElementById('offline-indicator');

  function updateOnlineState() {
    if (navigator.onLine) {
      offlineIndicator.classList.add('hidden');
      flushOfflineQueue();
    } else {
      offlineIndicator.classList.remove('hidden');
    }
  }

  window.addEventListener('online', updateOnlineState);
  window.addEventListener('offline', updateOnlineState);
  updateOnlineState();
}

// --------------------------------
// API 呼び出しヘルパー
// --------------------------------

/**
 * Apps Script API 呼び出し
 * - application/x-www-form-urlencoded で送信し、CORSプリフライトを避ける
 */
async function callApi(action, body) {
  const payload = Object.assign({}, body || {}, { action });
  const payloadStr = JSON.stringify(payload);
  const formBody = 'payload=' + encodeURIComponent(payloadStr);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
    },
    body: formBody
  });

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new Error('サーバー応答が不正です (JSON 解析失敗)');
  }

  if (!json.ok) {
    throw new Error(json.error || 'API エラー');
  }
  return json.data;
}

// --------------------------------
// マスターデータ読み込み
// --------------------------------

async function loadMasterData() {
  try {
    const data = await callApi('getMasterData', {});
    masterUsers = data.users || [];
    masterTerminals = data.terminals || [];
  } catch (err) {
    console.error(err);
    alert('マスターデータ取得に失敗しました: ' + err.message);
  }
}

// --------------------------------
// QRコード スキャン
// --------------------------------

function startQrScan(mode) {
  currentScanMode = mode;

  const readerElem = document.getElementById('qr-reader');

  if (html5Qrcode) {
    try {
      html5Qrcode.stop().catch(() => {});
    } catch (e) {}
  }

  html5Qrcode = new Html5Qrcode('qr-reader');

  const onScanSuccess = async (decodedText) => {
    try {
      await html5Qrcode.stop();
    } catch (e) {}

    try {
      await handleDecodedText(decodedText, mode);
    } catch (err) {
      alert('QR処理中にエラーが発生しました: ' + err.message);
    }
  };

  const config = { fps: 10, qrbox: 250 };

  html5Qrcode.start({ facingMode: 'environment' }, config, onScanSuccess)
    .catch(err => {
      alert('カメラの起動に失敗しました: ' + err);
    });
}

async function handleDecodedText(decodedText, mode) {
  let payload;
  try {
    payload = JSON.parse(decodedText);
  } catch (e) {
    payload = { type: mode, id: decodedText };
  }

  if (mode === 'user') {
    if (payload.type !== 'user') {
      alert('ユーザーQRではありません。');
      return;
    }
    await loginWithUserId(payload.id);
  } else if (mode === 'terminal') {
    if (payload.type !== 'terminal') {
      alert('端末QRではありません。');
      return;
    }
    selectTerminalById(payload.id);
  }
}

// --------------------------------
// ユーザー認証
// --------------------------------

async function loginWithUserId(userId) {
  try {
    const user = await callApi('getUser', { userId });
    currentUser = user;

    document.getElementById('current-user-name').textContent = user.name_ja;
    document.getElementById('current-user-id').textContent = user.user_id;
    document.getElementById('current-user-role').textContent = user.role;

    updateAdminVisibility();
    renderDashboardTable(); // 操作列の権限反映
    alert('ログインしました: ' + user.name_ja);
  } catch (err) {
    console.error(err);
    alert('ユーザー認証に失敗しました: ' + err.message);
  }
}

// --------------------------------
// 端末選択（マスタから取得）
// --------------------------------

function selectTerminalById(terminalId) {
  const t = masterTerminals.find(x => x.terminal_id === terminalId);
  if (!t) {
    currentTerminal = {
      terminal_id: terminalId,
      name_ja: '端末 ' + terminalId,
      process_name: '不明工程',
      location: '不明ロケーション'
    };
  } else {
    currentTerminal = t;
  }

  document.getElementById('current-terminal-name').textContent = currentTerminal.name_ja;
  document.getElementById('current-process-name').textContent = currentTerminal.process_name;
  document.getElementById('current-location').textContent = currentTerminal.location;

  alert('端末を選択しました: ' + currentTerminal.terminal_id);
}

// --------------------------------
// 開始/終了 保存処理 + オフラインキュー
// --------------------------------

async function handleSaveLog() {
  if (!currentUser) {
    alert('まずユーザーQRをスキャンしてログインしてください。');
    return;
  }
  if (!currentTerminal) {
    alert('端末QRをスキャンして工程を選択してください。');
    return;
  }

  const productCode = document.getElementById('product-code-input').value.trim();
  if (!productCode) {
    if (!confirm('製品番号が未入力です。空のまま保存してもよろしいですか？')) {
      return;
    }
  }

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const status = document.getElementById('status-select').value;
  const qtyTotal = Number(document.getElementById('qty-total-input').value || 0);
  const qtyOk = Number(document.getElementById('qty-ok-input').value || 0);
  const qtyNg = Number(document.getElementById('qty-ng-input').value || 0);

  const now = new Date();
  const sessionKey = buildSessionKey(currentUser.user_id, currentTerminal.terminal_id, productCode);
  let activeSessions = loadActiveSessions();

  if (mode === 'start') {
    activeSessions[sessionKey] = now.toISOString();
    saveActiveSessions(activeSessions);
    alert('開始時刻を記録しました。終了時に同じユーザー + 端末 + 製品番号で「終了」を保存してください。');
    return;
  }

  const startIso = activeSessions[sessionKey];
  if (!startIso) {
    if (!confirm('開始時刻が見つかりません。現在時刻を開始として保存しますか？')) {
      return;
    }
  }

  const startDate = startIso ? new Date(startIso) : now;
  const endDate = now;
  const durationSec = Math.round((endDate - startDate) / 1000);

  const timestampStartStr = formatDateTime(startDate);
  const timestampEndStr = formatDateTime(endDate);

  const log = {
    product_code: productCode,
    process_name: currentTerminal.process_name,
    terminal_id: currentTerminal.terminal_id,
    terminal_name: currentTerminal.name_ja,
    user_id: currentUser.user_id,
    user_name: currentUser.name_ja,
    role: currentUser.role,
    status: status === '検査保留' ? '検査保留' : '終了',
    qty_total: qtyTotal,
    qty_ok: qtyOk,
    qty_ng: qtyNg,
    timestamp_start: timestampStartStr,
    timestamp_end: timestampEndStr,
    duration_sec: durationSec,
    location: currentTerminal.location
  };

  try {
    await callApi('logEvent', { log });
    delete activeSessions[sessionKey];
    saveActiveSessions(activeSessions);

    alert('ログを保存しました。');
    clearForm();
    loadDashboard();
    loadAnalytics();
  } catch (err) {
    console.error(err);
    // ネットワーク系エラーの場合はオフラインキューに入れる
    if (!navigator.onLine || err.message.includes('サーバー応答')) {
      enqueueOfflineLog(log);
      alert('ネットワークエラーのため、オフラインキューに保存しました。オンライン復帰後に自動送信されます。');
    } else {
      alert('ログ保存に失敗しました: ' + err.message);
    }
  }
}

// --------------------------------
// 開始セッション管理（localStorage）
// --------------------------------

function buildSessionKey(userId, terminalId, productCode) {
  return `${userId}__${terminalId}__${productCode || ''}`;
}

function loadActiveSessions() {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveActiveSessions(sessions) {
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sessions || {}));
}

// --------------------------------
// オフラインキュー管理
// --------------------------------

function enqueueOfflineLog(log) {
  const queue = loadOfflineQueue();
  queue.push(log);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function loadOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function flushOfflineQueue() {
  let queue = loadOfflineQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const log of queue) {
    try {
      await callApi('logEvent', { log });
    } catch (err) {
      console.error('オフラインキュー送信失敗', err);
      remaining.push(log);
    }
  }
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  if (queue.length !== remaining.length) {
    alert('オフライン中のデータの一部をサーバーへ送信しました。');
    loadDashboard();
    loadAnalytics();
  }
}

// --------------------------------
// フォームクリア + 日付ユーティリティ
// --------------------------------

function clearForm() {
  document.getElementById('product-code-input').value = '';
  document.getElementById('qty-total-input').value = 0;
  document.getElementById('qty-ok-input').value = 0;
  document.getElementById('qty-ng-input').value = 0;
}

function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

// --------------------------------
// ダッシュボード読み込み・描画
// --------------------------------

async function loadDashboard() {
  try {
    const data = await callApi('getDashboard', { limit: 200 });
    dashboardLogs = data || [];
    renderDashboardTable();
    updateAlertBanner();
  } catch (err) {
    console.error(err);
    alert('ダッシュボードデータ取得に失敗しました: ' + err.message);
  }
}

function renderDashboardTable() {
  const tbody = document.getElementById('logs-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const processFilter = document.getElementById('filter-process').value;
  const terminalFilter = document.getElementById('filter-terminal').value.trim().toLowerCase();
  const productFilter = document.getElementById('filter-product').value.trim().toLowerCase();
  const dateFrom = document.getElementById('filter-date-from').value;
  const dateTo = document.getElementById('filter-date-to').value;

  const filtered = dashboardLogs.filter(log => {
    if (processFilter) {
      if (log.process_name !== processFilter && log.status !== processFilter) return false;
    }
    if (terminalFilter) {
      const target = (log.terminal_id + ' ' + log.terminal_name).toLowerCase();
      if (!target.includes(terminalFilter)) return false;
    }
    if (productFilter) {
      if (!String(log.product_code || '').toLowerCase().includes(productFilter)) return false;
    }
    if (dateFrom) {
      const d = new Date(log.timestamp_end || log.timestamp_start);
      if (d < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const d = new Date(log.timestamp_end || log.timestamp_start);
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      if (d >= to) return false;
    }
    return true;
  });

  filtered.forEach(log => {
    const tr = document.createElement('tr');
    const durationMin = log.duration_sec ? (log.duration_sec / 60).toFixed(1) : '';

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.classList.add('badge');
    if (log.status === '検査保留') {
      badge.classList.add('badge-hold');
    } else if (log.status === '終了' || log.status === '通常') {
      badge.classList.add('badge-normal');
    } else {
      badge.classList.add('badge-error');
    }
    badge.textContent = log.status || '-';
    statusCell.appendChild(badge);

    tr.innerHTML = `
      <td>${log.timestamp_end || log.timestamp_start || ''}</td>
      <td>${log.product_code || ''}</td>
      <td>${log.process_name || ''}</td>
      <td>${log.terminal_name || ''} (${log.terminal_id || ''})</td>
      <td>${log.user_name || ''}</td>
      <td>${log.qty_total || 0} (${log.qty_ok || 0} / ${log.qty_ng || 0})</td>
    `;
    tr.appendChild(statusCell);

    const tdDuration = document.createElement('td');
    tdDuration.textContent = durationMin || '';
    tr.appendChild(tdDuration);

    const tdLocation = document.createElement('td');
    tdLocation.textContent = log.location || '';
    tr.appendChild(tdLocation);

    const tdActions = document.createElement('td');
    if (currentUser && currentUser.role === 'admin') {
      const editBtn = document.createElement('button');
      editBtn.textContent = '編集';
      editBtn.className = 'ghost-button';
      editBtn.style.fontSize = '0.7rem';
      editBtn.addEventListener('click', () => openEditModal(log));

      const delBtn = document.createElement('button');
      delBtn.textContent = '削除';
      delBtn.className = 'ghost-button';
      delBtn.style.fontSize = '0.7rem';
      delBtn.style.marginLeft = '4px';
      delBtn.addEventListener('click', () => handleDeleteLog(log));

      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);
    } else {
      tdActions.textContent = '-';
    }
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

// 不良または検査保留が最近あるかどうかでバナー表示
function updateAlertBanner() {
  const banner = document.getElementById('alert-banner');
  const recent = dashboardLogs.slice(0, 50); // 直近50件だけ確認
  const hasProblem = recent.some(log => (log.qty_ng || 0) > 0 || log.status === '検査保留');
  if (hasProblem) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// --------------------------------
// ログ編集・削除
// --------------------------------

function openEditModal(log) {
  document.getElementById('edit-log-id').value = log.log_id;
  document.getElementById('edit-qty-total').value = log.qty_total || 0;
  document.getElementById('edit-qty-ok').value = log.qty_ok || 0;
  document.getElementById('edit-qty-ng').value = log.qty_ng || 0;
  document.getElementById('edit-status').value = log.status || '通常';
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function handleEditSave() {
  const logId = document.getElementById('edit-log-id').value;
  const qtyTotal = Number(document.getElementById('edit-qty-total').value || 0);
  const qtyOk = Number(document.getElementById('edit-qty-ok').value || 0);
  const qtyNg = Number(document.getElementById('edit-qty-ng').value || 0);
  const status = document.getElementById('edit-status').value;

  try {
    await callApi('updateLog', {
      log: { log_id: logId, qty_total: qtyTotal, qty_ok: qtyOk, qty_ng: qtyNg, status }
    });
    alert('ログを更新しました。');
    closeEditModal();
    loadDashboard();
    loadAnalytics();
  } catch (err) {
    console.error(err);
    alert('ログの更新に失敗しました: ' + err.message);
  }
}

async function handleDeleteLog(log) {
  if (!confirm('このログを削除しますか？')) return;
  try {
    await callApi('deleteLog', { logId: log.log_id });
    alert('ログを削除しました。');
    loadDashboard();
    loadAnalytics();
  } catch (err) {
    console.error(err);
    alert('ログの削除に失敗しました: ' + err.message);
  }
}

// --------------------------------
// Excelエクスポート
// --------------------------------

async function handleExportProduct() {
  const productCode = prompt('エクスポートする製品番号を入力してください:');
  if (!productCode) return;

  try {
    const data = await callApi('exportLogsByProduct', { productCode });
    const csv = data.csv || '';
    if (!csv) {
      alert('対象データがありません。');
      return;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `logs_${productCode}_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('CSVファイルをダウンロードしました。Excelで開いてください。');
  } catch (err) {
    console.error(err);
    alert('エクスポートに失敗しました: ' + err.message);
  }
}

// --------------------------------
// 管理者メニュー表示制御
// --------------------------------

function updateAdminVisibility() {
  const guardMsg = document.getElementById('admin-guard-message');
  const adminContent = document.getElementById('admin-content');

  if (currentUser && currentUser.role === 'admin') {
    guardMsg.classList.add('hidden');
    adminContent.classList.remove('hidden');
  } else {
    guardMsg.classList.remove('hidden');
    adminContent.classList.add('hidden');
  }
}

// --------------------------------
// 管理者: ユーザー登録 + QR生成
// --------------------------------

async function handleCreateUser() {
  if (!currentUser || currentUser.role !== 'admin') {
    alert('管理者権限が必要です。');
    return;
  }

  const userId = document.getElementById('admin-user-id').value.trim();
  const nameJa = document.getElementById('admin-user-name').value.trim();
  const role = document.getElementById('admin-user-role').value;

  if (!userId || !nameJa) {
    alert('ユーザーIDと氏名を入力してください。');
    return;
  }

  try {
    await callApi('createUser', { user: { user_id: userId, name_ja: nameJa, role } });
    alert('ユーザーを登録しました。');

    const qrData = JSON.stringify({ type: 'user', id: userId });
    const container = document.getElementById('user-qr-container');
    container.innerHTML = '';
    new QRCode(container, { text: qrData, width: 160, height: 160 });

    // もう一度マスタを更新
    loadMasterData();
  } catch (err) {
    console.error(err);
    alert('ユーザー登録に失敗しました: ' + err.message);
  }
}

// --------------------------------
// 管理者: 端末登録 + QR生成
// --------------------------------

async function handleCreateTerminal() {
  if (!currentUser || currentUser.role !== 'admin') {
    alert('管理者権限が必要です。');
    return;
  }

  const terminalId = document.getElementById('admin-terminal-id').value.trim();
  const nameJa = document.getElementById('admin-terminal-name').value.trim();
  const processName = document.getElementById('admin-terminal-process').value;
  const location = document.getElementById('admin-terminal-location').value.trim();

  if (!terminalId || !nameJa) {
    alert('端末IDと端末名称を入力してください。');
    return;
  }

  const qrValue = JSON.stringify({ type: 'terminal', id: terminalId });

  try {
    await callApi('createTerminal', {
      terminal: { terminal_id: terminalId, name_ja: nameJa, process_name: processName, location, qr_value: qrValue }
    });

    alert('端末を登録しました。');

    const container = document.getElementById('terminal-qr-container');
    container.innerHTML = '';
    new QRCode(container, { text: qrValue, width: 160, height: 160 });

    loadMasterData();
  } catch (err) {
    console.error(err);
    alert('端末登録に失敗しました: ' + err.message);
  }
}

// --------------------------------
// Analytics (Chart.js)
// --------------------------------

async function loadAnalytics() {
  try {
    const data = await callApi('getAnalytics', {});
    const today = data.today || { total: 0, ng: 0 };
    const byProcess = data.byProcess || [];

    document.getElementById('today-total').textContent = today.total;
    document.getElementById('today-ng').textContent = today.ng;

    const labels = byProcess.map(x => x.process_name || '不明');
    const totals = byProcess.map(x => x.total || 0);

    const ctx = document.getElementById('process-chart');
    if (!ctx) return;

    if (processChart) {
      processChart.destroy();
    }

    processChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '総数量',
          data: totals
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } catch (err) {
    console.error(err);
    // 分析は必須ではないため、アラートは出さずログのみ
  }
}
