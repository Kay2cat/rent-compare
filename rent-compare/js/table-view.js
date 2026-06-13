/**
 * 表格檢視模組 — 渲染物件比較表格，支援排序、看房狀態、通勤距離
 */
const TableView = (() => {
  let _properties = [];
  let _votes = [];
  let _sortKey = null;
  let _sortDir = 'asc';
  let _isDemo = false;

  // 看房狀態選項
  const HUNT_STATUSES = [
    { value: '候選',   label: '💡 候選' },
    { value: '已約看', label: '📅 已約看' },
    { value: '已看',   label: '👀 已看' },
    { value: '淘汰',   label: '❌ 淘汰' },
    { value: '簽約',   label: '✅ 簽約' },
  ];

  function setConfig(isDemo) {
    _isDemo = isDemo;
  }

  /**
   * 渲染表格
   * @param {Array} properties - enriched properties
   * @param {Array} votes - 投票陣列
   */
  function render(properties, votes) {
    _properties = properties;
    _votes = votes;

    // 沒有通勤目的地時隱藏通勤欄
    const thCommute = document.getElementById('th-commute');
    if (thCommute) thCommute.style.display = Commute.hasDestinations() ? '' : 'none';

    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (properties.length === 0) return;

    // 排序
    let sorted = [...properties];
    if (_sortKey) {
      sorted.sort((a, b) => {
        let va = _getSortValue(a, _sortKey);
        let vb = _getSortValue(b, _sortKey);
        if (typeof va === 'string') {
          return _sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return _sortDir === 'asc' ? va - vb : vb - va;
      });
    } else {
      // 預設排序：淘汰物件沉到最底
      sorted.sort((a, b) => (a.huntStatus === '淘汰' ? 1 : 0) - (b.huntStatus === '淘汰' ? 1 : 0));
    }

    sorted.forEach((p, i) => {
      const tr = document.createElement('tr');
      tr.className = 'animate-in';
      tr.style.animationDelay = `${i * 0.04}s`;
      if (p.huntStatus === '淘汰') tr.classList.add('row-eliminated');
      if (p.huntStatus === '簽約') tr.classList.add('row-signed');

      // 名稱
      const tdName = document.createElement('td');
      const nameEl = document.createElement('div');
      nameEl.className = 'property-name';
      if (p.url) {
        const a = document.createElement('a');
        a.href = p.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = p.name || '未命名物件';
        a.title = p.address || '';
        nameEl.appendChild(a);
      } else {
        nameEl.textContent = p.name || '未命名物件';
      }
      // 地址
      if (p.address) {
        const addr = document.createElement('div');
        addr.style.fontSize = '0.75rem';
        addr.style.color = 'var(--text-muted)';
        addr.style.marginTop = '2px';
        addr.textContent = p.address;
        nameEl.appendChild(addr);
      }
      tdName.appendChild(nameEl);
      tr.appendChild(tdName);

      // 看房狀態
      const tdStatus = document.createElement('td');
      tdStatus.appendChild(_renderStatusSelect(p));
      tr.appendChild(tdStatus);

      // 月租金
      const tdRent = document.createElement('td');
      const rentEl = document.createElement('span');
      rentEl.className = 'property-price';
      rentEl.textContent = `$${CostCalc.formatMoney(p.rent)}`;
      tdRent.appendChild(rentEl);
      tr.appendChild(tdRent);

      // 人均月費（含成本條）
      const tdPP = document.createElement('td');
      tdPP.appendChild(CostCalc.renderCostBar(p));
      tr.appendChild(tdPP);

      // 坪數
      const tdSize = document.createElement('td');
      tdSize.textContent = p.size ? `${p.size} 坪` : '-';
      tr.appendChild(tdSize);

      // 格局
      const tdLayout = document.createElement('td');
      tdLayout.textContent = p.layout || '-';
      tr.appendChild(tdLayout);

      // 樓層
      const tdFloor = document.createElement('td');
      tdFloor.textContent = p.floor || '-';
      tr.appendChild(tdFloor);

      // 通勤距離（有設定目的地才顯示）
      if (Commute.hasDestinations()) {
        const tdCommute = document.createElement('td');
        tdCommute.appendChild(Commute.renderCell(p));
        tr.appendChild(tdCommute);
      }

      // 優缺點標籤
      const tdTags = document.createElement('td');
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'property-tags';

      const allTags = [...TagSystem.parseTags(p.pros), ...TagSystem.parseTags(p.cons)];
      allTags.forEach(t => {
        tagsContainer.appendChild(TagSystem.renderTag(t, false));
      });

      tdTags.appendChild(tagsContainer);
      tr.appendChild(tdTags);

      // 投票平均 + 留言數
      const tdVote = document.createElement('td');
      const avg = _getAvgVote(p.name);
      if (avg !== null) {
        const avgEl = document.createElement('span');
        avgEl.style.fontWeight = '700';
        avgEl.style.fontSize = '1rem';
        const starColor = avg >= 4 ? 'var(--success)' : avg >= 3 ? 'var(--warning)' : 'var(--danger)';
        avgEl.style.color = starColor;
        avgEl.textContent = `⭐ ${avg.toFixed(1)}`;
        tdVote.appendChild(avgEl);
      } else {
        tdVote.textContent = '-';
        tdVote.style.color = 'var(--text-muted)';
      }
      // 留言數
      const commentCount = _votes.filter(v => v.propertyName === p.name && (v.comment || '').trim()).length;
      if (commentCount > 0) {
        const cEl = document.createElement('div');
        cEl.style.fontSize = '0.75rem';
        cEl.style.color = 'var(--text-muted)';
        cEl.style.marginTop = '2px';
        cEl.textContent = `💬 ${commentCount} 則意見`;
        cEl.title = _votes
          .filter(v => v.propertyName === p.name && (v.comment || '').trim())
          .map(v => `${v.voterName}：${v.comment}`)
          .join('\n');
        tdVote.appendChild(cEl);
      }
      tr.appendChild(tdVote);

      tbody.appendChild(tr);
    });

    // 綁定排序事件
    _bindSortHeaders();
  }

  /**
   * 渲染狀態下拉選單
   */
  function _renderStatusSelect(property) {
    const select = document.createElement('select');
    select.className = 'status-select';
    const current = property.huntStatus || '候選';
    select.dataset.status = current;

    HUNT_STATUSES.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.value;
      opt.textContent = s.label;
      if (s.value === current) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', async () => {
      const newStatus = select.value;
      select.disabled = true;

      try {
        if (_isDemo) {
          property.huntStatus = newStatus;
          App.showToast(`狀態已更新為「${newStatus}」`, 'success');
          App.refreshAll();
        } else {
          await DataService.updateStatus(property.url, newStatus);
          App.showToast(`狀態已更新為「${newStatus}」`, 'success');
          App.refreshAll();
        }
      } catch (err) {
        App.showToast(`更新失敗：${err.message}`, 'error');
        select.value = current;
      } finally {
        select.disabled = false;
      }
    });

    return select;
  }

  function _getAvgVote(propertyName) {
    const pv = _votes.filter(v => v.propertyName === propertyName);
    if (pv.length === 0) return null;
    const sum = pv.reduce((s, v) => s + (parseFloat(v.score) || 0), 0);
    return sum / pv.length;
  }

  function _getSortValue(property, key) {
    switch (key) {
      case 'name': return property.name || '';
      case 'huntStatus': return property.huntStatus || '候選';
      case 'rent': return parseFloat(property.rent) || 0;
      case 'perPerson': return property._perPersonTotal || 0;
      case 'size': return parseFloat(property.size) || 0;
      case 'layout': return property.layout || '';
      case 'floor': return property.floor || '';
      case 'commute': return Commute.avgDistance(property) ?? Infinity;
      case 'avgVote': return _getAvgVote(property.name) || 0;
      default: return '';
    }
  }

  function _bindSortHeaders() {
    const headers = document.querySelectorAll('.property-table th[data-sort]');
    headers.forEach(th => {
      // 移除舊事件
      const newTh = th.cloneNode(true);
      th.parentNode.replaceChild(newTh, th);

      newTh.addEventListener('click', () => {
        const key = newTh.dataset.sort;
        if (_sortKey === key) {
          _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          _sortKey = key;
          _sortDir = 'asc';
        }

        // 更新排序指示
        document.querySelectorAll('.property-table th').forEach(h => {
          h.classList.remove('sorted', 'sort-asc', 'sort-desc');
        });
        newTh.classList.add('sorted', _sortDir === 'asc' ? 'sort-asc' : 'sort-desc');

        render(_properties, _votes);
      });
    });
  }

  return { setConfig, render };
})();
