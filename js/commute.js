/**
 * 通勤模組 — 計算物件到各室友目的地的直線距離
 * 目的地來源：Google Sheet「通勤目的地」工作表（名稱/地址/緯度/經度）
 * 註：直線距離 × 1.3 約略等於市區實際路程，僅供相對比較
 */
const Commute = (() => {
  let _destinations = [];

  /**
   * 設定目的地清單
   * @param {Array} destinations - [{ name, address, lat, lng }]
   */
  function setDestinations(destinations) {
    _destinations = (destinations || []).filter(d => d.lat && d.lng);
  }

  function getDestinations() {
    return _destinations;
  }

  function hasDestinations() {
    return _destinations.length > 0;
  }

  /**
   * Haversine 直線距離（公里）
   */
  function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * 計算單一物件到所有目的地的距離
   * @param {Object} property
   * @returns {Array<{name, km}>|null}
   */
  function distancesFor(property) {
    if (!hasDestinations()) return null;
    const lat = parseFloat(property.lat);
    const lng = parseFloat(property.lng);
    if (!lat || !lng) return null;

    return _destinations.map(d => ({
      name: d.name,
      km: distanceKm(lat, lng, parseFloat(d.lat), parseFloat(d.lng)),
    }));
  }

  /**
   * 平均距離（用於排序與雷達圖計分）
   * @param {Object} property
   * @returns {number|null}
   */
  function avgDistance(property) {
    const ds = distancesFor(property);
    if (!ds || ds.length === 0) return null;
    return ds.reduce((s, d) => s + d.km, 0) / ds.length;
  }

  /**
   * 渲染表格內的通勤距離小卡
   * @param {Object} property
   * @returns {HTMLElement}
   */
  function renderCell(property) {
    const wrapper = document.createElement('div');
    wrapper.className = 'commute-cell';

    const ds = distancesFor(property);
    if (!ds || ds.length === 0) {
      wrapper.textContent = '-';
      wrapper.style.color = 'var(--text-muted)';
      return wrapper;
    }

    ds.forEach(d => {
      const chip = document.createElement('span');
      chip.className = 'commute-chip';
      chip.textContent = `${d.name} ${d.km.toFixed(1)}km`;
      chip.title = `直線距離，實際路程約 ${(d.km * 1.3).toFixed(1)} km`;
      wrapper.appendChild(chip);
    });

    return wrapper;
  }

  return {
    setDestinations,
    getDestinations,
    hasDestinations,
    distanceKm,
    distancesFor,
    avgDistance,
    renderCell,
  };
})();
