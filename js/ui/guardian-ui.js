/* Companion choices, growth goals and rescue controls use existing local sprites. */
G.GuardianUI = (() => {
  const $ = id => document.getElementById(id);
  const clock = seconds => G.U.mmss(Math.max(0, Math.ceil(seconds)));
  const sprite = dex => `<span class="guardian-sprite" data-guardian-dex="${dex}" aria-label="${G.DEX_BY[dex].name}"></span>`;
  const stages = line => `<span class="guardian-stages">${line.stages.map((dex, i) => `${i ? '<i>→</i>' : ''}${sprite(dex)}`).join('')}</span>`;

  function hydrate(box) {
    box.querySelectorAll('[data-guardian-dex]').forEach(el => el.appendChild(G.UI.spriteCanvas(Number(el.dataset.guardianDex), 58, 54, { lively: true, scale: 1.5 })));
  }
  function prepare() {
    return `<div class="guardian-intro"><strong>${G.Icons.html('heart', 20)} 這次，有一位夥伴等你帶回家。</strong><p>01:00 出現守護寶箱。救出幼體，待在牠身邊累積成長；完全進化後，牠會開始保護你。迎戰追獵者，讓整條進化系加入收藏。</p><div class="guardian-lines">${G.Guardian.LINES.map(l => `<div style="--exp-color:${l.color}">${stages(l)}<b>${l.name}</b><small>${l.tag}</small><small>守護 ${clock(l.times.at(-1))} 成為完全體${G.DB.save.stats['guardianBond_' + l.id] ? ' · 已締結羈絆' : ''}</small></div>`).join('')}</div><p class="note">倒下不會永久失去夥伴；靠近守住 3 秒即可救起。按 G／召回按鈕可帶牠回到身邊，冷卻 14 秒。遠離、倒下或進入裂隙時，成長暫停。</p></div>`;
  }
  function choice(type, list) {
    if (type === 'guardian') return `<p class="exp-eyebrow">A PROMISE TO PROTECT / 守護的約定</p><h2>牠還很弱小，但牠相信你。</h2><p class="sub">選一位同行夥伴。幼體不攻擊；守住這段成長時間，見證牠的蛻變。戰鬥已暫停。</p><div class="exp-relic-grid guardian-choices">${list.map((l, i) => `<button class="exp-relic" data-choice="${i}" style="--exp-color:${l.color}"><span class="exp-relic-top">${stages(l)}<kbd>${i + 1}</kbd></span><small>${l.tag}</small><h3>${l.name}</h3><p>${l.desc}</p><span class="guardian-growth">${l.times.map((t, n) => `${clock(t)} ${G.DEX_BY[l.stages[n + 1]].name}`).join(' · ')}</span><span class="exp-take">我會保護你 →</span></button>`).join('')}</div><p class="note">牠在你 220 範圍內才會成長。靠近可減少牠受到的傷害；G 召回也能回復 18% 夥伴生命。全隊永久強化同樣適用。</p>`;
    const s = G.Guardian.state;
    return `<p class="exp-eyebrow">HOME, TOGETHER / 一起回家</p><h2>這次，換牠陪你走下去。</h2><p class="sub">${s.line.bossName} 已擊倒。你們守住了這份約定。</p><div class="guardian-home" style="--exp-color:${s.line.color}">${stages(s.line)}<strong>${s.line.stages.map(d => G.DEX_BY[d].name).join('、')} 已加入收藏</strong><small>之後可以在營地選擇出戰。${s.line.name} · 第 ${G.DB.save.stats['guardianBond_' + s.line.id]} 次完成</small></div><div class="exp-victory"><b>+250</b><span>基礎金幣，結算時套用收益倍率</span><b>+3</b><span>招募券，已加入本局收穫</span></div><div class="exp-actions"><button class="btn gold" data-choice="0">1 · 結伴回營</button><button class="btn" data-choice="1">2 · 一起繼續遠征</button></div><p class="note">繼續後夥伴仍會助戰，可挑戰 12:00 首領。本局守護獎勵只領一次。</p>`;
  }
  function goal(s) {
    if (G.Rift.inArena) return '裂隙探索中 · 夥伴在外等待';
    if (s.bossDefeated) return s.pet.dead ? '追獵者已倒下 · 先救起夥伴' : '守護完成 · 一起繼續遠征';
    if (s.boss) return s.bossPhase === 2 ? '追獵者狂怒 · 避開地面預警' : '目標：與夥伴擊敗追獵者';
    if (s.warning !== null) return `追獵者將至 · ${Math.ceil(s.warning)} 秒`;
    if (G.Guardian.mature()) return s.grace > 0 ? `並肩作戰 · 追獵者 ${Math.ceil(s.grace)} 秒後鎖定` : '先擊倒現有首領，再迎戰追獵者';
    return '守住幼體 → 完全進化 → 迎戰追獵者';
  }
  function pauseInfo() {
    const s = G.Guardian.state;
    if (!s) return '';
    return `<div class="guardian-intro"><strong>守護夥伴${s.pet ? ' · ' + s.pet.mon.name : ''}</strong><p>${s.pet ? `${goal(s)}。${s.pet.dead ? '靠近守住 3 秒救援。' : `生命 ${Math.ceil(s.pet.hp)}/${s.pet.maxHp}。`}${!G.Guardian.mature() ? `距離下一次進化還需守護 ${clock(s.line.times[s.stage] - s.growth)}。` : ''}` : s.opened ? '選擇一位夥伴開始守護。' : '01:00 出現守護寶箱；走近停留 3 秒即可開啟。'}</p><small>G 召回：冷卻 14 秒，帶回夥伴並回復 18% 生命。倒下的夥伴也能召回救援。裂隙期間守護計時暫停。</small></div>`;
  }
  function drawStatus(ctx, x, y, width, p) {
    const s = G.Guardian.state, r = G.Expedition.run, pet = s.pet;
    ctx.fillStyle = s.line?.color || '#b9edcc';
    ctx.fillText(`守護夥伴 · ${pet ? pet.mon.name : '等待相遇'}`, x, y, width - 12);
    ctx.fillStyle = '#e8e1c8';
    if (pet) {
      const dead = pet.dead;
      ctx.fillText(dead ? `救援 ${s.revive.toFixed(1)} / 3 秒` : `生命 ${Math.ceil(pet.hp)} / ${pet.maxHp}${s.shield > 0 ? ' · 盾 ' + Math.ceil(s.shield) : ''}`, x, y + 16, width - 90);
      ctx.fillStyle = '#384550'; ctx.fillRect(x, y + 21, width - 90, 4);
      ctx.fillStyle = dead ? '#ffd596' : s.line.color; ctx.fillRect(x, y + 21, (width - 90) * Math.min(1, dead ? s.revive / 3 : pet.hp / pet.maxHp), 4);
      ctx.fillStyle = '#c9deed';
      const nearby = Math.hypot(p.x - pet.x, p.y - pet.y) < 220;
      ctx.fillText(dead ? '靠近守住，或召回救援' : G.Guardian.mature() ? '完全體 · 自動助戰中' : `${!nearby || G.Rift.inArena ? '成長暫停' : '下次進化'} ${clock(s.line.times[s.stage] - s.growth)}`, x, y + 39, width - 90);
      const bx = x + width - 80, by = y + 6, ready = s.recallCd <= 0 && !G.Rift.inArena;
      ctx.fillStyle = ready ? '#31564c' : '#202d3d'; ctx.fillRect(bx, by, 66, 40);
      ctx.strokeStyle = ready ? '#b2eccb' : '#607183'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, 66, 40);
      ctx.fillStyle = ready ? '#e4ffe9' : '#aab6c5'; ctx.textAlign = 'center';
      ctx.fillText(G.Rift.inArena ? '等待中' : s.recallCd > 0 ? s.recallCd.toFixed(1) + 's' : 'G 召回', bx + 33, by + 24);
      ctx.textAlign = 'left';
      G.Touch.addButton(bx, by, 66, 40, () => G.Guardian.recall(p), 4);
    } else {
      let text = `寶箱將在 ${clock(60 - s.elapsed)} 後出現`;
      if (s.chest) {
        const a = Math.atan2(s.chest.y - p.y, s.chest.x - p.x);
        const dir = ['右方', '右下方', '下方', '左下方', '左方', '左上方', '上方', '右上方'][(Math.round(a / (Math.PI / 4)) + 8) % 8];
        text = s.chest.open > 0 ? `開啟中 ${s.chest.open.toFixed(1)} / 3 秒` : `守護寶箱在${dir} · 靠近停留 3 秒`;
      }
      ctx.fillText(text, x, y + 20, width - 12);
      ctx.fillStyle = '#a5bbc8'; ctx.fillText('5 位夥伴 · 火力 / 治療 / 爆發 / 連鎖 / 防護', x, y + 39, width - 12);
    }
    ctx.fillStyle = '#f5d991'; ctx.fillText(goal(s), x, y + 57, width - 12);
    const trial = G.ExpeditionTrials.state.active, c = r.contract;
    ctx.fillStyle = '#a5c6c7';
    ctx.fillText(trial ? `${trial.name} ${trial.progress}/${trial.goal} · ${Math.ceil(trial.left)}s` : c ? `${c.name} ${Math.min(c.goal, Math.floor(c.progress))}/${c.goal} · ${Math.ceil(c.left)}s` : `遺物 ${r.relics.length} · 護盾 ${Math.ceil(r.shield)} · 共鳴 ${r.synergies.length}`, x, y + 73, width - 12);
  }
  function summary(s) {
    if (!s) return;
    if (s.completed) $('over-title').textContent = '守護完成，一起回家！';
    $('over-stats').insertAdjacentHTML('beforeend', `<div class="exp-summary guardian-summary"><b>${s.completed ? '已締結羈絆' : s.mature ? '已完成進化' : '這份約定，下次再繼續'}${s.family ? ' · ' + s.family : ''}</b><p>${s.name ? `${s.name} · 成長 ${clock(s.growth)} · 救援 ${s.revives} 次 · 助戰 ${s.attacks} 次` : '尚未開啟守護寶箱'}</p>${s.completed ? '<small>進化系已加入收藏，招募券與金幣已計入收穫。</small>' : '<small>下次守護遠征會重新遇見幼體，已有收藏照常保留。</small>'}</div>`);
  }
  return { prepare, choice, hydrate, pauseInfo, drawStatus, summary };
})();
