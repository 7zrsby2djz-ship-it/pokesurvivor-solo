# PokéSurvivor｜繁中單人版

遊玩（正式站，仍是 v0.7）：https://pokesurvivor-solo.adored-rhino-4625.chatgpt.site

**這個倉庫現在是完整原始碼＋全部素材**，clone 下來就能建置與遊玩，不再只是補丁備份。

## 目前版本：0.8.1 開發中（2026-10-17）

- 0.8：三種模式都有 14／16／18／20 分鐘後期狩獵（階段招募券、擊殺必得異色永久收藏），升級卡改為遞減成長曲線。
- 0.8.1：局末戰報、切招連攜、6 隻寶可夢戰鬥習性試玩；裂隙回來 Boss 重新預警、存檔失敗結算提示。
- 詳細：`SOLO-CHANGES.md`、`docs/PLAY-FEEL-0.8.1.md`。數值為試作，尚待真人試玩調整。

## 建置與測試（只需要 Node.js，不用 npm install）

```sh
node tools/build-solo.mjs          # 產生 dist/、根目錄 index.html 與 js/app.min.js
node tools/check-independent.mjs
node tools/check-expedition.mjs
node tools/check-resonance.mjs
node tools/check-hunt.mjs
node tools/check-battle-report.mjs
node tools/check-switch-link.mjs
node tools/check-habits.mjs
python -m http.server 8000 --directory dist
```

## 發布注意

- 正式站由 ChatGPT Sites 託管（`.openai/hosting.json`，靜態目錄 `dist`）。發布請用同一個網址，玩家存檔在瀏覽器的 `ps.save.solo`，換網址會看不到舊進度（需先匯出、再匯入 JSON）。
- `.backup/` 是舊的 v0.7 補丁備份，保留作紀錄。

原作程式 MIT（JPTER78/pokesurvivor）；角色素材 SpriteCollab，CC BY-NC 4.0，署名見 `CREDITS.md` 與 `assets/licenses/`。非商業單人版。
