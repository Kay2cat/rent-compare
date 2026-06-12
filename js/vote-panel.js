/**
 * 投票面板模組 — 1-5 分制投票
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

      card.appendChild(info);

      // 投票操作區
      const actions = document.createElement('div');
      actions.className = 'vote-card__actions';

      // 投票星星
      const myVote = _getMyVote(p.name);
      const starsContainer = _renderStars(p.name, myVote, idx);
      actions.appendChild(starsContainer);

      // 投票摘要
      const summary = _renderSummary(p.name);
      actions.appendChild(summary);

      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  /**
   * 渲染星星
   */
  function _renderStars(propertyName, currentScore, idx) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '8px';

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
          } else {
            _votes.push({
              propertyName,
              voterName: _voterName,
              score,
              comment: '',
            });
          }
          App.showToast(`已投 ${score} 分 ⭐`, 'success');
          App.refreshAll();
        } else {
          await DataService.submitVote({
            propertyName,
            voterName: _voterName,
            score,
            comment: '',
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

  function _getMyVote(propertyName) {
    const v = _votes.find(v => v.propertyName === propertyName && v.voterName === _voterName);
    return v ? parseInt(v.score) : null;
  }

  return { setConfig, render };
})();
