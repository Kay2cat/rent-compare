/**
 * 主應用程式 — 初始化所有模組、綁定事件、管理狀態
 */
const App = (() => {
  // 應用狀態
  let _state = {
    properties: [],  // enriched properties
    votes: [],
    tagDefs: [],
    destinations: [],
    voterName: '',
    scriptUrl: '',
    roommateCount: 3,
    hideEliminated: false,
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
    QuickAdd.bindEvents();

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
    _state.hideEliminated = localStorage.getItem('rc_hideEliminated') === '1';
  }

  /**
   * 儲存設定
   */
  function _saveSettings() {
    localStorage.setItem('rc_voterName', _state.voterName);
    localStorage.setItem('rc_scriptUrl', _state.scriptUrl);
    localStorage.setItem('rc_roommateCount', _state.roommateCount);
    localStorage.setItem('rc_hideEliminated', _state.hideEliminated ? '1' : '0');
  }

  /**
   * 設定各模組的共用組態
   */
  function _configModules() {
    CostCalc.setConfig(_state.roommateCount);
    TagSystem.init(_state.tagDefs, _onFilterChange);
    VotePanel.setConfig(_state.voterName, _state.roommateCount, _state.isDemo);
    TableView.setConfig(_state.isDemo);
    QuickAdd.setConfig(_state.isDemo);
    Commute.setDestinations(_state.destinations);
  }

  /**
   * 載入 Demo 資料
   */
  function _loadDemoData() {
    const demo = DataService.getDemoData();
    _state.tagDefs = demo.tagDefs;
    _state.votes = demo.votes;
    _state.destinations = demo.destinations || [];
    _state.voterName = _state.voterName || '小明';

    _configModules();

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
      _state.destinations = data.destinations || [];

      _configModules();

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

    // 隱藏已淘汰 toggle 狀態
    const toggle = document.getElementById('toggle-hide-eliminated');
    if (toggle) toggle.checked = _state.hideEliminated;

    // 渲染目前的檢視
    _renderCurrentView();
  }

  /**
   * 更新摘要卡片
   */
  function _updateSummary() {
    const props = _state.properties;
    const activeProps = props.filter(p => p.huntStatus !== '淘汰');
    const votes = _state.votes;

    // 物件數（顯示 有效/全部）
    const countEl = document.getElementById('stat-count');
    countEl.textContent = activeProps.length < props.length
      ? `${activeProps.length}/${props.length}`
      : props.length;

    // 平均月租（只算未淘汰）
    const base = activeProps.length > 0 ? activeProps : props;
    if (base.length > 0) {
      const avgRent = base.reduce((s, p) => s + (parseFloat(p.rent) || 0), 0) / base.length;
      document.getElementById('stat-avg-rent').textContent = `$${CostCalc.formatMoney(avgRent)}`;

      const minRent = Math.min(...base.map(p => parseFloat(p.rent) || Infinity));
      document.getElementById('stat-min-rent').textContent = `$${CostCalc.formatMoney(minRent)}`;
    }

    // 投票進度（淘汰物件不計入分母）
    const votableNames = new Set(activeProps.map(p => p.name));
    const totalVotable = activeProps.length * _state.roommateCount;
    const totalVoted = votes.filter(v => votableNames.has(v.propertyName)).length;
    const pct = totalVotable > 0 ? Math.min(100, Math.round(totalVoted / totalVotable * 100)) : 0;
    document.getElementById('stat-vote-progress').textContent = `${pct}%`;
  }

  /**
   * 渲染目前的檢視
   */
  function _renderCurrentView() {
    let filtered = TagSystem.filterProperties(
      _state.properties,
      TagSystem.getActiveFilters()
    );

    // 隱藏已淘汰
    if (_state.hideEliminated) {
      filtered = filtered.filter(p => p.huntStatus !== '淘汰');
    }

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

    // 隱藏已淘汰 toggle
    const toggle = document.getElementById('toggle-hide-eliminated');
    if (toggle) {
      toggle.addEventListener('change', () => {
        _state.hideEliminated = toggle.checked;
        _saveSettings();
        _renderCurrentView();
      });
    }

    // 設定 Modal
    document.getElementById('btn-save-settings').addEventListener('click', () => {
      _state.scriptUrl = document.getElementById('input-script-url').value.trim();
      _state.voterName = document.getElementById('input-voter-name').value.trim() || '使用者';
      _state.roommateCount = parseInt(document.getElementById('input-roommate-count').value) || 3;

      _saveSettings();
      _hideSettings();

      // 重新初始化
      if (_state.scriptUrl) {
        _state.isDemo = false;
        DataService.init(_state.scriptUrl);
        _fetchData().then(_updateUI);
      } else {
        _state.isDemo = true;
        _configModules();
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
      if (e.key === 'Escape') {
        _hideSettings();
        QuickAdd.close();
      }
    });
  }

  function _showSettings() {
    document.getElementById('input-script-url').value = _state.scriptUrl;
    document.getElementById('input-voter-name').value = _state.voterName;
    document.getElementById('input-roommate-count').value = _state.roommateCount;
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
   * Demo 模式下新增物件（快速新增 Modal 使用）
   */
  function addDemoProperty(payload) {
    const raw = _state.properties.map(p => {
      const { _perPerson, _perPersonTotal, _annualCost, _costRank, _costRatio, ...rest } = p;
      return rest;
    });
    raw.push({
      ...payload,
      pros: '', cons: '', images: '', notes: '',
      lat: '', lng: '', status: 'Demo', huntStatus: '候選',
    });
    _state.properties = CostCalc.enrichAll(raw);
    _updateUI();
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
    addDemoProperty,
  };
})();

// 啟動
document.addEventListener('DOMContentLoaded', () => App.init());
