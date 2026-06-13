/**
 * 快速新增模組 — 「貼上即解析」
 * 在租屋網頁（如 591）全選複製，貼到這裡即可自動解析欄位並寫入 Google Sheet
 * 不需安裝任何工具，手機電腦皆可用，是書籤小工具的零安裝替代方案
 */
const QuickAdd = (() => {
  let _isDemo = false;

  function setConfig(isDemo) {
    _isDemo = isDemo;
  }

  /**
   * 開啟 Modal
   */
  function open() {
    _clearForm();
    document.getElementById('quickadd-modal').classList.add('open');
    setTimeout(() => document.getElementById('qa-paste').focus(), 100);
  }

  function close() {
    document.getElementById('quickadd-modal').classList.remove('open');
  }

  function _clearForm() {
    ['qa-paste', 'qa-url', 'qa-name', 'qa-address', 'qa-rent', 'qa-size',
     'qa-layout', 'qa-floor', 'qa-deposit', 'qa-utilities', 'qa-pros'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  /**
   * 解析貼上的網頁文字（針對 591 等台灣租屋網站優化）
   * @param {string} text
   * @returns {Object} 解析結果
   */
  function parse(text) {
    const result = { name: '', address: '', rent: 0, size: 0, layout: '', floor: '', deposit: '', utilities: '', url: '', pros: '' };
    if (!text) return result;

    // 網址（若貼文中含網址）
    const urlMatch = text.match(/https?:\/\/[^\s"'<>）)]+/);
    if (urlMatch) result.url = urlMatch[0];

    // 租金 — 優先找「X,XXX 元/月」格式，其次找大於 3000 的「元」金額
    let m = text.match(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*元\s*\/\s*月/);
    if (!m) m = text.match(/月租金?[:：\s]*(\d{1,3}(?:,\d{3})+|\d{4,6})/);
    if (!m) {
      // 找出所有「N元」，取第一個 >= 3000 的（過濾掉押金說明中的小數字較難，取第一個合理值）
      const all = [...text.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,6})\s*元/g)];
      const candidate = all.map(x => parseInt(x[1].replace(/,/g, ''))).find(n => n >= 3000 && n <= 300000);
      if (candidate) result.rent = candidate;
    }
    if (m) result.rent = parseInt(m[1].replace(/,/g, ''));

    // 坪數
    m = text.match(/([\d.]+)\s*坪/);
    if (m) result.size = parseFloat(m[1]);

    // 格局 — 3房2廳2衛 / 2房1廳 / 開放式
    // 使用 matchAll 找出所有符合的格局字串，並取最長的（避免先抓到「3房」而漏掉後面的「3房1廳2衛」）
    const layoutMatches = [...text.matchAll(/(\d+\s*房(?:\s*\d+\s*廳)?(?:\s*\d+\s*衛)?(?:\s*\d+\s*陽台)?)/g)];
    if (layoutMatches.length > 0) {
      const bestMatch = layoutMatches.sort((a, b) => b[0].length - a[0].length)[0];
      result.layout = bestMatch[1].replace(/\s+/g, '');
    } else if (/開放式/.test(text)) {
      result.layout = '開放式格局';
    }

    // 樓層 — 5F/12F、5/12樓、樓層：5/12
    m = text.match(/(\d{1,2})\s*F?\s*\/\s*(\d{1,2})\s*F/i) ||
        text.match(/樓層[:：\s]*(\d{1,2})\s*\/\s*(\d{1,2})/) ||
        text.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*樓/);
    if (m) result.floor = `${m[1]}F/${m[2]}F`;

    // 地址 — 台灣地址格式：XX市/縣 XX區/鄉/鎮 + 路/街/大道/巷
    m = text.match(/([^\s，,。]{1,4}[市縣][^\s，,。]{1,4}[區鄉鎮市][^\s，,。]{0,20}?(?:路|街|大道|巷|段)[^\s，,。]{0,15})/);
    if (m) result.address = m[1].trim();

    // 押金
    m = text.match(/押金[:：\s]*([一二三]|[123１２３])\s*個?月/);
    if (m) {
      const map = { '1': '一', '２': '二', '2': '二', '3': '三', '１': '一', '３': '三' };
      const num = map[m[1]] || m[1];
      result.deposit = `${num}個月`;
    }

    // 含水電網
    const utils = [];
    if (/含水費?/.test(text)) utils.push('含水');
    if (/含電費?/.test(text)) utils.push('含電');
    if (/含網路|含第四台/.test(text)) utils.push('含網路');
    if (/含管理費/.test(text)) utils.push('含管理費');
    result.utilities = utils.length > 0 ? utils.join('、') : '';

    // 其他特色
    m = text.match(/其他特色[:：\s]*([^\n]+)/);
    if (m) {
      result.pros = m[1].trim().replace(/[、\s]+/g, ', ');
    }

    // 名稱 — 取第一行非空且長度合理的文字（去掉網站名稱字尾）
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.length >= 4 && line.length <= 40 && !/^https?:/.test(line) && !/^(\d|登入|註冊|首頁|搜尋)/.test(line)) {
        result.name = line.replace(/\s*[-–—|]\s*(591租屋網|591|樂屋網|好房網).*$/i, '').trim();
        break;
      }
    }

    return result;
  }

  /**
   * 將解析結果填入表單
   */
  function _fillForm(parsed) {
    if (parsed.url)       document.getElementById('qa-url').value = parsed.url;
    if (parsed.name)      document.getElementById('qa-name').value = parsed.name;
    if (parsed.address)   document.getElementById('qa-address').value = parsed.address;
    if (parsed.rent)      document.getElementById('qa-rent').value = parsed.rent;
    if (parsed.size)      document.getElementById('qa-size').value = parsed.size;
    if (parsed.layout)    document.getElementById('qa-layout').value = parsed.layout;
    if (parsed.floor)     document.getElementById('qa-floor').value = parsed.floor;
    if (parsed.deposit)   document.getElementById('qa-deposit').value = parsed.deposit;
    if (parsed.utilities) document.getElementById('qa-utilities').value = parsed.utilities;
    if (parsed.pros)      document.getElementById('qa-pros').value = parsed.pros;
  }

  /**
   * 送出
   */
  async function _submit() {
    const payload = {
      url: document.getElementById('qa-url').value.trim(),
      name: document.getElementById('qa-name').value.trim(),
      address: document.getElementById('qa-address').value.trim(),
      rent: parseInt(document.getElementById('qa-rent').value) || 0,
      size: parseFloat(document.getElementById('qa-size').value) || 0,
      layout: document.getElementById('qa-layout').value.trim(),
      floor: document.getElementById('qa-floor').value.trim(),
      deposit: document.getElementById('qa-deposit').value.trim(),
      utilities: document.getElementById('qa-utilities').value.trim(),
      pros: document.getElementById('qa-pros').value.trim(),
    };

    if (!payload.url) {
      App.showToast('請填入物件網址（作為唯一識別）', 'error');
      return;
    }
    if (!payload.name) {
      App.showToast('請填入物件名稱', 'error');
      return;
    }

    const btn = document.getElementById('btn-qa-submit');
    btn.disabled = true;
    btn.textContent = '同步中...';

    try {
      if (_isDemo) {
        App.addDemoProperty(payload);
        App.showToast('已新增物件（Demo 模式，不會寫入試算表）', 'success');
      } else {
        const result = await DataService.addProperty(payload);
        if (result.error) throw new Error(result.error);
        App.showToast(result.action === 'updated' ? '物件已更新 ✅' : '物件已新增 ✅', 'success');
        App.refreshAll();
      }
      close();
    } catch (err) {
      App.showToast(`新增失敗：${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '送出至試算表';
    }
  }

  /**
   * 綁定事件（App.init 時呼叫一次）
   */
  function bindEvents() {
    document.getElementById('btn-quickadd').addEventListener('click', open);
    document.getElementById('btn-qa-cancel').addEventListener('click', close);
    document.getElementById('btn-qa-submit').addEventListener('click', _submit);

    document.getElementById('quickadd-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) close();
    });

    // 貼上或輸入時即時解析
    const pasteArea = document.getElementById('qa-paste');
    pasteArea.addEventListener('input', () => {
      const parsed = parse(pasteArea.value);
      _fillForm(parsed);
    });
  }

  return { setConfig, open, close, parse, bindEvents };
})();
