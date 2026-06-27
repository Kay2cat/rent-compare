/**
 * 表格檢視模組 — 渲染物件比較表格
 * 支援：排序、看房狀態、通勤距離、刪除、點列展開（投票 + 留言）
 */
const TableView = (() => {
  let _properties = [];
  let _votes = [];
  let _sortKey = null;
  let _sortDir = 'asc';
  let _isDemo = false;
  let _expandedName = null; // 目前展開的物件名稱（一次只展開一個）

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
   * 計算目前表格的欄位數（給展開列 colspan 用）
   */
  function _columnCount() {
    // 展開鈕 + 名稱 + 狀態 + 租金 + 人均 + 坪數 + 格局 + 樓層 + [通勤] + 標籤 + 投票
    return Commute.hasDestinations() ? 11 : 10;
  }

  /**
   * 渲染表格
   * @param {Array} properties - enriched properties
   * @param {Array} votes - 投票陣列
   */
  function render(properties, votes) {
    _properties = properties;
    _votes = votes;
    VotePanel.setVotes(votes);

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
      tr.className = 'property-row animate-in';
      tr.style.animationDelay = `${i * 0.04}s`;
      if (p.huntStatus === '淘汰') tr.classList.add('row-eliminated');
      if (p.huntStatus === '簽約') tr.classList.add('row-signed');
      if (_expandedName === p.name) tr.classList.add('row-expanded');

      // === 展開指示欄 ===
      const tdToggle = document.createElement('td');
      tdToggle.className = 'col-toggle';
      const chevron = document.createElement('span');
      chevron.className = 'row-chevron';
      chevron.textContent = '▸';
      tdToggle.appendChild(chevron);
      tr.appendChild(tdToggle);

      // === 名稱 ===
      const tdName = document.createElement('td');
      const nameEl = document.createElement('div');
      nameEl.className = 'property-name';

      const nameHeader = document.createElement('div');
      nameHeader.style.display = 'flex';
      nameHeader.style.alignItems = 'center';
      nameHeader.style.gap = '6px';

      // 刪除按鈕
      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-delete';
      btnDelete.innerHTML = '🗑️';
      btnDelete.title = '刪除此物件';
      btnDelete.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`確定要刪除「${p.name || '此物件'}」嗎？\n這將會從試算表中移除該物件及所有人的投票資料！`)) {
          App.deleteProperty(p.url, p.name);
        }
      });
      nameHeader.appendChild(btnDelete);

      if (p.url) {
        const a = document.createElement('a');
        a.href = p.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = p.name || '未命名物件';
        a.title = p.address || '';
        a.addEventListener('click', (e) => e.stopPropagation()); // 點連結不要觸發展開
        nameHeader.appendChild(a);
      } else {
        const span = document.createElement('span');
        span.textContent = p.name || '未命名物件';
        nameHeader.appendChild(span);
      }
      nameEl.appendChild(nameHeader);

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

      // === 看房狀態 ===
      const tdStatus = document.createElement('td');
      tdStatus.appendChild(_renderStatusSelect(p));
      tr.appendChild(tdStatus);

      // === 月租金 ===
      const tdRent = document.createElement('td');
      const rentEl = document.createElement('span');
      rentEl.className = 'property-price';
      rentEl.textContent = `$${CostCalc.formatMoney(p.rent)}`;
      tdRent.appendChild(rentEl);
      tr.appendChild(tdRent);

      // === 人均月費 ===
      const tdPP = document.createElement('td');
      tdPP.appendChild(CostCalc.renderCostBar(p));
      tr.appendChild(tdPP);

      // === 坪數 ===
      const tdSize = document.createElement('td');
      tdSize.textContent = p.size ? `${p.size} 坪` : '-';
      tr.appendChild(tdSize);

      // === 格局 ===
      const tdLayout = document.createElement('td');
      tdLayout.textContent = p.layout || '-';
      tr.appendChild(tdLayout);

      // === 樓層 ===
      const tdFloor = document.createElement('td');
      tdFloor.textContent = p.floor || '-';
      tr.appendChild(tdFloor);

      // === 通勤距離 ===
      if (Commute.hasDestinations()) {
        const tdCommute = document.createElement('td');
        tdCommute.appendChild(Commute.renderCell(p));
        tr.appendChild(tdCommute);
      }

      // === 優缺點標籤 ===
      const tdTags = document.createElement('td');
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'property-tags';
      const allTags = [...TagSystem.parseTags(p.pros), ...TagSystem.parseTags(p.cons)];
      allTags.forEach(t => tagsContainer.appendChild(TagSystem.renderTag(t, false)));
      tdTags.appendChild(tagsContainer);
      tr.appendChild(tdTags);

      // === 投票摘要（精簡）+ 留言數 ===
      const tdVote = document.createElement('td');
      tdVote.className = 'col-vote';
      tdVote.appendChild(VotePanel.renderSummaryInline(p.name));

      const cCount = VotePanel.commentCount(p.name);
      const hint = document.createElement('div');
      hint.className = 'vote-cell-hint';
      hint.textContent = cCount > 0 ? `💬 ${cCount} · 點此投票` : '點此投票/留言';
      tdVote.appendChild(hint);
      tr.appendChild(tdVote);

      // === 點列展開 ===
      tr.addEventListener('click', () => _toggleExpand(p, tr));

      tbody.appendChild(tr);

      // 若此列為展開狀態，補上展開列
      if (_expandedName === p.name) {
        tbody.appendChild(_buildExpandRow(p));
      }
    });

    // 綁定排序事件
    _bindSortHeaders();
  }

  /**
   * 切換展開
   */
  function _toggleExpand(property, tr) {
    if (_expandedName === property.name) {
      _expandedName = null;
    } else {
      _expandedName = property.name;
    }
    // 重新渲染（簡單可靠，資料量不大）
    render(_properties, _votes);

    // 展開後捲動到該列
    if (_expandedName === property.name) {
      setTimeout(() => {
        const expanded = document.querySelector('.row-expanded');
        if (expanded && expanded.scrollIntoView) expanded.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }

  /**
   * 建立展開列（投票 + 留言）
   */
  function _buildExpandRow(property) {
    const tr = document.createElement('tr');
    tr.className = 'expand-row';

    const td = document.createElement('td');
    td.colSpan = _columnCount();

    const panel = document.createElement('div');
    panel.className = 'expand-panel animate-in';

    // 圖片（若有）
    if (property.images) {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'expand-panel__media';
      const img = document.createElement('img');
      img.src = property.images;
      img.alt = property.name || '';
      img.loading = 'lazy';
      img.onerror = () => { imgWrap.style.display = 'none'; };
      imgWrap.appendChild(img);
      panel.appendChild(imgWrap);
    }

    // 主體：資訊 + 投票區
    const main = document.createElement('div');
    main.className = 'expand-panel__main';

    // 摘要資訊列（備註等）
    if (property.notes) {
      const notes = document.createElement('div');
      notes.className = 'expand-panel__notes';
      notes.textContent = `📝 ${property.notes}`;
      main.appendChild(notes);
    }

    // 完整標籤
    const allTags = [...TagSystem.parseTags(property.pros), ...TagSystem.parseTags(property.cons)];
    if (allTags.length > 0) {
      const tagsRow = document.createElement('div');
      tagsRow.className = 'property-tags expand-panel__tags';
      allTags.forEach(t => tagsRow.appendChild(TagSystem.renderTag(t, false)));
      main.appendChild(tagsRow);
    }

    // 投票 + 留言區塊
    main.appendChild(VotePanel.renderVoteBlock(property));

    panel.appendChild(main);
    td.appendChild(panel);
    tr.appendChild(td);

    // 展開區內部點擊不要冒泡觸發收合
    tr.addEventListener('click', (e) => e.stopPropagation());

    return tr;
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

    // 避免點下拉選單觸發整列展開
    select.addEventListener('click', (e) => e.stopPropagation());

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
