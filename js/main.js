// 画面と操作：タイトル・魔王の玉座・モンスター作り・作戦会議と戦闘の再生
import { IDS, CHARS, ELEMS, ELEM, WEAPONS, WEAPON, KEYS, keyName, STATS, STAT, SHAPES, TRAITS, STAGES, RES_MULT } from './data.js?v=2026.11.03-10';
import * as E from './engine.js?v=2026.11.03-10';
import { monsterSVG } from './monster.js?v=2026.11.03-10';
import { AI, OLLAMA_MODEL } from './llm.js?v=2026.11.03-10';
import { VERSION } from './version.js?v=2026.11.03-10';

const $ = id => document.getElementById(id);
const h = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v); } if (html) e.innerHTML = html; return e; };
const face = id => `img/face/${id}.webp`;
const stand = id => `img/stand/${id}.webp`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------- 保存 ----------------
const KEY = 'lq-v1';
let G = null;
let set = { ai: 'none', model: OLLAMA_MODEL, speed: 1 };
function load() {
  try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) { G = E.migrate(j.G || null); Object.assign(set, j.set || {}); } } catch {}
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ G, set })); } catch {} }

function show(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; }
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }
function openSheet(html) { $('sheet-content').innerHTML = html; $('sheet').hidden = false; }
$('sheet-close').onclick = () => { $('sheet').hidden = true; };
$('sheet').onclick = e => { if (e.target.id === 'sheet') $('sheet').hidden = true; };

// ---------------- タイトル ----------------
function title() {
  show('title');
  $('ver').textContent = 'ver ' + VERSION;
  $('btn-continue').hidden = !G;
  for (const r of document.querySelectorAll('input[name=ai]')) r.checked = r.value === set.ai;
  $('ollama-model').value = set.model || OLLAMA_MODEL;
  if (AI.isMobile()) { const r = document.querySelector('input[value=ollama]'); r.disabled = true; if (set.ai === 'ollama') document.querySelector('input[value=none]').checked = true; $('ai-pc').style.opacity = .4; }
  syncAi();
}
function syncAi() {
  const v = document.querySelector('input[name=ai]:checked').value;
  $('ollama-opts').hidden = v !== 'ollama';
  $('ai-note').textContent = '';
}
for (const r of document.querySelectorAll('input[name=ai]')) r.onchange = syncAi;
async function prepareAI() {
  const v = document.querySelector('input[name=ai]:checked').value;
  set.ai = v; set.model = $('ollama-model').value.trim() || OLLAMA_MODEL; save();
  if (v === 'none') { AI.mode = 'none'; return true; }
  $('ai-note').textContent = v === 'cloud' ? 'クラウドAIを確かめています…' : `PCのAI（${set.model}）を探しています…`;
  try { await AI.connect(v, set.model); $('ai-note').textContent = ''; toast(v === 'cloud' ? 'クラウドAIで作戦会議をします' : `PCのAI（${AI.served}）につながりました`); return true; } catch (e) {
    AI.mode = 'none';
    $('ai-note').textContent = e.message === 'nomodel' ? `Ollamaにはつながりましたが「${set.model}」が入っていません。PowerShellで「ollama pull ${set.model}」を実行してください。${e.names?.length ? '（入っているAI：' + e.names.join('、') + '）' : ''}`
      : e.message === 'quota' ? 'クラウドAIは今日の無料枠を使い切りました。「ふつう」で遊べます。'
      : e.message === 'nobind' ? 'クラウドAIの設定（Workers AI）がまだです。「ふつう」で遊べます。'
      : v === 'cloud' ? 'クラウドAIにつながりませんでした。「ふつう」で遊べます。'
      : 'Ollamaにつながりませんでした。Ollamaが起動しているか、OLLAMA_ORIGINS にこのゲームのアドレスを入れたかを確かめてください（README）。';
    return false;
  }
}
$('btn-continue').onclick = async () => { if (await prepareAI()) hub(); };
$('btn-new').onclick = async () => {
  if (G && !confirm('はじめからにしますか？（いまの旅の記録は消えます）')) return;
  if (!(await prepareAI())) return;
  G = E.newGame(); save();
  openSheet(`<div class="help"><h3>魔王、目覚める</h3><p>あなたは<b>魔王</b>。Liella!の11人が、あなたを倒すために旅立ちました。</p><p>道にモンスターを置いて迎え撃ち、<b>期限まで草原を抜けさせなければ魔王の勝ち</b>です。</p><p>彼女たちは作戦会議で4人を選び、戦いながら弱点を探し、負けても図鑑に書いて学んできます。魔王も戦うたびに力（魔力）が増えます。</p><p>まずは最初の1体を作りましょう。</p></div>`);
  hub();
};
$('btn-help').onclick = () => openSheet(HELP);
// 最新版に更新：古いファイルが残っていても、全部読み直す
async function hardReload() {
  toast('最新版を読み込んでいます…');
  const files = ['index.html', 'style.css', 'manifest.json', ...['main', 'engine', 'data', 'talk', 'monster', 'llm', 'version'].map(f => `js/${f}.js`), ...['index', ...IDS].map(f => `js/lines/${f}.js`)];
  try { await Promise.all(files.map(f => fetch(f, { cache: 'reload' }))); } catch { /* オフラインなら無視 */ }
  location.replace(location.pathname + '?r=' + Date.now());
}
$('btn-update').onclick = hardReload;
const HELP = `<div class="help"><h3>遊び方</h3>
<p><b>勝ち負け</b>：あなたは魔王。草原（4戦・最後はボス）に向かってくるLiella!を迎え撃ちます。1回戦うと1日たち、<b>期限が0日になったら魔王の勝ち</b>。ボスまで倒されたら魔王の負けです。</p>
<p><b>期限</b>：最初は2日。Liella!が1つ突破するたびに、次の戦いのぶんの日数が足されます（2戦目+3日・3戦目+3日・ボス+4日。残った日は持ちこし）。後の敵ほど強いので、Liella!が挑める回数も多くなります。</p>
<p><b>魔王の成長</b>：戦うたびに使える魔力が増えます（撃退すると+3、突破されても+2）。レベルが上がっていくLiella!に負けないよう、増えた魔力でモンスターを強くしましょう。</p>
<p><b>魔王の玉座</b>：次の戦いのモンスターを作って「迎え撃つ」。撃退したあとは、同じモンスターのままでも、直してもかまいません。</p>
<p><b>モンスター作り</b>：能力（体力・攻撃・防御…）、効き目（弱点と耐性）、特性（再生・飛行…）を決める。能力は1ポイント＝魔力1で、どの能力も1ポイントでだいたい同じくらい強くなります（0〜15）。ただし防御は、片方だけ上げるとパーティーがもう片方（物理⇔魔法）で攻めてくるので、両方上げると効きます。弱点を作ると魔力が少し戻ります（最大9）。名前は「おまかせ」で形・属性・能力から自動で付きます。</p>
<p><b>見た目と言い伝え</b>：パーティーは見た目（形と色）で判断します。火の色なら「水が効くはず」と思いこむので、そこを無効にしておくと引っかかります。同じ見た目で中身を変えると、前の記憶が通じず混乱します。</p>
<p><b>パーティー</b>：11人それぞれ武器や属性の得意度（0〜10）、性格がちがいます。使った武器や魔法は少しずつ上達します。戦った人は疲れ、倒れた人は次の戦いを休みます。控えも経験値を半分もらえます。</p>
<p><b>図鑑</b>：パーティーが見て覚えたこと。会心の一撃を弱点と勘ちがいすることもあります（理屈っぽい人は割り引いて考える）。</p>
<p><b>頭脳</b>：「ふつう」は性格と数字で考えます。クラウドAI・PCのAIは、作戦会議（出撃メンバーと作戦）と、戦闘中の大事な場面（ピンチ・予想外のこと）でAIが判断します。PCのAIは回数制限がないので、3ターンごとの見直しもAIがします（1回の戦闘で最大6回）。セリフはどのモードでも、キャラごとに用意したものです。</p></div>`;

// ---------------- 魔王の玉座 ----------------
let tab = 'party';
function hub() {
  show('hub');
  const S = STAGES[G.stage], f = E.currentFight(G);
  $('hub-day').innerHTML = G.cleared || G.maouWin ? `${G.day - 1}日` : `期限まで<br><b style="color:var(--gold);font-size:15px">あと${E.daysLeft(G)}日</b>`;
  $('hub-sub').textContent = `ステージ：${S.name}　魔王の力 +${G.power || 0}`;
  $('progress').innerHTML = S.fights.map((x, i) => `<div class="dot ${i < G.fight || G.cleared ? 'done' : i === G.fight ? 'now' : ''}">${x.boss ? 'ボス' : i + 1 + '戦目'}</div>`).join('');
  const card = $('next-card');
  if (G.maouWin) {
    card.innerHTML = `<h3 class="win">魔王の勝ち！</h3><p class="note">Liella!は期限までに草原を抜けられず、旅をあきらめました。<br>（${S.fights.length}戦のうち${G.fight}戦を突破されただけ・撃退${G.history.filter(x => !x.win).length}回）</p><button class="btn" id="btn-restart">はじめから遊ぶ</button>`;
    $('btn-restart').onclick = () => { if (confirm('はじめからにしますか？')) { G = E.newGame(); save(); hub(); } };
  } else if (G.cleared) {
    card.innerHTML = `<h3 class="lose">魔王の負け……草原を突破された</h3><p class="note">Liella!は${G.day - 1}日目に草原のボスを倒しました。（次のステージは、これから作ります）<br>撃退した回数：${G.history.filter(x => !x.win).length}回</p><button class="btn" id="btn-restart">はじめから遊ぶ</button>`;
    $('btn-restart').onclick = () => { if (confirm('はじめからにしますか？')) { G = E.newGame(); save(); hub(); } };
  } else {
    const tries = G.tries[`${G.stage}-${G.fight}`] || 0;
    const d = G.next;
    card.innerHTML = `<div class="label">${f.boss ? 'ボス戦' : `${G.fight + 1}戦目`}　使える魔力 ${f.budget}${tries ? `　（${tries}回撃退）` : ''}</div>
      <div class="next-row"><div class="mini">${d ? monsterSVG(d, { size: 104 }) : '<span class="note">まだ<br>いない</span>'}</div>
      <div class="info">${d ? `<b>${esc(d.name)}</b><br>${E.lookName(d)}<br>魔力 ${E.costOf(d)} / ${f.budget}${tries ? '<br><span class="note">撃退されたLiella!が、作戦を変えて戻ってきます。増えた魔力で強くしておきましょう。</span>' : ''}` : '<span class="note">向かってくるLiella!を迎え撃つモンスターを作りましょう。</span>'}</div></div>
      <div class="btn-row"><button class="btn" id="btn-edit">${d ? '直す' : '作る'}</button><button class="btn primary" id="btn-go" ${d ? '' : 'disabled'}>迎え撃つ</button></div>`;
    $('btn-edit').onclick = () => editor();
    $('btn-go').onclick = () => fight();
  }
  for (const b of document.querySelectorAll('.tabs button')) { b.classList.toggle('on', b.dataset.tab === tab); b.onclick = () => { tab = b.dataset.tab; hub(); }; }
  for (const t of ['party', 'book', 'log']) $('tab-' + t).hidden = t !== tab;
  if (tab === 'party') renderParty();
  if (tab === 'book') renderBook();
  if (tab === 'log') renderLog();
}
$('hub-title').onclick = () => title();

function tiredDots(n) { return `<span class="tired">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`; }
function renderParty() {
  const el = $('tab-party');
  el.innerHTML = `<div class="pgrid">${IDS.map(id => { const P = G.party[id], C = CHARS[id]; return `<div class="pc" data-id="${id}" style="--c:${C.color}">${P.hurt ? '<span class="tag">ケガ</span>' : ''}<img src="${face(id)}" alt=""><div class="nm">${C.name}</div><div class="lv">Lv${P.lv} ${tiredDots(P.tired)}</div><div class="role">${C.role}</div></div>`; }).join('')}</div>
    <p class="note">タップでくわしく。オレンジの点は疲れ（3つで限界）。</p>`;
  for (const c of el.querySelectorAll('.pc')) c.onclick = () => charSheet(c.dataset.id);
}
function charSheet(id) {
  const C = CHARS[id], P = G.party[id], st = E.charStats(G, id);
  const bar = (label, k) => { const base = WEAPON[k] ? C.w[k] : ELEM[k] ? C.e[k] : C.s[k]; const a = E.apt(G, id, k); return `<div>${label}</div><div class="b"><i style="width:${base * 10}%"></i></div><div>${a}${a > base ? `<small style="color:var(--gold)">↑</small>` : ''}</div>`; };
  const PN = { careful: '慎重', rash: '無鉄砲', curious: '試したがり', pride: '得意技へのこだわり', logic: '理屈で考える', bold: '出たがり', kind: '仲間思い' };
  openSheet(`<div class="det-head" style="--c:${C.color}"><img src="${face(id)}" alt=""><div><b style="font-size:18px">${C.name}</b><div class="note">${C.role}<br>Lv${P.lv}（次まで ${40 * P.lv - P.exp}）　疲れ ${tiredDots(P.tired)}${P.hurt ? '　<span class="lose">ケガで休み</span>' : ''}</div></div></div>
    <div class="note">体力${st.maxHp}・力${Math.round(st.atk)}・魔力${Math.round(st.mag)}・守り${Math.round(st.def)}・魔法の守り${Math.round(st.mdef)}・素早さ${Math.round(st.spd)}</div>
    <h4>武器の得意度（0〜10、↑は使いこんで上達）</h4><div class="bars">${WEAPONS.map(k => bar(WEAPON[k].name, k)).join('')}</div>
    <h4>属性の得意度</h4><div class="bars">${ELEMS.map(k => bar(ELEM[k].name, k)).join('')}</div>
    <h4>そのほか</h4><div class="bars">${[['回復', 'heal'], ['歌', 'song'], ['かばう', 'guard'], ['分析', 'scan']].map(([l, k]) => bar(l, k)).join('')}</div>
    <h4>性格</h4><div class="bars">${Object.entries(C.p).map(([k, v]) => `<div>${PN[k]}</div><div class="b"><i class="m" style="width:${v * 10}%"></i></div><div>${v}</div>`).join('')}</div>`);
}
function renderBook() {
  const el = $('tab-book');
  const items = Object.values(G.book);
  if (!items.length) { el.innerHTML = '<p class="note">まだ何も書かれていません。戦うたびに、パーティーが見たことを書きこみます。</p>'; return; }
  el.innerHTML = `<p class="note">パーティーが「そう思っていること」です。本当とはちがうこともあります。✓は分析で確かめたもの。</p>` + items.map(b => {
    const effs = KEYS.map(k => {
      const fact = b.res[k] != null, o = b.obs[k];
      const m = fact ? b.res[k] : o?.n ? o.v : null;
      if (m == null) return '';
      return `<span class="eff ${m >= 1.25 ? 'good' : m <= 0.6 ? 'bad' : ''} ${fact ? 'fact' : ''}">${keyName(k)}：${E.mText(m)}</span>`;
    }).join('');
    const tr = Object.keys(b.traits).map(t => TRAITS[t].name).join('、');
    const stt = Object.entries(b.stats).map(([s, v]) => `${STAT[s].name}${E.lvText(v)}`).join('、');
    return `<div class="book-item"><b>${b.look}</b>　<span class="note">${b.met}回　<span class="win">${b.wins}勝</span> <span class="lose">${b.losses}敗</span></span><br>${effs || '<span class="note">効き目はまだ分からない</span>'}${tr ? `<br>特性：${tr}` : ''}${stt ? `<br>能力：${stt}` : ''}</div>`;
  }).join('');
}
function renderLog() {
  const el = $('tab-log');
  if (!G.history.length) { el.innerHTML = '<p class="note">まだ戦いの記録はありません。</p>'; return; }
  el.innerHTML = G.history.slice().reverse().map(x => `<div class="log-item">${x.day}日目　<b>${esc(x.name)}</b>（${x.look}）<br><span class="${x.win ? 'lose' : 'win'}">${x.win ? '突破された' : x.outcome === 'wipe' ? '撃退（全滅させた）' : '撃退（撤退させた）'}</span>　${x.rounds}ターン　${x.team.map(id => CHARS[id].name).join('・')}</div>`).join('');
}

// ---------------- モンスター作り ----------------
let D = null, nameAuto = true;
function editor() {
  show('editor');
  const f = E.currentFight(G);
  D = JSON.parse(JSON.stringify(G.next || E.blankDesign()));
  if (!G.next && G.fight > 0) D.name = '';
  $('ed-sub').textContent = `${f.boss ? 'ボス' : `${G.fight + 1}戦目`}　使える魔力 ${f.budget}`;
  nameAuto = !D.name || D.name === E.autoName(D);
  $('ed-name').value = D.name;
  $('ed-name').oninput = () => { D.name = $('ed-name').value; nameAuto = !D.name.trim(); };
  $('ed-autoname').onclick = () => { nameAuto = true; edRender(false); };
  // 前に作ったもの
  const sv = $('ed-saved');
  if (G.designs.length) {
    sv.innerHTML = `<div class="label">前に作ったモンスターを呼ぶ</div><div class="chips">${G.designs.map((x, i) => `<button data-i="${i}">${esc(x.name)}</button>`).join('')}</div>`;
    for (const b of sv.querySelectorAll('button')) b.onclick = () => { D = JSON.parse(JSON.stringify(G.designs[+b.dataset.i])); $('ed-name').value = D.name; nameAuto = D.name === E.autoName(D); edRender(true); };
  } else sv.innerHTML = '';
  edRender(true);
  $('ed-back').onclick = () => hub();
  $('ed-random').onclick = () => { D = randomDesign(f.budget, ''); nameAuto = true; edRender(true); };
  $('ed-ok').onclick = () => {
    if (E.costOf(D) > f.budget) return toast('魔力が足りません');
    D.name = (D.name || '').trim() || E.autoName(D);
    G.next = JSON.parse(JSON.stringify(D));
    const i = G.designs.findIndex(x => x.name === D.name);
    if (i >= 0) G.designs[i] = G.next; else G.designs.push(G.next);
    if (G.designs.length > 12) G.designs.shift();
    save(); hub();
  };
}
const RES_LABEL = { '-3': '大きな弱点', '-2': '弱点', '-1': '少し弱い', 0: 'ふつう', 1: '少し強い', 2: '強い', 3: '効かない' };
function edRender(full) {
  const f = E.currentFight(G);
  if (full) {
    $('ed-shape').innerHTML = Object.entries(SHAPES).map(([k, v]) => `<button data-k="${k}" class="${D.shape === k ? 'on' : ''}">${v.name}</button>`).join('');
    for (const b of $('ed-shape').children) b.onclick = () => { D.shape = b.dataset.k; edRender(true); };
    $('ed-elem').innerHTML = ELEMS.map(k => `<button data-k="${k}" class="${D.elem === k ? 'on' : ''}"><span class="sw" style="background:${ELEM[k].color}"></span>${ELEM[k].name}</button>`).join('');
    for (const b of $('ed-elem').children) b.onclick = () => { D.elem = b.dataset.k; edRender(true); };
    $('ed-stats').innerHTML = STATS.map(s => sliderRow(STAT[s].name, 0, 15, D.stats[s], `sv-${s}`)).join('');
    $('ed-stats').querySelectorAll('.sl').forEach((row, i) => wireSlider(row, v => { D.stats[STATS[i]] = v; edRender(false); }));
    $('ed-res').innerHTML = KEYS.map(k => sliderRow(keyName(k), -3, 3, D.res[k] || 0, `rv-${k}`)).join('');
    $('ed-res').querySelectorAll('.sl').forEach((row, i) => wireSlider(row, v => { if (v) D.res[KEYS[i]] = v; else delete D.res[KEYS[i]]; edRender(false); }));
    $('ed-traits').innerHTML = Object.entries(TRAITS).map(([k, t]) => `<label class="trait"><input type="checkbox" data-k="${k}" ${D.traits.includes(k) ? 'checked' : ''}><span><b>${t.name}</b>（魔力${t.cost}）<small>${t.desc}</small></span></label>`).join('');
    for (const c of $('ed-traits').querySelectorAll('input')) c.onchange = () => { D.traits = D.traits.filter(x => x !== c.dataset.k); if (c.checked) D.traits.push(c.dataset.k); edRender(false); };
  }
  // 名前のおまかせ：形・属性・能力を変えるたびに付け直す（自分で名前を打ったら変えない）
  if (nameAuto) { D.name = E.autoName(D); $('ed-name').value = D.name; }
  const ms = E.monStats(D);
  const val = { hp: `体力${ms.maxHp}`, atk: E.lvText(D.stats.atk), mag: E.lvText(D.stats.mag), def: E.lvText(D.stats.def), mdef: E.lvText(D.stats.mdef), spd: `1ターン${ms.rate.toFixed(1)}回` };
  for (const s of STATS) $('sv-' + s).textContent = `${D.stats[s]}　${val[s]}`;
  for (const k of KEYS) { const v = D.res[k] || 0, el = $('rv-' + k); el.textContent = RES_LABEL[v]; el.className = 'v ' + (v < 0 ? 'good' : v > 0 ? 'bad' : ''); }
  $('ed-preview').innerHTML = monsterSVG(D, { size: 124 });
  const c = E.costOf(D), over = c > f.budget;
  $('ed-cost-text').innerHTML = `魔力 <span style="color:${over ? 'var(--red)' : 'var(--gold)'}">${c}</span> / ${f.budget}`;
  $('ed-cost-bar').style.width = Math.min(100, c / f.budget * 100) + '%';
  $('ed-cost-bar').parentElement.classList.toggle('over', over);
  $('ed-cost-note').textContent = over ? '魔力が足りません。どこかを下げてください。' : `見た目：${E.lookName(D)}`;
  $('ed-ok').disabled = over;
}
// シークバー：−/＋ボタンでも1つずつ動かせる。バーをタップした位置にも動く（iPhone はつまみしか動かせないため）
const sliderRow = (label, min, max, v, vid) => `<div class="sl"><span>${label}</span><button class="pm" data-d="-1" aria-label="下げる">−</button><input type="range" min="${min}" max="${max}" step="1" value="${v}"><button class="pm" data-d="1" aria-label="上げる">＋</button><span class="v" id="${vid}"></span></div>`;
function wireSlider(row, onSet) {
  const r = row.querySelector('input');
  const setV = v => { v = Math.max(+r.min, Math.min(+r.max, Math.round(v))); if (v === +r.value) return; r.value = v; onSet(v); };
  r.oninput = () => onSet(+r.value);
  for (const b of row.querySelectorAll('.pm')) b.onclick = () => setV(+r.value + +b.dataset.d);
  let sx = 0, sy = 0;
  r.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
  r.addEventListener('pointerup', e => {
    if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) return;
    const rc = r.getBoundingClientRect();
    setV(+r.min + (e.clientX - rc.left) / rc.width * (+r.max - +r.min));
  });
}
function randomDesign(budget, name) {
  const R = Math.random, pick = a => a[Math.floor(R() * a.length)];
  let best = null;
  for (let t = 0; t < 300; t++) {
    const d = E.blankDesign();
    d.name = name || ''; d.shape = pick(Object.keys(SHAPES)); d.elem = pick(ELEMS);
    for (const s of STATS) d.stats[s] = Math.floor(R() * Math.min(16, budget / 4));
    for (let i = 0; i < 3; i++) if (R() < 0.6) d.res[pick(KEYS)] = Math.floor(R() * 7) - 3;
    if (R() < 0.5) d.traits.push(pick(Object.keys(TRAITS)));
    const c = E.costOf(d);
    if (c <= budget && (!best || c > E.costOf(best))) best = d;
    if (best && E.costOf(best) >= budget - 3) break;
  }
  if (!best.name) best.name = E.autoName(best);
  return best;
}

// ---------------- 作戦会議と戦闘 ----------------
let play = null;
async function fight() {
  const d = G.next;
  show('scene');
  $('sc-log').innerHTML = '';
  $('sc-mon').className = 'sc-mon';
  $('sc-mon').innerHTML = monsterSVG(d, { size: 220 });
  $('sc-mon-name').textContent = d.name;
  $('sc-mon-hp').style.width = '100%';
  $('sc-mon-num').textContent = '';
  $('sc-party').innerHTML = '';
  $('sc-done').hidden = true; $('sc-skip').hidden = false;
  $('sc-cut').classList.remove('on');
  speedUI();
  addEv({ t: 'narr', text: '― 作戦会議 ―', cls: 'round' });
  let ai = null;
  if (AI.usable()) {
    // 見た目は参謀が考えているように（AIの名前は出さない）
    const strat = E.available(G).sort((a, b) => E.apt(G, b, 'scan') + CHARS[b].p.logic * 0.3 - (E.apt(G, a, 'scan') + CHARS[a].p.logic * 0.3))[0];
    const wait = addEv({ t: 'aiwait', sp: strat, text: `${CHARS[strat].name}が作戦を考えている……` });
    ai = await AI.plan(G, d);
    wait.remove();
    if (AI.quotaOut) toast('クラウドAIの今日の無料枠を使い切りました。ここからは「ふつう」で考えます');
  }
  const M = E.meeting(G, d, ai);
  play = { evs: [...M.ev], i: 0, timer: null, done: false, computing: true, idle: false, fast: false };
  step();
  const onEvent = e => { if (!play) return; play.evs.push(e); if (play.idle) { play.idle = false; step(); } };
  const hooks = { onEvent, ...AI.battleHooks() };
  if (hooks.maxAI) hooks.tactic = (g, dd, st) => AI.tactic(g, dd, st);
  const res = await E.battle(G, d, M, hooks);
  const rv = E.review(G, d, res);
  if (res.win) E.advance(G);
  E.checkDeadline(G);
  save();
  if (!play) return;
  play.evs.push({ t: 'narr', text: '― 反省会 ―', cls: 'round' }, ...rv);
  if (G.maouWin) play.evs.push({ t: 'end', cls: 'win', text: '期限切れ！ Liella!は草原を抜けられなかった。魔王の勝ち！' });
  else if (G.cleared) play.evs.push({ t: 'end', cls: 'lose', text: `草原のボスまで倒された……魔王の負け（${G.day - 1}日目）` });
  else play.evs.push({ t: 'narr', text: res.win ? `魔王の力が増した。次の戦いで使える魔力 ${E.currentFight(G).budget}（期限まであと${E.daysLeft(G)}日）` : `魔王の力が増した。使える魔力 ${E.currentFight(G).budget}（期限まであと${E.daysLeft(G)}日）` });
  play.computing = false;
  if (play.idle) { play.idle = false; step(); }
}
function delayOf(e) {
  const base = { say: 1700, think: 1250, narr: 1000, round: 450, hit: 850, miss: 800, mon: 950, team: 1100, start: 1000, down: 1100, win: 1600, lose: 1600, lvup: 1200, heal: 850, buff: 850, scan: 900, swap: 1000, hurt: 900, aiwait: 500 }[e.t] || 900;
  return play?.fast ? 0 : base * set.speed;
}
function step() {
  if (!play) return;
  if (play.i >= play.evs.length) { if (play.computing) { play.idle = true; return; } return finish(); }
  const e = play.evs[play.i++];
  render(e, !play.fast);
  if (play.fast) { $('sc-log').scrollTop = $('sc-log').scrollHeight; return step(); }
  play.timer = setTimeout(step, delayOf(e));
}
function finish() {
  if (!play || play.done) return;
  play.done = true; clearTimeout(play.timer);
  $('sc-skip').hidden = true; $('sc-done').hidden = false;
  $('sc-cut').classList.remove('on');
  $('sc-log').scrollTop = $('sc-log').scrollHeight;
}
// 最後まで：AIを待っている間も、届いたものから一気に出す
$('sc-skip').onclick = () => {
  if (!play) return;
  clearTimeout(play.timer);
  play.fast = true;
  if (!play.idle) step();
};
$('sc-done').onclick = () => { play = null; hub(); };
function speedUI() {
  for (const b of $('sc-speed').children) { b.classList.toggle('on', +b.dataset.s === set.speed); b.onclick = () => { set.speed = +b.dataset.s; save(); speedUI(); }; }
}
function addEv(e) {
  const log = $('sc-log');
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
  let el;
  if (e.t === 'say') {
    const C = CHARS[e.sp];
    el = h('div', { class: 'ev say', style: `--c:${C.color}` }, `<img src="${face(e.sp)}" alt=""><div class="bub"><div class="who">${C.name}</div>${esc(e.text)}</div>`);
  } else if (e.t === 'aiwait') {
    el = h('div', { class: 'ev think' }, `<img src="${face(e.sp)}" alt=""><span>${esc(e.text)}</span>`);
  } else if (e.t === 'think') {
    el = h('div', { class: 'ev think' }, `<img src="${face(e.sp)}" alt=""><span>（${esc(e.text)}）</span>`);
  } else if (e.t === 'win' || e.t === 'lose' || e.t === 'end') {
    // 色は魔王から見た勝ち負け（Liella!の勝ち＝赤、撃退＝緑）
    el = h('div', { class: `ev banner ${e.cls || (e.t === 'win' ? 'lose' : 'win')}` }, esc(e.text));
  } else {
    const cls = e.cls || ({ round: 'round', mon: 'mon', hurt: 'mon', down: 'mon', team: 'team', lvup: 'lvup', hit: 'hit' }[e.t] || 'narr');
    const txt = e.t === 'hit' ? esc(e.text).replace(/(\d+)のダメージ/, '<span class="d">$1</span>のダメージ') : esc(e.text);
    el = h('div', { class: 'ev ' + cls }, txt);
  }
  log.appendChild(el);
  if (stick) log.scrollTop = log.scrollHeight;
  return el;
}
function render(e, anim) {
  addEv(e);
  if (e.s) {
    const s = e.s;
    $('sc-mon-hp').style.width = Math.max(0, s.mon / s.max * 100) + '%';
    $('sc-mon-num').textContent = `${s.mon} / ${s.max}`;
    const party = $('sc-party');
    const key = s.team.join(',');
    if (party.dataset.k !== key) {
      party.dataset.k = key;
      party.innerHTML = s.team.map(id => `<div class="sp" id="sp-${id}" style="--c:${CHARS[id].color}"><img src="${face(id)}" alt=""><div>${CHARS[id].name}</div><div class="hp"><i></i></div></div>`).join('');
    }
    for (const id of s.team) {
      const el = $('sp-' + id); if (!el) continue;
      const r = (s.hp[id] ?? 0) / (s.max2[id] || 1);
      const bar = el.querySelector('.hp i'); bar.style.width = r * 100 + '%'; bar.classList.toggle('low', r < 0.3);
      el.classList.toggle('down', (s.hp[id] ?? 0) <= 0);
    }
  }
  if (e.t === 'team' && !e.s) {
    const party = $('sc-party'); party.dataset.k = e.team.join(',');
    party.innerHTML = e.team.map(id => `<div class="sp" id="sp-${id}" style="--c:${CHARS[id].color}"><img src="${face(id)}" alt=""><div>${CHARS[id].name}</div><div class="hp"><i style="width:100%"></i></div></div>`).join('');
  }
  if (!anim) { if (e.t === 'win') $('sc-mon').classList.add('dead'); return; }
  const cut = $('sc-cut');
  if (e.t === 'say') { $('sc-stand').src = stand(e.sp); cut.style.setProperty('--c', CHARS[e.sp].color); cut.classList.add('on'); clearTimeout(render.st); render.st = setTimeout(() => cut.classList.remove('on'), delayOf(e) * 0.9); }
  if (e.t === 'hit') { const m = $('sc-mon'); m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake'); }
  if ((e.t === 'mon' || e.t === 'hurt') && e.sp) { const el = $('sp-' + e.sp); if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); } }
  if (e.t === 'win') $('sc-mon').classList.add('dead');
}

// ---------------- iPhone：キーボードを閉じたあと、画面がずれたまま（タップの位置がずれる）にならないように ----------------
function resetScroll() { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); }
document.addEventListener('focusout', () => setTimeout(resetScroll, 60));
window.addEventListener('scroll', () => { const a = document.activeElement; if (!a || a.tagName !== 'INPUT' || a.type === 'range') resetScroll(); });
window.visualViewport?.addEventListener('resize', () => setTimeout(resetScroll, 60));

// ---------------- 起動 ----------------
load();
document.getElementById('boot').remove();
title();
window.__booted = true;
