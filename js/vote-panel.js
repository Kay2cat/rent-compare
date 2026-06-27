/**
 * 投票模組 — 1-5 分制投票 + 留言
 * 主要對外介面：
 *   - setConfig(voterName, roommateCount, isDemo)
 *   - renderVoteBlock(property)  → 回傳含星星/留言框/留言串的 DOM 區塊（供表格展開列使用）
 *   - renderSummaryInline(propertyName) → 回傳精簡的平均分+投票者圓點（供表格欄位使用）
 */
const VotePanel = (() => {
  let _votes = [];
  let _voterName = '';
  let _roommateCount = 3;
  let _isDemo = false;

  function setConfig(voterName, roommateCount, isDemo) {
    _voterName = voterName;
    _roommateCount = roommateCount;
    _isDemo = isDemo;
  }

  /**
   * 提供最新的投票資料（表格渲染前呼叫）
   */
  function setVotes(votes) {
    _votes = votes || [];
  }

  /**
   * 渲染完整投票區塊（星星 + 留言輸入 + 留言串）
   * 給表格展開列使用
   * @param {Object} property - enriched property
   * @returns {HTMLElement}
   */
  function renderVoteBlock(property) {
    const wrapper = document.createElement('div');
    wrapper.className = 'vote-block';

    // 左：投票輸入
    const inputArea = _renderInput(property);
    wrapper.appendChild(inputArea);

    // 右：留言串
    const thread = _renderComments(property.name);
    wrapper.appendChild(thread);

    return wrapper;
  }

  /**
   * 渲染星星 + 留言輸入 + 送出按鈕
   */
  function _renderInput(property) {
    const propertyName = property.name;
    const currentScore = _getMyVote(propertyName);

    const wrapper = document.createElement('div');
    wrapper.className = 'vote-input-area';

    const heading = document.createElement('div');
    heading.className = 'vote-block__heading';
    heading.textContent = `${_voterName} 的評分`;
    wrapper.appendChild(heading);

    const stars = document.createElement('div');
    stars.className = 'vote-stars';

    // group 名稱用物件名稱雜湊，避免多列衝突
    const groupName = `vote-${_hash(propertyName)}`;

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

    // 留言輸入框
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

    btn.addEventListener('click', async () => {
      const selected = stars.querySelector(`input[name="${groupName}"]:checked`);
      const comment = commentInput.value.trim();

      // 允許只留言不評分？這裡要求至少有分數，但若已有舊分數則沿用
      let score = selected ? parseInt(selected.value) : currentScore;
      if (!score) {
        App.showToast('請先選擇分數 ⭐', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '送出中...';

      try {
        if (_isDemo) {
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
          await DataService.submitVote({ propertyName, voterName: _voterName, score, comment });
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
   * 渲染留言串（所有人的留言）
   */
  function _renderComments(propertyName) {
    const wrapper = document.createElement('div');
    wrapper.className = 'vote-comments';

    const pv = _votes.filter(v => v.propertyName === propertyName && (v.comment || '').trim());

    const title = document.createElement('div');
    title.className = 'vote-comments__title';
    title.textContent = pv.length > 0 ? `💬 室友意見（${pv.length}）` : '💬 室友意見';
    wrapper.appendChild(title);

    if (pv.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'vote-comments__empty';
      empty.textContent = '還沒有人留言，當第一個吧！';
      wrapper.appendChild(empty);
      return wrapper;
    }

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

  /**
   * 精簡投票摘要（平均分 + 投票者圓點），給表格欄位使用
   * @param {string} propertyName
   * @returns {HTMLElement}
   */
  function renderSummaryInline(propertyName) {
    const pv = _votes.filter(v => v.propertyName === propertyName);
    const summary = document.createElement('div');
    summary.className = 'vote-summary vote-summary--inline';

    const avg = pv.length > 0
      ? pv.reduce((s, v) => s + (parseFloat(v.score) || 0), 0) / pv.length
      : null;

    if (avg !== null) {
      const avgEl = document.createElement('div');
      avgEl.className = 'vote-summary__avg';
      const color = avg >= 4 ? 'var(--success)' : avg >= 3 ? 'var(--warning)' : 'var(--danger)';
      avgEl.style.color = color;
      avgEl.textContent = `⭐ ${avg.toFixed(1)}`;
      summary.appendChild(avgEl);
    } else {
      const noneEl = document.createElement('div');
      noneEl.className = 'vote-summary__none';
      noneEl.textContent = '尚未投票';
      summary.appendChild(noneEl);
    }

    // 投票者圓點
    const dots = document.createElement('div');
    dots.className = 'vote-summary__voters';

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
   * 取得某物件的留言數
   */
  function commentCount(propertyName) {
    return _votes.filter(v => v.propertyName === propertyName && (v.comment || '').trim()).length;
  }

  function _getMyVote(propertyName) {
    const v = _votes.find(v => v.propertyName === propertyName && v.voterName === _voterName);
    return v ? parseInt(v.score) : null;
  }

  function _getMyComment(propertyName) {
    const v = _votes.find(v => v.propertyName === propertyName && v.voterName === _voterName);
    return v ? (v.comment || '') : '';
  }

  // 簡易字串雜湊（產生唯一的 radio group 名稱）
  function _hash(str) {
    let h = 0;
    for (let i = 0; i < (str || '').length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  return {
    setConfig,
    setVotes,
    renderVoteBlock,
    renderSummaryInline,
    commentCount,
  };
})();
