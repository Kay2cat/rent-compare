/**
 * 比較檢視模組 — 雷達圖 + 加權決策矩陣
 * 1. 雷達圖：勾選最多 3 個物件做形狀比較
 * 2. 權重設定：每位室友依重視程度調整各面向權重
 * 3. 加權排行榜：所有物件依加權總分排名，幫助達成共識
 */
const ChartView = (() => {
  let _chart = null;
  let _properties = [];
  let _votes = [];
  let _selected = new Set(); // 已勾選的物件名稱
  let _weights = {};         // 各維度權重 0-5
  const MAX_SELECT = 3;

  // 雷達圖色彩
  const CHART_COLORS = [
    { bg: 'rgba(74, 124, 114, 0.15)', border: '#4a7c72' },
    { bg: 'rgba(192, 117, 58, 0.15)', border: '#c0753a' },
    { bg: 'rgba(138, 106, 173, 0.15)', border: '#8a6aad' },
  ];

  /**
   * 動態維度定義 — 有通勤目的地時多一軸
   */
  function _getDimensions() {
    const dims = [
      { key: 'rent',      label: '💰 租金' },
      { key: 'size',      label: '📐 坪數' },
      { key: 'transport', label: '🚇 交通' },
      { key: 'facility',  label: '🏢 設施' },
      { key: 'vote',      label: '⭐ 投票' },
    ];
    if (Commute.hasDestinations()) {
      dims.push({ key: 'commute', label: '🎯 通勤' });
    }
    return dims;
  }

  function _loadWeights() {
    try {
      const saved = JSON.parse(localStorage.getItem('rc_weights') || '{}');
      _weights = saved;
    } catch (e) { _weights = {}; }
    // 預設權重 3
    _getDimensions().forEach(d => {
      if (typeof _weights[d.key] !== 'number') _weights[d.key] = 3;
    });
  }

  function _saveWeights() {
    localStorage.setItem('rc_weights', JSON.stringify(_weights));
  }

  /**
   * 渲染
   * @param {Array} properties
   * @param {Array} votes
   */
  function render(properties, votes) {
    _properties = properties;
    _votes = votes;
    _loadWeights();

    _renderSelector();
    _renderWeights();
    _renderRanking();
    _updateChart();
  }

  /**
   * 計算所有物件的各維度分數（0-5，於全體物件間正規化）
   * @returns {Map<string, Object>} 物件名稱 → { rent, size, transport, facility, vote, commute? }
   */
  function _computeScores() {
    const scores = new Map();
    if (_properties.length === 0) return scores;

    const allRents = _properties.map(p => parseFloat(p.rent) || 0);
    const allSizes = _properties.map(p => parseFloat(p.size) || 0);
    const maxRent = Math.max(...allRents);
    const minRent = Math.min(...allRents);
    const maxSize = Math.max(...allSizes);

    // 通勤：以平均距離正規化（越近越高分）
    let commuteVals = null;
    if (Commute.hasDestinations()) {
      commuteVals = _properties.map(p => Commute.avgDistance(p));
      const valid = commuteVals.filter(v => v !== null);
      var maxCommute = valid.length > 0 ? Math.max(...valid) : 0;
      var minCommute = valid.length > 0 ? Math.min(...valid) : 0;
    }

    _properties.forEach((p, idx) => {
      const rent = parseFloat(p.rent) || 0;
      const size = parseFloat(p.size) || 0;

      // 租金分 — 反向（越便宜越高分）
      const rentScore = maxRent > minRent
        ? ((maxRent - rent) / (maxRent - minRent)) * 5
        : 2.5;

      // 坪數分
      const sizeScore = maxSize > 0 ? (size / maxSize) * 5 : 0;

      // 交通分 / 設施分 — 依標籤數
      const transportScore = Math.min(TagSystem.countByCategory(p.pros, '交通') * 2.5, 5);
      const facilityScore = Math.min(TagSystem.countByCategory(p.pros, '設施') * 1.5, 5);

      // 投票分
      const pVotes = _votes.filter(v => v.propertyName === p.name);
      const voteScore = pVotes.length > 0
        ? pVotes.reduce((s, v) => s + (parseFloat(v.score) || 0), 0) / pVotes.length
        : 0;

      const s = {
        rent: rentScore,
        size: sizeScore,
        transport: transportScore,
        facility: facilityScore,
        vote: voteScore,
      };

      // 通勤分 — 反向（越近越高分）
      if (commuteVals) {
        const cv = commuteVals[idx];
        if (cv === null) {
          s.commute = 0;
        } else {
          s.commute = maxCommute > minCommute
            ? ((maxCommute - cv) / (maxCommute - minCommute)) * 5
            : 2.5;
        }
      }

      scores.set(p.name, s);
    });

    return scores;
  }

  /**
   * 加權總分（0-5）
   */
  function _weightedScore(dimScores) {
    const dims = _getDimensions();
    let sum = 0, wSum = 0;
    dims.forEach(d => {
      const w = _weights[d.key] || 0;
      sum += (dimScores[d.key] || 0) * w;
      wSum += w;
    });
    return wSum > 0 ? sum / wSum : 0;
  }

  /**
   * 渲染物件選擇器
   */
  function _renderSelector() {
    const container = document.getElementById('chart-selector');
    if (!container) return;

    // 保留標題
    const title = container.querySelector('.chart-selector__title');
    container.innerHTML = '';
    if (title) container.appendChild(title);

    _properties.forEach((p, i) => {
      const item = document.createElement('label');
      item.className = 'chart-selector__item';

      const checked = _selected.has(p.name);
      const disabled = !checked && _selected.size >= MAX_SELECT;
      if (disabled) item.classList.add('disabled');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checked;
      cb.disabled = disabled;
      cb.addEventListener('change', () => {
        if (cb.checked) {
          _selected.add(p.name);
        } else {
          _selected.delete(p.name);
        }
        _renderSelector();
        _renderRanking();
        _updateChart();
      });

      const label = document.createElement('span');
      label.style.fontSize = '0.85rem';
      label.style.color = checked ? 'var(--text-primary)' : 'var(--text-secondary)';
      label.textContent = `${p.name}`;

      // 色塊
      if (checked) {
        const idx = Array.from(_selected).indexOf(p.name);
        const dot = document.createElement('span');
        dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${CHART_COLORS[idx]?.border || '#fff'};flex-shrink:0;`;
        item.appendChild(cb);
        item.appendChild(dot);
        item.appendChild(label);
      } else {
        item.appendChild(cb);
        item.appendChild(label);
      }

      container.appendChild(item);
    });
  }

  /**
   * 渲染權重滑桿
   */
  function _renderWeights() {
    const container = document.getElementById('chart-weights');
    if (!container) return;
    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'chart-selector__title';
    title.textContent = '⚖️ 你在乎什麼？（拖動權重）';
    container.appendChild(title);

    _getDimensions().forEach(d => {
      const row = document.createElement('div');
      row.className = 'weight-row';

      const label = document.createElement('span');
      label.className = 'weight-row__label';
      label.textContent = d.label;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = 0;
      slider.max = 5;
      slider.step = 1;
      slider.value = _weights[d.key];
      slider.className = 'weight-row__slider';

      const value = document.createElement('span');
      value.className = 'weight-row__value';
      value.textContent = _weights[d.key];

      slider.addEventListener('input', () => {
        _weights[d.key] = parseInt(slider.value);
        value.textContent = slider.value;
        _saveWeights();
        _renderRanking();
      });

      row.appendChild(label);
      row.appendChild(slider);
      row.appendChild(value);
      container.appendChild(row);
    });

    const hint = document.createElement('div');
    hint.className = 'weight-hint';
    hint.textContent = '權重只存在你自己的瀏覽器，每位室友可以有不同的偏好設定';
    container.appendChild(hint);
  }

  /**
   * 渲染加權排行榜
   */
  function _renderRanking() {
    const container = document.getElementById('chart-ranking');
    if (!container) return;
    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'chart-selector__title';
    title.textContent = '🏆 加權總分排行（依你的權重）';
    container.appendChild(title);

    if (_properties.length === 0) return;

    const scores = _computeScores();
    const ranked = _properties
      .map(p => ({ p, score: _weightedScore(scores.get(p.name) || {}) }))
      .sort((a, b) => b.score - a.score);

    const maxScore = Math.max(...ranked.map(r => r.score), 0.001);

    ranked.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'rank-row';
      if (r.p.huntStatus === '淘汰') row.classList.add('rank-row--eliminated');
      if (_selected.has(r.p.name)) row.classList.add('rank-row--selected');

      const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;

      const rankEl = document.createElement('span');
      rankEl.className = 'rank-row__medal';
      rankEl.textContent = medal;

      const nameEl = document.createElement('span');
      nameEl.className = 'rank-row__name';
      nameEl.textContent = r.p.name;
      nameEl.title = '點擊加入/移出雷達圖比較';

      const barWrap = document.createElement('div');
      barWrap.className = 'rank-row__bar';
      const bar = document.createElement('div');
      bar.className = 'rank-row__bar-fill';
      requestAnimationFrame(() => {
        bar.style.width = `${(r.score / maxScore) * 100}%`;
      });
      barWrap.appendChild(bar);

      const scoreEl = document.createElement('span');
      scoreEl.className = 'rank-row__score';
      scoreEl.textContent = r.score.toFixed(2);

      row.appendChild(rankEl);
      row.appendChild(nameEl);
      row.appendChild(barWrap);
      row.appendChild(scoreEl);

      // 點擊整列 → 切換雷達圖勾選
      row.addEventListener('click', () => {
        if (_selected.has(r.p.name)) {
          _selected.delete(r.p.name);
        } else if (_selected.size < MAX_SELECT) {
          _selected.add(r.p.name);
        } else {
          App.showToast(`雷達圖最多比較 ${MAX_SELECT} 個物件`, 'info');
          return;
        }
        _renderSelector();
        _renderRanking();
        _updateChart();
      });

      container.appendChild(row);
    });
  }

  /**
   * 更新雷達圖
   */
  function _updateChart() {
    const canvas = document.getElementById('radar-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 收集已選物件資料
    const selectedArr = _properties.filter(p => _selected.has(p.name));

    if (selectedArr.length === 0) {
      if (_chart) {
        _chart.destroy();
        _chart = null;
      }
      // 顯示提示
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9c958e';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('請勾選 2-3 個物件進行比較（也可點排行榜的列）', canvas.width / 2, canvas.height / 2);
      return;
    }

    const dims = _getDimensions();
    const scores = _computeScores();

    const datasets = selectedArr.map((p, i) => {
      const s = scores.get(p.name) || {};
      const colorIdx = i % CHART_COLORS.length;

      return {
        label: p.name,
        data: dims.map(d => Math.round((s[d.key] || 0) * 10) / 10),
        backgroundColor: CHART_COLORS[colorIdx].bg,
        borderColor: CHART_COLORS[colorIdx].border,
        borderWidth: 2,
        pointBackgroundColor: CHART_COLORS[colorIdx].border,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });

    // 銷毀舊圖表
    if (_chart) _chart.destroy();

    _chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: dims.map(d => d.label),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#6b6560',
              font: { family: 'Inter, Noto Sans TC, sans-serif', size: 12 },
              padding: 16,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(45, 42, 38, 0.9)',
            titleColor: '#f6f4f1',
            bodyColor: '#d5d0ca',
            borderColor: 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
          },
        },
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              color: '#9c958e',
              backdropColor: 'transparent',
              font: { size: 10 },
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.06)',
            },
            angleLines: {
              color: 'rgba(0, 0, 0, 0.06)',
            },
            pointLabels: {
              color: '#6b6560',
              font: { family: 'Inter, Noto Sans TC, sans-serif', size: 13, weight: '500' },
            },
          },
        },
      },
    });
  }

  return { render };
})();
