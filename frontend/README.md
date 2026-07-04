# huitao.tw frontend

此目錄是 huitao.tw 的前端站點，使用 Astro 作為靜態網站框架，並整合 Tailwind CSS 與 React。站內包含首頁、品牌介紹、預約、購物車、作品集，以及多個獨立商品／活動頁面。

## 技術棧

- Astro 4
- Tailwind CSS 3
- React 18
- Node.js 20+

## 開發需求

請先確認本機環境符合以下條件：

- Node.js `>= 20.0.0`
- npm

安裝依賴：

```sh
npm install
```

## 常用指令

以下指令皆在 `frontend/` 目錄執行：

| 指令 | 說明 |
| :--- | :--- |
| `npm run dev` | 啟動本機開發伺服器，預設為 `http://localhost:4321` |
| `npm run build` | 建置正式版站點，並額外產生舊網址相容的 `.html` 頁面 |
| `npm run preview` | 以正式版輸出內容進行本機預覽 |
| `npm run astro -- --help` | 查看 Astro CLI 說明 |

## 專案結構

```text
frontend/
├── public/
│   ├── _redirects
│   ├── images/
│   ├── guasha-blue.html
│   ├── guasha-hq.html
│   ├── guasha-orchid.html
│   ├── guasha-red-b.html
│   └── medcoral.html
├── scripts/
│   └── create-legacy-pages.mjs
├── src/
│   ├── assets/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── scripts/
│   └── styles/
├── astro.config.mjs
├── package.json
└── tailwind.config.mjs
```

### 主要目錄說明

- `src/pages/`: 站內路由頁面來源，每個 `.astro` 檔對應一個頁面。
- `src/layouts/`: 共用版型。
- `src/components/`: 可重用元件。
- `src/scripts/`: 前端互動邏輯，目前包含作品集頁面的本地評論／上傳管理。
- `src/styles/`: 全域樣式。
- `public/`: 直接原樣輸出的靜態檔案，例如圖片、favicon、Netlify `_redirects` 與既有靜態 HTML。
- `scripts/create-legacy-pages.mjs`: 建置後將部分動態路由輸出額外複製成根目錄 `.html`，用於保留舊連結相容性。

## 站內頁面

目前 `src/pages/` 包含以下路由：

- `/`
- `/about`
- `/booking`
- `/cart`
- `/gallery`
- `/guasha-blue`
- `/guasha-hq`
- `/guasha-orchid`
- `/guasha-red-b`
- `/medcoral`

其中 `npm run build` 完成後，會額外產生以下相容舊網址的輸出檔：

- `guasha-blue.html`
- `guasha-hq.html`
- `guasha-orchid.html`
- `guasha-red-b.html`
- `medcoral.html`

## 建置與部署備註

- `astro.config.mjs` 已啟用 Tailwind 與 React 整合。
- `public/_redirects` 可提供 Netlify 路由設定。
- 若新增需要保留舊網址的商品頁，除了建立對應的 `src/pages/*.astro`，也要同步更新 `scripts/create-legacy-pages.mjs`。

## 維護建議

- 新增頁面時，優先放在 `src/pages/`，並保持檔名與網址 slug 一致。
- 新增靜態素材時，依用途放在 `public/images/` 或 `src/assets/`。
- 若作品集互動邏輯有調整，請一併檢查 `src/scripts/galleryManager.js` 的本地儲存欄位是否相容。
