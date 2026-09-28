# 慧陶香坊訂單後台 MVP

此 patch 保留現行 `/medcoral` Google Form，不改顧客下單流程；Form submit 透過 Apps Script 同步到 Netlify Database (Postgres)，後台位於 `/admin/orders`。

## 新增元件

- `frontend/netlify/database/migrations/20260928153000_orders.sql`
  - customers / products / orders / order_items / order_events / audit_logs
  - 內建 MedCoral 1 瓶、2 瓶 bundle pricing 與 2ml 試用樣本資料基礎
- `frontend/netlify/lib/orders.mjs`
  - Google Form payload validation、方案定價、客戶去重、交易式寫入、idempotency
- `frontend/netlify/functions/import-google-form.mjs`
  - `POST /api/import/google-form`
  - 以 `HUITAO_FORM_SYNC_TOKEN` 保護
- `frontend/netlify/functions/admin-orders.mjs`
  - `GET /api/admin/orders`
  - `PATCH /api/admin/orders`
  - 以 Bearer `HUITAO_ADMIN_TOKEN` 保護
- `frontend/src/pages/admin/orders.astro`
  - 訂單列表、狀態篩選、狀態更新
  - token 只放 sessionStorage，不持久保存
- `docs/google-form-sync.gs`
  - 綁定 Google Form 的 Apps Script，同步新回覆

## package.json 必要變更

Netlify Database 最新 `@netlify/database` 2.0.1 需要 Node >=22.12：

```json
{
  "engines": { "node": ">=22.12.0" },
  "dependencies": {
    "@netlify/database": "2.0.1"
  }
}
```

保留既有 Astro/Tailwind/React dependencies。首次在本機執行 `npm install` 後，應一併提交更新後的 `package-lock.json`；Netlify 本身預設也會執行 `npm install`。

## Netlify 設定

Netlify 目前的 `base = "frontend"`，因此 Functions 預設目錄會是 `frontend/netlify/functions`，migration 也放在 base 下的 `frontend/netlify/database/migrations`。

在 Netlify UI 建立 Functions scope secrets：

- `HUITAO_FORM_SYNC_TOKEN`: 高熵隨機字串
- `HUITAO_ADMIN_TOKEN`: 另一個高熵隨機字串

兩者不可相同，也不要 commit 進 Git。

部署後，若帳號可使用 Netlify Database，`@netlify/database` + migration 會觸發資料庫 provisioning / migration。Netlify Database 目前要求 credit-based plan；若不使用 managed database，可設定 `HUITAO_DATABASE_URL` 指向外部 PostgreSQL，但 migration 需另外套用。

## Google Form

1. 在 Google Form 開啟 Extensions → Apps Script。
2. 貼入 `docs/google-form-sync.gs`。
3. 將 `setHuitaoOrderSyncToken()` 內 placeholder 暫時換成與 Netlify 相同的 `HUITAO_FORM_SYNC_TOKEN`，執行一次。
4. 把明文 secret 從 script 編輯器移除／改回 placeholder。
5. 執行 `installHuitaoOrderSyncTrigger()` 一次並授權。
6. 送一筆測試表單。
7. 到 `/admin/orders` 以 `HUITAO_ADMIN_TOKEN` 登入確認。

## 定價 mapping

- `one_bottle`: 1 × NT$4,500；運費 NT$0
- `two_bottles`: 2 × NT$4,300 = NT$8,600；運費 NT$0
- `sample_2ml`: 商品 NT$0；運費 NT$60

定價由 server-side mapping 決定，不信任 Apps Script 傳來的金額。

## 尚未做（下一階段）

- 正式帳號登入 / RBAC（目前是單一 admin token）
- huitao.tw 自有 checkout（目前仍使用 Google Form）
- 金流 webhook
- 出貨單與物流
- MCP tools（會直接共用 orders service / DB）
- retention / PII deletion job
