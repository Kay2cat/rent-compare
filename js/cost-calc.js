/**
 * 費用計算模組 — 計算人均費用與成本排名
 */
const CostCalc = (() => {
  let _roommateCount = 3;
  let _utilityEstimate = 1500; // 每人預估水電網（元/月）

  /**
   * 設定參數
   */
  function setConfig(roommateCount, utilityEstimate) {
    _roommateCount = roommateCount || 3;
    _utilityEstimate = utilityEstimate || 1500;
  }

  /**
   * 計算單一物件的人均月費
   * @param {Object} property
   * @returns {number}
   */
  function perPersonRent(property) {
    const rent = parseFloat(property.rent) || 0;
    return Math.round(rent / _roommateCount);
  }

  /**
   * 計算單一物件的人均月總支出
   * @param {Object} property
   * @returns {number}
   */
  function perPersonTotal(property) {
    let utility = _utilityEstimate;

    // 如果含水電，扣除部分預估
    const utils = (property.utilities || '').toLowerCase();
    if (utils.includes('含') && (utils.includes('水') || utils.includes('電'))) {
      if (utils.includes('水') && utils.includes('電')) {
        utility = Math.round(utility * 0.3); // 只剩網路
      } else {
        utility = Math.round(utility * 0.65); // 部分含
      }
    }

    return perPersonRent(property) + utility;
  }

  /**
   * 計算年度總成本
   * @param {Object} property
   * @returns {number}
   */
  function annualCost(property) {
    const monthly = perPersonTotal(property);
    let depositMonths = 2;
    const d = (property.deposit || '').trim();
    if (d.includes('一')) depositMonths = 1;
    if (d.includes('三')) depositMonths = 3;

    const depositAmount = perPersonRent(property) * depositMonths;
    return monthly * 12 + depositAmount;
  }

  /**
   * 為所有物件計算並排名
   * @param {Array} properties
   * @returns {Array} 附加了費用資訊的物件陣列
   */
  function enrichAll(properties) {
    const enriched = properties.map(p => ({
      ...p,
      _perPerson: perPersonRent(p),
      _perPersonTotal: perPersonTotal(p),
      _annualCost: annualCost(p),
    }));

    // 排名（由低到高）
    const sorted = [...enriched].sort((a, b) => a._perPersonTotal - b._perPersonTotal);
    sorted.forEach((p, i) => { p._costRank = i + 1; });

    // 最大值（用於成本條比例）
    const maxTotal = Math.max(...enriched.map(p => p._perPersonTotal));
    enriched.forEach(p => {
      p._costRatio = maxTotal > 0 ? (p._perPersonTotal / maxTotal) : 0;
    });

    return enriched;
  }

  /**
   * 格式化金額
   */
  function formatMoney(amount) {
    return new Intl.NumberFormat('zh-TW').format(Math.round(amount));
  }

  /**
   * 渲染成本條
   * @param {Object} property - enriched property
   * @returns {HTMLElement}
   */
  function renderCostBar(property) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cost-bar';

    const fill = document.createElement('div');
    fill.className = 'cost-bar__fill';

    const inner = document.createElement('div');
    inner.className = 'cost-bar__fill-inner';
    // 延遲設定寬度以觸發動畫
    requestAnimationFrame(() => {
      inner.style.width = `${property._costRatio * 100}%`;
    });
    fill.appendChild(inner);

    const value = document.createElement('span');
    value.className = 'cost-bar__value';
    value.textContent = `$${formatMoney(property._perPersonTotal)}/人`;

    wrapper.appendChild(fill);
    wrapper.appendChild(value);
    return wrapper;
  }

  return {
    setConfig,
    perPersonRent,
    perPersonTotal,
    annualCost,
    enrichAll,
    formatMoney,
    renderCostBar,
  };
})();
