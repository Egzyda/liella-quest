// 画面と操作：タイトル・魔王の玉座・モンスター作り・作戦会議と戦闘の再生
import { CMDS, CMD_LINE, MAOU_ACTS, TRUMP, GROW_KEYS, growText, baseApt as bApt, IDS, CHARS, charGear, ELEMS, ELEM, WEAPONS, WEAPON, KEYS, keyName, STATS, STAT, SHAPES, TRAITS, STAGES, RES_MULT } from './data.js?v=2026.11.03-23';
import * as E from './engine.js?v=2026.11.03-23';
import { monsterSVG } from './monster.js?v=2026.11.03-23';
import { AI, OLLAMA_MODEL } from './llm.js?v=2026.11.03-23';
import { icon } from './icons.js?v=2026.11.03-23';
import { freePhase, learnable, rowText, decidePolicy } from './camp.js?v=2026.11.03-23';
import { say } from './talk.js?v=2026.11.03-23';
import { VERSION } from './version.js?v=2026.11.03-23';

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
// top：上に出す（キーボードで隠れないように。入力欄があるとき）
function openSheet(html, top = false) { $('sheet-content').innerHTML = html; $('sheet').classList.toggle('top', top); $('sheet').hidden = false; }
// 窓を閉じたときにすること（戦闘中のメニューなら再開）
let sheetClosed = null;
function closeSheet() { $('sheet').hidden = true; const f = sheetClosed; sheetClosed = null; f?.(); }
$('sheet-close').onclick = closeSheet;
$('sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };

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
$('btn-continue').onclick = async () => { if (!(await prepareAI())) return; if (!G.pname) askName(n => { G.pname = n; save(); hub(); }); else hub(); };
// プレイヤーの名前（Liella!のみんなが呼ぶ名前。6文字まで）
function askName(done) {
  openSheet(`<div class="help"><h3>あなたの名前</h3><p class="note">Liella!のみんなが呼ぶ名前です（6文字まで）。魔王軍の名前にもなります。何も入れなければ「麗」になります。</p>
    <div class="ed-row"><input id="pn" maxlength="6" value="${esc(set.pname || '')}" placeholder="麗" autocomplete="off"></div>
    <button class="btn primary" id="pn-ok">これで始める</button></div>`, true);
  const ok = () => { const n = $('pn').value.trim().slice(0, 6) || '麗'; set.pname = n; save(); $('pn').blur(); $('sheet').hidden = true; resetScroll(); done(n); };
  $('pn-ok').onclick = ok;
  $('pn').onkeydown = e => { if (e.key === 'Enter') ok(); };
}
function startNew() {
  askName(n => {
    G = E.newGame(); G.pname = n; save();
    hub();
    openSheet(`<div class="help"><h3>ログイン完了</h3><p>放課後、Liella!のみんなとフルダイブ型のVRゲーム「リエラクエスト」を遊ぶことになった。</p><p>みんなは勇者のパーティー。そして<b>${esc(n)}</b>は――<b>魔王</b>の役。</p><p>魔王${esc(n)}軍として草原にモンスターを置き、迎え撃とう。<b>イベントの期限まで草原を抜けさせなければ魔王の勝ち</b>。</p><p>みんなは作戦会議で4人を選び、戦いながら弱点を探し、負けても図鑑に書いて学んでくる。魔王は戦闘中に「号令」で指示を出し、戦いのあとの自由行動で号令を覚えたり、偵察したりできる。</p><p>まずは最初の1体を作ろう。</p></div>`);
  });
}
$('btn-new').onclick = async () => {
  if (G && !confirm('はじめからにしますか？（いまの記録は消えます）')) return;
  if (!(await prepareAI())) return;
  startNew();
};
$('btn-help').onclick = () => openSheet(HELP);
// 最新版に更新：古いファイルが残っていても、全部読み直す
async function hardReload() {
  toast('最新版を読み込んでいます…');
  const files = ['index.html', 'style.css', 'manifest.json', ...['main', 'engine', 'data', 'talk', 'monster', 'llm', 'version', 'camp', 'icons'].map(f => `js/${f}.js`), ...['index', ...IDS].map(f => `js/lines/${f}.js`)];
  try { await Promise.all(files.map(f => fetch(f, { cache: 'reload' }))); } catch { /* オフラインなら無視 */ }
  location.replace(location.pathname + '?r=' + Date.now());
}
$('btn-update').onclick = hardReload;
const HELP = `<div class="help"><h3>遊び方</h3>
<p><b>設定</b>：Liella!のみんなと、フルダイブ型のVRゲーム「リエラクエスト」で遊んでいます。みんなは勇者のパーティー、あなたは魔王の役です。</p>
<p><b>勝ち負け</b>：あなたは魔王。草原（4戦・最後はボス）に向かってくるLiella!を迎え撃ちます。1回戦うと1日たち、<b>期限が0日になったら魔王の勝ち</b>。ボスまで倒されたら魔王の負けです。</p>
<p><b>期限</b>：最初は2日。Liella!が1つ突破するたびに、次の戦いのぶんの日数が足されます（2戦目+3日・3戦目+3日・ボス+4日。残った日は持ちこし）。後の敵ほど強いので、Liella!が挑める回数も多くなります。</p>
<p><b>魔王の成長</b>：戦うたびに使える魔力が増えます（撃退すると+3、突破されても+2）。レベルが上がっていくLiella!に負けないよう、増えた魔力でモンスターを強くしましょう。</p>
<p><b>魔王の玉座</b>：次の戦いのモンスターを作って「迎え撃つ」。撃退したあとは、同じモンスターのままでも、直してもかまいません。</p>
<p><b>モンスター作り</b>：能力（体力・攻撃・防御…）、効き目（弱点と耐性）、特性（再生・飛行…）を決める。能力は1ポイント＝魔力1で、どの能力も1ポイントでだいたい同じくらい強くなります（0〜15）。ただし防御は、片方だけ上げるとパーティーがもう片方（物理⇔魔法）で攻めてくるので、両方上げると効きます。弱点を作ると魔力が少し戻ります（最大9）。名前は「おまかせ」で形・属性・能力から自動で付きます。</p>
<p><b>見た目と言い伝え</b>：パーティーは見た目（形と色）で判断します。火の色なら「水が効くはず」と思いこむので、そこを無効にしておくと引っかかります。同じ見た目で中身を変えると、前の記憶が通じず混乱します。</p>
<p><b>パーティー</b>：11人それぞれ武器や属性の得意度（0〜10）、性格がちがいます。使った武器や魔法は少しずつ上達します。戦った人は疲れ、倒れた人は次の戦いを休みます。控えも経験値を半分もらえます。</p>
<p><b>号令</b>：戦闘中、モンスターの下の「号令」から指示を出せます（押すと一時停止）。号令ゲージ（金のひし形）を使い、次のターンから効きます。最初は「狙い（自由・弱った子）」と「構え（攻め・守り）」だけ。ため・威嚇・切り札・回復役ねらいなどは、自由行動で覚えます。「最後まで」で飛ばすと、おまかせで号令します。</p>
<p><b>自由行動</b>：戦いのあと、Liella!は町で休む・鍛える・情報を集める。魔王は1つだけ「号令を覚える」「力をためる」「偵察（2人を全部見る）」「刺客（1人を大きく削る）」から選べます。</p>
<p><b>体力は持ち越し</b>：Liella!は戦いで減った体力が休むまで戻りません（控えは少し回復）。削っておくと次の戦いで別の子が出てきます。</p>
<p><b>見えるのは見たことだけ</b>：Liella!の得意は、戦いで使ったものと偵察した子だけわかります（「？」はまだ見ていない）。毎回、初期の育ち方が少しずつ違うので、最初の「育成会議」の話もヒントになります。</p>
<p><b>盾とねらわれやすさ</b>：モンスターは、目立つこと（強い攻撃・回復・歌）をした子をねらいやすくなります。盾が得意な子（きな子・可可・恋・夏美）は「挑発」で自分にねらいを集め、盾を構えてダメージを減らします。対抗するには特性の「見破り」（挑発に乗らず回復役や弱った子をねらう）や「貫通」（守りと盾を無視）を。</p>
<p><b>外野の分析役</b>：控えに分析が得意な子（四季・冬毬など）がいると、戦いを見ていて弱点に気づいたり、作戦を変えたりします。</p>
<p><b>装備</b>：みんなは、はじめから得意な武器（盾が得意な子は盾も）を持っています。</p>
<p><b>ランダム</b>：モンスター作りの「ランダム」は、形・属性・能力・効き目・特性をすべてランダムに決めます（特性の数は選べます）。</p>
<p><b>パーティーの一覧</b>：玉座のパーティーを「一覧表」「攻撃ごと」に切りかえると、11人の得意が一目でわかります。モンスター作りの「パーティー」ボタンからも開けます。得意な子が多い攻撃（主力）を効かなくすると困り、少ない攻撃（手薄）は弱点にしても突かれにくいです。</p>
<p><b>図鑑</b>：パーティーが見て覚えたこと。会心の一撃を弱点と勘ちがいすることもあります（理屈っぽい人は割り引いて考える）。</p>
<p><b>頭脳</b>：「ふつう」は性格と数字で考えます。クラウドAI・PCのAIは、作戦会議（出撃メンバーと作戦）と、戦闘中の大事な場面（ピンチ・予想外のこと）でAIが判断します。PCのAIは回数制限がないので、3ターンごとの見直しもAIがします（1回の戦闘で最大6回）。セリフはどのモードでも、キャラごとに用意したものです。</p></div>`;

// ---------------- 魔王の玉座 ----------------
let tab = 'party';
function hub() {
  show('hub');
  const S = STAGES[G.stage], f = E.currentFight(G);
  $('hub-day').innerHTML = G.cleared || G.maouWin ? `${G.day - 1}日` : `期限まで<br><b style="color:var(--gold);font-size:15px">あと${E.daysLeft(G)}日</b>`;
  $('hub-sub').textContent = `魔王${G.pname || ''}軍　${S.name}　力 +${G.power || 0}`;
  $('progress').innerHTML = S.fights.map((x, i) => `<div class="dot ${i < G.fight || G.cleared ? 'done' : i === G.fight ? 'now' : ''}">${x.boss ? 'ボス' : i + 1 + '戦目'}</div>`).join('');
  const card = $('next-card');
  if (G.maouWin) {
    card.innerHTML = `<h3 class="win">魔王${esc(G.pname || '')}軍の勝ち！</h3><p class="note">Liella!は期限までに草原を抜けられず、旅をあきらめました。<br>（${S.fights.length}戦のうち${G.fight}戦を突破されただけ・撃退${G.history.filter(x => !x.win).length}回）</p><button class="btn" id="btn-restart">はじめから遊ぶ</button>`;
    $('btn-restart').onclick = () => { if (confirm('はじめからにしますか？')) startNew(); };
  } else if (G.cleared) {
    card.innerHTML = `<h3 class="lose">魔王${esc(G.pname || '')}軍の負け……草原を突破された</h3><p class="note">Liella!は${G.day - 1}日目に草原のボスを倒しました。（次のステージは、これから作ります）<br>撃退した回数：${G.history.filter(x => !x.win).length}回</p><button class="btn" id="btn-restart">はじめから遊ぶ</button>`;
    $('btn-restart').onclick = () => { if (confirm('はじめからにしますか？')) startNew(); };
  } else if (G.phase === 'free') {
    card.innerHTML = `<div class="label">自由行動（${G.day - 1}日目の夜）</div><p class="note">Liella!は町で過ごしている。魔王も1つだけ動ける。</p><button class="btn make" id="btn-free">自由行動へ</button>`;
    $('btn-free').onclick = () => openFree();
  } else {
    const tries = G.tries[`${G.stage}-${G.fight}`] || 0;
    const d = G.next;
    card.innerHTML = `<div class="label">${f.boss ? 'ボス戦' : `${G.fight + 1}戦目`}　使える魔力 ${f.budget}${tries ? `　（${tries}回撃退）` : ''}</div>
      <div class="next-row"><div class="mini">${d ? monsterSVG(d, { size: 104 }) : '<span class="note">まだ<br>いない</span>'}</div>
      <div class="info">${d ? `<b>${esc(d.name)}</b><br>${E.lookName(d)}<br>魔力 ${E.costOf(d)} / ${f.budget}${tries ? '<br><span class="note">撃退されたLiella!が、作戦を変えて戻ってきます。増えた魔力で強くしておきましょう。</span>' : ''}` : '<span class="note">向かってくるLiella!を迎え撃つモンスターを作りましょう。</span>'}</div></div>
      ${d ? '<div class="btn-row"><button class="btn" id="btn-edit">直す</button><button class="btn primary" id="btn-go">迎え撃つ</button></div>'
        : '<button class="btn make" id="btn-edit">モンスターを作る</button>'}`;
    $('btn-edit').onclick = () => editor();
    if (d) $('btn-go').onclick = () => fight();
  }
  for (const b of document.querySelectorAll('.tabs button')) { b.classList.toggle('on', b.dataset.tab === tab); b.onclick = () => { tab = b.dataset.tab; hub(); }; }
  for (const t of ['party', 'book', 'log', 'maou']) $('tab-' + t).hidden = t !== tab;
  if (tab === 'maou') renderMaou();
  if (tab === 'party') renderParty();
  if (tab === 'book') renderBook();
  if (tab === 'log') renderLog();
}
$('hub-title').onclick = () => title();

function tiredDots(n) { return `<span class="tired">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`; }
// ---------------- パーティーの見方（カード・一覧表・攻撃ごと） ----------------
// 得意＝得意度6以上。休み（ケガ）の子は数えない
const GOOD = 6;
const SKILLS = [['heal', '回復'], ['song', '歌'], ['guard', '盾'], ['scan', '分析']];
const ACOLS = [...WEAPONS.map(k => [k, WEAPON[k].name, 'w']), ...ELEMS.map(k => [k, ELEM[k].name, 'e']), ...SKILLS.map(([k, n]) => [k, n, 's'])];
const baseApt = (id, k) => { const C = CHARS[id]; return WEAPON[k] ? C.w[k] : ELEM[k] ? C.e[k] : C.s[k] || 0; };
// 魔王が知っていること：偵察した子は全部、戦いで見た子は使った攻撃・技だけ。能力（力など）は偵察か2回以上見たら
const knowK = (id, k) => !!(G.scout?.[id] || G.seen?.[id]?.[k]);
const knowSt = id => !!(G.scout?.[id] || (G.seen?.[id]?._n || 0) >= 2);
const seenAny = id => !!(G.scout?.[id] || G.seen?.[id]?._n);
// その攻撃が得意な子（休みを除く・分かっている範囲）。主力＝3人以上、手薄＝ほぼ全員分かっていて1人以下
function keyInfo(k) {
  const av = E.available(G);
  const list = av.filter(id => knowK(id, k)).map(id => ({ id, a: E.apt(G, id, k) })).sort((a, b) => b.a - a.a);
  const good = list.filter(x => x.a >= GOOD);
  const unk = av.length - list.length;
  return { list, good, unk, tag: good.length >= 3 ? 'main' : good.length <= 1 && unk <= av.length * 0.4 ? 'thin' : '' };
}
const TAG = { main: '主力', thin: '手薄' };
const goodText = x => `得意${x.good.length}人${x.unk ? '＋？' : ''}`;
let psort = null;
function partyView(el, inSheet) {
  const v = set.pview2 || 'glance';
  const tabs = inSheet ? [['glance', 'ひと目'], ['table', '一覧表'], ['keys', '攻撃ごと']] : [['glance', 'ひと目'], ['card', 'カード'], ['table', '一覧表'], ['keys', '攻撃ごと']];
  const vv = inSheet && v === 'card' ? 'glance' : v;
  let html = `<div class="seg pview">${tabs.map(([k, n]) => `<button data-v="${k}" class="${vv === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  if (vv === 'card') {
    html += `<div class="pgrid">${IDS.map(id => { const P = G.party[id], C = CHARS[id]; return `<div class="pc" data-id="${id}" style="--c:${C.color}">${P.hurt ? '<span class="tag">ケガ</span>' : !seenAny(id) ? '<span class="tag unk">未確認</span>' : ''}<img src="${face(id)}" alt=""><div class="nm">${C.name}</div><div class="lv">Lv${P.lv} ${tiredDots(P.tired)}</div><div class="hpb"><i style="width:${(P.hpR ?? 1) * 100}%"></i></div><div class="role">${C.role}</div></div>`; }).join('')}</div>
      <p class="note">タップでくわしく。緑の線は体力（休むまで戻らない）、オレンジの点は疲れ。「未確認」はまだ戦いで見ていない子。</p>`;
  } else if (vv === 'table') html += partyTable();
  else if (vv === 'keys') html += keyList();
  else html += glance();
  el.innerHTML = html;
  for (const b of el.querySelectorAll('.pview button')) b.onclick = () => { set.pview2 = b.dataset.v; save(); partyView(el, inSheet); };
  for (const c of el.querySelectorAll('[data-id]')) c.onclick = () => charSheet(c.dataset.id, inSheet ? () => openParty() : null);
  for (const th of el.querySelectorAll('th[data-k]')) th.onclick = () => { psort = psort === th.dataset.k ? null : th.dataset.k; partyView(el, inSheet); };
  if (vv === 'table' && el.dataset.sx) el.querySelector('.ptable-wrap').scrollLeft = +el.dataset.sx;
  const w = el.querySelector('.ptable-wrap'); if (w) w.onscroll = () => { el.dataset.sx = w.scrollLeft; };
}
// ひと目でわかる：要注意の攻撃・物理と魔法の割合・手薄・要注意の子・1人ずつの上位3つ（分かっている範囲）
function glance() {
  const av = E.available(G);
  const KEYS10 = [...WEAPONS, ...ELEMS];
  const score = k => av.filter(id => knowK(id, k)).reduce((a, id) => a + Math.pow(Math.max(0, E.apt(G, id, k) - 3), 1.4), 0);
  const sc = KEYS10.map(k => ({ k, v: score(k) })).sort((a, b) => b.v - a.v);
  const tot = sc.reduce((a, x) => a + x.v, 0) || 1;
  const phys = sc.filter(x => WEAPON[x.k]).reduce((a, x) => a + x.v, 0) / tot;
  const known = IDS.reduce((a, id) => a + ACOLS.filter(([k]) => knowK(id, k)).length, 0), all = IDS.length * ACOLS.length;
  const face2 = id => `<img src="${face(id)}" alt="">`;
  const top3 = sc.filter(x => x.v > 0).slice(0, 3).map((x, i) => { const inf = keyInfo(x.k); return `<div class="gl-row"><span class="rank">${i + 1}</span><b>${keyName(x.k)}</b><span class="pct">${Math.round(x.v / tot * 100)}%</span><span class="faces">${inf.list.slice(0, 3).map(y => `<span class="kp hi" data-id="${y.id}">${face2(y.id)}${y.a}</span>`).join('')}</span></div>`; }).join('');
  const thin = KEYS10.map(k => ({ k, x: keyInfo(k) })).filter(o => o.x.tag === 'thin').map(o => keyName(o.k));
  const role = (k, min, label, tip) => {
    const c = av.filter(id => knowK(id, k) && E.apt(G, id, k) >= min).sort((a, b) => E.apt(G, b, k) - E.apt(G, a, k))[0];
    return `<div class="gl-who">${c ? `<span class="kp hi" data-id="${c}">${face2(c)}${CHARS[c].name}</span>` : '<span class="kp">？</span>'}<span><b>${label}</b><small>${tip}</small></span></div>`;
  };
  const atk = av.map(id => ({ id, v: Math.max(...KEYS10.filter(k => knowK(id, k)).map(k => E.apt(G, id, k)), 0) })).sort((a, b) => b.v - a.v)[0];
  const rows = IDS.map(id => {
    const P = G.party[id], C = CHARS[id];
    const ks = ACOLS.filter(([k]) => knowK(id, k)).map(([k]) => ({ k, a: E.apt(G, id, k) })).sort((a, b) => b.a - a.a).slice(0, 3);
    return `<div class="gl-mem ${P.hurt ? 'off' : ''}" data-id="${id}" style="--c:${C.color}">${face2(id)}<div class="nm">${C.name}<small>Lv${P.lv}${P.hurt ? '・ケガ' : P.tired ? `・疲れ${P.tired}` : ''}</small><div class="hpb"><i style="width:${(P.hpR ?? 1) * 100}%"></i></div></div><div class="tops">${ks.map(x => `<span class="t ${x.a >= GOOD ? 'hi' : ''}">${keyName(x.k)}<b>${x.a}</b></span>`).join('')}${ks.length < 3 ? '<span class="t unk">？</span>'.repeat(3 - ks.length) : ''}</div></div>`;
  }).join('');
  const unseen = IDS.filter(id => !seenAny(id));
  return `<div class="gl"><div class="gl-box"><div class="gl-h">要注意の攻撃</div>${top3 || '<p class="note">まだ何もわかっていない。戦うか偵察すると見えてくる。</p>'}</div>
    <div class="gl-box"><div class="gl-h">物理と魔法</div><div class="pm-bar"><i style="width:${Math.round(phys * 100)}%"></i></div><div class="pm-lbl"><span>物理 ${Math.round(phys * 100)}%</span><span>魔法 ${100 - Math.round(phys * 100)}%</span></div></div>
    <div class="gl-box"><div class="gl-h">手薄（弱点にしても突かれにくい）</div><div>${thin.length ? thin.join('・') : '<span class="note">まだはっきりしない</span>'}</div></div>
    <div class="gl-box"><div class="gl-h">要注意の子</div>
      <div class="gl-who">${atk && atk.v ? `<span class="kp hi" data-id="${atk.id}">${face2(atk.id)}${CHARS[atk.id].name}</span>` : '<span class="kp">？</span>'}<span><b>アタッカー</b><small>いちばん得意の高い攻め手</small></span></div>
      ${role('heal', 5, '回復役', '「回復役を狙え」「見破り」でねらえる')}${role('guard', 6, '盾役', '「貫通」で盾を無視できる')}${role('scan', 6, '分析役', '控えにいると弱点がばれやすい')}</div>
    <div class="gl-box"><div class="gl-h">1人ずつ（得意の上位3つ）</div>${rows}</div>
    <p class="note">わかっている得意：${known}/${all}${unseen.length ? `　まだ見ていない子：${unseen.map(id => CHARS[id].name).join('・')}` : ''}。戦いで使った攻撃や技はわかる。全部知るには自由行動で「偵察」。</p></div>`;
}
function partyTable() {
  const st = Object.fromEntries(IDS.map(id => [id, E.charStats(G, id)]));
  const val = (id, k) => k === 'lv' ? G.party[id].lv : k === 'atk' ? (knowSt(id) ? st[id].atk : -1) : k === 'mag' ? (knowSt(id) ? st[id].mag : -1) : knowK(id, k) ? E.apt(G, id, k) : -1;
  let rows = IDS.slice();
  if (psort) rows.sort((a, b) => (G.party[a].hurt - G.party[b].hurt) || (val(b, psort) - val(a, psort)));
  const th = (k, n, cls = '') => `<th data-k="${k}" class="${cls} ${psort === k ? 'on' : ''}">${n}${psort === k ? '<i>▼</i>' : ''}</th>`;
  const head = `<tr><th class="nm">メンバー</th>${th('lv', 'Lv')}${th('atk', '力', 'g0')}${th('mag', '魔力')}${ACOLS.map(([k, n, g], i) => th(k, n, (i === 0 || i === 4 || i === 10 ? 'g0 ' : '') + (g === 'e' ? 'el' : ''))).join('')}</tr>`;
  const body = rows.map(id => {
    const P = G.party[id], C = CHARS[id], ks = knowSt(id);
    return `<tr data-id="${id}" class="${P.hurt ? 'off' : ''}"><th class="nm" style="--c:${C.color}"><img src="${face(id)}" alt=""><span class="${C.name.length >= 5 ? 'long' : ''}">${C.name}${P.hurt ? '<em>休み</em>' : P.tired ? `<em class="t">疲れ${P.tired}</em>` : ''}</span></th>
      <td>${P.lv}</td><td class="g0">${ks ? Math.round(st[id].atk) : '<span class="unk">？</span>'}</td><td>${ks ? Math.round(st[id].mag) : '<span class="unk">？</span>'}</td>
      ${ACOLS.map(([k], i) => { if (!knowK(id, k)) return `<td class="ap unk ${i === 0 || i === 4 || i === 10 ? 'g0' : ''}">？</td>`; const a = E.apt(G, id, k), up = a - baseApt(id, k); return `<td class="ap ${a >= GOOD ? 'hi' : ''} ${i === 0 || i === 4 || i === 10 ? 'g0' : ''}" style="--a:${Math.min(1, a / 10).toFixed(2)}">${a}${up > 0 ? `<sup>+${up}</sup>` : ''}</td>`; }).join('')}</tr>`;
  }).join('');
  const infos = ACOLS.map(([k]) => keyInfo(k));
  const sum1 = `<tr class="sum"><th class="nm">一番手</th><td colspan="3"></td>${infos.map((x, i) => `<td class="${i === 0 || i === 4 || i === 10 ? 'g0' : ''}">${x.list[0] ? `<img src="${face(x.list[0].id)}" alt="${CHARS[x.list[0].id].name}">` : '？'}</td>`).join('')}</tr>`;
  const sum2 = `<tr class="sum"><th class="nm">得意な子</th><td colspan="3"></td>${infos.map((x, i) => `<td class="${x.tag} ${i === 0 || i === 4 || i === 10 ? 'g0' : ''}">${x.good.length}${x.unk ? '+' : ''}${x.tag ? `<small>${TAG[x.tag]}</small>` : ''}</td>`).join('')}</tr>`;
  return `<div class="ptable-wrap"><table class="ptable"><thead>${head}</thead><tbody>${body}${sum1}${sum2}</tbody></table></div>
    <p class="note">数字は得意度（<b class="hi-t">6以上</b>を「得意」）。<sup>+1</sup>は育ったぶん。「？」はまだ見ていないところ（戦いで使うか、偵察するとわかる）。表は横にすべらせて見られます。見出しをタップで並べかえ、名前をタップでくわしく。<br><span class="main-t">主力</span>＝得意な子が3人以上、<span class="thin-t">手薄</span>＝ほぼ全員わかっていて1人以下。「+」はまだわからない子がいる印。休みの子は数えません。</p>`;
}
function keyList() {
  const items = ACOLS.map(([k, n, g]) => {
    const x = keyInfo(k);
    const top = x.list.slice(0, 3).map(y => `<span class="kp ${y.a >= GOOD ? 'hi' : ''}" data-id="${y.id}"><img src="${face(y.id)}" alt="">${CHARS[y.id].name}<b>${y.a}</b></span>`).join('') || '<span class="note">まだわからない</span>';
    return `<div class="krow ${x.tag}"><div class="kn">${g === 'e' ? `<span class="sw" style="background:${ELEM[k].color}"></span>` : ''}${n}${g === 'e' ? '魔法' : ''}<small>${goodText(x)}</small>${x.tag ? `<em class="tg">${TAG[x.tag]}</em>` : ''}</div><div class="kt">${top}</div></div>`;
  });
  const group = (t, a, b) => `<h4 class="kh">${t}</h4>${items.slice(a, b).join('')}`;
  return group('武器', 0, 4) + group('魔法', 4, 10) + group('そのほか', 10, 14) + `<p class="note">わかっている中での上位3人（休みの子を除く）。「＋？」はまだわからない子がいる印です。</p>`;
}
function renderParty() { partyView($('tab-party'), false); }
// 下から出す一覧（モンスター作りの画面からも開ける）
function openParty() {
  openSheet('<h3 style="margin:0 0 8px">パーティーの得意</h3><div id="party-sheet"></div>');
  partyView($('party-sheet'), true);
}
function charSheet(id, back) {
  const C = CHARS[id], P = G.party[id], st = E.charStats(G, id);
  const bar = (label, k) => { if (!knowK(id, k)) return `<div>${label}</div><div class="b"></div><div class="unk">？</div>`; const base = baseApt(id, k); const a = E.apt(G, id, k); return `<div>${label}</div><div class="b"><i style="width:${Math.min(100, a * 10)}%"></i></div><div>${a}${a > base ? `<small style="color:var(--gold)">↑</small>` : ''}</div>`; };
  const PN = { careful: '慎重', rash: '無鉄砲', curious: '試したがり', pride: '得意技へのこだわり', logic: '理屈で考える', bold: '出たがり', kind: '仲間思い' };
  const sc = G.scout?.[id];
  const picks = sc && P.picks?.length ? (() => { const c = {}; for (const k of P.picks) c[k] = (c[k] || 0) + 1; return Object.entries(c).map(([k, n]) => `${keyName(k)}+${n}${bApt(id, k) <= 3 ? '（意外）' : ''}`).join('・'); })() : '';
  openSheet(`<div class="det-head" style="--c:${C.color}"><img src="${face(id)}" alt=""><div><b style="font-size:18px">${C.name}</b><div class="note">${C.role}<br>Lv${P.lv}　疲れ ${tiredDots(P.tired)}${P.hurt ? '　<span class="lose">ケガで休み</span>' : ''}　体力${Math.round((P.hpR ?? 1) * 100)}%</div></div></div>
    <div class="note">装備：${charGear(id).join('・')}（はじめから持っている）${sc ? '　<span class="win">偵察ずみ</span>' : ''}</div>
    <div class="note">${knowSt(id) ? `体力${st.maxHp}・力${Math.round(st.atk)}・魔力${Math.round(st.mag)}・守り${Math.round(st.def)}・魔法の守り${Math.round(st.mdef)}・素早さ${Math.round(st.spd)}` : '能力：？（2回以上戦うか、偵察するとわかる）'}</div>
    ${picks ? `<div class="note">今回の育ち方：${picks}${P.pts ? `　鍛えるポイント残り${P.pts}` : ''}</div>` : ''}
    <h4>武器の得意度（↑は育ったぶん、？はまだ見ていない）</h4><div class="bars">${WEAPONS.map(k => bar(WEAPON[k].name, k)).join('')}</div>
    <h4>属性の得意度</h4><div class="bars">${ELEMS.map(k => bar(ELEM[k].name, k)).join('')}</div>
    <h4>そのほか</h4><div class="bars">${[['回復', 'heal'], ['歌', 'song'], ['盾', 'guard'], ['分析', 'scan']].map(([l, k]) => bar(l, k)).join('')}</div>
    <h4>性格</h4><div class="bars">${Object.entries(C.p).map(([k, v]) => `<div>${PN[k]}</div><div class="b"><i class="m" style="width:${v * 10}%"></i></div><div>${v}</div>`).join('')}</div>${back ? '<button class="btn small ghost" id="sheet-back">‹ 一覧にもどる</button>' : ''}`);
  if (back) $('sheet-back').onclick = back;
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
  document.querySelector('#editor .scroll').scrollTop = 0;
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
  $('ed-party').onclick = $('ed-party2').onclick = () => openParty();
  $('ed-random').onclick = () => { D = randomDesign(f.budget, ''); nameAuto = true; edRender(true); };
  randUI();
  $('ed-rand').onclick = () => { D = fullRandom(f.budget, set.rn ?? -1); nameAuto = true; edRender(true); toast('ランダムで作りました'); };
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
    $('ed-res').innerHTML = KEYS.map(k => { const x = keyInfo(k); return sliderRow(`${keyName(k)}<small class="kc ${x.tag}">${goodText(x)}${x.tag ? '・' + TAG[x.tag] : ''}</small>`, -3, 3, D.res[k] || 0, `rv-${k}`); }).join('');
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
// 完全ランダム：形・属性・能力の振り分け・効き目・特性をすべてランダムに。n＝特性の数（-1ならおまかせ）。魔力はほぼ使い切る
function randUI() {
  const v = set.rn ?? -1;
  $('ed-rn').innerHTML = [[-1, 'おまかせ'], [0, '0'], [1, '1'], [2, '2'], [3, '3']].map(([k, n]) => `<button data-v="${k}" class="${v === k ? 'on' : ''}">${n}</button>`).join('');
  for (const b of $('ed-rn').children) b.onclick = () => { set.rn = +b.dataset.v; save(); randUI(); };
}
function fullRandom(budget, n) {
  const R = Math.random, pick = a => a[Math.floor(R() * a.length)];
  const d = E.blankDesign();
  d.name = ''; d.shape = pick(Object.keys(SHAPES)); d.elem = pick(ELEMS);
  for (const s of STATS) d.stats[s] = 0;
  const tr = Object.keys(TRAITS).sort(() => R() - 0.5);
  const cnt = n >= 0 ? n : Math.floor(R() * 3);
  d.traits = tr.slice(0, cnt);
  // 特性が高すぎるときは、安いものに入れかえる
  while (E.costOf(d) > budget * 0.6 && d.traits.length) d.traits.pop();
  for (const k of KEYS) if (R() < 0.3) d.res[k] = Math.floor(R() * 7) - 3 || 0;
  for (const k of KEYS) if (!d.res[k]) delete d.res[k];
  while (E.costOf(d) > budget * 0.8) { const ks = Object.keys(d.res).filter(k => d.res[k] > 0); if (!ks.length) break; delete d.res[pick(ks)]; }
  // 残りの魔力を能力にランダムに振る
  for (let i = 0; i < 400 && E.costOf(d) < budget; i++) {
    const s = pick(STATS);
    if (d.stats[s] >= 15) continue;
    d.stats[s]++;
    if (E.costOf(d) > budget) { d.stats[s]--; break; }
  }
  d.name = E.autoName(d);
  return d;
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
  $('sc-paused').hidden = true; $('sc-pause').textContent = 'Ⅱ'; $('sc-pause').hidden = false;
  speedUI();
  $('sc-mstat').innerHTML = ''; $('sc-cmd').hidden = false;
  if (!G.history.length && !G.talked) {
    G.talked = true;
    for (const e of [{ t: 'narr', text: '― 育成会議 ―', cls: 'round' }, ...E.trainingTalk(G)]) addEv(e);
  }
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
  const before = { power: G.power || 0, budget: E.currentFight(G).budget, days: E.daysLeft(G), lv: Object.fromEntries(IDS.map(id => [id, G.party[id].lv])) };
  const M = E.meeting(G, d, ai);
  play = { evs: [...M.ev], i: 0, timer: null, done: false, computing: true, idle: false, fast: false, cmdQ: [], lastS: null, d, gateRes: null };
  cmdBar();
  step();
  const onEvent = e => { if (!play) return; play.evs.push(e); if (play.idle && !play.paused) { play.idle = false; step(); } };
  const hooks = {
    onEvent, ...AI.battleHooks(),
    // 号令：画面が追いつくまで次のターンを計算しない（その間に号令を出せる）。飛ばしたときはおまかせ号令
    gate: () => new Promise(res => { if (!play) return res(); play.gateRes = res; checkGate(); }),
    takeCmds: () => { if (!play) return []; const q = play.cmdQ; play.cmdQ = []; cmdBar(); return q; },
    get auto() { return !play || play.fast; },
  };
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
  if (!G.cleared && !G.maouWin) { G.phase = 'free'; save(); }
  play.result = { win: res.win, before, after: G.cleared || G.maouWin ? null : { power: G.power || 0, budget: E.currentFight(G).budget, days: E.daysLeft(G) }, ups: IDS.filter(id => G.party[id].lv > before.lv[id]), end: G.maouWin ? 'maou' : G.cleared ? 'clear' : null, team: res.team };
  play.computing = false;
  if (play.idle) { play.idle = false; step(); }
}
function delayOf(e) {
  const base = { say: 1700, think: 1250, narr: 1000, round: 450, hit: 850, miss: 800, mon: 950, team: 1100, start: 1000, down: 1100, win: 1600, lose: 1600, lvup: 1200, heal: 850, buff: 850, scan: 900, swap: 1000, hurt: 900, aiwait: 500 }[e.t] || 900;
  return play?.fast ? 0 : base * set.speed;
}
function step() {
  if (!play) return;
  if (play.paused) { play.waiting = true; return; }
  if (play.i >= play.evs.length) { if (play.computing) { play.idle = true; checkGate(); return; } return finish(); }
  const e = play.evs[play.i++];
  render(e, !play.fast);
  if (play.fast) { $('sc-log').scrollTop = $('sc-log').scrollHeight; return step(); }
  play.timer = setTimeout(step, delayOf(e));
}
// 画面が出来事に追いついたら、次のターンの計算を始めてよい
function checkGate() {
  if (!play?.gateRes) return;
  if (play.fast || (!play.paused && play.i >= play.evs.length)) { const r = play.gateRes; play.gateRes = null; r(); }
}
function finish() {
  if (!play || play.done) return;
  $('sc-cmd').hidden = true;
  play.done = true; clearTimeout(play.timer);
  $('sc-skip').hidden = true; $('sc-done').hidden = false;
  $('sc-pause').hidden = true; $('sc-paused').hidden = true; $('sc-cmd').hidden = true;
  $('sc-cut').classList.remove('on');
  $('sc-log').scrollTop = $('sc-log').scrollHeight;
  if (play.result) setTimeout(() => showResult(play?.result), play.fast ? 150 : 700);
}
// 戦いのあとのまとめ（魔力・期限・レベルアップ）
function showResult(r) {
  if (!r) return;
  sheetClosed = null;
  const nm = esc(G.pname || '');
  let head, cls;
  if (r.end === 'maou') { head = `魔王${nm}軍の勝ち！`; cls = 'win'; }
  else if (r.end === 'clear') { head = `魔王${nm}軍の負け……`; cls = 'lose'; }
  else if (r.win) { head = '突破された……'; cls = 'lose'; }
  else { head = '撃退！'; cls = 'win'; }
  let body = '';
  if (r.after) {
    const dp = r.after.power - r.before.power, dd = r.after.days - r.before.days;
    body += `<div class="rs-row"><span>魔王の力</span><b>+${r.before.power} → <em>+${r.after.power}</em></b><small class="win">+${dp}</small></div>`;
    body += `<div class="rs-row"><span>使える魔力</span><b>${r.win ? `次の敵は <em>${r.after.budget}</em>` : `${r.before.budget} → <em>${r.after.budget}</em>`}</b><small></small></div>`;
    body += `<div class="rs-row"><span>期限</span><b>あと${r.before.days}日 → <em>あと${r.after.days}日</em></b><small class="${dd >= 0 ? 'win' : 'lose'}">${dd >= 0 ? '+' + dd : dd}日</small></div>`;
    if (r.win) body += `<p class="note">次の戦いへ。突破されたぶん、期限が延びた。</p>`;
    else if (r.after.days <= 2) body += `<p class="note">期限まであと少し。ここをしのげば魔王の勝ち！</p>`;
  } else if (r.end === 'maou') body += `<p class="note">Liella!は期限までに草原を抜けられなかった。</p>`;
  else body += `<p class="note">Liella!は草原のボスを倒した。</p>`;
  if (r.ups.length) body += `<div class="rs-ups"><div class="label">レベルアップ（Liella!）</div>${r.ups.map(id => `<span class="kp hi"><img src="${face(id)}" alt="">${CHARS[id].name}<b>Lv${G.party[id].lv}</b></span>`).join('')}</div>`;
  if (r.end && G.pname) {
    const sp = r.team[Math.floor(Math.random() * r.team.length)];
    const ln = say(sp, r.end === 'maou' ? 'end_lose' : 'end_clear', { p: G.pname });
    body += `<div class="ev say" style="--c:${CHARS[sp].color}"><img src="${face(sp)}" alt=""><div class="bub"><div class="who">${CHARS[sp].name}</div>${esc(ln.text)}</div></div>`;
  }
  const next = G.phase === 'free';
  openSheet(`<div class="result"><h3 class="${cls}">${head}</h3>${body}<div class="btn-row"><button class="btn ghost" id="rs-log">記録を見る</button><button class="btn primary" id="rs-hub">${next ? '自由行動へ' : '玉座へ戻る'}</button></div></div>`);
  $('rs-log').onclick = () => { $('sheet').hidden = true; };
  $('rs-hub').onclick = () => { $('sheet').hidden = true; play = null; hub(); if (next) openFree(); };
}
// 最後まで：AIを待っている間も、届いたものから一気に出す
$('sc-skip').onclick = () => {
  if (!play) return;
  clearTimeout(play.timer);
  play.fast = true;
  checkGate();
  if (play.paused) { setPause(false); return; }
  if (!play.idle) step();
};
$('sc-done').onclick = () => { play = null; hub(); };
// 一時停止：止めている間は次の出来事を出さない（計算は裏で進む）
function setPause(on) {
  if (!play || play.done) on = false;
  if (play) {
    play.paused = on;
    if (on) clearTimeout(play.timer);
    else {
      play.waiting = false;
      // 止めている間に届いた出来事があれば続きから。計算待ちならそのまま待つ
      if (play.i < play.evs.length || !play.computing) { play.idle = false; step(); }
      else { play.idle = true; checkGate(); }
    }
  }
  if (!on) checkGate();
  $('sc-pause').textContent = on ? '▶' : 'Ⅱ';
  $('sc-pause').setAttribute('aria-label', on ? '再開' : '一時停止');
  $('sc-paused').hidden = !on;
}
$('sc-pause').onclick = () => setPause(!play?.paused);
// 戦闘中のメニュー（開いている間は止める）
$('sc-menu').onclick = () => {
  const was = !!play?.paused;
  setPause(true);
  openSheet(`<h3 style="margin:0 0 12px">メニュー</h3>
    <button class="btn" id="mn-resume">戦いにもどる</button>
    <button class="btn ghost" id="mn-party">パーティーの得意</button>
    <button class="btn ghost" id="mn-help">遊び方</button>`);
  const back = () => { $('sheet').hidden = true; sheetClosed = null; setPause(was); };
  sheetClosed = () => setPause(was);
  $('mn-resume').onclick = back;
  $('mn-party').onclick = () => { openParty(); sheetClosed = () => setPause(was); };
  $('mn-help').onclick = () => { openSheet(HELP); sheetClosed = () => setPause(was); };
};
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
    const cls = e.cls || ({ round: 'round', mon: 'mon', hurt: 'mon', down: 'mon', team: 'team', lvup: 'lvup', hit: 'hit', cmd: 'cmd' }[e.t] || 'narr');
    const txt = e.t === 'hit' ? esc(e.text).replace(/(\d+)のダメージ/, '<span class="d">$1</span>のダメージ') : esc(e.text);
    el = h('div', { class: 'ev ' + cls }, txt);
  }
  log.appendChild(el);
  if (stick) log.scrollTop = log.scrollHeight;
  return el;
}
// ---------------- 自由行動 ----------------
// 魔王の行動を1つ選ぶ → Liella!の行動と合わせて結果を見せる
function openFree() {
  if (G.phase !== 'free') return;
  const L = learnable(G);
  const acts = [['learn', L.length > 0], ['power', true], ['scout', true], ['assassin', true]];
  openSheet(`<h3 style="margin:0 0 4px">自由行動（${G.day - 1}日目の夜）</h3><p class="note">Liella!は町で過ごしている（休む・鍛える・情報集め）。魔王は1つだけ動ける。</p>
    <div class="act-list">${acts.map(([k, ok]) => `<button class="act-opt" data-k="${k}" ${ok ? '' : 'disabled'}><b>${MAOU_ACTS[k].name}</b><small>${ok ? MAOU_ACTS[k].desc : 'もう覚えられる号令がない'}</small></button>`).join('')}</div>
    <div id="act-sub"></div>`);
  for (const b of document.querySelectorAll('.act-opt')) b.onclick = () => {
    for (const x of document.querySelectorAll('.act-opt')) x.classList.toggle('on', x === b);
    freeSub(b.dataset.k, L);
  };
}
function freeSub(k, L) {
  const sub = $('act-sub');
  const go = act => { const r = freePhase(G, act); save(); freeResult(r); };
  if (k === 'power') { sub.innerHTML = `<button class="btn primary" id="act-ok">力をためる</button>`; $('act-ok').onclick = () => go({ type: 'power' }); return; }
  if (k === 'learn') {
    const byLine = {};
    for (const c of L) (byLine[CMDS[c].line] ||= []).push(c);
    sub.innerHTML = `<div class="label" style="margin-top:10px">どの号令を覚える？</div>${Object.entries(byLine).map(([ln, cs]) => `<div class="kh">${CMD_LINE[ln]}</div>${cs.map(c => `<button class="cmd-opt learn" data-c="${c}"><b>${CMDS[c].name}</b>${CMDS[c].cost ? `<span class="cpips">${'<i></i>'.repeat(CMDS[c].cost)}</span>` : '<span class="note">いつでも効く</span>'}<small>${CMDS[c].desc}</small></button>`).join('')}`).join('')}`;
    for (const b of sub.querySelectorAll('.cmd-opt')) b.onclick = () => go({ type: 'learn', cmd: b.dataset.c });
    return;
  }
  const n = k === 'scout' ? 2 : 1, picked = [];
  sub.innerHTML = `<div class="label" style="margin-top:10px">${k === 'scout' ? '偵察する2人を選ぶ' : '刺客を送る相手を選ぶ'}</div>
    <div class="pick-row wide">${IDS.map(id => { const P = G.party[id]; return `<button class="pick" data-id="${id}" style="--c:${CHARS[id].color}"><img src="${face(id)}" alt="">${CHARS[id].name}<small>${G.scout[id] ? '偵察ずみ' : P.hurt ? 'ケガ' : `体力${Math.round((P.hpR ?? 1) * 100)}%`}</small></button>`; }).join('')}</div>
    <button class="btn primary" id="act-ok" disabled>${k === 'scout' ? '偵察する' : '刺客を送る'}</button>`;
  for (const b of sub.querySelectorAll('.pick')) b.onclick = () => {
    const id = b.dataset.id, i = picked.indexOf(id);
    if (i >= 0) picked.splice(i, 1); else { picked.push(id); if (picked.length > n) picked.shift(); }
    for (const x of sub.querySelectorAll('.pick')) x.classList.toggle('on', picked.includes(x.dataset.id));
    $('act-ok').disabled = picked.length !== n;
  };
  $('act-ok').onclick = () => go(k === 'scout' ? { type: 'scout', ids: picked.slice() } : { type: 'assassin', id: picked[0] });
}
// 同じ過ごし方をまとめて見せる（偵察した子・情報集めは1人ずつ）
function freeGroups(rows) {
  const solo = [], grp = {};
  for (const o of rows) {
    if (G.scout[o.id] || o.act === 'info') solo.push(o);
    else (grp[o.act] ||= []).push(o.id);
  }
  const GN = { rest: '休んだ（体力・ケガ・疲れが回復）', train: '鍛えた（中身は見えなかった）', drill: '自主練をした' };
  return Object.entries(grp).map(([a, ids]) => `<div class="free-grp"><div class="fg-h">${GN[a]}</div><div class="fg-faces">${ids.map(id => `<span class="kp" style="--c:${CHARS[id].color}"><img src="${face(id)}" alt="">${CHARS[id].name}</span>`).join('')}</div></div>`).join('')
    + solo.map(o => `<div class="free-row" style="--c:${CHARS[o.id].color}"><img src="${face(o.id)}" alt=""><b>${CHARS[o.id].name}</b><span>${esc(rowText(G, o))}</span></div>`).join('');
}
function freeResult(r) {
  openSheet(`<h3 style="margin:0 0 8px">夜が明けた</h3>
    <div class="free-maou">${esc(r.maou)}</div>
    <div class="label" style="margin-top:12px">Liella!の過ごし方</div>
    <div class="free-rows">${freeGroups(r.rows)}</div>
    <p class="note">鍛えた中身は、偵察した子だけ見えます。</p>
    <button class="btn primary" id="free-ok">玉座へ戻る</button>`);
  $('free-ok').onclick = () => { $('sheet').hidden = true; hub(); };
  hub();
}
// 魔王タブ：覚えた号令と、これから覚えられる号令
function renderMaou() {
  const has = new Set(G.maou.cmds);
  const row = c => `<div class="mrow ${has.has(c) ? 'on' : ''}"><b>${CMDS[c].name}</b>${CMDS[c].cost != null ? `<span class="cpips">${'<i></i>'.repeat(CMDS[c].cost)}</span>` : '<span class="note">いつでも効く</span>'}<small>${CMDS[c].desc}${!has.has(c) && CMDS[c].req && !has.has(CMDS[c].req) ? `（先に「${CMDS[CMDS[c].req].name}」）` : ''}</small></div>`;
  const lines = {};
  for (const c of Object.keys(CMDS)) (lines[CMDS[c].line] ||= []).push(c);
  $('tab-maou').innerHTML = `<div class="card"><b>魔王${esc(G.pname || '')}軍</b><div class="note">力 +${G.power || 0}（戦うたび・「力をためる」で増える）／偵察ずみ：${IDS.filter(id => G.scout[id]).map(id => CHARS[id].name).join('・') || 'なし'}</div></div>
    <h4 class="kh">号令（明るいものが使える）</h4>${Object.entries(lines).map(([ln, cs]) => `<div class="kh small">${CMD_LINE[ln]}</div>${cs.map(row).join('')}`).join('')}
    <p class="note">号令ゲージは戦いの始めに${2 + (has.has('g_start') ? 1 : 0)}、毎ターン1ずつたまり（大きく削られると+1）、最大${5 + (has.has('g_max') ? 1 : 0)}。</p>`;
}

// ---------------- 状態アイコン・号令 ----------------
function memberIcons(s, id) {
  const out = [];
  if (s.taunt === id) out.push(icon('taunt', 'blue'));
  if (s.guardBy === id) out.push(icon('guard', 'blue'));
  if (s.buff) out.push(icon('song', 'gold'));
  if (s.poison?.[id]) out.push(icon('poison', 'purple'));
  if (s.scared?.[id]) out.push(icon('scared', 'red'));
  if (s.aim === 'pick' && s.aimId === id) out.push(icon('target', 'red'));
  return out.join('');
}
const AIM_TEXT = { weak: '弱った子', healer: '回復役' };
function monIcons(s) {
  const out = [];
  if (s.mst === 'atk') out.push(`<span class="chip red">${icon('sword')}攻め</span>`);
  if (s.mst === 'def') out.push(`<span class="chip blue">${icon('shield')}守り</span>`);
  if (s.aim && s.aim !== 'free') out.push(`<span class="chip red">${icon('target')}${s.aim === 'pick' ? CHARS[s.aimId]?.name || '' : AIM_TEXT[s.aim]}</span>`);
  if (s.charge) out.push(`<span class="chip gold">${icon('charge')}${s.charge === 2 ? 'ため完了' : 'ため'}</span>`);
  if (s.raged) out.push(`<span class="chip red">${icon('rage')}怒り</span>`);
  if (s.reflectN) out.push(`<span class="chip blue">${icon('reflect')}反射</span>`);
  if (s.flyN) out.push(`<span class="chip blue">${icon('fly')}上空</span>`);
  if (s.keenN) out.push(`<span class="chip gold">${icon('keen')}見破り</span>`);
  if (s.pierceNext) out.push(`<span class="chip gold">${icon('pierce')}貫通</span>`);
  $('sc-mstat').innerHTML = out.join('');
}
// 号令のゲージと予約（予約したぶんはゲージから引いて見せる）
const qCost = () => (play?.cmdQ || []).reduce((a, c) => a + (CMDS[c.id.split(':')[0]]?.cost || 0), 0);
function cmdBar() {
  if (!play) return;
  const s = play.lastS, g = s ? s.g : 2 + (G.maou.cmds.includes('g_start') ? 1 : 0), gm = s ? s.gmax : 5 + (G.maou.cmds.includes('g_max') ? 1 : 0);
  const left = g - qCost();
  $('sc-gauge').innerHTML = Array.from({ length: gm }, (_, i) => `<i class="${i < left ? 'on' : i < g ? 'rsv' : ''}"></i>`).join('');
  const q = play.cmdQ.map(c => cmdLabel(c)).join('・');
  $('sc-cmd-btn').textContent = q ? `予約：${q}` : '号令';
  $('sc-cmd-btn').classList.toggle('queued', !!q);
}
const cmdLabel = c => { const [cid, sub] = c.id.split(':'); return cid === 'trump' ? `切り札（${TRAITS[sub].name}）` : (c.target ? `${CHARS[c.target].name}を` : '') + (cid === 'aim_pick' ? '狙え' : cid === 'scare' ? '威嚇' : CMDS[cid].name); };
$('sc-cmd-btn').onclick = () => {
  if (!play || play.done) return;
  const was = !!play.paused;
  setPause(true);
  const s = play.lastS || {};
  const left = (s.g ?? 2) - qCost();
  const al = (s.team || []).filter(id => (s.hp?.[id] ?? 1) > 0);
  const d = play.d;
  const opts = [];
  for (const cid of G.maou.cmds) {
    const D = CMDS[cid]; if (!D || D.passive) continue;
    if (cid === 'trump') { for (const t of d.traits) opts.push({ id: 'trump:' + t, name: `切り札：${TRAITS[t].name}`, cost: D.cost, desc: TRUMP[t] }); continue; }
    const now = (cid === 'aim_free' && (s.aim || 'free') === 'free') || (cid === 'aim_weak' && s.aim === 'weak') || (cid === 'aim_healer' && s.aim === 'healer') || (cid === 'stance_atk' && s.mst === 'atk') || (cid === 'stance_def' && s.mst === 'def') || (cid === 'stance_norm' && (s.mst || 'normal') === 'normal') || (cid === 'charge' && s.charge);
    opts.push({ id: cid, name: D.name, cost: D.cost, desc: D.desc, target: D.target, now });
  }
  const pips = n => `<span class="cpips">${Array.from({ length: n }, () => '<i></i>').join('') || '<small>0</small>'}</span>`;
  openSheet(`<h3 style="margin:0 0 4px">号令</h3><p class="note">ゲージ ${left}（次のターンから効く）。${play.cmdQ.length ? `予約中：${play.cmdQ.map(cmdLabel).join('・')}` : ''}</p>
    <div class="cmd-list">${opts.map((o, i) => `<button class="cmd-opt" data-i="${i}" ${o.cost > left || o.now ? 'disabled' : ''}><b>${o.name}${o.now ? '<small>（いまこれ）</small>' : ''}</b>${pips(o.cost)}<small>${o.desc}</small></button>`).join('')}</div>
    <div id="cmd-target"></div>
    ${play.cmdQ.length ? '<button class="btn ghost small" id="cmd-clear" style="margin-top:8px">予約を取り消す</button>' : ''}
    <p class="note">号令を覚えるには、戦いのあとの自由行動で「号令を覚える」を選びます。</p>`);
  sheetClosed = () => setPause(was);
  const done = () => { cmdBar(); closeSheet(); };
  if ($('cmd-clear')) $('cmd-clear').onclick = () => { play.cmdQ = []; done(); };
  for (const b of document.querySelectorAll('.cmd-opt')) b.onclick = () => {
    const o = opts[+b.dataset.i];
    if (!o.target) { play.cmdQ.push({ id: o.id }); return done(); }
    $('cmd-target').innerHTML = `<div class="label" style="margin-top:10px">だれに？</div><div class="pick-row">${al.map(id => `<button class="pick" data-id="${id}" style="--c:${CHARS[id].color}"><img src="${face(id)}" alt="">${CHARS[id].name}</button>`).join('')}</div>`;
    for (const p of document.querySelectorAll('#cmd-target .pick')) p.onclick = () => { play.cmdQ.push({ id: o.id, target: p.dataset.id }); done(); };
  };
};
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
      party.innerHTML = s.team.map(id => `<div class="sp" id="sp-${id}" style="--c:${CHARS[id].color}"><div class="st"></div><img src="${face(id)}" alt=""><div>${CHARS[id].name}</div><div class="hp"><i></i></div></div>`).join('');
    }
    for (const id of s.team) {
      const el = $('sp-' + id); if (!el) continue;
      const r = (s.hp[id] ?? 0) / (s.max2[id] || 1);
      const bar = el.querySelector('.hp i'); bar.style.width = r * 100 + '%'; bar.classList.toggle('low', r < 0.3);
      el.classList.toggle('down', (s.hp[id] ?? 0) <= 0);
      const st = el.querySelector('.st');
      if (st) st.innerHTML = (s.hp[id] ?? 0) <= 0 ? '' : memberIcons(s, id);
    }
    play && (play.lastS = s);
    monIcons(s);
    cmdBar();
  }
  if (e.t === 'team' && !e.s) {
    const party = $('sc-party'); party.dataset.k = e.team.join(',');
    party.innerHTML = e.team.map(id => `<div class="sp" id="sp-${id}" style="--c:${CHARS[id].color}"><div class="st"></div><img src="${face(id)}" alt=""><div>${CHARS[id].name}</div><div class="hp"><i style="width:${(G.party[id].hpR ?? 1) * 100}%"></i></div></div>`).join('');
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
