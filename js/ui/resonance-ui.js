/* Visible progression and a deterministic alternative to waiting for one dupe. */
G.ResonanceUI = (() => {
  let selected = 0;
  const R = () => G.Resonance;
  function badge(dex) {
    const n = R().rank(G.DB.save, dex);
    return n ? ` <span class="resonance-badge" title="共鳴升階 +${n}">+${n}</span>` : '';
  }
  function detail(dex) {
    if (!R().eligible(dex)) return '';
    const s = G.DB.save, n = R().rank(s, dex), o = R().offer(s, dex);
    return `<div class="resonance-detail"><strong>共鳴 +${n} / +${R().MAX}</strong><p>${R().summary(s,dex)}</p><small>普通／異色共用；加成用於你操作這隻寶可夢時。${n < 3 ? '+3 解鎖冷卻縮短 5%。' : n < 5 ? '+5 解鎖移速 +5%。' : '已滿階，再次重複可獲得更多精華。'}</small>${o ? `<button type="button" class="btn small resonance-grow" data-grow="${dex}" ${o.affordable ? '' : 'disabled'}>培養至 +${o.next} · ${o.cost} 精華</button>` : ''}<small>持有共鳴精華：${s.resonance?.essence || 0}</small></div>`;
  }
  function bindDetail(box, refresh) {
    const button = box.querySelector('[data-grow]');
    if (button) button.onclick = () => {
      const result = R().exchange(G.DB.save, Number(button.dataset.grow));
      if (!result) return;
      G.DB.commit(true); G.Audio.sfx('legend'); refresh();
    };
  }
  function workshop() {
    const s = G.DB.save;
    const pool = G.DEX.filter(p => R().offer(s, p.dex));
    if (!pool.some(p => p.dex === selected)) selected = pool.find(p => p.dex === s.partner)?.dex || pool[0]?.dex || 0;
    return `<details class="resonance-workshop"><summary>共鳴工坊 · 精華 ${s.resonance?.essence || 0}</summary><p>重複史詩、傳說都能累積精華。你可以指定培養，也可以存起來招募尚未擁有的夥伴。</p><label for="resonance-target">選擇目標（所有世代）</label><select id="resonance-target">${pool.map(p => {
      const o = R().offer(s,p.dex);
      return `<option value="${p.dex}" ${selected === p.dex ? 'selected' : ''}>${p.rarity === 5 ? '傳說' : '史詩'} · ${p.name} · ${o.kind === 'grow' ? '培養 +' + o.next : '首次招募'} · ${o.cost} 精華</option>`;
    }).join('')}</select><p id="resonance-preview" aria-live="polite"></p><button type="button" class="btn gold" id="resonance-exchange">指定培養／招募</button><small>培養：史詩 12／傳說 36；首次招募：史詩 40／傳說 120。招募得到普通版本，從 +0 開始。兌換不消耗招募券、不影響保底。</small></details>`;
  }
  function bindWorkshop(refresh) {
    const select = document.getElementById('resonance-target'), button = document.getElementById('resonance-exchange');
    if (!select || !button) return;
    const update = () => {
      selected = Number(select.value);
      const s = G.DB.save, o = R().offer(s,selected);
      document.getElementById('resonance-preview').textContent = !o ? '所有史詩與傳說都已滿階！精華會繼續保留。' : `${G.DEX_BY[selected].name} · ${o.kind === 'grow' ? '共鳴 +' + R().rank(s,selected) + ' → +' + o.next : '加入收藏（普通版本）'}${o.affordable ? '' : ` · 還差 ${o.cost - (s.resonance?.essence || 0)} 精華`}`;
      button.disabled = !o?.affordable;
      button.textContent = o ? `${o.kind === 'grow' ? '培養至 +' + o.next : '招募 ' + G.DEX_BY[selected].name} · ${o.cost} 精華` : '已全部滿階';
    };
    select.onchange = update; update();
    button.onclick = () => {
      // Re-read cost/rank at click time, then commit before refreshing the UI.
      const result = R().exchange(G.DB.save,selected);
      if (!result) { update(); return; }
      G.Progress.checkAch(); G.DB.commit(true); G.Audio.sfx('legend');
      G.UI.toast(`${G.DEX_BY[selected].name}${result.kind === 'grow' ? ' 共鳴 +' + result.next : ' 已加入收藏'}`);
      refresh(); document.querySelector('.resonance-workshop').open = true;
    };
  }
  function reward(r) {
    if (!r.resonance) return '';
    const a = r.resonance;
    const milestone = a.after !== a.before && a.after === 3 ? '冷卻 −5% 解鎖' : a.after !== a.before && a.after === 5 ? '移速 +5% 解鎖' : '';
    return `<div class="resonance-reward"><strong>${a.capped ? '共鳴 +5 · 滿階回饋' : `共鳴 +${a.before} → +${a.after}`}</strong>${a.capped ? '' : '<span>攻擊 +4% · 生命 +3%</span>'}${milestone ? `<span>${milestone}</span>` : ''}<span>共鳴精華 +${a.essence}</span></div>`;
  }
  return { badge, detail, bindDetail, workshop, bindWorkshop, reward };
})();
