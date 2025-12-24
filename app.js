<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>生産進捗トラッキングシステム</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- PWA -->
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#2f80ed">
  <link rel="icon" type="image/png" href="tsh.png">
  <!-- Fonts: Inter + Noto Sans JP -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap"
    rel="stylesheet">

  <!-- CSS -->
  <link rel="stylesheet" href="style.css">

  <!-- Libs -->
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
<div class="app-shell">

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <img src="tsh.png" alt="ロゴ">
      <span>生産進捗</span>
    </div>
    <nav class="sidebar-nav">
      <button class="sidebar-link active" data-section="dashboard-section">ダッシュボード</button>
      <button class="sidebar-link" data-section="scan-section">スキャン</button>
      <button class="sidebar-link" data-section="plan-input-section">生産計画入力</button>
      <button class="sidebar-link" data-section="plan-list-section">生産一覧</button>
      <button class="sidebar-link admin-only" data-section="admin-section">ユーザー / QR</button>
      <button class="sidebar-link admin-only" data-section="terminalqr-section">工程一覧</button>
    </nav>
  </aside>

  <!-- Main area -->
  <div id="sidebar-overlay" class="sidebar-overlay"></div>

  <div class="main-area">


    <!-- Top bar -->
    <header class="topbar">
      <div class="topbar-left">
        <!-- Burger (mobile) -->
        <button id="btn-menu-toggle" class="burger-button" aria-label="メニュー">
          <span></span><span></span><span></span>
        </button>

        <div>
          <h1 class="topbar-title">生産進捗トラッキングシステム</h1>
          <p class="topbar-subtitle">リアルタイムで進捗と不良を可視化する簡易生産管理</p>
        </div>
      </div>
      <div class="topbar-right">
        <!-- Quick search -->
        <div class="quick-search">
          <input id="header-product-search" type="text" placeholder="製品番号検索">
          <button id="btn-header-search" class="ghost-button ghost-small"><svg class="icon"><use href="#i-search"></use></svg>検索</button>
        </div>
        <button id="btn-monitor-mode" class="ghost-button ghost-small">
          モニタ表示
        </button>
        <!-- Help -->
        <button id="btn-help" class="ghost-icon-button" title="ヘルプ">?</button>

        <!-- User menu (popup style) -->
        <div class="user-menu-wrapper">
          <button type="button" class="user-chip" id="user-menu-toggle">
            <div class="user-avatar">👤</div>
            <div class="user-meta">
              <div id="top-username">ゲスト</div>
              <div class="user-role"><span id="top-userrole">未ログイン</span></div>
            </div>
          </button>

          <div id="user-menu-panel" class="user-menu hidden">
            <!-- 現在のユーザー -->
            <div class="user-menu-section">
              <div class="user-menu-title">現在のユーザー</div>
              <div class="user-menu-row">
                <span>ログインユーザー:</span>
                <span id="current-user-name">未ログイン</span>
              </div>
              <div class="user-menu-row">
                <span>ユーザーID:</span>
                <span id="current-user-id">-</span>
              </div>
              <div class="user-menu-row">
                <span>権限:</span>
                <span id="current-user-role">-</span>
              </div>
            </div>

            <!-- ログイン -->
            <div class="user-menu-section">
              <div class="user-menu-title">ログイン</div>
              <div class="manual-login-row">
                <input id="manual-user-id" type="text" placeholder="ユーザーIDを入力（例: ADMIN001）">
                <button id="btn-manual-login" class="secondary-button">ユーザーIDでログイン</button>
              </div>
              <div id="last-user-quick-login" class="manual-login-row hidden">
                <div class="hint">
                  前回ログイン: <span id="last-user-label"></span>
                </div>
                <button id="btn-last-user-login" class="primary-button">
                  このユーザーでログイン
                </button>
              </div>
              <button id="btn-start-user-scan" class="ghost-button" style="margin-top:8px;">
                ユーザーQRスキャン開始
              </button>
            </div>

            <!-- ショートカット -->
            <div class="user-menu-section">
              <div class="user-menu-title">ショートカット</div>
              <div class="button-row">
                <button type="button" class="ghost-button ghost-small"
                        onclick="document.querySelector('.sidebar-link[data-section=\'dashboard-section\']')?.click(); document.getElementById('user-menu-panel').classList.add('hidden');">
                  ダッシュボードへ
                </button>
                <button type="button" class="ghost-button ghost-small"
                        onclick="document.querySelector('.sidebar-link[data-section=\'scan-section\']')?.click(); document.getElementById('user-menu-panel').classList.add('hidden');">
                  スキャン画面へ
                </button>
                <button type="button" class="ghost-button ghost-small"
                        onclick="document.querySelector('.sidebar-link[data-section=\'plan-list-section\']')?.click(); document.getElementById('user-menu-panel').classList.add('hidden');">
                  生産一覧へ
                </button>
                <button type="button" class="ghost-button ghost-small"
                        onclick="document.getElementById('btn-monitor-mode')?.click(); document.getElementById('user-menu-panel').classList.add('hidden');">
                  モニタ表示ON/OFF
                </button>
              </div>
            </div>

            <!-- ログアウト -->
            <div class="user-menu-section">
              <button id="btn-logout" class="ghost-button" style="width:100%;">ログアウト</button>
            </div>

            <p class="hint" style="margin-top:6px;">
              ユーザー認証はこのメニューから行ってください。
            </p>
          </div>
        </div>

      </div>
    </header>

    <!-- Content -->
    <main class="content">

      <!-- Offline indicator -->
      <div id="offline-indicator" class="offline-indicator hidden">
        オフラインモード：オンライン復帰後に自動同期します。
      </div>

      <!-- Dashboard -->
      <section id="dashboard-section" class="section active">
        <div class="page">
          <div class="page-header">
            <div class="page-title-group">
              <h1 class="page-title">ダッシュボード</h1>
              <p class="page-subtitle">最新の進捗状況と生産計画を確認します。</p>
            </div>
            <div class="page-actions"></div>
          </div>
          <div class="page-content">
            <div id="dash-summary-block" class="monitor-source">

        <div class="card welcome-card">
          <div class="welcome-main">
            <div class="welcome-icon">👋</div>
            <div>
              <p class="welcome-title">ようこそ、<span id="welcome-name">ゲスト</span> さん。</p>
              <p class="welcome-text">最新の進捗状況と生産計画を確認しましょう。</p>
            </div>
          </div>
          <!-- Safety card -->
          <div class="card safety-card">
            <div class="safety-icon">🦺</div>
            <div class="safety-body">
              <div class="safety-title">今日の安全メッセージ</div>
              <div class="safety-text" id="safety-message">
                安全第一で作業しましょう。
              </div>
            </div>
          </div>
          <div class="welcome-meta">
            <div class="welcome-meta-item">
              <span class="meta-label">本日</span>
              <span id="welcome-date"></span>
            </div>            </div>

          </div>
        </div>

        <!-- Summary -->
        <div class="summary-grid">
          <div class="summary-card">
            <p class="summary-label">本日の総生産数量</p>
            <p class="summary-value" id="today-total">0</p>
          </div>
          <div class="summary-card warning-card">
            <p class="summary-label">本日の不良数量</p>
            <p class="summary-value" id="today-ng">0</p>
          </div>
          <div class="summary-card">
            <p class="summary-label">登録工程数</p>
            <p class="summary-value" id="summary-terminals">0</p>
          </div>
          <div class="summary-card">
            <p class="summary-label">登録生産計画数</p>
            <p class="summary-value" id="summary-plans">0</p>
          </div>
        </div>

        <div id="alert-banner" class="alert-banner hidden">
          最近の工程で不良または検査保留が発生しています。詳細は一覧を確認してください。
        </div>

        <div class="ticker-card">
          <div class="ticker-label">INFO</div>
          <div class="ticker-content">
            <div id="ticker-text" class="ticker-text">
              生産システムへようこそ。最新の実績と生産計画を確認してください。
            </div>
          </div>
        </div>

        <!-- KPI 計画 vs 実績 -->
        <div class="card plan-actual-card">
          <h3 class="card-title">計画 vs 実績</h3>
          <p class="plan-actual-text">
            本日の計画数量: <span id="plan-total">0</span> 個 / 実績: <span id="actual-total">0</span> 個
            （達成率: <span id="plan-rate">0</span>%）
          </p>
          <div class="progress-bar">
            <div id="plan-progress" class="progress-fill" style="width: 0%;"></div>
          </div>

          <div id="plan-status-badge" class="plan-status-badge">
            計画データなし
          </div>
        </div>

                    </div>

            <div id="dash-latest-block" class="monitor-source">

        <!-- 最新実績一覧 -->
        <div class="card">
          <div class="card-header-row">
            <div class="card-header-left">
              <h2 class="card-title">最新の実績一覧</h2>
              <div class="dashboard-update-info">
                <span id="dashboard-last-updated">最終更新: -</span>
                <span id="dashboard-next-refresh">次の自動更新まで: 60 秒</span>
              </div>
            </div>
            <div class="button-row">
              <button id="btn-refresh-dashboard" class="primary-button"><svg class="icon"><use href="#i-refresh"></use></svg>更新</button>
              <button id="btn-export-product" class="ghost-button">製品別Excelエクスポート</button>
            </div>
          </div>

          <div class="filter-grid">
            <div class="form-group">
              <label for="filter-process">工程フィルター</label>
              <select id="filter-process">
                <option value="">すべて</option>
                <option>レザー加工</option>
                <option>外注工程</option>
                <option>曲げ加工</option>
                <option>準備工程</option>
                <option>外枠組立工程</option>
                <option>パンタ組立工程</option>
                <option>シャッター組立工程</option>
                <option>スポット工程</option>
                <option>コーキング工程</option>
                <option>溶接工程</option>
                <option>組立工程</option>
                <option>検査工程</option>
                <option>検査保留</option>
                <option>出荷準備</option>
                <option>出荷完成</option>
              </select>
            </div>
            <div class="form-group">
              <label for="filter-terminal">工程名フィルター</label>
              <input id="filter-terminal" type="text" placeholder="工程IDまたは名称で検索">
            </div>
            <div class="form-group">
              <label for="filter-product">製品番号フィルター</label>
              <input id="filter-product" type="text" placeholder="製品番号/ロット番号">
            </div>
            <div class="form-group">
              <label for="filter-work-type">作業区分</label>
              <select id="filter-work-type">
                <option value="">社内＋外注すべて</option>
                <option value="社内">社内のみ</option>
                <option value="外注">外注のみ</option>
              </select>
            </div>
            <div class="form-group">
              <label>期間フィルター</label>
              <div class="date-range">
                <input id="filter-date-from" type="date">
                <span>〜</span>
                <input id="filter-date-to" type="date">
              </div>
            </div>
          </div>

          <div class="table-wrapper">
            <table class="logs-table responsive-table">
              <thead>
              <tr>
                <th>工程開始</th>
                <th>図番</th>
                <th>品名</th>
                <th>工程</th>
                <th>ユーザー</th>
                <th>数量(OK/不良)</th>
                <th>ステータス</th>
                <th>所要時間(分)</th>
                <th>ロケーション</th>
                <th>操作</th>
              </tr>
              </thead>
              <tbody id="logs-tbody"></tbody>
            </table>
          </div>
        </div>

                    </div>

            <div id="dash-chart-block" class="monitor-source">

        <!-- 工程別 生産量 -->
        <div class="card small-gap">
          <h2 class="card-title">工程別 生産量（直近7日）</h2>
          <div class="chart-wrapper">
            <canvas id="process-chart"></canvas>
          </div>
        </div>

        <!-- 製品別 合計工数 -->
        <div class="card small-gap">
          <h2 class="card-title">製品別 合計工数（全期間）</h2>
          <div class="table-wrapper compact">
            <table class="logs-table compact">
              <thead>
              <tr>
                <th>製品番号</th>
                <th class="align-right">合計工数 [h]</th>
              </tr>
              </thead>
              <tbody id="manhour-product-tbody"></tbody>
            </table>
          </div>
        </div>

        <!-- 工程別 合計工数 -->
        <div class="card small-gap">
          <h2 class="card-title">工程別 合計工数（全期間）</h2>
          <div class="table-wrapper compact">
            <table class="logs-table compact">
              <thead>
              <tr>
                <th>工程名</th>
                <th class="align-right">合計工数 [h]</th>
              </tr>
              </thead>
              <tbody id="manhour-process-tbody"></tbody>
            </table>
          </div>
        </div>
            <!-- Monitor-only: Special Slides (Overdue / Top NG / Bottleneck / Top Items) -->
            <div id="dash-overdue-block" class="monitor-source monitor-only">
              <div class="card">
                <div class="card-header-row">
                  <div class="card-header-left">
                    <h2 class="card-title">遅れ計画（Overdue）</h2>
                    <div class="hint">計画終了を過ぎても未達の計画（上位10件）</div>
                  </div>
                </div>
                <div class="table-wrapper compact">
                  <table class="logs-table compact responsive-table">
                    <thead>
                      <tr>
                        <th>図番</th><th>工程</th><th class="align-right">計画</th><th class="align-right">実績</th><th class="align-right">遅れ(h)</th>
                      </tr>
                    </thead>
                    <tbody id="overdue-tbody"></tbody>
                  </table>
                  <div id="overdue-empty" class="empty-state hidden">遅れ計画はありません。</div>
                </div>
              </div>
            </div>

            <div id="dash-topng-block" class="monitor-source monitor-only">
              <div class="card">
                <div class="card-header-row">
                  <div class="card-header-left">
                    <h2 class="card-title">Top NG（直近7日）</h2>
                    <div class="hint">不良数量が多い製品・工程（上位）</div>
                  </div>
                </div>

                <div class="two-col">
                  <div>
                    <h3 class="sub-title">製品別（NG数量）</h3>
                    <div class="table-wrapper compact">
                      <table class="logs-table compact">
                        <thead>
                          <tr><th>図番</th><th class="align-right">NG</th><th class="align-right">NG率</th></tr>
                        </thead>
                        <tbody id="topng-product-tbody"></tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <h3 class="sub-title">工程別（NG数量）</h3>
                    <div class="table-wrapper compact">
                      <table class="logs-table compact">
                        <thead>
                          <tr><th>工程</th><th class="align-right">NG</th></tr>
                        </thead>
                        <tbody id="topng-process-tbody"></tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div id="topng-empty" class="empty-state hidden">対象データがありません。</div>
              </div>
            </div>

            <div id="dash-bottleneck-block" class="monitor-source monitor-only">
              <div class="card">
                <div class="card-header-row">
                  <div class="card-header-left">
                    <h2 class="card-title">ボトルネック工程（直近7日）</h2>
                    <div class="hint">工数（h）が大きい工程（上位）</div>
                  </div>
                </div>
                <div class="table-wrapper compact">
                  <table class="logs-table compact responsive-table">
                    <thead>
                      <tr>
                        <th>工程</th>
                        <th class="align-right">工数(h)</th>
                        <th class="align-right">平均(分)</th>
                        <th class="align-right">件数</th>
                      </tr>
                    </thead>
                    <tbody id="bottleneck-tbody"></tbody>
                  </table>
                  <div id="bottleneck-empty" class="empty-state hidden">対象データがありません。</div>
                </div>
              </div>
            </div>

            <div id="dash-topitems-block" class="monitor-source monitor-only">
              <div class="card">
                <div class="card-header-row">
                  <div class="card-header-left">
                    <h2 class="card-title">頻出品目（直近7日 / 30日）</h2>
                    <div class="hint">作業回数（ログ件数）が多い製品（上位）</div>
                  </div>
                </div>

                <div class="two-col">
                  <div>
                    <h3 class="sub-title">直近7日</h3>
                    <div class="table-wrapper compact">
                      <table class="logs-table compact">
                        <thead>
                          <tr><th>図番</th><th class="align-right">回数</th><th class="align-right">数量</th></tr>
                        </thead>
                        <tbody id="topitems-weekly-tbody"></tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 class="sub-title">直近30日</h3>
                    <div class="table-wrapper compact">
                      <table class="logs-table compact">
                        <thead>
                          <tr><th>図番</th><th class="align-right">回数</th><th class="align-right">数量</th></tr>
                        </thead>
                        <tbody id="topitems-monthly-tbody"></tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div id="topitems-empty" class="empty-state hidden">対象データがありません。</div>
              </div>
            </div>

      
          </div>
        </div>
</section>

      <!-- Scan -->
      <section id="scan-section" class="section">
        <div class="page">
          <div class="page-header">
            <div class="page-title-group">
              <h1 class="page-title">スキャン / 生産データ入力</h1>
              <p class="page-subtitle">工程QRを読み取り、実績を入力します。</p>
            </div>
            <div class="page-actions"></div>
          </div>
          <div class="page-content">

        <!-- ユーザー認証案内 -->
        <div class="card">
          <h2 class="card-title">ユーザー認証</h2>
          <p>ユーザー認証は画面右上のメニューから行ってください。</p>
        </div>

        <!-- 工程スキャン -->
        <div class="card">
          <h2 class="card-title">工程スキャン</h2>
          <p>工程に設置されたQRコードをスキャンして、生産を記録します。</p>

          <div class="terminal-info">
            <div><strong>現在の工程:</strong> <span id="current-terminal-name">未スキャン</span></div>
            <div><strong>工程ID:</strong> <span id="current-terminal-id">-</span></div>
            <div><strong>工程:</strong> <span id="current-process-name">-</span></div>
            <div><strong>ロケーション:</strong> <span id="current-location">-</span></div>
          </div>

          <div style="margin-top:8px;">
            <button id="btn-start-terminal-scan" class="primary-button">工程QRスキャン開始</button>
          </div>

          <div id="qr-reader-terminal" class="qr-reader"></div>
        </div>

        <!-- 生産データ入力 -->
        <div class="card">
          <h2 class="card-title">生産データ入力</h2>
          <p>生産計画一覧から対象行の「スキャン/更新」を選択し、工程をスキャンしてから実績を入力してください。</p>

          <!-- Plan情報 -->
          <div class="form-grid">
            <div class="form-group">
              <label>製品番号</label>
              <input id="log-product-code" type="text" readonly placeholder="生産計画から自動設定">
            </div>
            <div class="form-group">
              <label>製品名</label>
              <input id="log-product-name" type="text" readonly>
            </div>
            <div class="form-group">
              <label>計画数量</label>
              <input id="log-plan-qty" type="number" readonly value="0">
            </div>
            <div class="form-group">
              <label for="log-lot-number">ロット番号（任意）</label>
              <input id="log-lot-number" type="text" placeholder="例: LOT20241001">
            </div>
          </div>

        <!-- Input utama operator - WITH REQUIRED FIELD HIGHLIGHTING -->
<div class="form-grid">
  <div class="form-group">
    <label for="log-status" class="field-required">ステータス</label>
    <select id="log-status" class="required-field">
      <option value="工程開始">工程開始</option>
      <option value="工程終了" selected>工程終了</option>
      <option value="一時停止">一時停止（保留）</option>
      <option value="検査保留">検査保留</option>
    </select>
  </div>

  <div class="form-group">
    <label for="log-qty-ok" class="field-required">OK数量</label>
    <input id="log-qty-ok" type="number" min="0" value="0" class="required-field">
  </div>

  <div class="form-group">
    <label for="log-qty-ng" class="field-required">不良数量</label>
    <input id="log-qty-ng" type="number" min="0" value="0" class="required-field">
  </div>

  <div class="form-group">
    <label for="log-qty-total">総数量</label>
    <input id="log-qty-total" type="number" min="0" value="0" readonly>
  </div>
</div>


          <!-- Multi-operator -->
          <div class="form-grid two-col">
            <div class="form-group">
              <label for="log-crew-size">作業人数</label>
              <input id="log-crew-size" type="number" min="1" value="1">
              <small class="field-hint">
                複数人で同じ工程を行った場合のみ人数を変更してください。（例：2人作業なら「2」）
              </small>
            </div>
          </div>

          <div class="form-group">
            <label for="log-note">備考（任意）</label>
            <input id="log-note" type="text" placeholder="例: 金型異常あり">
          </div>

          <div class="button-row">
            <button id="btn-save-log" class="primary-button">保存</button>
            <button id="btn-clear-form" class="ghost-button">クリア</button>
          </div>

          <p class="hint" style="margin-top:6px;">
            ※ 現在のユーザーは右上メニューで確認できます。生産計画と工程を選択した状態で実績を登録してください。
          </p>
        </div>
      
          </div>
        </div>
</section>

      <!-- 生産計画入力 -->
      <section id="plan-input-section" class="section">
        <div class="page">
          <div class="page-header">
            <div class="page-title-group">
              <h1 class="page-title">生産計画入力</h1>
              <p class="page-subtitle">新しい生産計画を登録します。</p>
            </div>
            <div class="page-actions"></div>
          </div>
          <div class="page-content">

        <div class="card">
          <h2 class="card-title">生産計画登録</h2>
          <p>新しい生産計画を登録してください。（製品 × 工程 × 数量 単位）</p>
          <div class="form-grid">
  <div class="form-group">
    <label for="plan-product-code" class="field-required">図番</label>
    <input id="plan-product-code" type="text" placeholder="例: Z-001">
  </div>

  <div class="form-group">
    <label for="plan-product-name" class="field-required">品名</label>
    <input id="plan-product-name" type="text" placeholder="例: 品名A">
  </div>

  <div class="form-group">
    <label for="plan-process" class="field-required">工程名</label>
    <select id="plan-process">
      <option value="">選択してください</option>
                <option value="準備工程">準備工程</option>
                <option value="レザー加工">レザー加工</option>
                <option value="外注工程">外注工程</option>
                <option value="曲げ加工">曲げ加工</option>
                <option value="外枠組立工程">外枠組立工程</option>
                <option value="パンタ組立工程">パンタ組立工程</option>
                <option value="シャッター組立">工程シャッター組立工程</option>
                <option value="スポット工程">スポット工程</option>
                <option value="コーキング工程">コーキング工程</option>
                <option value="溶接工程">溶接工程</option>
                <option value="組立工程">組立工程</option>
                <option value="検査工程">検査工程</option>
                <option value="出荷準備">出荷準備</option>
                <option value="出荷完成">出荷完成</option>
              </select>
            </div>
           <div class="form-group">
    <label for="plan-qty" class="field-required">計画数量</label>
    <input id="plan-qty" type="number" min="0" value="0">
  </div>

  <div class="form-group">
    <label for="plan-start" class="field-required">計画開始</label>
    <input id="plan-start" type="datetime-local">
  </div>

  <div class="form-group">
    <label for="plan-end" class="field-required">計画終了</label>
    <input id="plan-end" type="datetime-local">
  </div>
            <div class="form-group">
              <label for="plan-status">ステータス</label>
              <select id="plan-status">
                <option value="計画中">計画中</option>
                <option value="進行中">進行中</option>
                <option value="完了">完了</option>
                <option value="中止">中止</option>
              </select>
            </div>
          </div>
          <div class="button-row">
            <button id="btn-save-plan" class="primary-button">計画登録</button>
            <button id="btn-clear-plan" class="ghost-button">クリア</button>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">生産計画インポート（CSV）</h2>
          <p>
            Excelから「CSV UTF-8」で保存し、1行目をヘッダーとして貼り付けてください。<br>
            列順: 図番, 品名, 工程名, 計画数量, 計画開始, 計画終了, ステータス
          </p>
          <div class="form-group">
            <textarea id="plan-import-text" rows="6"
                      placeholder="図番,品名,工程名,計画数量,計画開始,計画終了,ステータス"></textarea>
          </div>
          <button id="btn-import-plans" class="secondary-button">インポート実行</button>
        </div>
      
          </div>
        </div>
</section>

      <!-- 生産一覧 -->
      <section id="plan-list-section" class="section">
        <div class="page">
          <div class="page-header">
            <div class="page-title-group">
              <h1 class="page-title">生産計画一覧</h1>
              <p class="page-subtitle">登録済み計画の進捗確認・スキャン開始・更新ができます。</p>
            </div>
            <div class="page-actions"></div>
          </div>
          <div class="page-content">
            <div id="plan-list-block" class="monitor-source">

        <div class="card">
          <div class="card-header-row">
            <h2 class="card-title">生産計画一覧</h2>
            <div class="button-row">
              <button id="btn-refresh-plans" class="primary-button"><svg class="icon"><use href="#i-refresh"></use></svg>更新</button>
            </div>
          </div>
          <div class="table-wrapper">
            <table class="responsive-table">
              <thead>
              <tr>
                <th>図番</th>
                <th>品名</th>
                <th>工程名</th>
                <th>計画数量</th>
                <th>計画開始</th>
                <th>計画終了</th>
                <th>実績/計画</th>
                <th>ステータス</th>
                <th>操作</th>
              </tr>
              </thead>
              <tbody id="plans-tbody"></tbody>
            </table>
            </div>

          </div>
        </div>
      
          </div>
        </div>
</section>

      <!-- Admin: user & terminal register -->
      <section id="admin-section" class="section">
        <div class="page">
          <div class="page-header">
            <div class="page-title-group">
              <h1 class="page-title">管理者</h1>
              <p class="page-subtitle">ユーザー/工程の登録と管理を行います。</p>
            </div>
            <div class="page-actions"></div>
          </div>
          <div class="page-content">

        <div class="card">
          <h2 class="card-title">管理者メニュー（ユーザー / 工程登録）</h2>
          <p>管理者権限ユーザーでログインすると使用できます。（ロール: admin）</p>
          <p id="admin-guard-message" class="warning">
            現在のユーザーには管理者権限がありません。
          </p>
          <div id="admin-content" class="admin-grid hidden">
            <div class="admin-section">
              <h3>ユーザー登録</h3>
              <div class="form-group">
                <label for="admin-user-id">ユーザーID</label>
                <input id="admin-user-id" type="text" placeholder="例: U001">
              </div>
              <div class="form-group">
                <label for="admin-user-name">氏名（日本語）</label>
                <input id="admin-user-name" type="text" placeholder="例: 山田 太郎">
              </div>
              <div class="form-group">
                <label for="admin-user-role">権限</label>
                <select id="admin-user-role">
                  <option value="operator">オペレーター</option>
                  <option value="qc">QC</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
              <button id="btn-admin-create-user" class="primary-button">ユーザー登録</button>

              <h4>ユーザーQRコード</h4>
              <p>登録後に下のQRコードを印刷して、現場で使用してください。</p>
              <div id="user-qr-container" class="qr-container"></div>
            </div>

            <div class="admin-section">
              <h3>工程登録</h3>
              <div class="form-group">
                <label for="admin-terminal-id">工程ID</label>
                <input id="admin-terminal-id" type="text" placeholder="例: T001">
              </div>
              <div class="form-group">
                <label for="admin-terminal-name">工程名称</label>
                <input id="admin-terminal-name" type="text" placeholder="例: レザー加工工程1">
              </div>
              <div class="form-group">
                <label for="admin-terminal-process">工程</label>
                <select id="admin-terminal-process">
                  <option>レザー加工</option>
                  <option>外注工程</option>
                  <option>曲げ加工</option>
                  <option>準備工程</option>
                  <option>外枠組立工程</option>
                  <option>パンタ組立工程</option>
                  <option>シャッター組立工程</option>
                  <option>スポット工程</option>
                  <option>コーキング工程</option>
                  <option>溶接工程</option>
                  <option>組立工程</option>
                  <option>検査工程</option>
                  <option>出荷準備</option>
                  <option>出荷完成</option>
                </select>
              </div>
              <div class="form-group">
                <label for="admin-terminal-location">ロケーション</label>
                <input id="admin-terminal-location" type="text" placeholder="例: 第1工場 ラインA">
              </div>
              <button id="btn-admin-create-terminal" class="primary-button">工程登録</button>

              <h4>工程QRコード</h4>
              <p>登録後に下のQRコードを印刷して、各工程の工程に貼り付けてください。</p>
              <div id="terminal-qr-container" class="qr-container"></div>
            </div>
          </div>
        </div>

        <!-- ユーザー一覧 / QRラベル -->
        <div id="admin-user-list-card" class="card hidden">
          <h3 class="card-title">ユーザー一覧 / QRラベル</h3>
          <div class="table-wrapper">
            <table class="responsive-table">
              <thead>
              <tr>
                <th>QR</th>
                <th>ユーザーID</th>
                <th>氏名</th>
                <th>権限</th>
                <th>操作</th>
              </tr>
              </thead>
              <tbody id="admin-user-list-tbody"></tbody>
            </table>
          </div>
        </div>

        <!-- User Management Card -->
        <div id="admin-user-management-card" class="card hidden">
          <h3 class="card-title">👥 ユーザー管理</h3>

          <!-- New User -->
          <div class="admin-section">
            <h4>✨ 新規ユーザー登録</h4>
            <div class="form-grid">
              <div class="form-group">
                <label for="new-user-id">ユーザーID *</label>
                <input id="new-user-id" type="text" placeholder="例: U001" required>
              </div>
              <div class="form-group">
                <label for="new-user-name">氏名（日本語）*</label>
                <input id="new-user-name" type="text" placeholder="例: 山田 太郎" required>
              </div>
              <div class="form-group">
                <label for="new-user-role">権限 *</label>
                <select id="new-user-role">
                  <option value="operator">オペレーター</option>
                  <option value="qc">QC</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
            </div>
            <button id="btn-create-new-user" class="primary-button">
              <span>➕ ユーザー登録してQR生成</span>
            </button>

            <!-- QR Display -->
            <div id="new-user-qr-area" class="qr-display-area hidden">
              <h5>✅ ユーザー登録完了！</h5>
              <p>下記のQRコードを印刷して現場で使用してください。</p>
              <div class="qr-result-card">
                <div id="new-user-qr-container" class="qr-container-large"></div>
                <div class="qr-info">
                  <p><strong>ユーザーID:</strong> <span id="new-user-qr-id"></span></p>
                  <p><strong>氏名:</strong> <span id="new-user-qr-name"></span></p>
                  <p><strong>権限:</strong> <span id="new-user-qr-role"></span></p>
                </div>
                <button id="btn-download-new-user-qr" class="secondary-button">
                  📥 QRコードをダウンロード
                </button>
              </div>
            </div>
          </div>

          <!-- User list -->
          <div class="admin-section">
            <h4>📋 ユーザー一覧</h4>
            <div class="table-wrapper">
              <table class="responsive-table">
                <thead>
                <tr>
                  <th>QR</th>
                  <th>ユーザーID</th>
                  <th>氏名</th>
                  <th>権限</th>
                  <th>作成日時</th>
                  <th>操作</th>
                </tr>
                </thead>
                <tbody id="user-list-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      
          </div>
        </div>
</section>

      <!-- 工程一覧 / QRラベル -->
      <section id="terminalqr-section" class="section">
        <div class="page">
          <div class="page-header">
            <div class="page-title-group">
              <h1 class="page-title">工程一覧 / QRラベル</h1>
              <p class="page-subtitle">工程一覧の確認とQRラベルの印刷/ダウンロードを行います。</p>
            </div>
            <div class="page-actions"></div>
          </div>
          <div class="page-content">

        <div id="admin-terminal-list-card" class="card">
          <h2 class="card-title">工程一覧 / QRラベル</h2>
          <p>登録済みの工程一覧と各工程のQRラベルを確認できます。</p>
          <p class="warning">管理者としてログインすると内容が表示されます。（ロール: admin）</p>

          <div class="table-wrapper">
            <table class="responsive-table">
              <thead>
              <tr>
                <th>QR</th>
                <th>工程ID</th>
                <th>工程名称</th>
                <th>工程</th>
                <th>ロケーション</th>
                <th>操作</th>
              </tr>
              </thead>
              <tbody id="admin-terminal-list-tbody"></tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">工程QR一覧（印刷用）</h2>
          <p>すべての工程のQRコードを一覧表示します。このページを印刷して現場に配布してください。</p>
          <p id="terminalqr-guard" class="warning">
            管理者としてログインすると表示されます。（ロール: admin）
          </p>
          <div id="terminal-qr-list" class="terminalqr-grid hidden"></div>
        </div>
      
          </div>
        </div>
</section>

    </main>

    <!-- Floating Scan button (mobile) -->
    <button id="fab-scan" class="fab-scan" aria-label="スキャン画面へ">
      <svg class="icon icon-lg" aria-hidden="true"><use href="#i-scan"></use></svg>
      <span class="fab-label">SCAN</span>
    </button>

    <!-- Mobile bottom navigation -->
    <nav class="mobile-bottom-nav">
      <button class="mobile-nav-link active" data-section="dashboard-section">
        <svg class="icon icon-lg mobile-nav-icon" aria-hidden="true"><use href="#i-home"></use></svg>
        <span class="mobile-nav-label">ダッシュボード</span>
      </button>
      <button class="mobile-nav-link" data-section="scan-section">
        <svg class="icon icon-lg mobile-nav-icon" aria-hidden="true"><use href="#i-scan"></use></svg>
        <span class="mobile-nav-label">スキャン</span>
      </button>
      <button class="mobile-nav-link" data-section="plan-list-section">
        <svg class="icon icon-lg mobile-nav-icon" aria-hidden="true"><use href="#i-list"></use></svg>
        <span class="mobile-nav-label">生産一覧</span>
      </button>
    </nav>

    <footer class="app-footer">
      Design by Wahyu
    </footer>

  </div>
</div>

<!-- 編集モーダル -->
<div id="edit-modal" class="modal hidden">
  <div class="modal-content">
    <h3>ログ編集</h3>
    <input type="hidden" id="edit-log-id">
    <div class="form-group">
      <label for="edit-qty-total">総数量</label>
      <input id="edit-qty-total" type="number" min="0">
    </div>
    <div class="form-group">
      <label for="edit-qty-ok">OK数量</label>
      <input id="edit-qty-ok" type="number" min="0">
    </div>
    <div class="form-group">
      <label for="edit-qty-ng">不良数量</label>
      <input id="edit-qty-ng" type="number" min="0">
    </div>
    <div class="form-group">
      <label for="edit-status">ステータス</label>
      <select id="edit-status">
        <option value="通常">通常</option>
        <option value="検査保留">検査保留</option>
        <option value="終了">終了</option>
      </select>
    </div>
    <div class="button-row">
      <button id="btn-edit-save" class="primary-button">更新</button>
      <button id="btn-edit-cancel" class="ghost-button">キャンセル</button>
    </div>
  </div>
</div>

<!-- ヘルプモーダル -->
<div id="help-modal" class="modal hidden">
  <div class="modal-content">
    <h3>ヘルプ</h3>

    <p>このシステムの基本的な使い方:</p>
    <ol class="help-list">
      <li>① 右上メニューでユーザーQRまたはユーザーIDでログインします。</li>
      <li>② 「生産一覧」で対象の生産計画を選び、「スキャン/更新」をクリックします。<br>
        ┗ 製品番号・製品名・計画数量が「生産データ入力」に自動設定されます。
      </li>
      <li>③ 「スキャン」画面で工程QRをスキャンします。<br>
        ┗ 工程名・端末・ロケーションが自動でセットされます。
      </li>
      <li>④ ステータス・数量・作業人数を確認して「保存」ボタンで実績を登録します。</li>
      <li>⑤ 「ダッシュボード」で最新の実績と生産計画の進捗をリアルタイムに確認できます。</li>
      <li>⑥ 「ユーザー / QR」「工程一覧」でマスタとQRコードを管理できます。（adminのみ）</li>
    </ol>

    <h4 style="margin-top:8px;">ステータスの使い分け</h4>
    <ul class="help-list">
      <li><strong>工程開始</strong>：工程を始めるときに使用します。開始時刻だけを記録し、終了時に所要時間を計算します。</li>
      <li><strong>工程終了</strong>：工程が完了したときに使用します。OK/不良数量と作業人数を入力して保存します。</li>
      <li><strong>一時停止（保留）</strong>：段取り替え・別作業へ一時移動・材料待ちなど「一旦止めて後で再開する」場合に使用します。数量が確定していない場合は 0 のままでも構いません。</li>
      <li><strong>検査保留</strong>：品質確認のため一時停止する場合に使用します。ダッシュボードで注意が必要な工程として強調表示されます。</li>
    </ul>

    <h4 style="margin-top:8px;">HOLDして別作業を行う場合の流れ</h4>
    <ol class="help-list">
      <li>1) 工程Aを開始：ステータス「工程開始」で保存。</li>
      <li>2) 一時停止したいタイミングで、同じ生産計画＋工程Aを選び、<br>
        ステータスを「一時停止」または「検査保留」にして保存。<br>
        ┗ 開始〜一時停止までの時間が1つの区間としてログに記録されます。
      </li>
      <li>3) 別の作業Bを行うときは、生産計画B＋工程Bを選び、<br>
        「工程開始」→ 作業完了時に「工程終了」で登録します。
      </li>
      <li>4) 工程Aに戻るときは、再度 生産計画A＋工程Aを選び、<br>
        「工程開始」→ 最後に「工程終了」で登録します。<br>
        ┗ 区間ごとにログは分かれますが、システム側で自動的に合計作業時間として集計されます。
      </li>
    </ol>

    <h4 style="margin-top:8px;">複数人作業（作業人数）の入力</h4>
    <ul class="help-list">
      <li>通常は「作業人数 = 1」のままで構いません。</li>
      <li>同じ工程を2人以上で同時に行った場合、<strong>終了登録のとき</strong>に実際の人数を入力してください。<br>
        例：2人作業 → 作業人数「2」<br>
        ┗ 合計工数（man-hour）は「作業時間 × 作業人数」で自動計算されます。
      </li>
    </ul>

    <h4 style="margin-top:8px;">社内 / 外注 の扱い</h4>
    <ul class="help-list">
      <li>工程マスタのロケーションに「外注」や「subcon」などの文字を含めて登録すると、その工程は自動的に<strong>外注工程</strong>として扱われます。</li>
      <li>特に指定がない工程は<strong>社内工程</strong>として扱われます。</li>
      <li>ダッシュボード上部の「作業区分」フィルターで、「社内のみ」「外注のみ」を切り替えて表示できます。</li>
    </ul>

    <h4 style="margin-top:8px;">モニタ表示（デジタルサイネージ）</h4>
    <ul class="help-list">
      <li>右上の「モニタ表示」ボタンを押すと、サイドメニューなどが非表示になり、ライン全体の進捗を表示するモードになります。</li>
      <li>テレビや大型ディスプレイにブラウザ画面を映すことで、現場全員がリアルタイムの進捗を共有できます。</li>
      <li>通常表示に戻るには、ブラウザを再読み込み（F5）してください。</li>
    </ul>

    <p style="margin-top:8px;font-size:0.8rem;color:#666;">
      ※ Bahasa Indonesia (ringkas):<br>
      1) Login dengan QR/ID user, pilih rencana di 「生産一覧」 lalu klik 「スキャン/更新」.<br>
      2) Di menu 「スキャン」 scan QR proses, pilih status (開始 / 終了 / 一時停止 / 検査保留) dan isi qty.<br>
      3) Jika kerja lebih dari 1 orang, ubah 「作業人数」 saat input 終了. Sistem otomatis hitung man-hour dan membedakan 社内 vs 外注 dari lokasi di master工程.
    </p>

    <div class="button-row" style="margin-top:8px;">
      <button id="btn-help-close" class="primary-button">閉じる</button>
    </div>
  </div>
</div>

<!-- Loading badge -->
<div id="global-loading" class="loading-badge hidden">
  <div class="spinner"></div>
  <span id="loading-text">通信中...</span>
</div>

<!-- Toast notification -->
<div id="global-toast" class="toast hidden"></div>

<!-- SVG Icon Sprite (UI consistent icons) -->
<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false">
  <symbol id="i-home" viewBox="0 0 24 24">
    <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z"/>
  </symbol>
  <symbol id="i-scan" viewBox="0 0 24 24">
    <path d="M4 7V4h3V2H2v5h2zm13-5v2h3v3h2V2h-5zM4 17H2v5h5v-2H4v-3zm18 0h-2v3h-3v2h5v-5z"/>
    <path d="M7 12h10v2H7z"/>
  </symbol>
  <symbol id="i-list" viewBox="0 0 24 24">
    <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/>
  </symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24">
    <path d="M17.65 6.35A7.95 7.95 0 0012 4V1L7 6l5 5V7a5 5 0 014.9 4H19a7 7 0 00-1.35-4.65z"/>
    <path d="M6.35 17.65A7.95 7.95 0 0012 20v3l5-5-5-5v4a5 5 0 01-4.9-4H5a7 7 0 001.35 4.65z"/>
  </symbol>
  <symbol id="i-info" viewBox="0 0 24 24">
    <path d="M11 17h2v-6h-2v6zm0-8h2V7h-2v2z"/>
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16z"/>
  </symbol>
  <symbol id="i-download" viewBox="0 0 24 24">
    <path d="M5 20h14v-2H5v2z"/>
    <path d="M11 3h2v9h3l-4 4-4-4h3V3z"/>
  </symbol>
  <symbol id="i-trash" viewBox="0 0 24 24">
    <path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z"/>
  </symbol>
  <symbol id="i-edit" viewBox="0 0 24 24">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
    <path d="M20.71 7.04a1 1 0 000-1.41L18.37 3.29a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </symbol>
  <symbol id="i-print" viewBox="0 0 24 24">
    <path d="M6 9V3h12v6H6zm10-4H8v2h8V5z"/>
    <path d="M6 19v2h12v-2H6z"/>
    <path d="M19 10H5a3 3 0 00-3 3v4h4v-3h12v3h4v-4a3 3 0 00-3-3z"/>
  </symbol>
  <symbol id="i-csv" viewBox="0 0 24 24">
    <path d="M6 2h9l5 5v15a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z"/>
    <path d="M14 2v6h6"/>
    <path d="M7 14h10v2H7v-2zm0 4h10v2H7v-2z"/>
  </symbol>
  <symbol id="i-search" viewBox="0 0 24 24">
    <path d="M10 2a8 8 0 105.29 14l4.7 4.7 1.41-1.41-4.7-4.7A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
  </symbol>

  <symbol id="i-chevron-left" viewBox="0 0 24 24">
    <path d="M15 18l-6-6 6-6 1.4 1.4L11.8 12l4.6 4.6L15 18z"/>
  </symbol>

  <symbol id="i-chevron-right" viewBox="0 0 24 24">
    <path d="M9 6l6 6-6 6-1.4-1.4 4.6-4.6L7.6 7.4 9 6z"/>
  </symbol>

  <symbol id="i-close" viewBox="0 0 24 24">
    <path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4z"/>
  </symbol>
</svg>

<script src="app.js"></script>
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function (err) {
        console.log('SW registration failed:', err);
      });
    });
  }
</script>

  <!-- Monitor Carousel (Digital Signage) -->
  <div id="monitor-carousel" class="monitor-carousel" aria-hidden="true">
    <div class="monitor-topbar">
      <div class="monitor-brand">
        <img src="tsh.png" alt="TSH" class="monitor-logo">
        <div class="monitor-title">
          <div class="monitor-title-main">生産進捗 モニタ</div>
          <div class="monitor-title-sub" id="monitor-clock">--:--</div>
        </div>
      </div>
      <div class="monitor-controls">
        <button class="ghost-button ghost-small" id="monitor-prev" title="前へ" aria-label="前へ">
          <svg class="icon"><use href="#i-chevron-left"></use></svg>
        </button>
        <div class="monitor-dots" id="monitor-dots" aria-label="スライド選択"></div>
        <button class="ghost-button ghost-small" id="monitor-next" title="次へ" aria-label="次へ">
          <svg class="icon"><use href="#i-chevron-right"></use></svg>
        </button>
        <button class="ghost-button ghost-small" id="btn-exit-monitor" title="通常表示へ" aria-label="通常表示へ">
          <svg class="icon"><use href="#i-close"></use></svg>
          戻る
        </button>
      </div>
    </div>
    <div class="monitor-viewport">
      <div class="monitor-track" id="monitor-track">
        
        <div class="monitor-slide" data-slide="0"></div>
        <div class="monitor-slide" data-slide="1"></div>
        <div class="monitor-slide" data-slide="2"></div>
        <div class="monitor-slide" data-slide="3"></div>
        <div class="monitor-slide" data-slide="4"></div>
        <div class="monitor-slide" data-slide="5"></div>
        <div class="monitor-slide" data-slide="6"></div>
        <div class="monitor-slide" data-slide="7"></div>
      </div>
    </div>
  </div>
</body>
</html>
