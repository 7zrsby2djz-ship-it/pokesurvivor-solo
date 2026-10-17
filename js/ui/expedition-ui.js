/* Traditional Chinese expedition preparation, rewards and in-game information. */
G.ExpeditionUI = (() => {
  const $ = id => document.getElementById(id);
  let options = { mode: 'expedition', style: 'vanguard', difficulty: 'normal', focus: '', ultimate: '' };
  let kind = '', choose = null, offered = [];
  try {
    const stored = JSON.parse(localStorage.getItem('ps.expedition.options') || '{}');
    if (['guardian', 'expedition', 'classic'].includes(stored.mode)) options.mode = stored.mode;
    if (G.Expedition.STYLES.some(s => s.id === stored.style)) options.style = stored.style;
    if (G.Expedition.DIFFICULTIES.some(d => d.id === stored.difficulty)) options.difficulty = stored.difficulty;
    if (G.Expedition.RELICS.some(r => r.id === stored.focus)) options.focus = stored.focus;
    if (G.Moves.BY_ID[stored.ultimate]?.kind === 'melee') options.ultimate = stored.ultimate;
  } catch (_) { /* The game remains playable with storage disabled. */ }

  function optionButton(group, id, title, desc, icon, color) {
    const selected = options[group] === id;
    return `<button type="button" class="exp-option ${selected ? 'selected' : ''}" data-exp-group="${group}" data-exp-id="${id}" aria-pressed="${selected}" style="--exp-color:${color || '#ffd23f'}">
      ${icon ? `<span class="exp-ico">${G.Icons.html(icon, 25)}</span>` : ''}<strong>${title}</strong><small>${desc}</small></button>`;
  }

  function open() {
    kind = 'prepare'; choose = null;
    G.UI.chrome(false);
    const s = G.DB.save, box = $('exp-content');
    const mastery = G.Expedition.mastery(s, s.partner);
    const ultimatePool = G.Ultimate.pool(G.DEX_BY[s.partner]);
    if (!ultimatePool.includes(options.ultimate)) options.ultimate = G.Ultimate.defaultMove(G.DEX_BY[s.partner]);
    const known = G.Expedition.RELICS.filter(r => s.stats['relic_' + r.id]);
    if (!known.some(r => r.id === options.focus)) options.focus = '';
    box.innerHTML = `<div class="exp-heading"><div><p class="exp-eyebrow">SOLO EXPEDITION / 單人遠征</p><h2>下一段冒險，由你出發</h2><p class="sub">選擇作戰風格，讓這一局走出不同的路。</p></div><div id="exp-partner"></div></div>
      <div class="exp-record"><span>遠征通關 <b>${s.stats.expeditionWins || 0}</b></span><span>最佳評分 <b>${s.stats.expeditionBest || 0}</b></span><span>遺物圖鑑 <b>${known.length}/12</b></span></div>
      <div class="exp-mastery"><div><strong>${G.DEX_BY[s.partner].name}${G.ResonanceUI.badge(s.partner)} · ${mastery.name} ${'★'.repeat(mastery.rank)}</strong><small>${mastery.next ? `熟練度 ${mastery.xp} / ${mastery.next} · 升階獎勵 120 金幣` : '已達最高熟練階級'} · 本局遺物重選 ${1 + Math.min(2, mastery.rank)} 次</small></div><progress aria-label="夥伴熟練度" max="${mastery.next ? mastery.next - mastery.base : 1}" value="${mastery.next ? mastery.xp - mastery.base : 1}"></progress></div>
      <h3 class="exp-label">01 / 冒險方式</h3><div class="exp-options exp-modes">
      ${optionButton('mode', 'guardian', '守護夥伴', '從弱小幼體到並肩作戰。救出夥伴、陪牠進化，再一起擊敗追獵者。', 'heart', '#afe4bd')}
      ${optionButton('mode', 'expedition', '十二分鐘遠征', '遺物、途中委託、閃避與清場大絕。擊敗 12:00 出現的最終首領，即可領獎撤離或繼續生存。')}
      ${optionButton('mode', 'classic', '經典無盡', '純粹生存與遞減成長曲線，不啟用遠征遺物、委託、閃避或大絕。')}</div>
      ${options.mode === 'guardian' ? G.GuardianUI.prepare() : ''}
      <div class="${options.mode === 'classic' ? 'exp-muted' : ''}" id="exp-rules">
      <h3 class="exp-label">02 / 作戰風格</h3><div class="exp-options">${G.Expedition.STYLES.map(s => optionButton('style', s.id, s.name, s.desc, s.icon, s.color)).join('')}</div>
      <h3 class="exp-label">03 / 挑戰強度</h3><div class="exp-options">${G.Expedition.DIFFICULTIES.map(d => optionButton('difficulty', d.id, d.name, d.desc)).join('')}</div>
      <h3 class="exp-label">04 / 近戰覺醒大絕</h3>
      <div class="exp-ultimate-select"><label for="exp-ultimate">${G.Icons.html('fist', 28)} 獨立第五格</label><select id="exp-ultimate" ${options.mode === 'classic' ? 'disabled' : ''}>${ultimatePool.map(id => `<option value="${id}" ${options.ultimate === id ? 'selected' : ''}>${G.Moves.BY_ID[id].name} · ${G.Ultimate.form(G.Moves.BY_ID[id]).name}</option>`).join('')}</select><p id="exp-ultimate-preview">${ultimatePreview()}</p><small>近戰招式移至大絕格，保留四格一般招式。原本只會近戰的夥伴會補上一招自動攻擊。</small></div>
      <div class="exp-focus"><label for="exp-focus">研究方向 <small>已發現的遺物可指定出現在第一次補給</small></label><select id="exp-focus" ${options.mode === 'classic' ? 'disabled' : ''}><option value="">隨機探索</option>${known.map(r => `<option value="${r.id}" ${options.focus === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}</select></div></div>
      <div class="exp-route">${options.mode === 'guardian' ? '<span>01:00 守護寶箱</span><i>→</i><span>守護成長</span><i>→</i><span>進化助戰</span><i>→</i><span>迎戰追獵者</span><i>→</i><span>結伴回營</span>' : '<span>01:30 遺物</span><i>→</i><span>04:00 遺物</span><i>→</i><span>07:00 遺物</span><i>→</i><span>10:00 遺物</span><i>→</i><span>12:00 決戰</span>'}</div>
      <p class="note exp-controls">全模式後期狩獵：14／16／18／20 分鐘起依序迎戰，分別保證隨機全稀有度／三星以上／四星／五星異色。首領具有高爆發遞減護甲；生命降至 75／50／25% 各得 1 張招募券，擊殺必得異色收藏；場上首領未倒下時，下一場等待。</p><p class="note exp-controls">切招連攜（全模式）：衝刺招式打中敵人後 2 秒內切到近戰組，下一擊變成 360° 回身掃擊；近戰打中後切到射擊組，第一發多穿透 1 隻。招式格發光並寫「切這裡」時就是時機，兩種共用 8 秒冷卻。</p><p class="note exp-controls">Lv.6 選擇閃避路線，Lv.14 再次覺醒。懸賞完成即送招募券，暫停時可查看進度。</p><p class="note exp-controls">移動：WASD／方向鍵或觸控搖桿 · 遠征閃避：空白鍵／Shift · 大絕：F 或閃避上方按鈕。${options.mode === 'guardian' ? '守護召回：G 或左上召回按鈕。' : ''}遺物只在本局有效；收藏、強化與金幣照常保留。</p>
      <div class="exp-actions"><button class="btn" id="exp-back">返回營地</button><button class="btn" id="exp-codex">遺物與共鳴圖鑑</button><button class="btn gold" id="exp-start">${options.mode === 'classic' ? '開始經典生存' : options.mode === 'guardian' ? '開始守護遠征' : '開始遠征'}</button></div>`;
    box.querySelector('#exp-partner').appendChild(G.UI.spriteCanvas(s.partner, 88, 70, { shiny: !!s.partnerShiny, lively: true, scale: 2 }));
    G.GuardianUI.hydrate(box);
    box.querySelectorAll('[data-exp-group]').forEach(el => {
      el.disabled = options.mode === 'classic' && el.dataset.expGroup !== 'mode';
      el.onclick = () => { options[el.dataset.expGroup] = el.dataset.expId; open(); };
    });
    $('exp-back').onclick = () => G.Flow.goMenu();
    $('exp-codex').onclick = codex;
    $('exp-focus').onchange = e => { options.focus = e.target.value; };
    $('exp-ultimate').onchange = e => { options.ultimate = e.target.value; $('exp-ultimate-preview').textContent = ultimatePreview(); };
    $('exp-start').onclick = () => {
      try { localStorage.setItem('ps.expedition.options', JSON.stringify(options)); } catch (_) {}
      kind = ''; G.Game.startRun(null, options);
    };
    G.UI.show('scr-expedition');
    $('exp-start').focus({ preventScroll: true });
  }

  function ultimatePreview() {
    const f = G.Ultimate.form(G.Moves.BY_ID[options.ultimate]);
    return `${f.desc} 基礎冷卻 ${f.cd} 秒。閃避後 4 秒內施放，範圍 +20%。單次清除至少 8 隻，回復 12% 生命、重置閃避並吸取掉落物。`;
  }

  function showChoice(type, list, cb) {
    kind = type; choose = cb; offered = list;
    const r = G.Expedition.run;
    const box = $('exp-content');
    if (type === 'hunt-clear') {
      box.innerHTML = `<p class="exp-eyebrow">BOSS HUNT COMPLETE / 狩獵完成</p><h2>四場狩獵，戰利品已入帳。</h2><p class="sub">${G.Hunt.info()}</p><p>${G.Hunt.run?.retrySave ? '戰利品等待儲存，請保持分頁開啟並確認瀏覽器可儲存資料。' : '招募券與擊殺異色已永久保存。'}接下來可結算返回，或繼續無盡生存。本局四場狩獵不會重複刷新。</p><div class="exp-actions"><button class="btn gold" data-choice="0">1 · 帶著戰利品撤離</button><button class="btn" data-choice="1">2 · 繼續無盡挑戰</button></div>`;
    } else if (type === 'dash') {
      box.innerHTML = `<p class="exp-eyebrow">閃避進化 · Lv.6</p><h2>選一種步法，打出自己的節奏</h2><p class="sub">本局選擇 1 條路線，Lv.14 自動進入第二階。戰鬥已暫停。</p><div class="exp-relic-grid exp-dash-grid">${list.map((item, i) => `<button class="exp-relic" data-choice="${i}" style="--exp-color:${item.color}"><span class="exp-relic-top"><span class="exp-ico">${G.Icons.html(item.icon, 28)}</span><kbd>${i + 1}</kbd></span><small>${item.tag}</small><h3>${item.name}</h3><p>${item.desc}</p><p class="exp-dash-upgrade">${item.upgrade}</p><span class="exp-take">選擇這條路線 →</span></button>`).join('')}</div>`;
    } else if (type === 'guardian' || type === 'guardian-clear') {
      box.innerHTML = G.GuardianUI.choice(type, list);
      G.GuardianUI.hydrate(box);
    } else if (type === 'supply' || type === 'trial') {
      const supply = type === 'supply';
      box.innerHTML = `<p class="exp-eyebrow">${supply ? `FIELD SUPPLY / ${r.lastSupply === 'trial' ? '挑戰額外' : '第 ' + r.supply + ' 次'}遠征補給` : 'FORK IN THE ROAD / 遠征岔路'}</p><h2>${supply ? '一件遺物，一種新可能' : '這次，要冒多少風險？'}</h2>
        <p class="sub">${supply ? '選擇後回復 12% 生命。' : '挑戰成功多拿一件遺物；整備則幫你穩住下一場戰鬥。'}戰鬥已暫停。</p><div class="exp-relic-grid">${list.map((item, i) => `<button class="exp-relic" data-choice="${i}" style="--exp-color:${item.color}">
          <span class="exp-relic-top"><span class="exp-ico">${G.Icons.html(item.icon, 32)}</span><kbd>${i + 1}</kbd></span><small>${item.tag}</small><h3>${item.name}</h3><p>${item.desc}</p>${supply ? synergyHint(item.id) : ''}<span class="exp-take">${supply ? '收下遺物' : item.id === 'camp' ? '整備出發' : '接受挑戰'} →</span></button>`).join('')}</div>
        ${supply ? `<button class="btn small" id="exp-reroll" ${r.relicRerolls <= 0 ? 'disabled' : ''}>重選遺物 · 剩餘 ${r.relicRerolls} 次 <kbd>R</kbd></button>` : '<p class="note">委託和挑戰可同時推進。進入裂隙時，挑戰倒數暫停。</p>'}${buildLine()}`;
    } else {
      box.innerHTML = `<p class="exp-eyebrow">EXPEDITION COMPLETE / 遠征完成</p><h2>這次，你走到了最後。</h2><p class="sub">最終首領已擊倒。要帶著收穫返回，還是看看自己能走多遠？</p>
        <div class="exp-victory"><b>+300</b><span>基礎金幣，結算時套用收益倍率</span><b>+2</b><span>招募券，已加入本局收穫</span></div>${buildLine()}
        <div class="exp-actions"><button class="btn gold" data-choice="0">1 · 帶著戰利品撤離</button><button class="btn" data-choice="1">2 · 繼續無盡挑戰</button></div><p class="note">繼續挑戰後仍可從暫停選單結算；本局只發放一次通關獎勵。</p>`;
    }
    box.querySelectorAll('[data-choice]').forEach(el => { el.onclick = () => pick(Number(el.dataset.choice)); });
    if (supplyButton()) supplyButton().onclick = reroll;
    G.UI.show('scr-expedition');
    box.querySelector('[data-choice]')?.focus({ preventScroll: true });
  }

  function buildLine() {
    const r = G.Expedition.run;
    if (!r) return '';
    const names = r.relics.map(id => G.Expedition.RELICS.find(x => x.id === id).name);
    return `<div class="exp-build"><b>${r.style.name} · ${r.difficulty.name}</b><span>${names.join(' · ') || '尚未取得遺物'}</span>${r.synergies.length ? `<strong class="exp-resonance">共鳴：${r.synergies.map(id => G.Expedition.SYNERGIES.find(s => s.id === id).name).join(' · ')}</strong>` : ''}</div>`;
  }

  function synergyHint(id) {
    const s = G.Expedition.SYNERGIES.find(s => s.pair.includes(id));
    if (!s) return '';
    const other = s.pair.find(x => x !== id), ready = G.Expedition.run.relics.includes(other);
    return `<span class="exp-pair ${ready ? 'ready' : ''}">${ready ? '選下即覺醒：' + s.name : '搭配 ' + G.Expedition.RELICS.find(r => r.id === other).name + ' 可共鳴'}</span>`;
  }

  const supplyButton = () => $('exp-reroll');
  function reroll() {
    if (kind !== 'supply' || !choose) return;
    const list = G.Expedition.reroll();
    if (list) showChoice('supply', list, choose);
  }

  function codex() {
    kind = 'codex'; choose = null;
    const stats = G.DB.save.stats;
    $('exp-content').innerHTML = `<p class="exp-eyebrow">EXPEDITION JOURNAL / 遠征研究手冊</p><h2>下一套流派，從這裡開始</h2><p class="sub">完成一局即可記錄發現。已發現遺物能在出發前指定為研究方向。</p>
      <button class="btn small" id="exp-codex-back">返回遠征準備</button><h3>六種套裝共鳴</h3><div class="exp-codex-grid">${G.Expedition.SYNERGIES.map(s => `<article class="exp-codex-entry ${stats['synergy_' + s.id] ? 'discovered' : ''}" style="--exp-color:${s.color}"><small>${stats['synergy_' + s.id] ? '已覺醒' : '等待發現'}</small><h3>${s.name}</h3><b>${s.pair.map(id => G.Expedition.RELICS.find(r => r.id === id).name).join(' ＋ ')}</b><p>${s.desc}</p></article>`).join('')}</div>
      <h3>十二件遺物</h3><div class="exp-codex-grid">${G.Expedition.RELICS.map(r => `<article class="exp-codex-entry ${stats['relic_' + r.id] ? 'discovered' : ''}" style="--exp-color:${r.color}"><small>${stats['relic_' + r.id] ? '已發現 · ' + stats['relic_' + r.id] + ' 局使用' : '尚未取得'}</small><h3>${G.Icons.html(r.icon, 18)} ${r.name}</h3><p>${r.desc}</p></article>`).join('')}</div>
      <h3>菁英觀察筆記</h3><div class="exp-codex-grid">${G.ExpeditionTrials.AFFIXES.map(a => `<article class="exp-codex-entry" style="--exp-color:${a.color}"><h3>${a.name}菁英</h3><p>${a.desc}。擊倒獲得額外金幣與經驗，每擊倒 5 名菁英另得一張招募券。</p></article>`).join('')}</div>
      <div class="exp-actions"><button class="btn gold" id="exp-codex-bottom">返回遠征準備</button></div>`;
    $('exp-codex-back').onclick = open;
    $('exp-codex-bottom').onclick = open;
    $('exp-content').scrollTop = 0;
    $('exp-codex-back').focus({ preventScroll: true });
  }

  function pick(index) {
    if (!choose || (!['clear', 'hunt-clear'].includes(kind) && !offered[index]) || (['clear', 'hunt-clear'].includes(kind) && index > 1)) return;
    const cb = choose;
    const id = ['clear', 'hunt-clear'].includes(kind) ? index === 0 ? 'extract' : 'continue' : offered[index].id;
    choose = null; kind = '';
    G.UI.hide('scr-expedition');
    cb(id);
  }

  function keys() {
    if (!G.UI.isOpen('scr-expedition')) return false;
    if (kind === 'codex') {
      if (G.Input.tap('escape')) open();
    } else if (kind === 'prepare') {
      if (G.Input.tap('escape')) G.Flow.goMenu();
    } else {
      for (let i = 0; i < (['clear', 'hunt-clear'].includes(kind) ? 2 : offered.length); i++) if (G.Input.tap('digit' + (i + 1)) || G.Input.tap('numpad' + (i + 1))) pick(i);
      if (G.Input.tap('keyr')) reroll();
    }
    return true;
  }

  function pauseInfo() {
    const el = $('exp-pause');
    const r = G.Expedition.run;
    el.classList.toggle('hidden', !r && !G.Hunt.active);
    if (!r) { el.innerHTML = `<p class="note">${G.Hunt.info()}</p><p>紅色核心與預警攻擊可穿透自動衝刺保護。離開紅區，等綠色破綻再切入。抗爆發護甲：每秒超過首領最大生命 2% 的傷害逐步遞減。</p>${playInfo()}`; return; }
    el.innerHTML = `${playInfo()}<p class="note">${G.Hunt.info()}</p><p class="note">紅色核心穿透自動衝刺保護；手動閃避與保命效果仍有效。抗爆發護甲：每秒超過首領最大生命 2% 的傷害逐步遞減。</p><p class="note">F 大絕 · 空白鍵／Shift 閃避 · ${G.Guardian.active ? 'G 召回 · 守護完全體並擊敗追獵者，即可結伴回營。' : r.cleared ? '已通關，可隨時結算。' : '擊敗 12:00 出現的首領即可通關。'}</p>${buildLine()}${G.GuardianUI.pauseInfo()}${dashInfo()}${ultimatePause()}${bountyInfo()}
      <details><summary>查看本局遺物效果</summary>${r.relics.map(id => {
        const relic = G.Expedition.RELICS.find(x => x.id === id);
        return `<p><b>${relic.name}</b>：${relic.desc}${id === 'phoenix' && r.phoenixUsed ? '（本局已使用）' : ''}</p>`;
      }).join('') || '<p>在定時補給中選擇遺物。</p>'}${r.synergies.map(id => { const s = G.Expedition.SYNERGIES.find(x => x.id === id); return `<p class="exp-resonance"><b>${s.name}</b>：${s.desc}</p>`; }).join('')}</details><p class="note">近戰命中累積士氣；集滿時自動爆發，回復 8% 生命、短暫無敵並擊退敵人。</p>`;
    el.querySelectorAll('[data-ultimate-swap]').forEach(button => {
      button.onclick = () => {
        if (G.Ultimate.swap(G.Game.player, button.dataset.ultimateSwap)) { G.Audio.sfx('select'); pauseInfo(); }
      };
    });
  }

  // Species habit + switch-link reminder (all modes).
  function playInfo() {
    const p = G.Game.player, h = G.SpeciesHabits?.state, l = G.SwitchLink?.stats;
    const habit = h && h.player === p ? `<div class="exp-dash-info"><strong>戰鬥習性 · ${h.def.name}</strong><p>${h.def.desc}</p><small>本局觸發 ${h.uses} 次 · 試作數值，之後會依手感調整</small></div>` : '';
    return `${habit}<p class="note">切招連攜：衝刺命中後 2 秒內切到近戰組 → 下一擊 360° 回身掃擊；近戰命中後切到射擊組 → 第一發多穿透 1 隻。共用 8 秒冷卻${l ? ` · 本局 ${l.used} 次` : ''}。</p>`;
  }

  function dashInfo() {
    const d = G.DashEvolution.state(), f = G.DashEvolution.form();
    if (!d) return '';
    return `<div class="exp-dash-info"><strong>閃避 · ${G.DashEvolution.name()}${d.rank ? ' · 第 ' + d.rank + ' 階' : ''}</strong><p>${f ? (d.rank === 2 ? f.upgrade : f.desc) : 'Lv.6 選擇進化方向，Lv.14 再次覺醒。'}</p><small>成功施放 ${d.uses} 次 · 基礎冷卻 ${G.Expedition.dashCooldown().toFixed(1)} 秒${d.id === 'gale' ? ` · 儲存 ${d.charges}/${G.DashEvolution.capacity()} 次 · 下次充能 ${d.recharge.toFixed(1)} 秒` : ''}</small></div>`;
  }

  function bountyInfo(preview = false) {
    const tasks = preview ? G.Bounties.TASKS : G.Bounties.list();
    const s = G.Bounties.snapshot();
    return `<details class="exp-bounties" ${preview ? '' : 'open'}><summary>${preview ? '每局懸賞與招募券來源' : `本局懸賞 ${s.completed}/${s.total} · 已入帳 ${s.tickets} 張招募券`}</summary><p class="note">遠征／守護模式每局重新挑戰，完成即自動入帳，即使倒下也保留。一般遠征懸賞共 13 張，守護模式共 16 張；途中委託每件另給 1 張、岔路挑戰成功另給 2 張。</p><div class="bounty-list">${tasks.map(t => `<div class="bounty-row ${!preview && t.claimed ? 'claimed' : ''}"><span><b>${t.name}</b><small>${t.desc}${preview ? (t.guardian ? ' · 守護模式' : '') : ` · ${t.time ? G.U.mmss(t.progress) : t.progress}/${t.time ? G.U.mmss(t.goal) : t.goal}`}</small></span><strong>${!preview && t.claimed ? '已入帳' : '+' + t.tickets + ' 張'}</strong></div>`).join('')}</div></details>`;
  }

  function ultimatePause() {
    const p = G.Game.player, u = G.Ultimate.state();
    if (!u) return '';
    const f = G.Ultimate.form(u.move);
    const candidates = p.moves.filter(m => m.kind === 'melee' && m !== u.move);
    return `<div class="exp-ultimate-pause"><strong>${G.Icons.html('move:' + u.move.id, 22)} 大絕 · ${u.move.name} Lv.${u.move.lvl}</strong><p>${f.name} · ${f.desc} 冷卻 ${G.Ultimate.cooldown(p).toFixed(1)} 秒${u.cd > 0 ? `（剩餘 ${u.cd.toFixed(1)} 秒）` : ' · 已就緒'}。</p><p>閃避後 4 秒內範圍 +20%；單次清除 8 隻以上，回復 12% 生命、重置閃避並吸取掉落物。</p>${candidates.length ? `<small>把已學會的近戰招式與大絕格對調，保留等級與進化。對調後重新蓄力。</small><div class="exp-ultimate-swaps">${candidates.map(m => `<button class="btn small" data-ultimate-swap="${m.id}" ${u.cast ? 'disabled' : ''}>${m.name} Lv.${m.lvl} → 大絕</button>`).join('')}</div>` : '<small>之後學會其他近戰招式，可在這裡移至大絕格。</small>'}</div>`;
  }

  function summary(result) {
    if (!result) return;
    if (result.cleared) $('over-title').textContent = '遠征完成！';
    $('over-stats').insertAdjacentHTML('beforeend', `<div class="exp-summary"><span>${result.style} · ${result.difficulty}</span><b>遠征評分 ${result.score.toLocaleString('zh-TW')}</b><p>委託 ${result.contracts}/3 · 挑戰 ${result.trials}/3 · 菁英 ${result.eliteKills} · 最長連殺 ${result.combo} · 近戰爆發 ${result.breakouts}</p>${result.ultimate ? `<p class="exp-ultimate-result">大絕 ${result.ultimate.name} · 施放 ${result.ultimate.casts} 次 · 清除 ${result.ultimate.kills} 隻 · 單次最佳 ${result.ultimate.best} 隻</p>` : ''}<p>${result.dodge ? `閃避 · ${result.dodge.name} · 使用 ${result.dodge.uses} 次` : ''}${result.bounties ? ` · 懸賞 ${result.bounties.completed}/${result.bounties.total} · 招募券 +${result.bounties.tickets}（已入帳）` : ''}</p><small>${result.relics.join(' · ') || '未取得遺物'}</small>${result.synergies.length ? `<p class="exp-resonance">${result.synergies.join(' · ')}</p>` : ''}<div class="exp-mastery"><div><strong>${result.mastery.name} · 熟練度 +${result.masteryXp}</strong><small>${result.mastery.next ? `下一階 ${result.mastery.xp} / ${result.mastery.next}` : '熟練度已達大師'}${result.masteryBonus ? ` · 升階獎勵 +${result.masteryBonus} 金幣（已含於總收益）` : ''}</small></div></div></div>`);
    G.GuardianUI.summary(result.guardian);
  }

  function draw(ctx, w, h, p) {
    const r = G.Expedition.run;
    if (!r || G.Game.state === 'over') return;
    ctx.save();
    const small = h < 500;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `600 ${small ? 11 : 12}px Arial,"PingFang TC","Microsoft JhengHei",sans-serif`;
    const x = 16, y = 86, bw = small ? 212 : 240;
    ctx.fillStyle = 'rgba(8,16,28,.78)'; ctx.fillRect(x - 6, y - 15, bw, 93);
    if (G.Guardian.active) G.GuardianUI.drawStatus(ctx, x, y, bw, p);
    else {
    ctx.fillStyle = r.style.color;
    ctx.fillText(`${r.style.name} · ${r.difficulty.name} · 遺物 ${r.relics.length}`, x, y);
    ctx.fillStyle = '#f1e2ae';
    const next = G.Expedition.SUPPLIES[r.supply];
    const goal = r.cleared ? '遠征完成 · 無盡挑戰中' : r.time >= 720 ? '最終目標：擊敗遠征首領' : `下一補給 ${next != null ? G.U.mmss(next) : '已全部取得'} · 決戰 12:00`;
    ctx.fillText(goal, x, y + 16);
    ctx.fillStyle = '#d3ddec';
    const c = r.contract;
    const trial = G.ExpeditionTrials.state.active;
    ctx.fillText(trial ? `${trial.name} ${trial.progress}/${trial.goal} · ${Math.ceil(trial.left)}s` : c ? `${c.name} ${Math.min(c.goal, Math.floor(c.progress))}/${c.goal} · ${Math.ceil(c.left)}s` : `委託 ${r.contracts}/3 · 連殺 ${r.combo}`, x, y + 32);
    ctx.fillStyle = '#95cfff';
    ctx.fillText(`護盾 ${Math.ceil(r.shield)}${r.stanceT > 0 ? ' · 閃避增益生效中' : ' · 空白鍵 / Shift 閃避'}`, x, y + 48);
    ctx.fillStyle = '#e9c59b'; ctx.fillText(`共鳴 ${r.synergies.length} · 近戰士氣 ${Math.floor(r.bravery)}% · 菁英 ${G.ExpeditionTrials.state.elites}`, x, y + 64);

    }
    const bx = w - 86, by = h - (small ? 142 : 164), size = 64;
    const ready = r.dashCd <= 0;
    ctx.fillStyle = ready ? 'rgba(51,89,103,.92)' : 'rgba(10,20,34,.86)';
    ctx.fillRect(bx, by, size, 54);
    ctx.strokeStyle = ready ? '#a8eed6' : '#63758d'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, size, 54);
    ctx.fillStyle = ready ? '#effff7' : '#adbccc'; ctx.textAlign = 'center';
    ctx.font = '700 14px Arial,"Microsoft JhengHei",sans-serif';
    ctx.fillText(ready ? '閃避' : r.dashCd.toFixed(1) + 's', bx + size / 2, by + 23);
    ctx.font = '11px Arial,sans-serif'; ctx.fillText(G.DashEvolution.state()?.id === 'gale' ? '疾風 ' + G.DashEvolution.state().charges + '/' + G.DashEvolution.capacity() : ready ? 'SPACE' : '冷卻中', bx + size / 2, by + 40);
    G.Touch.addButton(bx, by, size, 54, () => G.Expedition.dash(p), 4);
    const u = G.Ultimate.state();
    if (u) {
      const ux = bx - 4, uy = by - 86, uw = size + 8, uh = 76, available = u.cd <= 0 && !u.cast;
      ctx.fillStyle = available ? 'rgba(99,62,26,.96)' : 'rgba(20,25,38,.94)';
      ctx.fillRect(ux, uy, uw, uh);
      ctx.strokeStyle = available ? '#ffe0a0' : '#887c69';
      ctx.lineWidth = available ? 2.5 : 1.5; ctx.strokeRect(ux, uy, uw, uh);
      ctx.fillStyle = '#f6dab0'; ctx.font = '700 12px Arial,"Microsoft JhengHei",sans-serif';
      ctx.fillText(u.move.name, ux + uw / 2, uy + 16, uw - 8);
      ctx.fillStyle = available ? '#fff1cc' : '#cbbfae';
      ctx.font = '700 19px Arial,"Microsoft JhengHei",sans-serif';
      ctx.fillText(available ? '大絕' : u.cd > 0 ? Math.ceil(u.cd) + 's' : '施放中', ux + uw / 2, uy + 39);
      ctx.font = '11px Arial,"Microsoft JhengHei",sans-serif';
      ctx.fillText(available ? (r.stanceT > 0 ? 'F · 連攜增幅' : 'F · 就緒') : 'F · 清場技', ux + uw / 2, uy + 58);
      ctx.fillStyle = '#332f2a'; ctx.fillRect(ux + 5, uy + uh - 8, uw - 10, 3);
      ctx.fillStyle = '#ffd78b'; ctx.fillRect(ux + 5, uy + uh - 8, (uw - 10) * (u.totalCd ? 1 - u.cd / u.totalCd : 1), 3);
      G.Touch.addButton(ux, uy, uw, uh, () => G.Ultimate.fire(p), 4);
    }
    ctx.restore();
  }

  return { open, showChoice, keys, pauseInfo, summary, draw, bountyInfo,
    replay() { if (G.Game.state === 'over' && !G.Coop.active) G.Game.startRun(null, options); } };
})();
