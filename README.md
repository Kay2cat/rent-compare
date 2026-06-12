# 🏠 合租找房比較器

> 多人合租找房比較工具：表格對比、地圖瀏覽、雷達圖分析、投票決策。
> 串接 Google Sheets 即時同步，不需架站、不花錢。

## 🚀 快速開始

### 第一步：建立 Google Sheet

1. 開啟 [Google Sheets](https://sheets.google.com)，建立新試算表
2. 命名為「合租找房比較」
3. 建立三個工作表（Sheet Tab）：

#### 工作表 1：`物件資料`

在第一列（標題列）依序填入：

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 網址 | 名稱 | 地址 | 月租金 | 坪數 | 格局 | 樓層 | 押金 | 含水電網 | 人均月費 | 優缺點標籤 | 圖片 | 備註 | 緯度 | 經度 | 抓取狀態 |

> **J 欄公式**：在 J2 輸入 `=IF(D2>0, ROUND(D2/3, 0), "")` 然後往下拉

#### 工作表 2：`投票`

| A | B | C | D | E |
|---|---|---|---|---|
| 物件名稱 | 投票者 | 分數 | 留言 | 時間 |

#### 工作表 3：`標籤定義`

| A | B | C | D |
|---|---|---|---|
| 標籤名稱 | 分類 | 顏色 | Emoji |
| 近捷運 | 交通 | #10b981 | 🚇 |
| 近公車站 | 交通 | #10b981 | 🚌 |
| 停車位 | 交通 | #10b981 | 🅿️ |
| 有電梯 | 設施 | #3b82f6 | 🛗 |
| 管理員 | 設施 | #3b82f6 | 👮 |
| 洗衣機 | 設施 | #3b82f6 | 🧺 |
| 家具齊全 | 設施 | #3b82f6 | 🛋️ |
| 冷氣 | 設施 | #3b82f6 | ❄️ |
| 獨立衛浴 | 設施 | #3b82f6 | 🚿 |
| 採光好 | 環境 | #f59e0b | ☀️ |
| 通風佳 | 環境 | #f59e0b | 🌬️ |
| 安靜 | 環境 | #f59e0b | 🤫 |
| 生活機能好 | 環境 | #f59e0b | 🏪 |
| 有陽台 | 環境 | #f59e0b | 🌿 |
| 新裝潢 | 屋況 | #a855f7 | ✨ |
| 含水費 | 費用 | #f97316 | 💧 |
| 含電費 | 費用 | #f97316 | ⚡ |
| 含網路 | 費用 | #f97316 | 📶 |
| 租金可議 | 費用 | #f97316 | 💬 |
| 無陽台 | 缺點 | #bf5a50 | ⚠️ |
| 離捷運遠 | 缺點 | #bf5a50 | ⚠️ |

> 你可以隨時新增自己的標籤！若未定義的標籤中包含常見負面詞（如：無、不、遠、吵、偏高），系統也會自動著色為缺點警告紅！

### 第二步：設定 Google Apps Script

1. 在 Google Sheet 上方選單 → **擴充功能** → **Apps Script**
2. 刪除預設程式碼
3. 將 `google-apps-script/Code.gs` 的完整內容貼入
4. 新增 Cheerio 程式庫：
   - 左側選單 → **程式庫**（Libraries）→ 點「+」
   - 輸入 Script ID：`1ReeQ6WO8kKNxoaA_O0XEQ589cIrRvEBA9qcWpNqdOP17i47u6N9M5Xh0`
   - 選擇最新版本 → **新增**
5. 部署為 Web App：
   - 右上角 **部署** → **新增部署作業**
   - 類型：**網頁應用程式**
   - 說明：合租找房比較器 API
   - 執行身分：**我**
   - 誰可以存取：**所有人**
   - 點擊 **部署** → 複製產生的 URL

> ⚠️ 首次部署需要授權。點擊「授權」→「進階」→「前往（你的專案名稱）」

### 第三步：設定自動抓取觸發器（選用）

1. 在 Apps Script 編輯器左側 → **觸發條件**（Triggers）
2. 點右下角 **+ 新增觸發器**
3. 設定：
   - 函式：`onEditTrigger`
   - 事件來源：試算表
   - 事件類型：**編輯時**
4. 儲存

設定完成後，在 A 欄貼入網址就會自動抓取！

### 第四步：使用網頁

#### 方法 1：直接開啟（Demo 模式）
直接用瀏覽器開啟 `index.html`，會以內建的示範資料運作。

#### 方法 2：連接 Google Sheets
開啟網頁後，點擊右上角的「投票者名稱」按鈕，在設定中：
- 貼入 Apps Script Web App URL
- 輸入你的暱稱
- 設定合租人數和水電預估

#### 方法 3：透過 URL 參數
```
https://你的帳號.github.io/rent-compare/?api=SCRIPT_URL&voter=小明
```

### 第五步：分享給室友

每位室友用不同的 `voter` 參數：
```
小明：?api=SCRIPT_URL&voter=小明
小華：?api=SCRIPT_URL&voter=小華
小美：?api=SCRIPT_URL&voter=小美
```

## 📋 使用流程

```
1. 在 Google Sheet A 欄貼入租屋網址
   ↓（自動抓取標題、價格等）
2. 手動補充缺少的資訊
3. 在 K 欄填寫優點（逗號分隔）：採光好, 近捷運, 有電梯
4. 在 L 欄填寫缺點（逗號分隔）：無陽台, 租金偏高
5. 開啟網頁 → 自動載入所有資料
6. 切換表格 / 地圖 / 雷達圖檢視
7. 點擊標籤篩選物件
8. 到投票頁面投票（1-5 分）
9. 用雷達圖比較候選物件
10. 達成共識，恭喜找到新家！🎉
```

## 🛠 技術棧

| 項目 | 技術 |
|:---|:---|
| 前端 | HTML + CSS + Vanilla JS |
| 地圖 | Leaflet.js + OpenStreetMap |
| 圖表 | Chart.js（雷達圖） |
| 資料 | Google Sheets |
| API | Google Apps Script |
| 部署 | GitHub Pages / 本機開啟 |

## 📂 檔案結構

```
rent-compare/
├── index.html              # 主頁面
├── css/
│   └── index.css           # 設計系統
├── js/
│   ├── app.js              # 主程式
│   ├── data-service.js     # 資料服務
│   ├── table-view.js       # 表格檢視
│   ├── map-view.js         # 地圖檢視
│   ├── chart-view.js       # 雷達圖
│   ├── tag-system.js       # 標籤系統
│   ├── vote-panel.js       # 投票面板
│   └── cost-calc.js        # 費用計算
├── google-apps-script/
│   └── Code.gs             # Apps Script 程式碼
└── README.md               # 本文件
```

## ❓ FAQ

## ❓ FAQ

**Q：591 抓不到資料怎麼辦？（⚠️ 完美解決方案：使用「一鍵找房書籤小工具」）**
A：由於 591 設有嚴格的防爬蟲機制，Google Apps Script 伺服器去爬網頁容易被阻擋。**最推薦的解決方法是使用「書籤小工具」，由您的瀏覽器進行一鍵抓取並同步**！

#### 🛠️ 書籤小工具安裝教學 (只需設定一次)
1. 複製下方框框中的**所有代碼**：
   ```javascript
   javascript:(function(){let s=localStorage.getItem('rc_bookmarklet_api');if(!s){s=prompt('首次使用，請輸入您的 Google Apps Script Web App URL:\n(例如: https://script.google.com/macros/s/.../exec)');if(!s)return;if(s.indexOf('https://script.google.com/')!==0){alert('無效的 Apps Script 網址！');return}localStorage.setItem('rc_bookmarklet_api',s)}const u=window.location.href;let n='',a='',r=0,z=0,l='',f='',img='';try{const g=p=>{const e=document.querySelector('meta[property="'+p+'"]');if(e)return e.content;return''};n=g('og:title')||document.title;n=n.replace(/\s*[-–—]\s*591.*$/i,'').trim();img=g('og:image');const d=g('og:description')||'';const rm=d.match(/(\d[\d,]*)\s*元/);if(rm)r=parseInt(rm[1].replace(/,/g,''));const zm=d.match(/([\d.]+)\s*坪/);if(zm)z=parseFloat(zm[1]);if(window.location.host.indexOf('591.com.tw')!==-1){const ae=document.querySelector('.address, .detail-map-addr, [class*="address"]');if(ae)a=ae.innerText.replace(/地圖|周邊/g,'').trim();const ds=document.querySelectorAll('.house-pattern span, .house-pattern li, .detail-house-item span, .info-box-content li');ds.forEach(e=>{const t=e.innerText.trim();if(t.indexOf('坪')!==-1&&!z){const m=t.match(/([\d.]+)\s*坪/);if(m)z=parseFloat(m[1])}if(t.indexOf('房')!==-1&&t.indexOf('廳')!==-1&&!l)l=t;if(t.indexOf('層')!==-1||t.indexOf('F')!==-1||t.indexOf('樓')!==-1){if(!f)f=t}});if(!r){const pe=document.querySelector('.house-price, .price, [class*="price"]');if(pe)r=parseInt(pe.innerText.replace(/[^\d]/g,''))}}}catch(e){console.error(e)}if(!confirm('即將同步此物件到您的找房比較器：\n\n🏠 名稱: '+n+'\n💰 租金: '+r+' 元/月\n📍 地址: '+(a||'（未抓到，請手動補）')+'\n📐 坪數: '+(z||0)+' 坪\n🧩 格局: '+(l||'（無）')+'\n🏢 樓層: '+(f||'（無）')+'\n\n是否送出？'))return;const p={action:'addProperty',url:u,name:n,address:a,rent:r,size:z,layout:l,floor:f,images:img};const ld=document.createElement('div');Object.assign(ld.style,{position:'fixed',top:'20px',right:'20px',background:'rgb(74,124,114)',color:'rgb(255,255,255)',padding:'12px 24px',borderRadius:'8px',zIndex:'999999',boxShadow:'0 4px 12px rgba(0,0,0,0.15)',fontFamily:'sans-serif',fontSize:'14px',transition:'all 0.3s ease'});ld.innerText='⏳ 正在同步資料到 Google Sheet...';document.body.appendChild(ld);fetch(s,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(p)}).then(x=>{if(!x.ok)throw new Error('API 錯誤');return x.json()}).then(y=>{if(y.success){ld.style.background='rgb(46,125,50)';ld.innerText='✅ 同步成功！物件已寫入試算表';setTimeout(()=>ld.remove(),2500)}else{throw new Error(y.error||'寫入失敗')}}).catch(e=>{ld.style.background='rgb(198,40,40)';ld.innerText='❌ 同步失敗: '+e.message;const c=confirm('同步失敗，是否需要清除儲存的 API 網址並重新設定？');if(c)localStorage.removeItem('rc_bookmarklet_api');setTimeout(()=>ld.remove(),5000)})();})();
   ```
2. 在您的瀏覽器中任意建立一個書籤（例如按 `Cmd+D` 或 `Ctrl+D` 隨便存一個網頁），然後對該書籤按右鍵點擊**「編輯」**（或「修改」）。
3. 將書籤的**名稱**命名為：`➕ 傳送至比較器`
4. 將書籤的**網址 (URL)** 欄位清空，並貼上您剛才複製的全部代碼，然後儲存。
5. 確保您的瀏覽器已顯示「書籤列」（快速鍵 `Cmd+Shift+B` 或 `Ctrl+Shift+B`），這樣方便您隨時點擊。

#### 🚀 如何使用書籤一鍵找房
1. 用瀏覽器開啟任何一個 591 租屋物件的詳細網頁。
2. 點擊您瀏覽器書籤列的 **`➕ 傳送至比較器`**。
3. **首次使用**：會跳出輸入框，請貼入您的 **Google Apps Script Web App URL**（只要輸入一次，瀏覽器就會自動記住）。
4. 網頁會彈出確認視窗，顯示抓取到的租屋資訊（標題、月租、地址、坪數等），確認無誤後點擊 **「確定」**。
5. 網頁右上角會顯示「✅ 同步成功！」，此時資料已自動寫入 Google Sheets 並自動計算人均月租和座標，重新整理比較器網頁即可看到新物件！

---

**Q：標籤可以自訂嗎？**
A：可以！在「標籤定義」工作表新增一列，填入標籤名稱、分類、顏色和 Emoji。網頁重新整理後就會生效。

**Q：投票可以改嗎？**
A：可以，再投一次相同物件就會自動更新分數。

**Q：手機可以用嗎？**
A：可以，網頁有響應式設計，手機瀏覽體驗良好。

