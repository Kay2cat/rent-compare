/**
 * 主應用程式 — 初始化所有模組、綁定事件、管理狀態
 */
const App = (() => {
  // 應用狀態
  let _state = {
    properties: [],  // enriched properties
    votes: [],
    tagDefs: [],
    voterName: '',
    scriptUrl: '',
    roommateCount: 3,
    utilityEstimate: 1500,
    isDemo: true,
    currentView: 'table',
  };

  /**
   * 初始化
   */
  async function init() {
    _loadSettings();
    _parseUrlParams();
    _bindEvents();

    // 如果沒有設定 Script URL，進入 Demo 模式
    if (!_state.scriptUrl) {
      _state.isDemo = true;
      _loadDemoData();
    } else {
      _state.isDemo = false;
      DataService.init(_state.scriptUrl);
      await _fetchData();
    }

    _updateUI();
  }

  /**
   * 從 URL 參數讀取設定
   */
  function _parseUrlParams() {
    const params = new URLSearchParams(window.location.search);

    if (params.has('voter')) {
      _state.voterName = params.get('voter');
      localStorage.setItem('rc_voterName', _state.voterName);
    }

    if (params.has('api')) {
      _state.scriptUrl = params.get('api');
      localStorage.setItem('rc_scriptUrl', _state.scriptUrl);
    }
  }

  /**
   * 從 localStorage 讀取設定
   */
  function _loadSettings() {
    _state.voterName = localStorage.getItem('rc_voterName') || '';
    _state.scriptUrl = localStorage.getItem('rc_scriptUrl') || '';
    _state.roommateCount = parseInt(localStorage.getItem('rc_roommateCount')) || 3;
    _state.utilityEstimate = parseInt(localStorage.getItem('rc_utilityEstimate')) || 1500;
  }

  /**
   * 儲存設定
   */
  function _saveSettings() {
    localStorage.setItem('rc_voterName', _state.voterName);
    localStorage.setItem('rc_scriptUrl', _state.scriptUrl);
    localStorage.setItem('rc_roommateCount', _state.roommateCount);
    localStorage.setItem('rc_utilityEstimate', _state.utilityEstimate);
  }

  /**
   * 載入 Demo 資料
   */
  function _loadDemoData() {
    const demo = DataService.getDemoData();
    _state.tagDefs = demo.tagDefs;
    _state.votes = demo.votes;
    _state.voterName = _state.voterName || '小明';

    // 初始化模組
    CostCalc.setConfig(_state.roommateCount, _state.utilityEstimate);
    TagSystem.init(_state.tagDefs, _onFilterChange);
    VotePanel.setConfig(_state.voterName, _state.roommateCount, true);

    // enriched
    _state.properties = CostCalc.enrichAll(demo.properties);

    _hideLoading();
  }

  /**
   * 從 API 讀取資料
   */
  async function _fetchData() {
    _showLoading();
    try {
      const data = await DataService.fetchAll();
      _state.tagDefs = data.tagDefs;
      _state.votes = data.votes;

      CostCalc.setConfig(_state.roommateCount, _state.utilityEstimate);
      TagSystem.init(_state.tagDefs, _onFilterChange);
      VotePanel.setConfig(_state.voterName, _state.roommateCount, false);

      _state.properties = CostCalc.enrichAll(data.properties);
      _hideLoading();
    } catch (err) {
      console.error('載入資料失敗:', err);
      _hideLoading();
      showToast('無法連接 Google Sheets，切換為 Demo 模式', 'info');
      _state.isDemo = true;
      _loadDemoData();
    }
  }

  /**
   * 更新所有 UI
   */
  function _updateUI() {
    // 更新 voter 顯示
    document.getElementById('voter-name').textContent =
      _state.isDemo ? `${_state.voterName}（Demo 模式）` : _state.voterName;

    // 如果沒有投票者名稱，顯示設定 Modal
    if (!_state.voterName) {
      _showSettings();
    }

    // 摘要卡片
    _updateSummary();

    // 篩選標籤列
    const filterBar = document.getElementById('tag-filter-bar');
    TagSystem.renderFilterBar(filterBar, _state.properties);

    // 渲染目前的檢視
    _renderCurrentView();
  }

  /**
   * 更新摘要卡片
   */
  function _updateSummary() {
    const props = _state.properties;
    const votes = _state.votes;

    // 物件數
    document.getElementById('stat-count').textContent = props.length;

    // 平均月租
    if (props.length > 0) {
      const avgRent = props.reduce((s, p) => s + (parseFloat(p.rent) || 0), 0) / props.length;
      document.getElementById('stat-avg-rent').textContent = `$${CostCalc.formatMoney(avgRent)}`;
    }

    // 最低月租
    if (props.length > 0) {
      const minRent = Math.min(...props.map(p => parseFloat(p.rent) || Infinity));
      document.getElementById('stat-min-rent').textContent = `$${CostCalc.formatMoney(minRent)}`;
    }

    // 投票進度
    const totalVotable = props.length * _state.roommateCount;
    const totalVoted = votes.length;
    const pct = totalVotable > 0 ? Math.round(totalVoted / totalVotable * 100) : 0;
    document.getElementById('stat-vote-progress').textContent = `${pct}%`;
  }

  /**
   * 渲染目前的檢視
   */
  function _renderCurrentView() {
    const filtered = TagSystem.filterProperties(
      _state.properties,
      TagSystem.getActiveFilters()
    );

    // 空狀態
    const emptyEl = document.getElementById('empty-state');
    const loadingEl = document.getElementById('loading');
    if (filtered.length === 0 && loadingEl.style.display === 'none') {
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
    }

    switch (_state.currentView) {
      case 'table':
        TableView.render(filtered, _state.votes);
        break;
      case 'map':
        MapView.render(filtered, _state.votes);
        MapView.invalidateSize();
        break;
      case 'chart':
        ChartView.render(filtered, _state.votes);
        break;
      case 'vote':
        VotePanel.render(filtered, _state.votes);
        break;
    }
  }

  /**
   * 篩選變更回呼
   */
  function _onFilterChange(activeFilters) {
    _renderCurrentView();
  }

  /**
   * 綁定事件
   */
  function _bindEvents() {
    // 檢視切換
    document.querySelectorAll('.view-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const view = tab.dataset.view;
        _state.currentView = view;

        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${view}`).classList.add('active');

        _renderCurrentView();
      });
    });

    // Header 點擊 → 開設定
    document.getElementById('voter-badge').addEventListener('click', _showSettings);

    // 設定 Modal
    document.getElementById('btn-save-settings').addEventListener('click', () => {
      _state.scriptUrl = document.getElementById('input-script-url').value.trim();
      _state.voterName = document.getElementById('input-voter-name').value.trim() || '使用者';
      _state.roommateCount = parseInt(document.getElementById('input-roommate-count').value) || 3;
      _state.utilityEstimate = parseInt(document.getElementById('input-utility-estimate').value) || 1500;

      _saveSettings();
      _hideSettings();

      // 重新初始化
      if (_state.scriptUrl) {
        _state.isDemo = false;
        DataService.init(_state.scriptUrl);
        _fetchData().then(_updateUI);
      } else {
        _state.isDemo = true;
        CostCalc.setConfig(_state.roommateCount, _state.utilityEstimate);
        VotePanel.setConfig(_state.voterName, _state.roommateCount, true);
        _state.properties = CostCalc.enrichAll(_state.properties.map(p => {
          const { _perPerson, _perPersonTotal, _annualCost, _costRank, _costRatio, ...raw } = p;
          return raw;
        }));
        _updateUI();
      }
    });

    document.getElementById('btn-cancel-settings').addEventListener('click', _hideSettings);

    document.getElementById('settings-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) _hideSettings();
    });

    // 鍵盤 ESC 關閉 Modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _hideSettings();
    });
  }

  function _showSettings() {
    document.getElementById('input-script-url').value = _state.scriptUrl;
    document.getElementById('input-voter-name').value = _state.voterName;
    document.getElementById('input-roommate-count').value = _state.roommateCount;
    document.getElementById('input-utility-estimate').value = _state.utilityEstimate;
    document.getElementById('settings-modal').classList.add('open');
  }

  function _hideSettings() {
    document.getElementById('settings-modal').classList.remove('open');
  }

  function _showLoading() {
    document.getElementById('loading').style.display = 'flex';
  }

  function _hideLoading() {
    document.getElementById('loading').style.display = 'none';
  }

  /**
   * Toast 通知
   * @param {string} msg
   * @param {string} type - 'success' | 'error' | 'info'
   */
  function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast toast--${type} show`;

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  /**
   * 重新整理所有資料（投票後呼叫）
   */
  function refreshAll() {
    if (_state.isDemo) {
      // Demo 模式直接重新渲染
      _updateSummary();
      _renderCurrentView();
    } else {
      _fetchData().then(_updateUI);
    }
  }

  return {
    init,
    showToast,
    refreshAll,
  };
})();

// 啟動
document.addEventListener('DOMContentLoaded', () => App.init());
