# Todo Calendar PWA

可部署於 GitHub Pages 的 Todo List / Calendar PWA，支援手機與桌機、離線、提醒、Google Drive 同步示範與版本更新。

## V0.2 修改重點

- 提醒時間改為選單式日期與時間欄位：`type="date"` + `type="time"`。
- 通知提醒移到事件新增 / 編輯 Modal，可針對每個事件選擇：不提醒、提前 5 分鐘、10 分鐘、30 分鐘、1 小時、1 天。
- 儲存有提醒的事件時，會主動檢查 / 要求 Notification 權限。
- 設定頁「檢查更新」新增明確狀態顯示：檢查中、已是最新版、發現新版本、檢查失敗。
- 月曆新增「回到今日」按鈕。
- App Version：`1.0.1`；專案檔名：`TodoPWA-V0.2-20260604`。

## 檔案結構

```text
TodoPWA-V0.2-20260604/
├─ index.html
├─ styles.css
├─ app.js
├─ manifest.json
├─ service-worker.js
├─ version.json
├─ README.md
└─ icons/
```

## 本機執行

```bash
python -m http.server 8080
```

開啟：`http://localhost:8080`

## GitHub Pages 部署

1. 將檔案放到 GitHub repo 根目錄。
2. 到 `Settings → Pages`。
3. Source 選 `Deploy from a branch`。
4. Branch 選 `main`，Folder 選 `/root`。

## Google Drive 同步

- 使用 `https://www.googleapis.com/auth/drive.file` scope。
- 在指定資料夾建立 / 更新 `todo-pwa-data.json`。
- 未授權時提供本機 mock remote 模式，僅用於示範同步流程。

## 更新機制

版本來源為 `version.json`：

```json
{
  "version": "1.0.1",
  "updateNotes": "V0.2 update"
}
```

更新時請同步修改：

1. `app.js` 的 `APP_VERSION`
2. `service-worker.js` 的 `CACHE_NAME`
3. `version.json` 的 `version` / `updateNotes`

## 版本紀錄

### V0.2 - 2026-06-04

- 提醒時間改為日期 / 時間選單。
- 通知提醒移至事件編輯頁面並支援個別事件設定。
- 改善 Notification 權限處理。
- 檢查更新新增狀態提醒。
- 月曆新增回到今日按鈕。

### V0.1 - 2026-06-04

- 初版：Todo、提醒、月曆、Mobile/desktop UX、設定頁、Google Drive 同步示範、PWA 離線、版本檢查與更新。
