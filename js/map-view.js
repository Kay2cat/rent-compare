/**
 * 地圖檢視模組 — Leaflet.js 地圖 + 標記點 + 彈出卡片
 */
const MapView = (() => {
  let _map = null;
  let _markers = [];
  let _initialized = false;

  // 標記顏色 — 依投票分數
  const SCORE_COLORS = {
    high: '#4a9a6a',   // ≥ 4 分
    mid: '#c0943a',    // 3~4 分
    low: '#bf5a50',    // < 3 分
    none: '#4a7c72',   // 未投票
  };

  /**
   * 初始化地圖
   */
  function init() {
    if (_initialized) return;

    const container = document.getElementById('map-container');
    if (!container) return;

    // 台北市中心
    _map = L.map(container, {
      center: [25.033, 121.565],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // OpenStreetMap 圖層 — 使用淺色更暖的 CartoDB Voyager
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(_map);

    _initialized = true;
  }

  /**
   * 渲染標記
   * @param {Array} properties - enriched properties
   * @param {Array} votes - 投票陣列
   */
  function render(properties, votes) {
    if (!_initialized) init();
    if (!_map) return;

    // 清除舊標記
    _markers.forEach(m => _map.removeLayer(m));
    _markers = [];

    const validProperties = properties.filter(p => p.lat && p.lng);

    const bounds = L.latLngBounds([]);

    // 通勤目的地標記（室友的公司/學校）
    Commute.getDestinations().forEach(d => {
      const icon = L.divIcon({
        className: '',
        html: `<div class="dest-marker">🎯<span class="dest-marker__label">${d.name}</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([parseFloat(d.lat), parseFloat(d.lng)], { icon })
        .addTo(_map)
        .bindPopup(`<b>🎯 ${d.name}</b><br>${d.address || ''}`);
      bounds.extend([parseFloat(d.lat), parseFloat(d.lng)]);
      _markers.push(marker);
    });

    if (validProperties.length === 0 && _markers.length === 0) return;

    validProperties.forEach(p => {
      const avg = _getAvgVote(p.name, votes);
      const color = _getColor(avg);

      // 自訂 icon — 顯示價格
      const priceLabel = `${Math.round((parseFloat(p.rent) || 0) / 1000)}K`;
      const icon = L.divIcon({
        className: '',
        html: `
          <div class="map-marker" style="background: ${color};">
            <span class="map-marker__label">${priceLabel}</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([parseFloat(p.lat), parseFloat(p.lng)], { icon })
        .addTo(_map);

      // 彈出卡片
      const popupHtml = _buildPopup(p, avg, votes);
      marker.bindPopup(popupHtml, {
        maxWidth: 280,
        className: 'custom-popup',
      });

      bounds.extend([parseFloat(p.lat), parseFloat(p.lng)]);
      _markers.push(marker);
    });

    // 調整視角到所有標記
    if (bounds.isValid()) {
      _map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  /**
   * 重新整理地圖大小（切換 tab 時需要呼叫）
   */
  function invalidateSize() {
    if (_map) {
      setTimeout(() => _map.invalidateSize(), 100);
    }
  }

  function _getAvgVote(propertyName, votes) {
    const pv = votes.filter(v => v.propertyName === propertyName);
    if (pv.length === 0) return null;
    return pv.reduce((s, v) => s + (parseFloat(v.score) || 0), 0) / pv.length;
  }

  function _getColor(avg) {
    if (avg === null) return SCORE_COLORS.none;
    if (avg >= 4) return SCORE_COLORS.high;
    if (avg >= 3) return SCORE_COLORS.mid;
    return SCORE_COLORS.low;
  }

  function _buildPopup(property, avg, votes) {
    const priceStr = CostCalc.formatMoney(property.rent);
    const ppStr = CostCalc.formatMoney(property._perPersonTotal || property._perPerson || 0);
    const voteStr = avg !== null ? `⭐ ${avg.toFixed(1)}` : '尚未投票';
    const statusStr = property.huntStatus && property.huntStatus !== '候選'
      ? `<span style="font-size:0.75rem;padding:1px 8px;border-radius:999px;background:rgba(0,0,0,0.06);margin-left:6px;">${property.huntStatus}</span>` : '';

    // 通勤距離
    const ds = Commute.distancesFor(property);
    const commuteHtml = ds && ds.length > 0
      ? `<div style="font-size:0.8rem;color:#4a7c72;margin-top:4px;">${ds.map(d => `🎯 ${d.name} ${d.km.toFixed(1)}km`).join(' · ')}</div>`
      : '';

    // 標籤 HTML
    const allTags = [...TagSystem.parseTags(property.pros), ...TagSystem.parseTags(property.cons)];
    const tagsHtml = allTags.map(t => {
      const style = TagSystem.getTagStyle(t, false);
      const isCon = style.cssClass === 'tag--con';
      const bg = isCon ? 'rgba(191, 90, 80, 0.1)' : 'rgba(74, 124, 114, 0.1)';
      const color = isCon ? '#bf5a50' : '#4a7c72';
      const emoji = style.emoji ? `${style.emoji} ` : '';
      return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;margin:2px;background:${bg};color:${color};">${emoji}${t}</span>`;
    }).join('');

    return `
      <div class="map-popup">
        <div class="map-popup__title">${property.name || '未命名'}${statusStr}</div>
        <div class="map-popup__price">$${priceStr}/月 · $${ppStr}/人</div>
        <div class="map-popup__address">${property.address || ''}</div>
        <div style="margin-top:4px;font-size:0.85rem;">${voteStr}</div>
        ${commuteHtml}
        ${property.layout ? `<div style="font-size:0.8rem;color:#888;margin-top:2px;">${property.layout} · ${property.size || '?'}坪 · ${property.floor || ''}</div>` : ''}
        ${tagsHtml ? `<div class="map-popup__tags">${tagsHtml}</div>` : ''}
        ${property.url ? `<a href="${property.url}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:0.8rem;color:#a5b4fc;">🔗 查看原始頁面</a>` : ''}
      </div>
    `;
  }

  return { init, render, invalidateSize };
})();
