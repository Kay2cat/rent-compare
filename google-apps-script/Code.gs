/**
 * 合租找房比較器 — Google Apps Script
 * 部署為 Web App，作為前端網頁與 Google Sheets 之間的資料中介
 *
 * 功能：
 * 1. doGet — 讀取物件資料 / 投票 / 標籤定義
 * 2. doPost — 寫入投票
 * 3. fetchProperty — 半自動抓取租屋物件資訊
 * 4. geocode — 地址轉經緯度
 *
 * 使用方式：
 * 1. 在 Google Sheet 中開啟 Apps Script 編輯器（擴充功能 → Apps Script）
 * 2. 將此檔案內容貼入
 * 3. 新增 Cheerio 程式庫：Script ID = 1ReeQ6WO8kKNxoaA_O0XEQ589cIrRvEBA9qcWpNqdOP17i47u6N9M5Xh0
 * 4. 部署為 Web App（執行身份：我，存取權限：所有人）
 */

// === 設定 ===
const SHEET_PROPERTIES = '物件資料';
const SHEET_VOTES = '投票';
const SHEET_TAGS = '標籤定義';
const SHEET_DEST = '通勤目的地'; // 選用：室友的公司/學校位置

// ============================
// 1. API 端點
// ============================

/**
 * GET 請求處理
 * @param {Object} e - 請求事件
 * @returns {ContentService.TextOutput}
 */
function doGet(e) {
  const action = e.parameter.action || 'getAll';

  let result;
  switch (action) {
    case 'getProperties':
      result = { properties: _getProperties() };
      break;
    case 'getVotes':
      result = { votes: _getVotes() };
      break;
    case 'getTagDefs':
      result = { tagDefs: _getTagDefs() };
      break;
    case 'getDestinations':
      result = { destinations: _getDestinations() };
      break;
    case 'getAll':
    default:
      result = {
        properties: _getProperties(),
        votes: _getVotes(),
        tagDefs: _getTagDefs(),
        destinations: _getDestinations(),
      };
  }

  return _jsonResponse(result);
}

/**
 * POST 請求處理（投票寫入）
 * @param {Object} e - 請求事件
 * @returns {ContentService.TextOutput}
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'vote') {
      const result = _submitVote(data);
      return _jsonResponse(result);
    } else if (data.action === 'addProperty') {
      const result = _addProperty(data);
      return _jsonResponse(result);
    } else if (data.action === 'updateStatus') {
      const result = _updateStatus(data);
      return _jsonResponse(result);
    }

    return _jsonResponse({ error: '未知的 action' });
  } catch (err) {
    return _jsonResponse({ error: err.message });
  }
}

// ============================
// 2. 資料讀取
// ============================

/**
 * 讀取物件資料
 */
function _getProperties() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROPERTIES);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // 只有標題列

  const headers = data[0];
  return data.slice(1).filter(row => row[0]).map(row => ({
    url: row[0] || '',
    name: row[1] || '',
    address: row[2] || '',
    rent: row[3] || 0,
    size: row[4] || 0,
    layout: row[5] || '',
    floor: row[6] || '',
    deposit: row[7] || '',
    utilities: row[8] || '',
    pros: row[10] || '',      // K 欄：優缺點標籤 (合併)
    cons: '',                 // 已合併到 pros，前端唯讀取此項保持空值
    images: row[11] || '',    // L 欄：圖片
    notes: row[12] || '',     // M 欄：備註
    lat: row[13] || '',       // N 欄：緯度
    lng: row[14] || '',       // O 欄：經度
    status: row[15] || '',    // P 欄：抓取狀態
    huntStatus: row[16] || '', // Q 欄：看房狀態（候選/已約看/已看/淘汰/簽約）
  }));
}

/**
 * 讀取投票
 */
function _getVotes() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_VOTES);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1).filter(row => row[0]).map(row => ({
    propertyName: row[0] || '',
    voterName: row[1] || '',
    score: row[2] || 0,
    comment: row[3] || '',
    timestamp: row[4] || '',
  }));
}

/**
 * 讀取標籤定義
 */
function _getTagDefs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TAGS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1).filter(row => row[0]).map(row => ({
    name: row[0] || '',
    category: row[1] || '',
    color: row[2] || '',
    emoji: row[3] || '',
  }));
}

/**
 * 讀取通勤目的地（室友的公司/學校）
 * 工作表「通勤目的地」欄位：A 名稱 / B 地址 / C 緯度 / D 經度
 * 若有地址但缺經緯度，會自動 geocode 並寫回
 */
function _getDestinations() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEST);
  if (!sheet) return []; // 沒建這張表也不影響其他功能

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;

    let lat = row[2];
    let lng = row[3];

    // 自動補經緯度
    if (row[1] && (!lat || !lng)) {
      const coords = _geocode(row[1].toString());
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
        sheet.getRange(i + 1, 3).setValue(lat);
        sheet.getRange(i + 1, 4).setValue(lng);
      }
    }

    results.push({
      name: row[0] || '',
      address: row[1] || '',
      lat: lat || '',
      lng: lng || '',
    });
  }
  return results;
}

/**
 * 更新看房狀態（Q 欄）— 以網址為唯一鍵
 * @param {Object} data - { url, status }
 */
function _updateStatus(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROPERTIES);
  if (!sheet) throw new Error('找不到「物件資料」工作表');

  const { url, status } = data;
  if (!url) throw new Error('缺少必要欄位：url');

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === url) {
      sheet.getRange(i + 1, 17).setValue(status || ''); // Q 欄
      return { success: true };
    }
  }
  throw new Error('找不到對應的物件');
}

// ============================
// 3. 投票寫入
// ============================

/**
 * 提交投票（新增或更新）
 */
function _submitVote(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_VOTES);
  if (!sheet) throw new Error('找不到「投票」工作表');

  const { propertyName, voterName, score, comment } = data;
  if (!propertyName || !voterName || !score) {
    throw new Error('缺少必要欄位');
  }

  const rows = sheet.getDataRange().getValues();

  // 檢查是否已投過（同一物件 + 同一投票者）
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === propertyName && rows[i][1] === voterName) {
      // 更新
      sheet.getRange(i + 1, 3).setValue(score);
      sheet.getRange(i + 1, 4).setValue(comment || '');
      sheet.getRange(i + 1, 5).setValue(new Date());
      return { success: true, action: 'updated' };
    }
  }

  // 新增
  sheet.appendRow([
    propertyName,
    voterName,
    score,
    comment || '',
    new Date(),
  ]);

  return { success: true, action: 'created' };
}

/**
 * 新增或更新租屋物件資料（供書籤小工具呼叫）
 * @param {Object} data - 前端傳入的物件資料
 * @returns {Object} 執行結果
 */
function _addProperty(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROPERTIES);
  if (!sheet) throw new Error('找不到「物件資料」工作表');

  const { url, name, address, rent, size, layout, floor, images, deposit, utilities, notes, pros } = data;
  if (!url) throw new Error('缺少必要欄位：url');

  const rows = sheet.getDataRange().getValues();
  
  // 檢查是否已存在相同的網址
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === url) {
      // 已存在，則更新已有欄位
      if (name)      sheet.getRange(i + 1, 2).setValue(name);
      if (address)   sheet.getRange(i + 1, 3).setValue(address);
      if (rent)      sheet.getRange(i + 1, 4).setValue(rent);
      if (size)      sheet.getRange(i + 1, 5).setValue(size);
      if (layout)    sheet.getRange(i + 1, 6).setValue(layout);
      if (floor)     sheet.getRange(i + 1, 7).setValue(floor);
      if (deposit)   sheet.getRange(i + 1, 8).setValue(deposit);   // H 欄：押金
      if (utilities) sheet.getRange(i + 1, 9).setValue(utilities); // I 欄：含水電網
      if (pros)      sheet.getRange(i + 1, 11).setValue(pros);     // K 欄：優缺點標籤
      if (images)    sheet.getRange(i + 1, 12).setValue(images);   // L 欄：圖片
      if (notes)     sheet.getRange(i + 1, 13).setValue(notes);    // M 欄：備註
      
      // 如果有更新地址且原本經緯度為空，重新進行地理編碼
      if (address && (!rows[i][13] || !rows[i][14])) { // N 欄和 O 欄 (index 13, 14)
        const coords = _geocode(address);
        if (coords) {
          sheet.getRange(i + 1, 14).setValue(coords.lat); // N 欄：緯度
          sheet.getRange(i + 1, 15).setValue(coords.lng); // O 欄：經度
        }
      }
      sheet.getRange(i + 1, 16).setValue('✅ 已更新'); // P 欄：狀態
      return { success: true, action: 'updated' };
    }
  }

  // 取得下一個寫入的列號，並建立人均費用公式 (J 欄)
  const nextRow = sheet.getLastRow() + 1;
  const formulaJ = "=IF(D" + nextRow + ">0, ROUND(D" + nextRow + "/3, 0), \"\")";

  // 取得地理座標
  let lat = '';
  let lng = '';
  if (address) {
    const coords = _geocode(address);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  // 寫入全新的一列
  sheet.appendRow([
    url,                  // A: 網址
    name || '',           // B: 名稱
    address || '',        // C: 地址
    rent || 0,            // D: 月租金
    size || 0,            // E: 坪數
    layout || '',         // F: 格局
    floor || '',          // G: 樓層
    deposit || '兩個月',  // H: 押金
    utilities || '不含',  // I: 含水電網
    formulaJ,             // J: 人均月費
    pros || '',           // K: 優缺點標籤
    images || '',         // L: 圖片
    notes || '',          // M: 備註
    lat,                  // N: 緯度
    lng,                  // O: 經度
    '✅ 已同步',          // P: 抓取狀態
    '候選'                // Q: 看房狀態
  ]);

  return { success: true, action: 'created' };
}

// ============================
// 4. 半自動抓取
// ============================

/**
 * 自訂選單 — 在 Google Sheet 上方新增「🏠 找房工具」選單
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏠 找房工具')
    .addItem('🔄 抓取所有網址', 'fetchAllProperties')
    .addItem('📍 更新所有經緯度', 'geocodeAll')
    .addToUi();
}

/**
 * onEdit 觸發器 — 當 A 欄被編輯時自動抓取
 * 需要在 Apps Script 中手動新增「可安裝觸發器」
 */
function onEditTrigger(e) {
  const sheet = e.source.getSheetByName(SHEET_PROPERTIES);
  if (!sheet || e.range.getSheet().getName() !== SHEET_PROPERTIES) return;

  // 只在 A 欄（網址欄）觸發
  if (e.range.getColumn() !== 1) return;

  const row = e.range.getRow();
  if (row <= 1) return; // 跳過標題列

  const url = e.range.getValue();
  if (!url || !url.toString().startsWith('http')) return;

  // 檢查是否已有名稱（避免重複抓取）
  const nameCell = sheet.getRange(row, 2);
  if (nameCell.getValue()) return;

  _fetchAndFillRow(sheet, row, url.toString());
}

/**
 * 抓取所有網址
 */
function fetchAllProperties() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROPERTIES);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('找不到「物件資料」工作表');
    return;
  }

  const data = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const url = data[i][0];
    const name = data[i][1];

    // 有網址但沒名稱 → 需要抓取
    if (url && url.toString().startsWith('http') && !name) {
      _fetchAndFillRow(sheet, i + 1, url.toString());
      count++;
      Utilities.sleep(1000); // 間隔 1 秒，避免被封
    }
  }

  SpreadsheetApp.getUi().alert(`已嘗試抓取 ${count} 個物件`);
}

/**
 * 抓取並填入單一列
 */
function _fetchAndFillRow(sheet, row, url) {
  try {
    const info = _parseUrl(url);

    if (info.name)    sheet.getRange(row, 2).setValue(info.name);
    if (info.address) sheet.getRange(row, 3).setValue(info.address);
    if (info.rent)    sheet.getRange(row, 4).setValue(info.rent);
    if (info.size)    sheet.getRange(row, 5).setValue(info.size);
    if (info.layout)  sheet.getRange(row, 6).setValue(info.layout);
    if (info.floor)   sheet.getRange(row, 7).setValue(info.floor);
    if (info.images)  sheet.getRange(row, 12).setValue(info.images); // L 欄：圖片

    // 狀態
    const filled = [info.name, info.rent, info.address].filter(Boolean).length;
    if (filled >= 3) {
      sheet.getRange(row, 16).setValue('✅ 已抓取'); // P 欄：抓取狀態
    } else if (filled > 0) {
      sheet.getRange(row, 16).setValue('⚠️ 部分抓取');
    } else {
      sheet.getRange(row, 16).setValue('❌ 需手動');
    }

    // 嘗試 geocode
    if (info.address) {
      const coords = _geocode(info.address);
      if (coords) {
        sheet.getRange(row, 14).setValue(coords.lat); // N 欄：緯度
        sheet.getRange(row, 15).setValue(coords.lng); // O 欄：經度
      }
    }
  } catch (err) {
    Logger.log(`抓取失敗 [${url}]: ${err.message}`);
    sheet.getRange(row, 16).setValue('❌ 需手動');
  }
}

/**
 * 解析網址 — 先用 OG meta，再用網站專用解析器
 */
function _parseUrl(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    },
  });

  const html = response.getContentText('UTF-8');
  const $ = Cheerio.load(html, { decodeEntities: false });

  const info = {
    name: '',
    address: '',
    rent: 0,
    size: 0,
    layout: '',
    floor: '',
    images: '',
  };

  // === 第一層：OG Meta 通用解析 ===
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const title = $('title').text() || '';

  info.name = ogTitle || title;
  if (ogImage) info.images = ogImage;

  // 從 OG description 嘗試解析租金和坪數
  const rentMatch = ogDesc.match(/(\d[\d,]*)\s*元?\/?月/);
  if (rentMatch) info.rent = parseInt(rentMatch[1].replace(/,/g, ''));

  const sizeMatch = ogDesc.match(/([\d.]+)\s*坪/);
  if (sizeMatch) info.size = parseFloat(sizeMatch[1]);

  // === 第二層：網站專用解析 ===
  if (url.includes('591.com.tw')) {
    _parse591($, info);
  } else if (url.includes('hbhousing.com') || url.includes('housefun.com.tw')) {
    _parseHaoFang($, info);
  } else if (url.includes('sinyi.com.tw')) {
    _parseSinYi($, info);
  } else if (url.includes('rakuya.com.tw')) {
    _parseRakuya($, info);
  }

  return info;
}

/**
 * 591 租屋網解析
 */
function _parse591($, info) {
  // 591 的 OG title 通常格式為：「物件名稱 - 591租屋網」
  if (info.name) {
    info.name = info.name.replace(/\s*[-–—]\s*591.*$/i, '').trim();
  }

  // 嘗試抓取更多資訊
  const priceEl = $('.info-price .price').text() || $('[data-v-price]').text();
  if (priceEl) {
    const p = parseInt(priceEl.replace(/[^\d]/g, ''));
    if (p > 0) info.rent = p;
  }

  const addrEl = $('.info-addr .addr').text() || $('[class*="address"]').text();
  if (addrEl) info.address = addrEl.trim();

  // 面積
  const infoItems = $('.info-box-content li, .detail-info li');
  infoItems.each(function() {
    const text = $(this).text();
    if (text.includes('坪') && !info.size) {
      const m = text.match(/([\d.]+)\s*坪/);
      if (m) info.size = parseFloat(m[1]);
    }
    if (text.includes('房') && !info.layout) {
      const m = text.match(/\d+房\d+廳\d+衛/);
      if (m) info.layout = m[0];
    }
    if (text.includes('樓') && !info.floor) {
      const m = text.match(/\d+F?\/?\d*F?/);
      if (m) info.floor = m[0];
    }
  });
}

/**
 * 好房網解析
 */
function _parseHaoFang($, info) {
  if (info.name) {
    info.name = info.name.replace(/\s*[-–—]\s*(好房網|HouseFun).*$/i, '').trim();
  }

  const price = $('[class*="price"], .detail-price').first().text();
  if (price) {
    const p = parseInt(price.replace(/[^\d]/g, ''));
    if (p > 0) info.rent = p;
  }

  const addr = $('[class*="address"], .detail-addr').first().text();
  if (addr) info.address = addr.trim();
}

/**
 * 信義房屋解析
 */
function _parseSinYi($, info) {
  if (info.name) {
    info.name = info.name.replace(/\s*[-–—]\s*信義房屋.*$/i, '').trim();
  }

  const details = $('[class*="detail"], .object-info');
  details.find('li, .info-item').each(function() {
    const text = $(this).text();
    if (text.includes('元') && !info.rent) {
      const m = text.match(/(\d[\d,]*)\s*元/);
      if (m) info.rent = parseInt(m[1].replace(/,/g, ''));
    }
  });
}

/**
 * 樂屋網解析
 */
function _parseRakuya($, info) {
  if (info.name) {
    info.name = info.name.replace(/\s*[-–—]\s*(樂屋網|rakuya).*$/i, '').trim();
  }
}

// ============================
// 5. 地理編碼
// ============================

/**
 * 更新所有經緯度
 */
function geocodeAll() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROPERTIES);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const address = data[i][2]; // C 欄
    const lat = data[i][13];    // N 欄 (index 13)
    const lng = data[i][14];    // O 欄 (index 14)

    if (address && (!lat || !lng)) {
      const coords = _geocode(address.toString());
      if (coords) {
        sheet.getRange(i + 1, 14).setValue(coords.lat); // N 欄：緯度
        sheet.getRange(i + 1, 15).setValue(coords.lng); // O 欄：經度
        count++;
      }
    }
  }

  SpreadsheetApp.getUi().alert(`已更新 ${count} 個經緯度`);
}

/**
 * 地址轉經緯度（使用 Google 試算表內建的 Google Maps 服務，100% 精準且不被阻擋）
 */
function _geocode(address) {
  try {
    const response = Maps.newGeocoder().geocode(address);
    if (response.status === 'OK' && response.results && response.results.length > 0) {
      const loc = response.results[0].geometry.location;
      return {
        lat: parseFloat(loc.lat),
        lng: parseFloat(loc.lng)
      };
    }
  } catch (err) {
    Logger.log(`Google Maps Geocode 失敗 [${address}]: ${err.message}`);
  }
  return null;
}

// ============================
// 輔助函式
// ============================

function _jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
