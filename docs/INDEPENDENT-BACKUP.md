# 長期保存與 AI 交接

本專案可獨立保存。原作是 JPTER78/pokesurvivor，固定基礎版本為
`90baf548375fc14891ce43e2a5d5953449e3663c`。原作者日後移除網站或儲存庫，
不會遠端刪除這份已保存的檔案。必要的程式、圖鑑資料、翻譯、圖片與字型均已包含。

## 給接手的 AI

1. 先讀 README.md、SOLO-CHANGES.md、LICENSE、CREDITS.md 和本文件。
2. 網頁來源是 dev.html，程式在 js/，翻譯來源是 tools/zh-Hant-ui.json。
3. 執行 `node tools/build-solo.mjs` 建立 dist/。沒有 npm 安裝步驟，也不必重新抓素材。
4. 生產網站發布 dist/；根目錄 index.html 與 js/app.min.js 由同一建置產生。
   en/index.html 導向目前單人版。不要使用原作 tools/build.js 覆蓋繁中建置。
5. 必要資源檢查是 `node tools/check-independent.mjs`，不需要反覆測試或重構。
6. 保留目前規則、數值、素材與存檔結構，只針對使用者提出的問題修改。

## 本地或其他主機

ZIP 解壓縮後可使用 Node.js 建置。若已安裝 Python，在專案根目錄執行：

```text
python -m http.server 8000 --directory dist
```

再開啟 http://localhost:8000/。必要資源全部由本地伺服器提供，不需要原作者網站、
PokeAPI、Firebase、TURN 或外部字型服務。部署到其他靜態主機時上傳 dist/ 內容即可。
不建議雙擊 HTML 作為長期存檔方式；file:// 的 localStorage 行為依瀏覽器而異。

`.openai/hosting.json` 保存目前 Sites 網站身分，維護原網站時不可更換。
建立另一個 Sites 網站時應在副本使用新網站回傳的 ID，避免覆蓋現有網站。
ZIP 保留目前專案身分，未包含存取憑證、.git、套件快取或使用者個人存檔。

## 目前的遊戲進度

網址維持 https://pokesurvivor-solo.adored-rhino-4625.chatgpt.site/ 。
永久進度位於同一瀏覽器、同一網站來源的 `ps.save.solo`。
本次沒有更改網址、這個鍵名、存檔版本或讀寫邏輯，也沒有清除瀏覽器資料。
GitHub 和程式 ZIP 不會自動包含你在瀏覽器裡玩的進度。
請在遊戲「設定 → 進度／備份」匯出 JSON，另外保存。
移到其他主機、localhost、其他瀏覽器或新手機時，使用遊戲內匯入還原。
備份只有永久進度，不含正在進行的戰鬥。

## 必要資源與保留的連結

| 類別 | 保存位置／狀態 |
|---|---|
| HTML／CSS／JavaScript | dev.html、js/、css/ 與完整 dist/ |
| 普通／異色動畫 | assets/pokemon/，發布副本在 dist/assets/pokemon/ |
| 圖示與字型 | assets/icons/、assets/fonts/；字型授權在 assets/fonts/OFL.txt |
| 音樂與音效 | js/data/music.js、js/core/audio.js；Web Audio 即時合成，沒有外部音訊檔依賴 |
| 圖鑑、招式、物品與翻譯 | js/data/ 與 tools/zh-Hant-ui.json；PokeAPI 僅為資料來源，遊玩與建置不呼叫它 |
| Firebase SDK／雲端 API | 原作程式保留，G.SOLO=true、G.FIREBASE_CONFIG=null 使單人啟動直接走本機 |
| TURN／STUN／排行榜 | 原作多人模組保留，沒有單人必要依賴，未登入雲端不啟用 |
| 原作者 GitHub、授權與作者連結 | 僅供署名或主動點開，關閉不影響遊戲 |
| 原作說明頁、後端與素材下載工具 | 為完整來源保留，不是單人部署或建置的必要步驟 |

有網址字串不等於遊玩會呼叫該服務。檢查以目前入口、建置順序與單人分支為準。
不要為了消除文字搜尋結果而刪除作者與授權連結。
目前 PWA 按使用情況快取圖片，不能保證只開過一次就已完整離線下載。
完整 ZIP 加本地伺服器是獨立於外部託管服務的保存方式。

## 授權

完整 LICENSE 和 CREDITS.md 原文保留。程式與合成音樂是 MIT；
SpriteCollab 素材為 CC BY-NC 4.0，須保留署名並限非商業用途；
Pixelify Sans 字型是 SIL OFL 1.1。MIT 不涵蓋全部素材。
Pokémon 名稱與角色權利聲明保留。本專案為個人、非商業同人作品。

## 檢查限制

本次僅做一次必要資源／單人入口檢查與一次 ZIP 完整性檢查。
沒有新增機制、重置進度或大規模重構；沒有重跑先前存檔測試或手機實機測試。
檔案完整與分支檢查不等同所有遊戲內容均已完整實機驗收。
