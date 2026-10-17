# 0.8.1 手感功能：切招連攜、戰鬥習性、局末戰報

2026-10-17 Claude 接手。全部是**試作數值**，需要真人試玩後再調；尚未部署、尚未推 GitHub。

## 檔案

| 檔案 | 內容 |
|---|---|
| `js/systems/battle-report.js` | 局末戰報（Codex 做好，Claude 合併） |
| `js/systems/switch-link.js` | 切招連攜：`G.SwitchLinkCore`（狀態核心）＋ `G.SwitchLink`（接線、HUD 資料） |
| `js/systems/species-habits.js` | 戰鬥習性：`G.SpeciesHabits`，dex→習性表 `BY_DEX`、參數 `HABITS` |
| `js/entities/player.js` | `setActive(i, manual)` 通知連攜；`addMove`／`fuse` 取消連攜；`update` 只把「有輸入的正常走路、撞牆後實際位移」交給習性 |
| `js/systems/combat.js` | `tickMove` 在目標／冷卻檢查通過後才取連攜修改後的**複本**施放；`castCtx` 只在主角同步施放期間存在；`hit` 依 HP＋盾真的減少才記為連攜來源；第一顆投射物才拿 `linkPierce` |
| `js/ui/hud.js` | 連攜：可切的招式格發光＋「切這裡：…」，已備妥時顯示「…待發 X.Xs」；習性：招式列左側小格（充能填色、就緒外框閃爍、冷卻秒數） |
| `js/ui/expedition-ui.js` | 準備畫面一句連攜說明；暫停畫面習性與連攜說明 |
| `js/systems/hunt.js`、`js/entities/enemy.js` | 裂隙回來後狩獵首領 `Hunt.resume` 重新完整預警；`info()` 交戰中顯示首領血量 |
| `js/game.js`、`js/ui/run-ui.js`、`css/solo.css` | 結算存檔失敗警示＋匯出／重存按鈕；戰報附連攜次數 |

## 可調參數（都在各自檔案頂端）

| 參數 | 目前 | 說明 |
|---|---|---|
| 連攜來源窗口／施放窗口／共用冷卻 | 2 s／3 s／8 s | `SwitchLinkCore` 常數 |
| 回身掃擊 | 下一次近戰 arc = 360° | 半徑、傷害、擊退不變 |
| 破陣穿透 | 第一顆投射物 +1 穿透 | 其他彈不變 |
| 蓄電步 | 走 240、冷卻 6 s、電球威力 0.35、count 1、pierce 0 | 電球等級跟觸發招式相同，但不超過電擊招式的等級上限 |
| 縮殼反拍 | 站穩 0.75 s、冷卻 8 s、半徑 70、knock **140**、最多 8 隻 | 規格初版 knock 90；實測 90 只推約 14 px，幾乎看不出，先用遊戲內既有最大值 140 |
| 孢子退路 | 冷卻 8 s、半徑 64、2 秒、緩速 25%、最多 8 隻 | 首領、狩獵首領、裂隙傳說都排除 |

## 驗證

```sh
node tools/build-solo.mjs
node tools/check-switch-link.mjs   # 6 組：真實衝刺／近戰／投射物、窗口、冷卻、誤觸排除、暫停、單目標傷害不變
node tools/check-habits.mjs        # 6 組：三種習性、撞牆／傳送不充電、首領不受影響、裂隙、暫停、存檔不變
node tools/check-battle-report.mjs
node tools/check-hunt.mjs          # 另加裂隙回來重新預警的回歸測試
node tools/check-expedition.mjs && node tools/check-resonance.mjs && node tools/check-independent.mjs
```

瀏覽器（Playwright＋Chromium，桌機 1280×720 與手機橫向 844×390）實際開過：三模式開局、狩獵首領預警、儲存失敗結算畫面、連攜「切這裡→待發→觸發」、三種習性小格與緩速圈、暫停說明。另以機器人高速跑完三模式各 21 分鐘整局（0 個執行錯誤），並在瀏覽器實際打完四場狩獵：12 張階段券、4 隻異色入收藏、最終撤離選單與結算畫面都正常。

## 還沒做到

- 沒有真人手感測試：連攜是否「只覺得多按一個鍵」、習性是否真的讓人想走動／停步／鋪退路，要實際玩才知道。
- 遠征／守護模式開局時，起始近戰招式會被移到大絕格；要觸發連攜需要再學一招近戰或衝刺招式。
- 習性只有 6 隻；其他寶可夢維持原玩法。
- 手機實機觸控沒有測（只用模擬手機尺寸）。
