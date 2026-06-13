/**
 * 標籤系統模組 — 解析優缺點文字為可互動標籤
 * 負責：標籤解析、分類配色、篩選互動、標籤統計
 */
const TagSystem = (() => {
  let _tagDefs = new Map();     // 標籤名稱 → { category, color, emoji }
  let _activeFilters = new Set(); // 目前啟用的篩選標籤
  let _onFilterChange = null;    // 篩選變更回呼

  // 分類 → CSS class 對照
  const CATEGORY_CLASS = {
    '交通': 'tag--transport',
    '設施': 'tag--facility',
    '環境': 'tag--environment',
    '屋況': 'tag--condition',
    '費用': 'tag--cost',
    '缺點': 'tag--con', // 支援缺點分類警告紅
  };

  /**
   * 初始化標籤定義
   * @param {Array} tagDefs - [{ name, category, color, emoji }]
   * @param {Function} onFilterChange - 篩選變更回呼 (activeFilters: Set)
   */
  function init(tagDefs, onFilterChange) {
    _tagDefs.clear();
    tagDefs.forEach(td => {
      _tagDefs.set(td.name.trim(), {
        category: td.category || '',
        color: td.color || '',
        emoji: td.emoji || '',
      });
    });
    _onFilterChange = onFilterChange;
  }

  /**
   * 解析逗號分隔的標籤文字
   * @param {string} text - "採光好, 近捷運, 有電梯"
   * @returns {Array<string>} 標籤名稱陣列
   */
  function parseTags(text) {
    if (!text || typeof text !== 'string') return [];
    return text.split(/[,，、]/).map(t => t.trim()).filter(Boolean);
  }

  /**
   * 取得標籤的樣式資訊
   * @param {string} tagName
   * @param {boolean} isCon - 是否為缺點標籤 (預設保留為相容性)
   * @returns {Object} { cssClass, emoji, category, color }
   */
  function getTagStyle(tagName, isCon = false) {
    if (isCon) {
      return {
        cssClass: 'tag--con',
        emoji: '⚠️',
        category: '缺點',
        color: '',
      };
    }

    // 智能識別負面關鍵字 (如：無陽台、不含水、離捷運稍遠)
    const negativeKeywords = /^(無|不|離.*遠|稍遠|偏高|吵|老舊|壁癌|巷子窄|潮濕|高公設|無電梯)/;
    if (negativeKeywords.test(tagName)) {
      return {
        cssClass: 'tag--con',
        emoji: '⚠️',
        category: '缺點',
        color: '',
      };
    }

    const def = _tagDefs.get(tagName);
    if (def) {
      return {
        cssClass: CATEGORY_CLASS[def.category] || 'tag--default',
        emoji: def.emoji || '',
        category: def.category || '',
        color: def.color || '',
      };
    }

    return {
      cssClass: 'tag--default',
      emoji: '',
      category: '',
      color: '',
    };
  }

  /**
   * 渲染單一標籤元素
   * @param {string} tagName
   * @param {boolean} isCon
   * @param {boolean} isFilterable - 是否可點擊篩選
   * @returns {HTMLElement}
   */
  function renderTag(tagName, isCon = false, isFilterable = false) {
    const style = getTagStyle(tagName, isCon);
    const el = document.createElement('span');
    el.className = `tag ${style.cssClass}`;
    if (_activeFilters.has(tagName)) el.classList.add('active');

    const emoji = style.emoji ? `${style.emoji} ` : '';
    el.textContent = `${emoji}${tagName}`;

    if (isFilterable) {
      el.addEventListener('click', () => _toggleFilter(tagName));
      el.style.cursor = 'pointer';
    }

    return el;
  }

  /**
   * 渲染一組標籤
   * @param {string} tagsText - 逗號分隔文字
   * @param {boolean} isCon - 是否為缺點
   * @returns {DocumentFragment}
   */
  function renderTags(tagsText, isCon = false) {
    const frag = document.createDocumentFragment();
    const tags = parseTags(tagsText);
    tags.forEach(t => frag.appendChild(renderTag(t, isCon)));
    return frag;
  }

  /**
   * 統計所有物件的標籤出現次數
   * @param {Array} properties - 物件陣列
   * @returns {Array<{name, count, isCon, style}>} 依出現次數排序
   */
  function countTags(properties) {
    const counter = new Map();

    properties.forEach(p => {
      parseTags(p.pros).forEach(t => {
        const key = `pro:${t}`;
        counter.set(key, (counter.get(key) || 0) + 1);
      });
      parseTags(p.cons).forEach(t => {
        const key = `con:${t}`;
        counter.set(key, (counter.get(key) || 0) + 1);
      });
    });

    return Array.from(counter.entries())
      .map(([key, count]) => {
        const [type, name] = [key.substring(0, 3), key.substring(4)];
        const isCon = type === 'con';
        return { name, count, isCon, style: getTagStyle(name, isCon) };
      })
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 渲染篩選列
   * @param {HTMLElement} container
   * @param {Array} properties
   */
  function renderFilterBar(container, properties) {
    // 移除舊的標籤（保留 label）
    const label = container.querySelector('.tag-filter-bar__label');
    container.innerHTML = '';
    if (label) container.appendChild(label);

    // 清除全部按鈕
    if (_activeFilters.size > 0) {
      const clearBtn = document.createElement('span');
      clearBtn.className = 'tag tag--default';
      clearBtn.textContent = '✕ 清除篩選';
      clearBtn.style.cursor = 'pointer';
      clearBtn.addEventListener('click', () => {
        _activeFilters.clear();
        renderFilterBar(container, properties);
        if (_onFilterChange) _onFilterChange(_activeFilters);
      });
      container.appendChild(clearBtn);
    }

    const tagStats = countTags(properties);
    tagStats.forEach(({ name, count, isCon, style }) => {
      const el = document.createElement('span');
      el.className = `tag ${style.cssClass}`;
      if (_activeFilters.has(name)) el.classList.add('active');

      const emoji = style.emoji ? `${style.emoji} ` : '';
      el.innerHTML = `${emoji}${name} <span class="tag__count">(${count})</span>`;
      el.style.cursor = 'pointer';

      el.addEventListener('click', () => {
        _toggleFilter(name);
        renderFilterBar(container, properties);
      });

      container.appendChild(el);
    });
  }

  /**
   * 切換篩選
   */
  function _toggleFilter(tagName) {
    if (_activeFilters.has(tagName)) {
      _activeFilters.delete(tagName);
    } else {
      _activeFilters.add(tagName);
    }
    if (_onFilterChange) _onFilterChange(_activeFilters);
  }

  /**
   * 篩選物件
   * @param {Array} properties
   * @param {Set} activeFilters
   * @returns {Array} 符合條件的物件
   */
  function filterProperties(properties, activeFilters) {
    if (!activeFilters || activeFilters.size === 0) return properties;

    return properties.filter(p => {
      const allTags = [...parseTags(p.pros), ...parseTags(p.cons)];
      return Array.from(activeFilters).every(f => allTags.includes(f));
    });
  }

  /**
   * 取得目前的篩選
   */
  function getActiveFilters() {
    return _activeFilters;
  }

  /**
   * 計算某分類的標籤數量（用於雷達圖計分）
   * @param {string} prosText - 優點文字
   * @param {string} category - 分類名稱
   * @returns {number}
   */
  function countByCategory(prosText, category) {
    const tags = parseTags(prosText);
    return tags.filter(t => {
      const def = _tagDefs.get(t);
      return def && def.category === category;
    }).length;
  }

  return {
    init,
    parseTags,
    getTagStyle,
    renderTag,
    renderTags,
    countTags,
    renderFilterBar,
    filterProperties,
    getActiveFilters,
    countByCategory,
  };
})();
