/**
 * 資料服務模組 — 與 Google Apps Script Web App 通訊
 * 負責：讀取物件資料、讀取標籤定義、送出投票、讀取投票
 */
const DataService = (() => {
  let _scriptUrl = '';
  let _cache = { properties: null, votes: null, tagDefs: null, lastFetch: 0 };
  const CACHE_TTL = 30000; // 30 秒快取

  /**
   * 初始化 — 設定 Apps Script Web App URL
   * @param {string} url
   */
  function init(url) {
    _scriptUrl = url;
  }

  /**
   * 取得 Script URL
   */
  function getScriptUrl() {
    return _scriptUrl;
  }

  /**
   * 通用 GET 請求
   */
  async function _get(params) {
    const url = new URL(_scriptUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`API 錯誤：${resp.status}`);
    return resp.json();
  }

  /**
   * 通用 POST 請求
   */
  async function _post(payload) {
    const resp = await fetch(_scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script 用 text/plain 較穩
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`API 錯誤：${resp.status}`);
    return resp.json();
  }

  /**
   * 取得全部物件資料
   * @param {boolean} forceRefresh - 是否強制重新抓取
   * @returns {Promise<Array>} 物件陣列
   */
  async function getProperties(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && _cache.properties && (now - _cache.lastFetch) < CACHE_TTL) {
      return _cache.properties;
    }
    const data = await _get({ action: 'getProperties' });
    _cache.properties = data.properties || [];
    _cache.lastFetch = now;
    return _cache.properties;
  }

  /**
   * 取得標籤定義
   * @returns {Promise<Array>} 標籤定義陣列
   */
  async function getTagDefinitions() {
    if (_cache.tagDefs) return _cache.tagDefs;
    const data = await _get({ action: 'getTagDefs' });
    _cache.tagDefs = data.tagDefs || [];
    return _cache.tagDefs;
  }

  /**
   * 取得全部投票
   * @returns {Promise<Array>} 投票陣列
   */
  async function getVotes(forceRefresh = false) {
    if (!forceRefresh && _cache.votes) return _cache.votes;
    const data = await _get({ action: 'getVotes' });
    _cache.votes = data.votes || [];
    return _cache.votes;
  }

  /**
   * 送出投票
   * @param {Object} vote - { propertyName, voterName, score, comment }
   * @returns {Promise<Object>} 回應結果
   */
  async function submitVote(vote) {
    const result = await _post({
      action: 'vote',
      ...vote,
    });
    _cache.votes = null; // 清除投票快取
    return result;
  }

  /**
   * 取得所有資料（一次性）
   */
  async function fetchAll() {
    const data = await _get({ action: 'getAll' });
    _cache.properties = data.properties || [];
    _cache.votes = data.votes || [];
    _cache.tagDefs = data.tagDefs || [];
    _cache.lastFetch = Date.now();
    return data;
  }

  /**
   * 清除快取
   */
  function clearCache() {
    _cache = { properties: null, votes: null, tagDefs: null, lastFetch: 0 };
  }

  // === Demo 模式 — 無須 Apps Script 即可體驗 ===
  function getDemoData() {
    return {
      properties: [
        {
          url: 'https://rent.591.com.tw/home/123',
          name: '信義區精美三房 近象山站',
          address: '台北市信義區松仁路100號',
          rent: 28000,
          size: 30,
          layout: '3房1廳1衛',
          floor: '5F/12F',
          deposit: '兩個月',
          utilities: '不含',
          pros: '近捷運, 採光好, 有電梯, 管理員',
          cons: '租金偏高, 無陽台',
          images: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400',
          notes: '房東人很好，可議價',
          lat: 25.0330,
          lng: 121.5654,
          status: '✅'
        },
        {
          url: 'https://rent.591.com.tw/home/456',
          name: '大安區溫馨兩房 近科技大樓站',
          address: '台北市大安區復興南路二段200號',
          rent: 22000,
          size: 22,
          layout: '2房1廳1衛',
          floor: '3F/6F',
          deposit: '兩個月',
          utilities: '含水費',
          pros: '近捷運, 生活機能好, 安靜, 獨立衛浴',
          cons: '無電梯, 坪數較小',
          images: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400',
          notes: '可養小型寵物',
          lat: 25.0260,
          lng: 121.5436,
          status: '✅'
        },
        {
          url: 'https://www.hbhousing.com.tw/rent/789',
          name: '中山區全新裝潢三房 近中山國中站',
          address: '台北市中山區復興北路300號',
          rent: 25000,
          size: 28,
          layout: '3房1廳2衛',
          floor: '8F/15F',
          deposit: '一個月',
          utilities: '含網路',
          pros: '新裝潢, 有電梯, 家具齊全, 冷氣, 洗衣機',
          cons: '離捷運稍遠, 巷子窄',
          images: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400',
          notes: '附近有全聯、7-11',
          lat: 25.0600,
          lng: 121.5440,
          status: '✅'
        },
        {
          url: 'https://rent.591.com.tw/home/321',
          name: '松山區景觀三房 近南京三民站',
          address: '台北市松山區南京東路五段50號',
          rent: 26000,
          size: 32,
          layout: '3房2廳1衛',
          floor: '10F/14F',
          deposit: '兩個月',
          utilities: '不含',
          pros: '採光好, 通風佳, 有陽台, 近公車站, 停車位',
          cons: '租金偏高',
          images: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=400',
          notes: '有景觀，可看到101',
          lat: 25.0510,
          lng: 121.5770,
          status: '✅'
        },
        {
          url: 'https://www.sinyi.com.tw/rent/654',
          name: '文山區平價三房 近萬隆站',
          address: '台北市文山區羅斯福路五段400號',
          rent: 18000,
          size: 25,
          layout: '3房1廳1衛',
          floor: '4F/5F',
          deposit: '一個月',
          utilities: '含水電',
          pros: '近捷運, 含水費, 含電費, 租金可議, 生活機能好',
          cons: '無電梯, 屋齡較高',
          images: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400',
          notes: '離學校近，適合通勤',
          lat: 24.9980,
          lng: 121.5340,
          status: '✅'
        }
      ],
      votes: [
        { propertyName: '信義區精美三房 近象山站', voterName: '小明', score: 4, comment: '地點很棒' },
        { propertyName: '信義區精美三房 近象山站', voterName: '小華', score: 3, comment: '太貴了' },
        { propertyName: '大安區溫馨兩房 近科技大樓站', voterName: '小明', score: 5, comment: '超喜歡' },
        { propertyName: '大安區溫馨兩房 近科技大樓站', voterName: '小美', score: 4, comment: '' },
        { propertyName: '中山區全新裝潢三房 近中山國中站', voterName: '小華', score: 4, comment: '裝潢很新' },
        { propertyName: '松山區景觀三房 近南京三民站', voterName: '小美', score: 5, comment: '景觀讚' },
        { propertyName: '文山區平價三房 近萬隆站', voterName: '小明', score: 4, comment: 'CP值高' },
        { propertyName: '文山區平價三房 近萬隆站', voterName: '小華', score: 5, comment: '便宜！' },
        { propertyName: '文山區平價三房 近萬隆站', voterName: '小美', score: 3, comment: '太遠了' },
      ],
      tagDefs: [
        { name: '近捷運', category: '交通', color: '#10b981', emoji: '🚇' },
        { name: '近公車站', category: '交通', color: '#10b981', emoji: '🚌' },
        { name: '停車位', category: '交通', color: '#10b981', emoji: '🅿️' },
        { name: '有電梯', category: '設施', color: '#3b82f6', emoji: '🛗' },
        { name: '管理員', category: '設施', color: '#3b82f6', emoji: '👮' },
        { name: '洗衣機', category: '設施', color: '#3b82f6', emoji: '🧺' },
        { name: '家具齊全', category: '設施', color: '#3b82f6', emoji: '🛋️' },
        { name: '冷氣', category: '設施', color: '#3b82f6', emoji: '❄️' },
        { name: '獨立衛浴', category: '設施', color: '#3b82f6', emoji: '🚿' },
        { name: '採光好', category: '環境', color: '#f59e0b', emoji: '☀️' },
        { name: '通風佳', category: '環境', color: '#f59e0b', emoji: '🌬️' },
        { name: '安靜', category: '環境', color: '#f59e0b', emoji: '🤫' },
        { name: '生活機能好', category: '環境', color: '#f59e0b', emoji: '🏪' },
        { name: '有陽台', category: '環境', color: '#f59e0b', emoji: '🌿' },
        { name: '新裝潢', category: '屋況', color: '#a855f7', emoji: '✨' },
        { name: '含水費', category: '費用', color: '#f97316', emoji: '💧' },
        { name: '含電費', category: '費用', color: '#f97316', emoji: '⚡' },
        { name: '含網路', category: '費用', color: '#f97316', emoji: '📶' },
        { name: '租金可議', category: '費用', color: '#f97316', emoji: '💬' },
        { name: '免管理費', category: '費用', color: '#f97316', emoji: '🆓' },
      ]
    };
  }

  return {
    init,
    getScriptUrl,
    getProperties,
    getTagDefinitions,
    getVotes,
    submitVote,
    fetchAll,
    clearCache,
    getDemoData,
  };
})();
