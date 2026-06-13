/**
 * 投票面板模組 — 1-5 分制投票 + 留言
 */
const VotePanel = (() => {
  let _properties = [];
  let _votes = [];
  let _voterName = '';
  let _roommateCount = 3;
  let _isDemo = false;

  /**
   * 設定
   */
  function setConfig(voterName, roommateCount, isDemo) {
    _voterName = voterName;
    _roommateCount = roommateCount;
    _isDemo = isDemo;
  }

  /**
   * 渲染投票面板
   * @param {Array} properties
   * @param {Array} votes
   */
  function render(properties, votes) {
    _properties = properties;
    _votes = votes;

    const container = document.getElementById('vote-section');
    if (!container) return;
    container.innerHTML = '';

    if (properties.length === 0) return;

    properties.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'glass-card vote-card animate-in';
      card.style.animationDelay = `${idx * 0.06}s`;
      if (p.huntStatus === '淘汰') card.classList.add('vote-card--eliminated');

      // === 上半部：物件資訊 + 投票操作 ===
      const topRow = document.createElement('div');
      topRow.className = 'vote-card__top';

      // 物件資訊
      const info = document.createElement('div');
      info.className = 'vote-card__info';

      const name = document.createElement('div');
      name.className = 'vote-card__name';
      name.textContent = p.name || '未命名物件';

      const price = document.createElement('div');
      price.className = 'vote-card__price';
      price.textContent = `$${CostCalc.formatMoney(p.rent)}/月 · $${CostCalc.formatMoney(p._perPerson || 0)}/人`;

      info.appendChild(name);
      info.appendChild(price);

      // 標籤摘要（簡要）
      const tagsRow = document.createElement('div');
      tagsRow.className = 'property-tags';
      tagsRow.style.marginTop = '8px';
      const allTags = [...TagSystem.parseTags(p.pros), ...TagSystem.parseTags(p.cons)].slice(0, 4);
      allTags.forEach(t => tagsRow.appendChild(TagSystem.renderTag(t, false)));
      info.appendChild(tagsRow);

      topRow.appendChild(info);

      // 投票操作區
      const actions = document.createElement('div');
      actions.className = 'vote-card__actions';

      const myVote = _getMyVote(p.name);
      const starsContainer = _renderStars(p, myVote, idx);
      actions.appendChild(starsContainer);

      const summary = _renderSummary(p.name);
      actions.appendChild(summary);

      topRow.appendChild(actions);
      card.appendChild(topRow);

      // === 下半部：留言串 ===
      const comments = _renderComments(p.name);
      if (comments) card.appendChild(comments);

      container.appendChild(card);
    });
  }

  /**
   * 渲染星星 + 留言輸入 + 送出按鈕
   */
  function _renderStars(property, currentScore, idx) {
    const propertyName = property.name;
    const wrapper = document.createElement('div');
    wrapper.className = 'vote-input-area';

    const stars = document.createElement('div');
    stars.className = 'vote-stars';

    const groupName = `vote-${idx}`;

    for (let i = 5; i >= 1; i--) {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = groupName;
      radio.value = i;
      radio.id = `${groupName}-${i}`;
      if (currentScore === i) radio.checked = true;

      const label = document.createElement('label');
      label.htmlFor = `${groupName}-${i}`;
      label.textContent = '★';
      label.title = `${i} 分`;

      stars.appendChild(radio);
      stars.appendChild(label);
    }

    wrapper.appendChild(stars);

    // 留言輸入框（帶入自己之前的留言）
    const myComment = _getMyComment(propertyName);
    const commentInput = document.createElement('textarea');
    commentInput.className = 'vote-comment-input';
    commentInput.rows = 2;
    commentInput.placeholder = '留下你的意見（選填），例：採光超棒但廁所偏舊';
    commentInput.value = myComment || '';
    wrapper.appendChild(commentInput);

    // 提交按鈕
    const btn = document.createElement('button');
    btn.className = 'vote-submit-btn';
    btn.textContent = currentScore ? '更新投票' : '送出投票';
    btn.id = `vote-btn-${idx}`;

    btn.addEventListener('click', async () => {
      const selected = stars.querySelector(`input[name="${groupName}"]:checked`);
      if (!selected) {
        App.showToast('請先選擇分數 ⭐', 'error');
        return;
      }

      const score = parseInt(selected.value);
      const comment = commentInput.value.trim();
      btn.disabled = true;
      btn.textContent = '送出中...';

      try {
        if (_isDemo) {
          // Demo 模式：直接更新本地資料
          const existing = _votes.findIndex(
            v => v.propertyName === propertyName && v.voterName === _voterName
          );
          if (existing >= 0) {
            _votes[existing].score = score;
            _votes[existing].comment = comment;
          } else {
            _votes.push({ propertyName, voterName: _voterName, score, comment });
          }
          App.showToast(`已投 ${score} 分 ⭐`, 'success');
          App.refreshAll();
        } else {
          await DataService.submitVote({
            propertyName,
            voterName: _voterName,
            score,
            comment,
          });
          App.showToast(`已投 ${score} 分 ⭐`, 'success');
          App.refreshAll();
        }
      } catch (err) {
        App.showToast(`投票失敗：${err.message}`, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '更新投票';
      }
    });

    wrapper.appendChild(btn);
    return wrapper;
  }

  /**
   * 渲染投票摘要
   */
  function _renderSummary(propertyName) {
    const pv = _votes.filter(v => v.propertyName === propertyName);
    const summary = document.createElement('div');
    summary.className = 'vote-summary';

    // 平均分
    if (pv.length > 0) {
      const avg = pv.reduce((s, v) => s + (parseFloat(v.score) || 0), 0) / pv.length;
      const avgEl = document.createElement('div');
      avgEl.className = 'vote-summary__avg';
      avgEl.textContent = avg.toFixed(1);
      summary.appendChild(avgEl);
    }

    // 投票者圓點
    const dots = document.createElement('div');
    dots.className = 'vote-summary__voters';

    // 收集所有已知投票者
    const allVoters = new Set();
    _votes.forEach(v => allVoters.add(v.voterName));
    if (_voterName) allVoters.add(_voterName);

    allVoters.forEach(name => {
      const vote = pv.find(v => v.voterName === name);
      const dot = document.createElement('div');
      dot.className = `vote-summary__voter-dot ${vote ? 'vote-summary__voter-dot--voted' : 'vote-summary__voter-dot--pending'}`;
      dot.textContent = name.charAt(0);
      dot.title = vote ? `${name}：${vote.score} 分` : `${name}：尚未投票`;
      dots.appendChild(dot);
    });

    summary.appendChild(dots);
    return summary;
  }

  /**
   * 渲染留言串（所有人的留言）
   */
  function _renderComments(propertyName) {
    const pv = _votes.filter(v => v.propertyName === propertyName && (v.comment || '').trim());
    if (pv.length === 0) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'vote-comments';

    const title = document.createElement('div');
    title.className = 'vote-comments__title';
    title.textContent = `💬 室友意見（${pv.length}）`;
    wrapper.appendChild(title);

    pv.forEach(v => {
      const item = document.createElement('div');
      item.className = 'vote-comment-item';

      const avatar = document.createElement('div');
      avatar.className = 'vote-comment-item__avatar';
      avatar.textContent = (v.voterName || '?').charAt(0);

      const body = document.createElement('div');
      body.className = 'vote-comment-item__body';

      const meta = document.createElement('div');
      meta.className = 'vote-comment-item__meta';
      const stars = v.score ? ` · ${'★'.repeat(Math.round(parseFloat(v.score)))}` : '';
      meta.textContent = `${v.voterName}${stars}`;

      const text = document.createElement('div');
      text.className = 'vote-comment-item__text';
      text.textContent = v.comment;

      body.appendChild(meta);
      body.appendChild(text);
      item.appendChild(avatar);
      item.appendChild(body);
      wrapper.appendChild(item);
    });

    return wrapper;
  }

  function _getMyVote(propertyName) {
    const v = _votes.find(v => v.propertyName === propertyName && v.voterName === _voterName);
    return v ? parseInt(v.score) : null;
  }

  function _getMyComment(propertyName) {
    const v = _votes.find(v => v.propertyName === propertyName && v.voterName === _voterName);
    return v ? (v.comment || '') : '';
  }

  return { setConfig, render };
})();
