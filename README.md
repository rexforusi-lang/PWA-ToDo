# Todo Calendar PWA

一個可部署於 GitHub Pages 的跨平台 Todo List / Calendar Progressive Web App。支援手機滑動刪除、桌機編輯、通知提醒、離線快取、Google Drive JSON 同步示範，以及版本檢查與更新流程。

## 功能總覽

- Todo 任務：標題、內容、提醒時間 `YYYY/MM/DD HH:mm`
- Checklist：完成後反灰與刪除線
- 通知提醒：提前 30 / 10 / 5 分鐘透過 Notification API 提醒
- 月曆：當月 6 週格線，包含前後月份日期，支援左右滑切換月份
- 新增 / 編輯 Modal
- Mobile UX：任務向左滑顯示紅色刪除按鈕，點擊後刪除
- Desktop UX：任務列顯示編輯 / 刪除按鈕，點擊任務亦可編輯
- 本地離線儲存：LocalStorage（可改 IndexedDB）
- Google Drive 同步：使用 Drive JSON 檔案作為資料來源；未授權時提供模擬同步
- PWA：manifest + service worker cache，可安裝與離線使用
- 版本更新：設定頁顯示 Current / Latest Version，從 `version.json` 取得最新版本

## 檔案結構

```text
TodoPWA-V0.1-20260604/
├─ index.html
├─ styles.css
├─ app.js
├─ manifest.json
├─ service-worker.js
├─ version.json
├─ README.md
└─ icons/
   ├─ icon-72.png
   ├─ icon-96.png
   ├─ icon-128.png
   ├─ icon-144.png
   ├─ icon-152.png
   ├─ icon-192.png
   ├─ icon-384.png
   └─ icon-512.png
```

## 快速開始

### 本機執行

Service Worker 需要 HTTP/HTTPS 環境，不建議直接用 `file://` 開啟。

```bash
python -m http.server 8080
```

開啟：

```text
http://localhost:8080
```

### 部署到 GitHub Pages

1. 建立 GitHub repository。
2. 將本專案所有檔案放到 repo 根目錄。
3. 到 GitHub `Settings → Pages`。
4. Source 選擇 `Deploy from a branch`。
5. Branch 選 `main`，Folder 選 `/root`。
6. 等待 Pages 完成部署。

> 本專案使用相對路徑 `./`，可直接部署於 GitHub Pages 子路徑。

## Google Drive 同步設定

此專案為純前端靜態 PWA，無後端伺服器。Google Drive 同步採用 OAuth access token 呼叫 Drive REST API：

- Scope：`https://www.googleapis.com/auth/drive.file`
- 檔名：`todo-pwa-data.json`
- 位置：使用者設定的 Google Drive folder
- 同步策略：
  - 本地更新後 debounce 自動同步
  - 每 60 秒 polling 一次
  - 也可在設定頁點擊「立即同步」
  - 合併策略：以每筆任務的 `updatedAt` 較新者為準

### 建立 OAuth Client ID

1. 前往 Google Cloud Console。
2. 建立或選擇 project。
3. 啟用 Google Drive API。
4. 建立 OAuth Client ID，類型選 Web application。
5. Authorized JavaScript origins 加入：
   - `http://localhost:8080`
   - 你的 GitHub Pages 網址，例如 `https://yourname.github.io`
6. 將 Client ID 貼到 App 設定頁。
7. 輸入 Google Drive 資料夾連結或 folder ID。
8. 點擊「Google 授權」後再點「立即同步」。

### 模擬同步

如果未輸入或未授權 Google OAuth，系統會將同步 payload 寫入本機設定中的 `mockRemote`，用於示範同步流程與資料格式。真正跨裝置同步需完成 Google OAuth 設定。

## 版本控制與 PWA 更新

版本資料來源為 `version.json`：

```json
{
  "version": "1.0.0",
  "updateNotes": "Initial release"
}
```

更新流程：

1. 修改 `app.js` 的 `APP_VERSION`。
2. 修改 `service-worker.js` 的 `CACHE_NAME`，例如 `todo-calendar-pwa-v1.0.1`。
3. 修改 `version.json` 的 `version` 與 `updateNotes`。
4. Commit 並 push 到 GitHub Pages。
5. 使用者在設定頁點擊「檢查更新」。
6. 若 `Latest Version > Current Version`，會出現「套用更新」。
7. 點擊後會更新 service worker、清 cache 並 reload。

## 已知限制與建議改善

- Notification API 在純前端 PWA 中需要 App/頁面仍有執行環境，瀏覽器完全關閉時無法保證準時提醒。若要可靠背景推播，需要 Push API + 後端或雲端排程。
- LocalStorage 已可離線使用，但大量資料建議改成 IndexedDB。
- Google Drive conflict resolution 目前採 last-write-wins，可擴充為 change log 或 CRDT。
- GitHub Pages 是靜態託管，無法安全保存 OAuth secret；本專案採用前端 OAuth flow，不使用 client secret。

## 版本紀錄

### V0.1 - 2026-06-04

- 初版：Todo、提醒、月曆、Mobile/desktop UX、設定頁、Google Drive 同步示範、PWA 離線、版本檢查與更新。
