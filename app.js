// =====================================
// 生産進捗トラッキング フロントエンド
// =====================================

// ★Apps Script Web App URL（/exec）をセット
const API_URL = 'https://script.google.com/macros/s/AKfycby_U7mv3AavS2AFgRE3mm-1ZKbT9cJodZwq_xayPy_twJQK74wp3nrO-Fgi5-0eO9v1/exec';

// 状態
let currentUser = null;
let currentTerminal = null;
let masterUsers = [];
let masterTerminals = [];
let dashboardLogs = [];
let plans = [];
let html5Qrcode = null;
let currentScanMode = null;
let processChart = null;

// localStorage keys
const ACTIVE_SESSION_KEY = 'active_sessions_v1';
const OFFLINE_QUEUE_KEY = 'offline_log_queue_v1';

// ----------------------------------
// 初期化
// ----------------------------------

document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();
  setupButtons();
  setupOnlineOfflineHandlers();
  setWelcomeDate();

  loadMasterData();
  loadDashboard();
  loadAnalytics();
  loadPlans();
});

// ----------------------------------
// Sidebar navigation
// ----------------------------------

function setupSidebar() {
  const links = document.querySelectorAll('.sidebar-link');
  const sections = document.querySelectorAll('.section');
  const sidebar = document.querySelector('.sidebar');
  const burger = document.getElementById('btn-menu-toggle');

  links.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.dataset.section;
      links.forEach(l => l.classList.toggle('active', l === link));
      sections.forEach(sec => sec.classList.toggle('active', sec.id === target));

      // スマホではメニュー選択後にサイドバーを閉じる
      if (window.innerWidth <= 800 && sidebar) {
        sidebar.classList.add('sidebar-hidden');
      }
    });
  });

  if (burger && sidebar) {
    burger.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-hidden');
    });

    // 初回ロード時、小さい画面なら閉じた状態から開始
    if (window.innerWidth <= 800) {
      sidebar.classList.add('sidebar-hidden');
    }

    window.addEventListener('resize', () => {
      if (window.innerWidth > 800) {
        sidebar.classList.remove('sidebar-hidden');
      } else {
        sidebar.classList.add('sidebar-hidden');
      }
    });
  }
}


// ----------------------------------
// ボタンイベント
// ----------------------------------

function setupButtons() {
  document.getElementById('btn-start-user-scan').addEventListener('click', () => {
    startQrScan('user');
  });
  document.getElementById('btn-start-terminal-scan').addEventListener('click', () => {
    startQrScan('terminal');
  });

  const manualBtn = document.getElementById('btn-manual-login');
  if (manualBtn) {
    manualBtn.addEventListener('click', handleManualLogin);
  }

  document.getElementById('btn-save-log').addEventListener('click', handleSaveLog);
  document.getElementById('btn-clear-form').addEventListener('click', clearForm);

  document.getElementById('btn-refresh-dashboard').addEventListener('click', () => {
    loadDashboard();
    loadAnalytics();
  });
  document.getElementById('btn-export-product').addEventListener('click', handleExportProduct);

  document.getElementById('btn-edit-save').addEventListener('click', handleEditSave);
  document.getElementById('btn-edit-cancel').addEventListener('click', closeEditModal);

  // Admin
  document.getElementById('btn-admin-create-user').addEventListener('click', handleCreateUser);
  document.getElementById('btn-admin-create-terminal').addEventListener('click', handleCreateTerminal);

  // Plans
  document.getElementById('btn-save-plan').addEventListener('click', handleSavePlan);
  document.getElementById('btn-clear-plan').addEventListener('click', clearPlanForm);
  document.getElementById('btn-refresh-plans').addEventListener('click', loadPlans);
  document.getElementById('btn-import-plans').addEventListener('click', handleImportPlans);
}

// ----------------------------------
// Online / Offline Indicator
// ----------------------------------

function setupOnlineOfflineHandlers() {
  const offlineIndicator = document.getElementById('offline-indicator');

  function updateState() {
    if (navigator.onLine) {
      offlineIndicator.classList.add('hidden');
      flushOfflineQueue();
    } else {
      offlineIndicator.classList.remove('hidden');
    }
  }
  window.addEventListener('online', updateState);
  window.addEventListener('offline', updateState);
  updateState();
}

// ----------------------------------
// Utils: API
// ----------------------------------

async function callApi(action, body) {
  const payload = Object.assign({}, body || {}, { action });
  const formBody = 'payload=' + encodeURIComponent(JSON.stringify(payload));

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: formBody
  });

  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error('サーバー応答の解析に失敗しました');
  }
  if (!json.ok) {
    throw new Error(json.error || 'API エラー');
  }
  return json.data;
}

// ----------------------------------
// Master data
// ----------------------------------

async function loadMasterData() {
  try {
    const data = await callApi('getMasterData', {});
    masterUsers = data.users || [];
    masterTerminals = data.terminals || [];
    renderTerminalQrListIfAdmin();
  } catch (err) {
    console.error(err);
    alert('マスターデータ取得に失敗しました: ' + err.message);
  }
}

// ----------------------------------
// QR Scan
// ----------------------------------

function startQrScan(mode) {
  currentScanMode = mode;
  const readerElemId = 'qr-reader';

  if (html5Qrcode) {
    try { html5Qrcode.stop().catch(() => {}); } catch (e) {}
  }

  html5Qrcode = new Html5Qrcode(readerElemId);
  const config = { fps: 10, qrbox: 250 };

  const onScanSuccess = async (decodedText) => {
    try { await html5Qrcode.stop(); } catch (e) {}
    try { await handleDecodedText(decodedText, mode); } catch (err) {
      alert('QR処理中にエラーが発生しました: ' + err.message);
    }
  };

  html5Qrcode.start({ facingMode: 'environment' }, config, onScanSuccess)
    .catch(err => alert('カメラの起動に失敗しました: ' + err));
}

async function handleDecodedText(decodedText, mode) {
  let payload;
  try {
    payload = JSON.parse(decodedText);
  } catch {
    payload = { type: mode, id: decodedText };
  }

  if (mode === 'user') {
    if (payload.type !== 'user') {
      alert('ユーザーQRではありません。');
      return;
    }
    await loginWithUserId(payload.id);
  } else {
    if (payload.type !== 'terminal') {
      alert('端末QRではありません。');
      return;
    }
    selectTerminalById(payload.id);
  }
}

// ----------------------------------
// Login
// ----------------------------------

async function loginWithUserId(userId) {
  try {
    const user = await callApi('getUser', { userId });
    currentUser = user;

    document.getElementById('current-user-name').textContent = user.name_ja;
    document.getElementById('current-user-id').textContent = user.user_id;
    document.getElementById('current-user-role').textContent = user.role;

    document.getElementById('top-username').textContent = user.name_ja;
    document.getElementById('top-userrole').textContent = user.role;
    document.getElementById('welcome-name').textContent = user.name_ja;

    updateAdminVisibility();
    renderDashboardTable();
    renderTerminalQrListIfAdmin();

    alert('ログインしました: ' + user.name_ja);
  } catch (err) {
    console.error(err);
    alert('ユーザー認証に失敗しました: ' + err.message);
  }
}
async function handleManualLogin() {
  const input = document.getElementById('manual-user-id');
  if (!input) return;
  const userId = input.value.trim();
  if (!userId) {
    alert('ユーザーIDを入力してください。');
    return;
  }
  await loginWithUserId(userId);
}

// ----------------------------------
// Terminal select
// ----------------------------------

function selectTerminalById(terminalId) {
  const t = masterTerminals.find(x => x.terminal_id === terminalId);
  if (t) {
    currentTerminal = t;
  } else {
    currentTerminal = {
      terminal_id: terminalId,
      name_ja: '端末 ' + terminalId,
      process_name: '不明工程',
      location: '不明ロケーション'
    };
  }

  document.getElementById('current-terminal-name').textContent = currentTerminal.name_ja;
  document.getElementById('current-process-name').textContent = currentTerminal.process_name;
  document.getElementById('current-location').textContent = currentTerminal.location;

  alert('端末を選択しました: ' + currentTerminal.terminal_id);
}

// ----------------------------------
// Save Log (start / end)
// ----------------------------------

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
  if (!productCode && !confirm('製品番号が未入力です。空のまま保存しますか？')) return;

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const statusInput = document.getElementById('status-select').value;
  const qtyTotal = Number(document.getElementById('qty-total-input').value || 0);
  const qtyOk = Number(document.getElementById('qty-ok-input').value || 0);
  const qtyNg = Number(document.getElementById('qty-ng-input').value || 0);

  const now = new Date();
  const sessionKey = buildSessionKey(currentUser.user_id, currentTerminal.terminal_id, productCode);
  let sessions = loadActiveSessions();

  if (mode === 'start') {
    sessions[sessionKey] = now.toISOString();
    saveActiveSessions(sessions);
    alert('開始時刻を記録しました。終了時に同じ組み合わせで保存してください。');
    return;
  }

  const startIso = sessions[sessionKey];
  if (!startIso && !confirm('開始時刻が見つかりません。現在時刻を開始として保存しますか？')) {
    return;
  }

  const start = startIso ? new Date(startIso) : now;
  const end = now;
  const durationSec = Math.round((end - start) / 1000);

  const log = {
    product_code: productCode,
    process_name: currentTerminal.process_name,
    terminal_id: currentTerminal.terminal_id,
    terminal_name: currentTerminal.name_ja,
    user_id: currentUser.user_id,
    user_name: currentUser.name_ja,
    role: currentUser.role,
    status: statusInput === '検査保留' ? '検査保留' : '終了',
    qty_total: qtyTotal,
    qty_ok: qtyOk,
    qty_ng: qtyNg,
    timestamp_start: formatDateTime(start),
    timestamp_end: formatDateTime(end),
    duration_sec: durationSec,
    location: currentTerminal.location
  };

  try {
    await callApi('logEvent', { log });
    delete sessions[sessionKey];
    saveActiveSessions(sessions);

    alert('ログを保存しました。');
    clearForm();
    loadDashboard();
    loadAnalytics();
  } catch (err) {
    console.error(err);
    if (!navigator.onLine) {
      enqueueOfflineLog(log);
      alert('オフラインのためキューに保存しました。オンライン復帰後に送信します。');
    } else {
      alert('ログ保存に失敗しました: ' + err.message);
    }
  }
}

// Active session

function buildSessionKey(userId, terminalId, productCode) {
  return `${userId}__${terminalId}__${productCode || ''}`;
}

function loadActiveSessions() {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveActiveSessions(obj) {
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(obj || {}));
}

// Offline queue

function enqueueOfflineLog(log) {
  const q = loadOfflineQueue();
  q.push(log);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

function loadOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function flushOfflineQueue() {
  const q = loadOfflineQueue();
  if (q.length === 0) return;
  const remain = [];
  for (const log of q) {
    try {
      await callApi('logEvent', { log });
    } catch (err) {
      console.error('オフラインキュー送信失敗', err);
      remain.push(log);
    }
  }
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remain));
  if (q.length !== remain.length) {
    loadDashboard();
    loadAnalytics();
  }
}

// ----------------------------------
// Form utils
// ----------------------------------

function clearForm() {
  document.getElementById('product-code-input').value = '';
  document.getElementById('qty-total-input').value = 0;
  document.getElementById('qty-ok-input').value = 0;
  document.getElementById('qty-ng-input').value = 0;
}

function formatDateTime(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function setWelcomeDate() {
  const el = document.getElementById('welcome-date');
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  el.textContent = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

// ----------------------------------
// Dashboard: load & render
// ----------------------------------

async function loadDashboard() {
  try {
    const data = await callApi('getDashboard', { limit: 200 });
    dashboardLogs = data || [];
    renderDashboardTable();
    updateAlertBanner();
  } catch (err) {
    console.error(err);
    alert('ダッシュボード取得に失敗しました: ' + err.message);
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
    if (processFilter && log.process_name !== processFilter && log.status !== processFilter) return false;
    if (terminalFilter) {
      const t = (log.terminal_id + ' ' + log.terminal_name).toLowerCase();
      if (!t.includes(terminalFilter)) return false;
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
    if (log.status === '検査保留') badge.classList.add('badge-hold');
    else if (log.status === '終了' || log.status === '通常') badge.classList.add('badge-normal');
    else badge.classList.add('badge-error');
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

    const tdLoc = document.createElement('td');
    tdLoc.textContent = log.location || '';
    tr.appendChild(tdLoc);

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

function updateAlertBanner() {
  const banner = document.getElementById('alert-banner');
  const hasProblem = dashboardLogs.slice(0, 50).some(l => (l.qty_ng || 0) > 0 || l.status === '検査保留');
  if (hasProblem) banner.classList.remove('hidden');
  else banner.classList.add('hidden');
}

// ----------------------------------
// Log edit / delete
// ----------------------------------

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
    alert('ログ更新に失敗しました: ' + err.message);
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
    alert('ログ削除に失敗しました: ' + err.message);
  }
}

// ----------------------------------
// Export logs CSV (per product)
// ----------------------------------

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
    const pad = n => String(n).padStart(2, '0');
    a.href = url;
    a.download = `logs_${productCode}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert('エクスポートに失敗しました: ' + err.message);
  }
}

// ----------------------------------
// Admin visibility & QR
// ----------------------------------

function updateAdminVisibility() {
  const guard = document.getElementById('admin-guard-message');
  const adminContent = document.getElementById('admin-content');
  const adminLinks = document.querySelectorAll('.admin-only');

  const isAdmin = currentUser && currentUser.role === 'admin';

  if (isAdmin) {
    guard.classList.add('hidden');
    adminContent.classList.remove('hidden');
    adminLinks.forEach(l => l.classList.remove('hidden'));
  } else {
    guard.classList.remove('hidden');
    adminContent.classList.add('hidden');
    adminLinks.forEach(l => l.classList.add('hidden'));
  }
}

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

    loadMasterData();
  } catch (err) {
    console.error(err);
    alert('ユーザー登録に失敗しました: ' + err.message);
  }
}

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

// 端末QR 一覧（印刷用）

function renderTerminalQrListIfAdmin() {
  const listEl = document.getElementById('terminal-qr-list');
  const guardEl = document.getElementById('terminalqr-guard');
  if (!listEl || !guardEl) return;

  const isAdmin = currentUser && currentUser.role === 'admin';
  if (!isAdmin) {
    listEl.classList.add('hidden');
    guardEl.classList.remove('hidden');
    return;
  }

  guardEl.classList.add('hidden');
  listEl.classList.remove('hidden');
  listEl.innerHTML = '';

  masterTerminals.forEach(t => {
    const card = document.createElement('div');
    card.className = 'terminalqr-card';
    const qrDiv = document.createElement('div');
    const qrData = t.qr_value || JSON.stringify({ type: 'terminal', id: t.terminal_id });

    new QRCode(qrDiv, { text: qrData, width: 120, height: 120 });

    card.innerHTML = `
      <h4>${t.name_ja || ''}</h4>
      <div style="font-size:0.75rem;color:#6b7280;">工程: ${t.process_name || ''}</div>
      <div style="font-size:0.75rem;color:#6b7280;">ID: ${t.terminal_id || ''}</div>
    `;
    card.appendChild(qrDiv);
    listEl.appendChild(card);
  });
}

// ----------------------------------
// Analytics (Chart + summary)
// ----------------------------------

async function loadAnalytics() {
  try {
    const data = await callApi('getAnalytics', {});
    const today = data.today || { total: 0, ng: 0 };
    const byProcess = data.byProcess || [];
    const counts = data.counts || { terminals: 0, plans: 0 };

    document.getElementById('today-total').textContent = today.total;
    document.getElementById('today-ng').textContent = today.ng;
    document.getElementById('summary-terminals').textContent = counts.terminals;
    document.getElementById('summary-plans').textContent = counts.plans;

    const labels = byProcess.map(x => x.process_name || '不明');
    const totals = byProcess.map(x => x.total || 0);

    const ctx = document.getElementById('process-chart');
    if (!ctx) return;
    if (processChart) processChart.destroy();

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
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
        animation: false
      }
    });
  } catch (err) {
    console.error(err);
  }
}

// ----------------------------------
// Plans (生産計画)
// ----------------------------------

async function loadPlans() {
  try {
    const data = await callApi('getPlans', {});
    plans = data || [];
    renderPlanTable();
  } catch (err) {
    console.error(err);
    alert('生産計画の取得に失敗しました: ' + err.message);
  }
}

function renderPlanTable() {
  const tbody = document.getElementById('plans-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  plans.forEach(plan => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${plan.product_code || ''}</td>
      <td>${plan.product_name || ''}</td>
      <td>${plan.process_name || ''}</td>
      <td>${plan.planned_qty || 0}</td>
      <td>${plan.planned_start || ''}</td>
      <td>${plan.planned_end || ''}</td>
      <td>${plan.status || ''}</td>
    `;

    const tdActions = document.createElement('td');
    const detailBtn = document.createElement('button');
    detailBtn.textContent = '詳細';
    detailBtn.className = 'ghost-button';
    detailBtn.style.fontSize = '0.7rem';
    detailBtn.addEventListener('click', () => showPlanDetail(plan));

    const exportBtn = document.createElement('button');
    exportBtn.textContent = '実績CSV';
    exportBtn.className = 'ghost-button';
    exportBtn.style.fontSize = '0.7rem';
    exportBtn.style.marginLeft = '4px';
    exportBtn.addEventListener('click', () => exportLogsForProduct(plan.product_code));

    tdActions.appendChild(detailBtn);
    tdActions.appendChild(exportBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

async function showPlanDetail(plan) {
  // 簡易版: ダッシュボードログから同じ製品番号をフィルタしてalertで表示
  const related = dashboardLogs.filter(l => l.product_code === plan.product_code);
  let msg = `【計画情報】\n製品番号: ${plan.product_code}\n製品名: ${plan.product_name}\n工程: ${plan.process_name}\n計画数量: ${plan.planned_qty}\n計画期間: ${plan.planned_start} ～ ${plan.planned_end}\nステータス: ${plan.status}\n\n【実績一覧】\n`;
  if (related.length === 0) {
    msg += '実績はまだありません。';
  } else {
    related.slice(0, 20).forEach(l => {
      msg += `- ${l.timestamp_end || l.timestamp_start} 端末:${l.terminal_name} 数量:${l.qty_total} (NG:${l.qty_ng})\n`;
    });
    if (related.length > 20) msg += `... ほか ${related.length - 20} 件\n`;
  }
  alert(msg);
}

async function exportLogsForProduct(productCode) {
  if (!productCode) return;
  const fakeEvent = { preventDefault: () => {} };
  await handleExportProductForCode(productCode);
}

async function handleExportProductForCode(productCode) {
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
    const pad = n => String(n).padStart(2, '0');
    a.href = url;
    a.download = `logs_${productCode}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert('エクスポートに失敗しました: ' + err.message);
  }
}

async function handleSavePlan() {
  const product_code = document.getElementById('plan-product-code').value.trim();
  const product_name = document.getElementById('plan-product-name').value.trim();
  const process_name = document.getElementById('plan-process').value;
  const planned_qty = Number(document.getElementById('plan-qty').value || 0);
  const planned_start = document.getElementById('plan-start').value;
  const planned_end = document.getElementById('plan-end').value;
  const status = document.getElementById('plan-status').value;

  if (!product_code) {
    alert('製品番号を入力してください。');
    return;
  }

  const plan = { product_code, product_name, process_name, planned_qty, planned_start, planned_end, status };

  try {
    await callApi('upsertPlan', { plan });
    alert('生産計画を保存しました。');
    clearPlanForm();
    loadPlans();
    loadAnalytics();
  } catch (err) {
    console.error(err);
    alert('生産計画の保存に失敗しました: ' + err.message);
  }
}

function clearPlanForm() {
  document.getElementById('plan-product-code').value = '';
  document.getElementById('plan-product-name').value = '';
  document.getElementById('plan-qty').value = 0;
  document.getElementById('plan-start').value = '';
  document.getElementById('plan-end').value = '';
}

async function handleImportPlans() {
  const text = document.getElementById('plan-import-text').value.trim();
  if (!text) {
    alert('CSVテキストを貼り付けてください。');
    return;
  }
  try {
    const data = await callApi('importPlansCsv', { csvText: text });
    alert(`インポートしました: ${data.imported} 件`);
    document.getElementById('plan-import-text').value = '';
    loadPlans();
    loadAnalytics();
  } catch (err) {
    console.error(err);
    alert('インポートに失敗しました: ' + err.message);
  }
}
