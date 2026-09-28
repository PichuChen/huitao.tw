# 慧陶香坊訂單後台 MVP

此 PR 保留現行 `/medcoral` Google Form，不改顧客下單流程；Form submit 透過 Apps Script 同步到 PostgreSQL，後台位於 `/admin/orders`。

## 架構

```text
Google Form
   ↓ Apps Script
POST /api/import/google-form
   ↓
Netlify Functions
   ↓
PostgreSQL (HUITAO_DATABASE_URL)
   ↓
/admin/orders
```

目前 huitao.tw 的 Netlify 專案測試結果顯示：
- 純 Astro + admin 頁 Deploy Preview 成功
- 普通 `pg` dependency Deploy Preview 成功
- 單獨加入 `@netlify/database` 即 Deploy Preview 失敗

因此 MVP 改用普通 PostgreSQL driver，不依賴 Netlify Database provisioning。資料庫可使用 Neon、Supabase、RDS 或其他 PostgreSQL。

## 新增元件

- `frontend/db/migrations/20260928153000_orders.sql`
  - customers / products / orders / order_items / order_events / audit_logs
- `frontend/scripts/migrate-db.mjs`
  - 簡單 migration runner，使用 `schema_migrations` 記錄已套用 migration
- `frontend/netlify/lib/orders.mjs`
  - Google Form payload validation、server-side pricing、客戶去重、交易式寫入、idempotency
- `frontend/netlify/functions/import-google-form.mjs`
  - `POST /api/import/google-form`
  - `HUITAO_FORM_SYNC_TOKEN`
- `frontend/netlify/functions/admin-orders.mjs`
  - `GET /api/admin/orders`
  - `PATCH /api/admin/orders`
  - Bearer `HUITAO_ADMIN_TOKEN`
- `frontend/src/pages/admin/orders.astro`
  - 訂單列表、狀態篩選、狀態更新
- `docs/google-form-sync.gs`
  - Google Form Apps Script 同步程式

## 必要環境變數

在 Netlify 設定 Functions 可讀取的 secrets：

- `HUITAO_DATABASE_URL`
- `HUITAO_FORM_SYNC_TOKEN`
- `HUITAO_ADMIN_TOKEN`

三者都不可 commit 進 Git。

## 初始化資料庫

設定本機 `HUITAO_DATABASE_URL` 後，在 `frontend/` 執行：

```sh
npm install
npm run db:migrate
```

migration runner 只會執行尚未記錄於 `schema_migrations` 的 SQL 檔。

## Google Form

1. 在 Google Form 開啟 Extensions → Apps Script。
2. 貼入 `docs/google-form-sync.gs`。
3. 將 `setHuitaoOrderSyncToken()` 內 placeholder 暫時換成與 Netlify 相同的 `HUITAO_FORM_SYNC_TOKEN`，執行一次。
4. 將明文 secret 從 script 編輯器移除／改回 placeholder。
5. 執行 `installHuitaoOrderSyncTrigger()` 一次並授權。
6. 送一筆測試表單。
7. 到 `/admin/orders` 以 `HUITAO_ADMIN_TOKEN` 登入確認。

## 定價 mapping

- `one_bottle`: 1 × NT$4,500；運費 NT$0
- `two_bottles`: 2 × NT$4,300 = NT$8,600；運費 NT$0
- `sample_2ml`: 商品 NT$0；運費 NT$60

金額由 server-side mapping 決定，不信任 Apps Script 傳入金額。

## 尚未做

- 正式帳號登入 / RBAC
- huitao.tw 自有 checkout
- 金流 webhook
- 出貨與物流
- MCP tools
- retention / PII deletion job
