# CLAUDE.md — Brand OS 系統憲法

> **這份檔給所有 Claude 對話讀。** 動 Brand OS 任何程式碼前,先讀完。
> 客戶 = RA(Cyndi · 芮比廣告行銷 · 台中)
> 線上版 = https://ai.raby.com.tw

---

## 🛑 絕對不可違反(Hard Rules)

### Rule 1 — AI 生圖不打品牌名字
**炸點**:AI 在海報上「打字寫巧福健康家電」→ 很醜。

**規則**:
- ❌ **絕對不准** prompt 裡寫「title text: 巧福健康家電」「品牌名稱以中文出現」
- ❌ **絕對不准** AI 生圖時自動加品牌名 typography
- ✅ **正確做法**:AI 生圖只生背景+商品 → PhotoRoom API 後製疊真 LOGO 到右下角

### Rule 2 — brand_pack.scenes 不可寫死「商品本質」
**炸點**:chiaofu brand_pack 的 scenes 寫了 "terrazzo / Togo sofa / 1970s vintage" → 任何 flavor 選項都生成台式懷舊。

**規則**:
- brand_pack.scenes 只能寫 **品牌氣質形容詞**(暖橘紅、木質米白、深森林綠調)
- 商品本質(復古、現代、未來感)**絕對禁止寫在 brand_pack**
- 場景具象描述(沙發、地板、年代)**絕對禁止寫在 brand_pack**

### Rule 3 — flavor 必須覆蓋 brand_pack.scenes
**規則**:`buildPosterPrompt()` 組合 prompt 時:
1. brand_pack.scenes = **底色**(色調 + mood)
2. flavor.scenes = **覆蓋層**(韓系乾淨 / 復古未來 Y2K / 2026 醜萌)
3. 衝突時 **flavor 一定贏**

### Rule 4 — 進駐表 bug ID 不可改
**炸點**:`ever_7011` / `kol_8072` 是進駐表自動編 ID(bug 結果)。

**規則**:這兩個 ID **絕對不可改**(會搞死關聯資料)。客戶已決議:保留,未來修核准邏輯時才一起處理。

### Rule 5 — 不重生長檔案
- admin.html(~2730 行)、Code.gs(~2700 行)、worker.js(~1500 行)→ **絕對禁止整檔重生**
- 只能用 `str_replace` patch 模式
- 唯一例外:檔案少於 800 行才能整段重生

---

## 📐 海報生成 Prompt 七層結構

```
[Layer 1] 品牌靈魂        ← brand.soul(從進駐表翻譯而來)
[Layer 2] 品牌色調 + Mood  ← brand.primaryColor + colorMood
[Layer 3] 商品本質        ← product.spec + feature(復古 / 現代 / 未來感)
[Layer 4] 場景 (Base)     ← brand_pack.scenes(只給「氣質」,不給「物件」)
[Layer 5] 風味 (Override) ← flavor.scenes(覆蓋層,韓系/復古/醜萌)
[Layer 6] 構圖           ← shot type / lighting / mood
[Layer 7] 禁區            ← negative: no brand name typography, no Chinese text overlay
```

**權重**:Layer 5 > Layer 4 > Layer 3 > Layer 2 > Layer 1
(風味永遠贏,品牌靈魂只當基底)

---

## 🔒 翻譯機規則(brand pack auto-parse)

當管理員核准進駐表時,GAS `approveBrand()` 會呼叫 Worker `ai_brand_pack_parse` action。

### 輸入(從進駐表 sheet 7 個欄位拼接)
```
story:    品牌故事 / 創辦背景
values:   品牌價值觀 / 主張
competitors: 對標品牌
pros:     優勢
cons:     劣勢 / 痛點
misc:     其他補充
audience: 目標客群
style:    廣告風格偏好
```

### 輸出(寫進 brand_packs sheet,B 雙存架構)
```
{
  "originalText": "...原文 7 欄位串接...",
  "parsed": {
    "soul":      "品牌靈魂 1-2 句",
    "moodWords": "氣質形容詞 4-6 個(只給氣質,不給物件)",
    "colorHints":"色調建議(若有)",
    "audience":  "目標客群摘要",
    "violations":[]   // 若觸發禁區詞 → 強制改寫並記錄
  }
}
```

### 違規偵測詞庫(若 AI 解析時混入,強制改寫)
- 「**商品本質詞**」混入 brand 層:復古、現代、Y2K、未來感、醜萌 → 應該寫在 product.feature,不可寫在 brand
- 「**場景物件詞**」混入 brand 層:terrazzo、沙發、地板、廚房 → 應該寫在 flavor.scenes,不可寫在 brand
- 「**typography 詞**」混入任何層:title text、中文字、品牌名稱 logo 字體 → **直接刪掉**

### 翻譯機重跑機制
- admin.html 提供「✨ 重新翻譯」按鈕(每個品牌一個)
- 點下去 → GAS `reparseBrandPack(brandId)` → Worker `ai_brand_pack_parse` → 預覽 modal → 確認後寫回 sheet
- **原文永遠保留**(B 雙存),可任意重跑

---

## 🎨 9 個品牌色票(寫死在 admin.html v11.2 BRAND_COLOR_PRESETS)

| ID | 名 | 主色 | 副色 | 點綴 | Mood |
|---|---|---|---|---|---|
| `cf` | 巧福健康家電 | `#D86E3C` | `#E8DCC4` | `#3D5A3F` | 溫暖居家、家人守護、生活科技 |
| `ww` | 旺味米香腸 | `#D9B96B` | `#2C4A2D` | `#C44329` | 台灣古早味、手工真材、烤肉聚餐 |
| `ly` | 琉宇醬選 | `#2C2522` | `#E89B9B` | `#F0E5CE` | 精緻質感、頂級料理、義式高級 |
| `ka` | 空瑪那頌缽 | `#4A3A6B` | `#C9A876` | `#F2EAD9` | 靈性療癒、頌缽冥想、東方禪意 |
| `la` | LACE&Z 內衣 | `#9B7BC9` | `#E8788C` | `#D4B896` | 紫藤浪漫、蕾絲柔軟、女性曲線 |
| `moz` | MOZ 瑞典駝鹿 | `#4A6B8A` | `#B89770` | `#7AA84F` | 北歐極簡、駝鹿氣質、春日漫步 |
| `ra` | 芮比(自家) | `#7C6DFA` | `#FA6D9B` | `#6DFAC2` | 當代設計、AI 自動化、未來感 |
| `kol_8072` | 香港福臨門 ⚠️ | `#B8302E` | `#C9A55B` | `#1F1A18` | 粵式經典、傳統高雅、米其林 |
| `ever_7011` | Every Hay 寵物草 ⚠️ | `#C9B584` | `#6B7A4A` | `#F4EDE0` | 天然草本、寵物友善 |

⚠️ = 進駐表自動編 ID,**不可改**

---

## 🏗️ 三層架構

| Layer | 角色 | 路徑 | 行數 |
|---|---|---|---|
| **GAS Code.gs** | Sheet 資料層 | Google Apps Script | ~2700 |
| **Cloudflare Worker** | API 中介 / AI 呼叫 | photoroom-proxy.calm-sunset-6b66.workers.dev | ~1500 |
| **admin.html / admaker.js** | 後台 UI / 主畫面廣告生成 | https://ai.raby.com.tw | ~2730 |

### 已掛環境變數(Worker)
fal.ai / PhotoRoom / Drive Service Account / Kling / GPT / Anthropic

### Anthropic API 預設
- model: `claude-sonnet-4-20250514`
- max_tokens: 1000(超過會 truncate)

---

## 💬 客戶溝通風格

- **語氣短促 = 好**(她在忙),**打長段 = 警訊**(代表不滿意)
- **直接動,別問太多** — 討厭來回確認
- **GAS / Worker 上手軟** — 當她家教
- **錯別字解讀**:依樣=一樣 / 在=再 / ˇ=注音沒選字 / KEY=Key=打字 / 醫直=一直

---

## 📋 動工 SOP(每一步都要走)

1. **動程式前先備份**:`cp /home/claude/brand-os/admin.html /home/claude/brand-os/admin.html.bak`
2. **GAS / Worker 改動用 patch 模式**:「Ctrl+F 搜什麼 → 改什麼 → 改完跟我說 OK」
3. **每階段交付完先停**:等客戶測完才動下一階段
4. **客戶說「給我下載」一定要 `present_files`**,光講「在 outputs」不夠
5. **CDN 快取會誤導判讀**:GitHub raw URL 後加 `?v=YYYYMMDD` 繞過

---

## 🐛 已知地雷

1. **3 家 SPA 站點爬不到色**:旺味 / 琉宇 / 空瑪那 / MOZ 都是 Shopline → 用 image_search 反推
2. **GitHub raw vs 線上版本不一致** → 是 CDN 快取,加 `?v=` 查詢參數繞過
3. **進駐表自動編 ID bug**(ever_7011 / kol_8072)→ 未來修核准邏輯時處理
4. **brand_packs sheet 已有 4 範例**:chiaofu / ka_yoga / lacez / radesign

---

## 🚧 工作進度(2026-05-20)

### ✅ 已部署
- admin.html v11.2 紫粉薄荷(色票卡 + 撞號彈窗 + spec/feature 欄)
- Worker v11.1(智慧新增 + ✨ 補齊)
- GAS v4.5(實際版,不是 context.md 寫的 v4.6/v4.7)

### 🔄 動工中:防呆翻譯機 + Day 1 admaker 重構
1. ✅ CLAUDE.md 憲法檔(這份)
2. ⏳ Worker `ai_brand_pack_parse` action
3. ⏳ GAS `parseBrandPackFromApply()` + `approveBrand()` 改造
4. ⏳ admin.html 加 ✨ 重新翻譯按鈕
5. ⏳ admaker.js `buildPosterPrompt()` flavor 覆蓋邏輯

### 📋 收進 Wishlist(今天不做)
- Harness 六層完整重構
- SEO/AEO/GEO 檢測工具
- lacez-voice 語料庫
- Meta 三平台演算法評分模組
- 圖層化導出按鈕
- Phase 2 模組化拆分
