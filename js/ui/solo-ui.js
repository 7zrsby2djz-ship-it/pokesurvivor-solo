/* Private single-player controls. All progression stays on this device. */
G.SoloUI = (() => {
  function download() {
    try {
      G.DB.commit();
      const blob = new Blob([G.DB.exportSave()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pokesurvivor-save-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      G.UI.toast('備份已匯出，請保留這個 JSON 檔。');
    } catch (e) { G.UI.toast(e.message || '無法匯出備份。'); }
  }

  function chooseBackup() {
    if (G.Game.state !== 'ui') { G.UI.toast('請先結束本局，再匯入備份。'); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error('備份檔超過 2 MB。');
        const text = await file.text();
        const s = G.DB.parseBackup(text);
        const count = Object.keys(s.owned).length;
        if (!confirm(`這份備份有 ${count} 隻寶可夢、${s.coins} 金幣。\n匯入會取代目前進度，是否繼續？`)) return;
        G.DB.importSave(text);
        location.reload();
      } catch (e) {
        G.UI.toast(e instanceof SyntaxError ? '無法讀取這個 JSON 備份檔。' : (e.message || '匯入失敗，原有進度未變更。'));
      }
    };
    input.click();
  }

  function renderBackup(box) {
    const s = G.DB.save;
    const count = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    const saved = G.DB.storageOk;
    box.innerHTML = `<h3 class="set-h">我的冒險進度</h3>
      <p class="sub">${saved ? '進度自動保存在這台裝置的瀏覽器。' : '瀏覽器目前無法儲存，請先匯出備份。'}</p>
      <div class="solo-save-stats"><div><b>${count}</b><span>已收集</span></div><div><b>${s.coins.toLocaleString('zh-TW')}</b><span>金幣</span></div><div><b>${s.stats.runs}</b><span>冒險次數</span></div></div>
      <div class="row wrap" style="gap:10px;margin-top:18px">
        <button class="btn gold" id="solo-export">匯出備份</button>
        <button class="btn" id="solo-import" ${G.Game.state === 'ui' ? '' : 'disabled'}>匯入備份</button>
      </div>
      <p class="note">備份包含收藏、金幣、強化與結算紀錄，不包含進行中的戰鬥。可用同一個備份檔在另一台裝置接續。</p>
      <p class="note">清除網站資料或使用無痕模式可能無法保留進度。離開長期使用的瀏覽器前，先匯出一份備份。</p>`;
    box.querySelector('#solo-export').onclick = download;
    box.querySelector('#solo-import').onclick = chooseBackup;
  }

  addEventListener('pagehide', () => { if (G.DB.loggedIn) G.DB.commit(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.DB.loggedIn) G.DB.commit(); });
  return { download, chooseBackup, renderBackup };
})();
