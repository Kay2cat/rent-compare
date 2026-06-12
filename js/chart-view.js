/**
 * 雷達圖比較模組 — Chart.js 雷達圖
 */
const ChartView = (() => {
  let _chart = null;
  let _properties = [];
  let _votes = [];
  let _selected = new Set(); // 已勾選的物件名稱
  const MAX_SELECT = 3;

  // 雷達圖色彩
  const CHART_COLORS = [
    { bg: 'rgba(74, 124, 114, 0.15)', border: '#4a7c72' },
    { bg: 'rgba(192, 117, 58, 0.15)', border: '#c0753a' },
    { bg: 'rgba(138, 106, 173, 0.15)', border: '#8a6aad' },
  ];

  /**
   * 渲染
   * @param {Array} properties
   * @param {Array} votes
   */
  function render(properties, votes) {
    _properties = properties;
    _votes = votes;

    _renderSelector();
    _updateChart();
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
      ctx.fillText('請從左側勾選 2-3 個物件進行比較', canvas.width / 2, canvas.height / 2);
      return;
    }

    // 計算各維度分數（正規化到 0-5）
    const allRents = _properties.map(p => parseFloat(p.rent) || 0);
    const allSizes = _properties.map(p => parseFloat(p.size) || 0);
    const maxRent = Math.max(...allRents);
    const minRent = Math.min(...allRents);
    const maxSize = Math.max(...allSizes);

    const datasets = selectedArr.map((p, i) => {
      const rent = parseFloat(p.rent) || 0;
      const size = parseFloat(p.size) || 0;

      // 租金分 — 反向（越便宜越高分）
      const rentScore = maxRent > minRent
        ? ((maxRent - rent) / (maxRent - minRent)) * 5
        : 2.5;

      // 坪數分
      const sizeScore = maxSize > 0 ? (size / maxSize) * 5 : 0;

      // 交通分 — 依交通類標籤數
      const transportScore = Math.min(TagSystem.countByCategory(p.pros, '交通') * 2.5, 5);

      // 設施分 — 依設施類標籤數
      const facilityScore = Math.min(TagSystem.countByCategory(p.pros, '設施') * 1.5, 5);

      // 投票分
      const pVotes = _votes.filter(v => v.propertyName === p.name);
      const avgVote = pVotes.length > 0
        ? pVotes.reduce((s, v) => s + (parseFloat(v.score) || 0), 0) / pVotes.length
        : 0;

      const colorIdx = i % CHART_COLORS.length;

      return {
        label: p.name,
        data: [
          Math.round(rentScore * 10) / 10,
          Math.round(sizeScore * 10) / 10,
          Math.round(transportScore * 10) / 10,
          Math.round(facilityScore * 10) / 10,
          Math.round(avgVote * 10) / 10,
        ],
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
        labels: ['💰 租金', '📐 坪數', '🚇 交通', '🏢 設施', '⭐ 投票'],
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
