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
let currentPlanForScan = null; // ★ 生産計画から選択中のplan
let processChart = null;

// localStorage keys
const ACTIVE_SESSION_KEY = 'active_sessions_v1';
const OFFLINE_QUEUE_KEY = 'offline_log_queue_v1';

function setGlobalLoading(isLoading, text) {
  const el = document.getElementById('global-loading');
  const t = document.getElementById('loading-text');
  if (!el) return;
  if (isLoading) {
    if (t && text) t.textContent = text;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

let toastTimer = null;
function showToast(message, type = 'info') {
  const el = document.getElementById('global-toast');
  if (!el) return;

  el.textContent = message;
  el.className = 'toast';
  if (type === 'success') el.classList.add('toast-success');
  else if (type === 'error') el.classList.add('toast-error');
  else el.classList.add('toast-info');

  el.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('hidden');
  }, 3000);
}

let dashboardAutoTimer = null;

function startDashboardAutoRefresh() {
  if (dashboardAutoTimer) clearInterval(dashboardAutoTimer);

  dashboardAutoTimer = setInterval(() => {
    const dashSection = document.getElementById('dashboard-section');
    if (dashSection && dashSection.classList.contains('active')) {
      loadDashboard();
      loadAnalytics();
    }
  }, 60000);
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRoleLabel(role) {
  if (role === 'admin') return '管理者';
  if (role === 'qc') return 'QC';
  if (role === 'operator') return 'オペレーター';
  return role || '';
}

function getQrImageData(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const img = container.querySelector('img');
  const canvas = container.querySelector('canvas');
  if (img && img.src) return img.src;
  if (canvas && canvas.toDataURL) return canvas.toDataURL('image/png');
  return null;
}

function downloadQrLabel(containerId, filename) {
  const dataUrl = getQrImageData(containerId);
  if (!dataUrl) {
    showToast('QRコードが見つかりません。', 'error');
    return;
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename || 'qr.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function printQrLabel(containerId, titleText, subtitleText) {
  const dataUrl = getQrImageData(containerId);
  if (!dataUrl) {
    showToast('QRコードが見つかりません。', 'error');
    return;
  }
  const win = window.open('', '_blank', 'width=400,height=400');
  if (!win) {
    showToast('ポップアップがブロックされています。', 'error');
    return;
  }
  win.document.write(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>QRラベル</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 16px; }
          .label-wrap { text-align: center; }
          img { width: 140px; height: 140px; }
          .title { margin-top: 8px; font-size: 14px; font-weight: 600; }
          .sub { font-size: 12px; color: #4b5563; }
        </style>
      </head>
      <body>
        <div class="label-wrap">
          <img src="${dataUrl}">
          <div class="title">${titleText || ''}</div>
          <div class="sub">${subtitleText || ''}</div>
        </div>
        <script>window.print();<\/script>
      </body>
    </html>
  `);
  win.document.close();
}

/* ================================
   Admin User List
   ================================ */

function renderAdminUserList() {
  const tbody = document.getElementById('admin-user-list-tbody');
  if (!tbody || !masterUsers || !currentUser || currentUser.role !== 'admin') return;

  tbody.innerHTML = '';

  masterUsers.forEach(user => {
    const tr = document.createElement('tr');
    const qrId = `admin-user-qr-${user.user_id}`;

    tr.innerHTML = `
      <td><div class="qr-mini" id="${qrId}"></div></td>
      <td>${escapeHtml(user.user_id)}</td>
      <td>${escapeHtml(user.name_ja || user.name || '')}</td>
      <td>${escapeHtml(getRoleLabel(user.role))}</td>
      <td>
        <div class="list-action-buttons">
          <button type="button" class="mini-btn mini-btn-edit" data-id="${user.user_id}">編集</button>
          <button type="button" class="mini-btn mini-btn-print" data-id="${user.user_id}">印刷</button>
          <button type="button" class="mini-btn mini-btn-dl" data-id="${user.user_id}">DL</button>
          <button type="button" class="mini-btn mini-btn-del" data-id="${user.user_id}">削除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // QR code
    const container = document.getElementById(qrId);
    if (container) {
      container.innerHTML = '';
      new QRCode(container, {
        text: user.user_id,
        width: 64,
        height: 64
      });
    }
  });

  // ★ 編集ボタン: form di atas otomatis terisi + scroll + highlight
  tbody.querySelectorAll('.mini-btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const user = masterUsers.find(u => u.user_id === id);
      if (!user) return;

      const idInput    = document.getElementById('admin-user-id');
      const nameInput  = document.getElementById('admin-user-name');
      const roleSelect = document.getElementById('admin-user-role');

      if (idInput)  idInput.value  = user.user_id;
      if (nameInput) nameInput.value = user.name_ja || user.name || '';
      if (roleSelect && user.role) roleSelect.value = user.role;

      // highlight sekali supaya kelihatan berubah
      [idInput, nameInput, roleSelect].forEach(el => {
        if (!el) return;
        el.classList.add('highlight-once');
        setTimeout(() => el.classList.remove('highlight-once'), 1200);
      });

      // scroll ke card form user
      const adminUserCard = document.querySelector('#admin-section .admin-section');
      if (adminUserCard) {
        adminUserCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      showToast('ユーザー情報を編集フォームに読み込みました。上のフォームを修正して「ユーザー登録」を押してください。', 'info');
    });
  });

  // 印刷
  tbody.querySelectorAll('.mini-btn-print').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const user = masterUsers.find(u => u.user_id === id);
      if (!user) return;
      const qrId = `admin-user-qr-${id}`;
      const title = `ID: ${user.user_id}`;
      const sub = `${user.name_ja || user.name || ''} / ${getRoleLabel(user.role)}`;
      printQrLabel(qrId, title, sub);
    });
  });

  // DL
  tbody.querySelectorAll('.mini-btn-dl').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const qrId = `admin-user-qr-${id}`;
      downloadQrLabel(qrId, `USER_${id}.png`);
    });
  });

  // 削除
  tbody.querySelectorAll('.mini-btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const user = masterUsers.find(u => u.user_id === id);
      if (!user) return;

      if (!confirm(`ユーザー「${user.name_ja || user.name || id}」を削除しますか？`)) return;

      try {
        await callApi('deleteUser', { userId: id });
        showToast('ユーザーを削除しました。', 'success');
        loadMasterData();
      } catch (err) {
        console.error(err);
        showToast('ユーザー削除に失敗しました: ' + err.message, 'error');
      }
    });
  });
}

/* ================================
   Admin Terminal List
   ================================ */

function renderAdminTerminalList() {
  const tbody = document.getElementById('admin-terminal-list-tbody');
  if (!tbody || !masterTerminals || !currentUser || currentUser.role !== 'admin') return;

  tbody.innerHTML = '';

  masterTerminals.forEach(t => {
    const tr = document.createElement('tr');
    const qrId = `admin-terminal-qr-${t.terminal_id}`;

    tr.innerHTML = `
      <td><div class="qr-mini" id="${qrId}"></div></td>
      <td>${escapeHtml(t.terminal_id)}</td>
      <td>${escapeHtml(t.name_ja || t.name || '')}</td>
      <td>${escapeHtml(t.process_name || '')}</td>
      <td>${escapeHtml(t.location || '')}</td>
      <td>
        <div class="list-action-buttons">
          <button class="mini-btn mini-btn-edit" data-id="${t.terminal_id}">編集</button>
          <button class="mini-btn mini-btn-print" data-id="${t.terminal_id}">印刷</button>
          <button class="mini-btn mini-btn-dl" data-id="${t.terminal_id}">DL</button>
          <button class="mini-btn mini-btn-del" data-id="${t.terminal_id}">削除</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);

    const container = document.getElementById(qrId);
    if (container) {
      container.innerHTML = '';
      new QRCode(container, {
        text: t.terminal_id,
        width: 64,
        height: 64
      });
    }
  });

  // 編集
tbody.querySelectorAll('.mini-btn-edit').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    const t = masterTerminals.find(x => x.terminal_id === id);
    if (!t) return;

    // Isi form di Admin: 工程登録
    const idInput = document.getElementById('admin-terminal-id');
    const nameInput = document.getElementById('admin-terminal-name');
    const processSelect = document.getElementById('admin-terminal-process');
    const locInput = document.getElementById('admin-terminal-location');

    if (idInput) idInput.value = t.terminal_id;
    if (nameInput) nameInput.value = t.name_ja || t.name || '';
    if (processSelect && t.process_name) processSelect.value = t.process_name;
    if (locInput) locInput.value = t.location || '';

    // Pindah section ke Admin（ユーザー / 工程登録）
    const targetSectionId = 'admin-section';
    const links = document.querySelectorAll('.sidebar-link');
    const sections = document.querySelectorAll('.section');

    links.forEach(l => {
      l.classList.toggle('active', l.dataset.section === targetSectionId);
    });
    sections.forEach(sec => {
      sec.classList.toggle('active', sec.id === targetSectionId);
    });

    // Scroll ke area form supaya langsung terlihat
    const adminSection = document.getElementById('admin-section');
    if (adminSection) {
      adminSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    showToast('工程情報を編集フォームに読み込みました。', 'info');
  });
});


  // 印刷
  tbody.querySelectorAll('.mini-btn-print').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const t = masterTerminals.find(x => x.terminal_id === id);
      if (!t) return;
      const qrId = `admin-terminal-qr-${id}`;
      const title = t.process_name || '';
      const sub = `ID: ${t.terminal_id} / ${t.name_ja || t.name || ''}`;
      printQrLabel(qrId, title, sub);
    });
  });

  // ダウンロード
  tbody.querySelectorAll('.mini-btn-dl').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const qrId = `admin-terminal-qr-${id}`;
      downloadQrLabel(qrId, `PROC_${id}.png`);
    });
  });

  // 削除
  tbody.querySelectorAll('.mini-btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const t = masterTerminals.find(x => x.terminal_id === id);
      if (!t) return;

      if (!confirm(`工程「${t.name_ja || id}」を削除しますか？`)) return;

      try {
        await callApi('deleteTerminal', { terminalId: id });
        showToast('工程を削除しました。', 'success');
        loadMasterData();
      } catch (err) {
        console.error(err);
        showToast('工程削除に失敗しました: ' + err.message, 'error');
      }
    });
  });
}

/* ================================
   初期化
   ================================ */

document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();
  setupButtons();
  setupOnlineOfflineHandlers();
  setWelcomeDate();

  loadMasterData();
  loadDashboard();
  loadAnalytics();
  startDashboardAutoRefresh();
  loadPlans();
});

/* ================================
   Sidebar navigation
   ================================ */

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

      if (window.innerWidth <= 800 && sidebar) {
        sidebar.classList.add('sidebar-hidden');
      }
    });
  });

  if (burger && sidebar) {
    burger.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-hidden');
    });

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

/* ================================
   ボタンイベント
   ================================ */

function setupButtons() {
  // ユーザーQRスキャン
  const btnUserScan = document.getElementById('btn-start-user-scan');
  if (btnUserScan) {
    btnUserScan.addEventListener('click', () => startQrScan('user'));
  }

  // 工程QRスキャン
  const btnTerminalScan = document.getElementById('btn-start-terminal-scan');
  if (btnTerminalScan) {
    btnTerminalScan.addEventListener('click', () => startQrScan('terminal'));
  }

  // 手動ログイン（ボタン）
  const manualBtn = document.getElementById('btn-manual-login');
  const manualInput = document.getElementById('manual-user-id');
  if (manualBtn) {
    manualBtn.addEventListener('click', handleManualLogin);
  }
  // 手動ログイン（Enter）
  if (manualInput) {
    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleManualLogin();
      }
    });
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // ユーザーメニュー開閉
  const userMenuToggle = document.getElementById('user-menu-toggle');
  const userMenuPanel = document.getElementById('user-menu-panel');
  if (userMenuToggle && userMenuPanel) {
    userMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenuPanel.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!userMenuPanel.contains(e.target) && !userMenuToggle.contains(e.target)) {
        userMenuPanel.classList.add('hidden');
      }
    });
  }

  // ヘルプモーダル
  const helpBtn = document.getElementById('btn-help');
  const helpClose = document.getElementById('btn-help-close');
  if (helpBtn && helpClose) {
    helpBtn.addEventListener('click', openHelpModal);
    helpClose.addEventListener('click', closeHelpModal);
  }
  // Monitor mode (digital signage)
  const monitorBtn = document.getElementById('btn-monitor-mode');
  if (monitorBtn) {
    monitorBtn.addEventListener('click', () => {
      const body = document.body;
      const isMonitor = !body.classList.contains('monitor-mode');
      body.classList.toggle('monitor-mode', isMonitor);

      // Paksa aktifkan dashboard section
      if (isMonitor) {
        const links = document.querySelectorAll('.sidebar-link');
        const sections = document.querySelectorAll('.section');

        sections.forEach(sec => sec.classList.toggle('active', sec.id === 'dashboard-section'));
        links.forEach(l => l.classList.toggle('active', l.dataset.section === 'dashboard-section'));

        showToast('モニタ表示モードをONにしました。', 'info');
      } else {
        showToast('モニタ表示モードをOFFにしました。', 'info');
      }
    });
  }

  // ヘッダー製品検索
  const headerSearchBtn = document.getElementById('btn-header-search');
  const headerSearchInput = document.getElementById('header-product-search');
  if (headerSearchBtn && headerSearchInput) {
    headerSearchBtn.addEventListener('click', handleHeaderSearch);
    headerSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleHeaderSearch();
      }
    });
  }

  // スキャン画面 保存 / クリア
  const btnSaveLog = document.getElementById('btn-save-log');
  if (btnSaveLog) btnSaveLog.addEventListener('click', handleSaveLog);

  const btnClearForm = document.getElementById('btn-clear-form');
  if (btnClearForm) btnClearForm.addEventListener('click', clearForm);

  // OK/NG → 総数量自動計算
  const qtyOkInput = document.getElementById('log-qty-ok');
  const qtyNgInput = document.getElementById('log-qty-ng');
  if (qtyOkInput && qtyNgInput) {
    const updateTotal = () => {
      const ok = Number(qtyOkInput.value || 0);
      const ng = Number(qtyNgInput.value || 0);
      const totalEl = document.getElementById('log-qty-total');
      if (totalEl) totalEl.value = ok + ng;
    };
    qtyOkInput.addEventListener('input', updateTotal);
    qtyNgInput.addEventListener('input', updateTotal);
  }

  // ダッシュボード更新 / エクスポート
  const btnRefreshDashboard = document.getElementById('btn-refresh-dashboard');
  if (btnRefreshDashboard) {
    btnRefreshDashboard.addEventListener('click', () => {
      loadDashboard();
      loadAnalytics();
    });
  }

  const btnExportProduct = document.getElementById('btn-export-product');
  if (btnExportProduct) btnExportProduct.addEventListener('click', handleExportProduct);

  // ログ編集モーダル
  const btnEditSave = document.getElementById('btn-edit-save');
  if (btnEditSave) btnEditSave.addEventListener('click', handleEditSave);

  const btnEditCancel = document.getElementById('btn-edit-cancel');
  if (btnEditCancel) btnEditCancel.addEventListener('click', closeEditModal);

  // Admin: ユーザー / 工程登録
  const btnCreateUser = document.getElementById('btn-admin-create-user');
  if (btnCreateUser) btnCreateUser.addEventListener('click', handleCreateUser);

  const btnCreateTerminal = document.getElementById('btn-admin-create-terminal');
  if (btnCreateTerminal) btnCreateTerminal.addEventListener('click', handleCreateTerminal);

  // 生産計画
  const btnSavePlan = document.getElementById('btn-save-plan');
  if (btnSavePlan) btnSavePlan.addEventListener('click', handleSavePlan);

  const btnClearPlan = document.getElementById('btn-clear-plan');
  if (btnClearPlan) btnClearPlan.addEventListener('click', clearPlanForm);

  const btnRefreshPlans = document.getElementById('btn-refresh-plans');
  if (btnRefreshPlans) btnRefreshPlans.addEventListener('click', loadPlans);

  const btnImportPlans = document.getElementById('btn-import-plans');
  if (btnImportPlans) btnImportPlans.addEventListener('click', handleImportPlans);
}

/* ================================
   Online / Offline Indicator
   ================================ */

function setupOnlineOfflineHandlers() {
  const offlineIndicator = document.getElementById('offline-indicator');

  function updateState() {
    if (!offlineIndicator) return;
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

/* ================================
   Utils: API
   ================================ */

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

/* ================================
   Master data
   ================================ */

async function loadMasterData() {
  try {
    const data = await callApi('getMasterData', {});
    masterUsers = data.users || [];
    masterTerminals = data.terminals || [];
    renderTerminalQrListIfAdmin();
    renderAdminUserList();
    renderAdminTerminalList();
  } catch (err) {
    console.error(err);
    alert('マスターデータ取得に失敗しました: ' + err.message);
  }
}

/* ================================
   QR Scan
   ================================ */

function startQrScan(mode) {
  currentScanMode = mode;
  const readerElemId = mode === 'user' ? 'qr-reader' : 'qr-reader-terminal';

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

/* ================================
   Login
   ================================ */

async function loginWithUserId(userId) {
  try {
    setGlobalLoading(true, 'ユーザー認証中...');
    const user = await callApi('getUser', { userId });
    currentUser = user;

    const nameEl = document.getElementById('current-user-name');
    const idEl = document.getElementById('current-user-id');
    const roleEl = document.getElementById('current-user-role');

    if (nameEl) nameEl.textContent = user.name_ja;
    if (idEl) idEl.textContent = user.user_id;
    if (roleEl) roleEl.textContent = user.role;

    document.getElementById('top-username').textContent = user.name_ja;
    document.getElementById('top-userrole').textContent = getRoleLabel(user.role);
    document.getElementById('welcome-name').textContent = user.name_ja;

    updateAdminVisibility();
    renderDashboardTable();
    renderTerminalQrListIfAdmin();
    renderPlanTable();

    const userMenuPanel = document.getElementById('user-menu-panel');
    if (userMenuPanel) userMenuPanel.classList.add('hidden');

    showToast('ログインしました: ' + user.name_ja, 'success');
  } catch (err) {
    console.error(err);
    showToast('ユーザー認証に失敗しました: ' + err.message, 'error');
  } finally {
    setGlobalLoading(false);
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

function handleLogout() {
  currentUser = null;

  const nameEl = document.getElementById('current-user-name');
  const idEl = document.getElementById('current-user-id');
  const roleEl = document.getElementById('current-user-role');
  const topNameEl = document.getElementById('top-username');
  const topRoleEl = document.getElementById('top-userrole');
  const welcomeNameEl = document.getElementById('welcome-name');

  if (nameEl) nameEl.textContent = '未ログイン';
  if (idEl) idEl.textContent = '-';
  if (roleEl) roleEl.textContent = '-';
  if (topNameEl) topNameEl.textContent = 'ゲスト';
  if (topRoleEl) topRoleEl.textContent = '未ログイン';
  if (welcomeNameEl) welcomeNameEl.textContent = 'ゲスト';

  currentPlanForScan = null;

  updateAdminVisibility();
  renderTerminalQrListIfAdmin();
  renderPlanTable();

  const userMenuPanel = document.getElementById('user-menu-panel');
  if (userMenuPanel) userMenuPanel.classList.add('hidden');

  showToast('ログアウトしました。', 'info');
}

function handleHeaderSearch() {
  const input = document.getElementById('header-product-search');
  if (!input) return;
  const value = input.value.trim();
  if (!value) {
    alert('製品番号を入力してください。');
    return;
  }

  const productFilter = document.getElementById('filter-product');
  if (productFilter) {
    productFilter.value = value;
  }

  const links = document.querySelectorAll('.sidebar-link');
  const sections = document.querySelectorAll('.section');
  sections.forEach(sec => sec.classList.toggle('active', sec.id === 'dashboard-section'));
  links.forEach(l => l.classList.toggle('active', l.dataset.section === 'dashboard-section'));

  if (!dashboardLogs || dashboardLogs.length === 0) {
    loadDashboard().then(() => renderDashboardTable());
  } else {
    renderDashboardTable();
  }
}

/* ================================
   Terminal select
   ================================ */

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

  const nameEl = document.getElementById('current-terminal-name');
  const idEl = document.getElementById('current-terminal-id');
  const processEl = document.getElementById('current-process-name');
  const locEl = document.getElementById('current-location');

  if (nameEl) nameEl.textContent = currentTerminal.name_ja;
  if (idEl) idEl.textContent = currentTerminal.terminal_id;
  if (processEl) processEl.textContent = currentTerminal.process_name;
  if (locEl) locEl.textContent = currentTerminal.location;

  showToast('端末を選択しました: ' + currentTerminal.terminal_id, 'info');
}

/* ================================
   Save Log (Plan + Terminal + User)
   ================================ */

async function handleSaveLog() {
  if (!currentUser) {
    alert('まず右上メニューからユーザー認証を行ってください。');
    return;
  }
  if (!currentTerminal) {
    alert('工程QRをスキャンして工程を選択してください。');
    return;
  }
  if (!currentPlanForScan) {
    alert('「生産一覧」から対象の生産計画を選び、「スキャン/更新」を押してください。');
    return;
  }

  const status = document.getElementById('log-status').value;
  const okInput = document.getElementById('log-qty-ok');
  const ngInput = document.getElementById('log-qty-ng');
  const totalInput = document.getElementById('log-qty-total');
  const lotInput = document.getElementById('log-lot-number');
  const noteInput = document.getElementById('log-note');

  const qtyOk = Number(okInput.value || 0);
  const qtyNg = Number(ngInput.value || 0);
  const qtyTotal = qtyOk + qtyNg;
  if (totalInput) totalInput.value = qtyTotal;

  [okInput, ngInput, totalInput].forEach(el => el && el.classList.remove('required-missing'));

  const missing = [];
  if (status === '工程終了' && qtyTotal <= 0) {
    missing.push(totalInput);
  }

  if (missing.length > 0) {
    missing.forEach(el => el && el.classList.add('required-missing'));
    showToast('必須項目を入力してください。', 'error');
    return;
  }

  const productCode = currentPlanForScan.product_code || '';
  const productName = currentPlanForScan.product_name || '';
  const planProcessName = currentPlanForScan.process_name || '';

  const now = new Date();
  const sessionKey = buildSessionKey(currentUser.user_id, currentTerminal.terminal_id, productCode);
  let sessions = loadActiveSessions();

  if (status === '工程開始') {
    sessions[sessionKey] = now.toISOString();
    saveActiveSessions(sessions);
    showToast('工程開始を記録しました。終了時に同じ計画と工程で保存してください。', 'info');
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
    product_name: productName,
    lot_number: lotInput ? lotInput.value.trim() : '',
    plan_process_name: planProcessName,
    process_name: currentTerminal.process_name,
    terminal_id: currentTerminal.terminal_id,
    terminal_name: currentTerminal.name_ja,
    user_id: currentUser.user_id,
    user_name: currentUser.name_ja,
    role: currentUser.role,
    status: status,
    qty_total: qtyTotal,
    qty_ok: qtyOk,
    qty_ng: qtyNg,
    note: noteInput ? noteInput.value.trim() : '',
    timestamp_start: formatDateTime(start),
    timestamp_end: formatDateTime(end),
    duration_sec: durationSec,
    location: currentTerminal.location
  };

  try {
    setGlobalLoading(true, '実績を保存中...');
    await callApi('logEvent', { log });
    delete sessions[sessionKey];
    saveActiveSessions(sessions);

    showToast('ログを保存しました。', 'success');
    clearForm();
    loadDashboard();
    loadAnalytics();
  } catch (err) {
    console.error(err);
    if (!navigator.onLine) {
      enqueueOfflineLog(log);
      showToast('オフラインのためキューに保存しました。オンライン復帰後に自動送信します。', 'info');
    } else {
      showToast('ログ保存に失敗しました: ' + err.message, 'error');
    }
  } finally {
    setGlobalLoading(false);
  }
}

/* ================================
   Active session (durasi)
   ================================ */

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

/* ================================
   Offline queue
   ================================ */

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

/* ================================
   Form utils
   ================================ */

function clearForm() {
  const okInput = document.getElementById('log-qty-ok');
  const ngInput = document.getElementById('log-qty-ng');
  const totalInput = document.getElementById('log-qty-total');
  const noteInput = document.getElementById('log-note');
  const lotInput = document.getElementById('log-lot-number');

  if (okInput) okInput.value = 0;
  if (ngInput) ngInput.value = 0;
  if (totalInput) totalInput.value = 0;
  if (noteInput) noteInput.value = '';
  if (lotInput) lotInput.value = '';
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

/* ================================
   Dashboard: load & render
   ================================ */

async function loadDashboard() {
  try {
    const data = await callApi('getDashboard', { limit: 200 });
    dashboardLogs = data || [];
    renderDashboardTable();
    updateAlertBanner();
    renderPlanTable(); // 計画一覧の実績/計画も更新
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

  // 1) ベース: 実績ログ
  const rows = dashboardLogs.map(l => Object.assign({ is_plan_only: false }, l));

  // 2) 実績がまだ1件もない「未完了の計画」を 予定 として追加
  if (Array.isArray(plans) && plans.length > 0) {
    plans.forEach(plan => {
      const related = dashboardLogs.filter(l =>
        l.product_code === plan.product_code &&
        (!plan.process_name || l.process_name === plan.process_name)
      );
      const actualTotal = related.reduce((sum, l) => sum + (l.qty_total || 0), 0);
      const planQty = plan.planned_qty || 0;
      const rate = planQty > 0 ? Math.round((actualTotal * 100) / planQty) : 0;

      const isCompleted =
        plan.status === '完了' ||
        plan.status === '中止' ||
        rate >= 100;

      // 完了・中止・100%以上 → ダッシュボードからは除外（生産一覧には残す）
      if (isCompleted) return;

      // 実績が1件も無い計画だけ 予定行 として追加
      if (related.length === 0) {
        rows.push({
          is_plan_only: true,
          plan_id: plan.plan_id,
          product_code: plan.product_code,
          product_name: plan.product_name,
          process_name: plan.process_name,
          planned_start: plan.planned_start,
          planned_end: plan.planned_end,
          plan_qty: planQty,
          status: plan.status || '計画中',
          terminal_id: '',
          terminal_name: '',
          user_id: '',
          user_name: '',
          role: '',
          qty_total: 0,
          qty_ok: 0,
          qty_ng: 0,
          timestamp_start: plan.planned_start || '',
          timestamp_end: '',
          duration_sec: null,
          location: '',
          created_at: plan.created_at || ''
        });
      }
    });
  }

  // helper: ベースとなる日時
  function getBaseDate(log) {
    const s = log.timestamp_end || log.timestamp_start || log.planned_start || log.created_at || '';
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // 3) フィルター適用
  const filtered = rows.filter(log => {
    if (processFilter && log.process_name !== processFilter && log.status !== processFilter) return false;

    if (terminalFilter) {
      const t = ((log.terminal_id || '') + ' ' + (log.terminal_name || '')).toLowerCase();
      if (!t.includes(terminalFilter)) return false;
    }

    if (productFilter) {
      const pc = String(log.product_code || '').toLowerCase();
      if (!pc.includes(productFilter)) return false;
    }

    if (dateFrom) {
      const d = getBaseDate(log);
      if (d && d < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const d = getBaseDate(log);
      if (d) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        if (d >= to) return false;
      }
    }
    return true;
  });

  // 4) 日付の新しい順（降順）
  filtered.sort((a, b) => {
    const da = getBaseDate(a);
    const db = getBaseDate(b);
    const ta = da ? da.getTime() : 0;
    const tb = db ? db.getTime() : 0;
    return tb - ta;
  });

  // 5) レンダリング
  filtered.forEach(log => {
    const tr = document.createElement('tr');
    const isPlan = !!log.is_plan_only;
    const durationMin = (!isPlan && log.duration_sec)
      ? (log.duration_sec / 60).toFixed(1)
      : '';

    // ステータスバッジ
    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.classList.add('badge');
    if (isPlan) {
      badge.classList.add('badge-plan');
    } else if (log.status === '検査保留') {
      badge.classList.add('badge-hold');
    } else if (log.status === '終了' || log.status === '通常' || log.status === '工程終了') {
      badge.classList.add('badge-normal');
    } else {
      badge.classList.add('badge-error');
    }
    badge.textContent = isPlan ? (log.status || '計画中') : (log.status || '-');
    statusCell.appendChild(badge);

    const timeText = log.timestamp_end || log.timestamp_start || log.planned_start || '';
    const terminalText = isPlan
      ? '-'
      : ((log.terminal_name || '') + (log.terminal_id ? ' (' + log.terminal_id + ')' : ''));
    const userText = isPlan ? '-' : (log.user_name || '');
    const qtyText = isPlan
      ? `- / ${log.plan_qty || 0}`
      : `${log.qty_total || 0} (${log.qty_ok || 0} / ${log.qty_ng || 0})`;

    tr.innerHTML = `
      <td>${timeText}</td>
      <td>${log.product_code || ''}</td>
      <td>${log.process_name || ''}</td>
      <td>${terminalText}</td>
      <td>${userText}</td>
      <td>${qtyText}</td>
    `;
    tr.appendChild(statusCell);

    const tdDuration = document.createElement('td');
    tdDuration.textContent = durationMin || '';
    tr.appendChild(tdDuration);

    const tdLoc = document.createElement('td');
    tdLoc.textContent = log.location || '';
    tr.appendChild(tdLoc);

    // 操作列
    const tdActions = document.createElement('td');

    if (isPlan) {
      // 予定行 → 詳細 / 実績CSV / スキャン/更新
      const planLike = {
        plan_id: log.plan_id,
        product_code: log.product_code,
        product_name: log.product_name,
        process_name: log.process_name,
        planned_qty: log.plan_qty,
        planned_start: log.planned_start,
        planned_end: log.planned_end,
        status: log.status
      };

      const detailBtn = document.createElement('button');
      detailBtn.textContent = '詳細';
      detailBtn.className = 'ghost-button';
      detailBtn.style.fontSize = '0.7rem';
      detailBtn.addEventListener('click', () => showPlanDetail(planLike));

      const exportBtn = document.createElement('button');
      exportBtn.textContent = '実績CSV';
      exportBtn.className = 'ghost-button';
      exportBtn.style.fontSize = '0.7rem';
      exportBtn.style.marginLeft = '4px';
      exportBtn.addEventListener('click', () => exportLogsForProduct(planLike.product_code));

      const scanBtn = document.createElement('button');
      scanBtn.textContent = 'スキャン/更新';
      scanBtn.className = 'ghost-button';
      scanBtn.style.fontSize = '0.7rem';
      scanBtn.style.marginLeft = '4px';
      scanBtn.addEventListener('click', () => startScanForPlan(planLike));

      tdActions.appendChild(detailBtn);
      tdActions.appendChild(exportBtn);
      tdActions.appendChild(scanBtn);
    } else {
      // 実績ログ行 → 既存の 編集 / 削除（管理者のみ）
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
    }

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}



function updateAlertBanner() {
  const banner = document.getElementById('alert-banner');
  if (!banner) return;
  const hasProblem = dashboardLogs.slice(0, 50).some(l => (l.qty_ng || 0) > 0 || l.status === '検査保留');
  if (hasProblem) banner.classList.remove('hidden');
  else banner.classList.add('hidden');
}

/* ================================
   Log edit / delete
   ================================ */

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

function openHelpModal() {
  const modal = document.getElementById('help-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeHelpModal() {
  const modal = document.getElementById('help-modal');
  if (modal) modal.classList.add('hidden');
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
async function handleDeletePlan(planLike) {
  if (!planLike.plan_id) {
    alert('この生産計画にはIDがありません。');
    return;
  }
  if (!confirm('この生産計画を削除しますか？')) return;
  try {
    await callApi('deletePlan', { planId: planLike.plan_id });
    alert('生産計画を削除しました。');
    // 計画とダッシュボードを再取得
    loadPlans();
    loadDashboard();
    loadAnalytics();
  } catch (err) {
    console.error(err);
    alert('生産計画の削除に失敗しました: ' + err.message);
  }
}

/* ================================
   Export logs CSV (per product)
   ================================ */

async function handleExportProduct() {
  const productCode = prompt('エクスポートする製品番号を入力してください:');
  if (!productCode) return;

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

/* ================================
   Admin visibility & QR
   ================================ */

function updateAdminVisibility() {
  const adminContent = document.getElementById('admin-content');
  const guard = document.getElementById('admin-guard-message');
  const userListCard = document.getElementById('admin-user-list-card');
  const terminalListCard = document.getElementById('admin-terminal-list-card');

  const isAdmin = currentUser && currentUser.role === 'admin';

  if (isAdmin) {
    if (adminContent) adminContent.classList.remove('hidden');
    if (guard) guard.classList.add('hidden');
    if (userListCard) userListCard.classList.remove('hidden');
    if (terminalListCard) terminalListCard.classList.remove('hidden');

    renderAdminUserList();
    renderAdminTerminalList();
  } else {
    if (adminContent) adminContent.classList.add('hidden');
    if (guard) guard.classList.remove('hidden');
    if (userListCard) userListCard.classList.add('hidden');
    if (terminalListCard) terminalListCard.classList.add('hidden');
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

/* 端末QR 一覧（印刷用） */

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

/* ================================
   Analytics (Chart + summary)
   ================================ */

async function loadAnalytics() {
  try {
    const data = await callApi('getAnalytics', {});
    const today = data.today || { total: 0, ng: 0 };
    const byProcess = data.byProcess || [];
    const counts = data.counts || { terminals: 0, plans: 0 };
    const planVsActual = data.planVsActual || { plan_total: 0, actual_total: 0 };

    document.getElementById('today-total').textContent = today.total;
    document.getElementById('today-ng').textContent = today.ng;
    document.getElementById('summary-terminals').textContent = counts.terminals;
    document.getElementById('summary-plans').textContent = counts.plans;

    const planTotalEl = document.getElementById('plan-total');
    const actualTotalEl = document.getElementById('actual-total');
    const planRateEl = document.getElementById('plan-rate');
    const planProgressEl = document.getElementById('plan-progress');

    if (planTotalEl && actualTotalEl && planRateEl && planProgressEl) {
      const planTotal = planVsActual.plan_total || 0;
      const actualTotal = planVsActual.actual_total || 0;
      const rate = planTotal > 0 ? Math.round((actualTotal * 100) / planTotal) : 0;
      planTotalEl.textContent = planTotal;
      actualTotalEl.textContent = actualTotal;
      planRateEl.textContent = planTotal > 0 ? Math.min(rate, 200) : 0;

      const width = planTotal > 0 ? Math.min(100, (actualTotal * 100) / planTotal) : 0;
      planProgressEl.style.width = width + '%';
    }

    const tickerEl = document.getElementById('ticker-text');
    if (tickerEl) {
      let msg;
      if (today.ng > 0) {
        msg = `本日、不良が ${today.ng} 個発生しています。原因と対策を確認してください。`;
      } else if (today.total > 0) {
        msg = `本日の生産数量は ${today.total} 個です。安全第一で作業を続けましょう。`;
      } else {
        msg = '生産データはまだありません。スキャン画面から実績を登録してください。';
      }
      tickerEl.textContent = msg;
    }

    const labels = byProcess.map(x => x.process_name || '不明');
    const totals = byProcess.map(x => x.total || 0);

    const ctx = document.getElementById('process-chart');
    if (!ctx || typeof Chart === 'undefined') {
      console.error('process-chart canvas or Chart.js is not available');
      return;
    }
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

/* ================================
   Plans (生産計画)
   ================================ */

async function loadPlans() {
  try {
    const data = await callApi('getPlans', {});
    plans = data || [];
    renderPlanTable();      // 生産一覧
    renderDashboardTable(); // Dashboard 最新の実績一覧 にも反映
  } catch (err) {
    console.error(err);
    alert('生産計画の取得に失敗しました: ' + err.message);
  }
}


function renderPlanTable() {
  const tbody = document.getElementById('plans-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // 計画開始の新しい順に並べ替え
  const sorted = (plans || []).slice().sort((a, b) => {
    const da = a.planned_start ? new Date(a.planned_start).getTime() : 0;
    const db = b.planned_start ? new Date(b.planned_start).getTime() : 0;
    return db - da; // desc
  });

  sorted.forEach(plan => {
    const tr = document.createElement('tr');

    const related = dashboardLogs.filter(l =>
      l.product_code === plan.product_code &&
      (!plan.process_name || l.process_name === plan.process_name)
    );
    const actualTotal = related.reduce((sum, l) => sum + (l.qty_total || 0), 0);
    const planQty = plan.planned_qty || 0;
    const rate = planQty > 0 ? Math.round((actualTotal * 100) / planQty) : 0;

    tr.innerHTML = `
      <td>${plan.product_code || ''}</td>
      <td>${plan.product_name || ''}</td>
      <td>${plan.process_name || ''}</td>
      <td>${plan.planned_qty || 0}</td>
      <td>${plan.planned_start || ''}</td>
      <td>${plan.planned_end || ''}</td>
      <td>${actualTotal} / ${planQty} (${rate}%)</td>
      <td>${plan.status || ''}</td>
    `;
    // … (lanjutan tombol 詳細 / 実績CSV / スキャン は tetap sama)


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

    const scanBtn = document.createElement('button');
    scanBtn.textContent = 'スキャン/更新';
    scanBtn.className = 'ghost-button';
    scanBtn.style.fontSize = '0.7rem';
    scanBtn.style.marginLeft = '4px';
    scanBtn.addEventListener('click', () => startScanForPlan(plan));

    tdActions.appendChild(detailBtn);
    tdActions.appendChild(exportBtn);
    tdActions.appendChild(scanBtn);
     // 計画削除（管理者のみ）
    if (currentUser && currentUser.role === 'admin') {
      const delPlanBtn = document.createElement('button');
      delPlanBtn.textContent = '計画削除';
      delPlanBtn.className = 'ghost-button';
      delPlanBtn.style.fontSize = '0.7rem';
      delPlanBtn.style.marginLeft = '4px';
      delPlanBtn.addEventListener('click', () => handleDeletePlan(plan));
      tdActions.appendChild(delPlanBtn);
    }
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}
async function handleDeletePlan(plan) {
  if (!plan.plan_id) {
    alert('この生産計画にはIDがありません。');
    return;
  }
  if (!confirm('この生産計画を削除しますか？')) return;

  try {
    await callApi('deletePlan', { planId: plan.plan_id });
    alert('生産計画を削除しました。');
    await loadPlans();
    await loadAnalytics();
    await loadDashboard();
  } catch (err) {
    console.error(err);
    alert('生産計画の削除に失敗しました: ' + err.message);
  }
}


function startScanForPlan(plan) {
  currentPlanForScan = plan;

  const codeEl = document.getElementById('log-product-code');
  const nameEl = document.getElementById('log-product-name');
  const qtyEl = document.getElementById('log-plan-qty');

  if (codeEl) codeEl.value = plan.product_code || '';
  if (nameEl) nameEl.value = plan.product_name || '';
  if (qtyEl) qtyEl.value = plan.planned_qty || 0;

  // スキャン画面へ移動
  const links = document.querySelectorAll('.sidebar-link');
  const sections = document.querySelectorAll('.section');
  const sidebar = document.querySelector('.sidebar');

  sections.forEach(sec => sec.classList.toggle('active', sec.id === 'scan-section'));
  links.forEach(l => l.classList.toggle('active', l.dataset.section === 'scan-section'));

  if (window.innerWidth <= 800 && sidebar) {
    sidebar.classList.add('sidebar-hidden');
  }

  showToast(`生産計画を選択しました: ${plan.product_code || ''} / ${plan.process_name || ''}`, 'info');
}

async function showPlanDetail(plan) {
  const related = dashboardLogs.filter(l => l.product_code === plan.product_code);
  let msg = `【計画情報】
製品番号: ${plan.product_code}
製品名: ${plan.product_name}
工程: ${plan.process_name}
計画数量: ${plan.planned_qty}
計画期間: ${plan.planned_start} ～ ${plan.planned_end}
ステータス: ${plan.status}

【実績一覧】
`;
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
  await handleExportProductForCode(productCode);
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
    await loadPlans();      // rencana + 生産一覧
    await loadAnalytics();  // 計画 vs 実績 のカード
    await loadDashboard();  // 最新の実績一覧 も更新（予定行を含める）
  } catch (err) {
    console.error(err);
    alert('生産計画の保存に失敗しました: ' + err.message);
  }
}


function clearPlanForm() {
  document.getElementById('plan-product-code').value = '';
  document.getElementById('plan-product-name').value = '';
  document.getElementById('plan-process').value = '準備工程'; // default
  document.getElementById('plan-qty').value = 0;
  document.getElementById('plan-start').value = '';
  document.getElementById('plan-end').value = '';
  document.getElementById('plan-status').value = '計画中';
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
