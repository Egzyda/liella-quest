// リエラクエストの中身（画面なし・Node でも動く）
// 魔王（プレイヤー）が作ったモンスターに、Liella! 11人が作戦を立てて挑む。
// ・戦いはターン制。誰が何をするかは、性格と「図鑑」（これまでに見たこと）から決める
// ・図鑑には見たことだけが書かれる（会心の一撃を「弱点」と勘ちがいすることもある）
// ・負けたら町に戻って反省し、もう一度挑む
import { ELEMS, ELEM, FOLK_WEAK, WEAPONS, WEAPON, KEYS, keyName, STATS, STAT, RES_MULT, SHAPES, TRAITS, STAGES, MAOU_GROW, IDS, CHARS } from './data.js?v=2026.11.03-19';
import { say, nameOf } from './talk.js?v=2026.11.03-19';

export const rnd = { f: Math.random };
const R = () => rnd.f();
const pick = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => (R() + R() + R() - 1.5) / 1.5;

// ---------------- 新しい旅 ----------------
export function newGame() {
  const party = {};
  for (const id of IDS) party[id] = { lv: 1, exp: 0, mast: {}, tired: 0, hurt: 0 };
  return { v: 1, stage: 0, fight: 0, party, book: {}, designs: [], next: null, tries: {}, history: [], cleared: false, pname: '', day: 1, limit: STAGES[0].fights[0].days, power: 0, maouWin: false };
}

// ---------------- モンスター ----------------
export function blankDesign() {
  return { name: 'アクアスライム', shape: 'slime', elem: 'water', stats: { hp: 4, atk: 3, mag: 2, def: 3, mdef: 3, spd: 3 }, res: {}, traits: [] };
}
const RES_COST = { 1: 2, 2: 4, 3: 7 };
// 魔力（コスト）の計算：能力は1ポイント＝魔力1（どの能力も同じ値段・同じくらいの強さ）。弱点を作ると少し戻ってくる（最大9まで）
export function costOf(d) {
  let c = 0;
  for (const s of STATS) c += d.stats[s] || 0;
  let refund = 0;
  for (const k of KEYS) {
    const r = d.res[k] || 0;
    if (r > 0) c += RES_COST[r];
    else if (r < 0) refund += -r;
  }
  c -= Math.min(9, refund);
  for (const t of d.traits) c += TRAITS[t].cost;
  return Math.round(c * 10) / 10;
}
export const lookKey = d => `${d.shape}:${d.elem}`;
export const lookName = d => `${ELEM[d.elem].name}の${SHAPES[d.shape].name}`;
// どの能力も1ポイントで強さが同じくらい（約1割）上がるようにしてある
//  体力：最大体力 / 物理攻撃・魔法攻撃：合計で攻撃の強さが決まる（多い方の種類で攻撃しやすい）
//  物理防御・魔法防御：受けるダメージが減る / 素早さ：1ターンに動ける回数（10で約2回）
export const MON = { hp0: 210, hpK: 0.075, pow0: 23, powK: 0.045, defK: 0.4, mdefK: 0.22, spdK: 0.032, magX: 1 };
export function monStats(d) {
  const s = d.stats, sum = (s.atk || 0) + (s.mag || 0);
  return {
    maxHp: Math.round(MON.hp0 * (1 + MON.hpK * s.hp)),
    pow: MON.pow0 * (1 + MON.powK * sum), magShare: sum ? s.mag / sum : 0,
    defF: 1 / (1 + MON.defK * s.def), mdefF: 1 / (1 + MON.mdefK * s.mdef),
    spd: 4 + s.spd * 1.2, rate: 1 + MON.spdK * s.spd,
  };
}
// モンスターの名前（おまかせ）：属性・特性・目立つ能力・種族から組み立てる
const NAME_ELEM = { fire: 'フレイム', water: 'アクア', wind: 'ウィンド', earth: 'ガイア', light: 'ホーリー', dark: 'ダーク' };
const NAME_TRAIT = { fly: 'スカイ', regen: 'リジェネ', poison: 'ポイズン', reflect: 'ミラー', rage: 'バーサク', sweep: 'ストーム', pierce: 'ブレイク', keen: 'シーカー' };
const NAME_STAT = { hp: 'ジャイアント', atk: 'マッスル', mag: 'ウィザード', def: 'アイアン', mdef: 'ルーン', spd: 'ソニック' };
const NAME_SHAPE = { slime: 'スライム', beast: 'ビースト', bird: 'ガルーダ', golem: 'ゴーレム', ghost: 'ゴースト', dragon: 'ドラゴン', knight: 'ナイト' };
export function autoName(d) {
  const parts = [];
  const top = STATS.map(k => [k, d.stats[k] || 0]).sort((a, b) => b[1] - a[1])[0];
  if (top[1] >= 8) parts.push(NAME_STAT[top[0]]);
  parts.push(NAME_ELEM[d.elem]);
  if (d.traits[0]) parts.push(NAME_TRAIT[d.traits[0]]);
  parts.push(NAME_SHAPE[d.shape]);
  return parts.join('');
}
// いまの戦い。budget は魔王の成長ぶん（power）を足したもの、base はもとの魔力
export function currentFight(G) {
  const f = STAGES[G.stage]?.fights[G.fight];
  return f && { ...f, base: f.budget, budget: f.budget + (G.power || 0) };
}
// 古いセーブを今のしくみに合わせる
export function migrate(G) {
  if (!G) return G;
  if (G.limit == null) {
    const F = STAGES[G.stage].fights;
    G.limit = F.slice(0, Math.min(G.fight + 1, F.length)).reduce((a, f) => a + f.days, 0);
    if (G.day - 1 >= G.limit) G.limit = G.day; // 移した直後に負けにならないよう1日残す
  }
  if (G.power == null) G.power = 0;
  return G;
}

// ---------------- キャラの強さ ----------------
export function charStats(G, id) {
  const C = CHARS[id], P = G.party[id];
  const g = 1 + 0.1 * (P.lv - 1), tiredF = 1 - 0.07 * P.tired;
  return {
    maxHp: Math.round(C.base.hp * (1 + 0.12 * (P.lv - 1))),
    atk: C.base.atk * g * tiredF, mag: C.base.mag * g * tiredF,
    def: C.base.def * g, mdef: C.base.mdef * g, spd: C.base.spd * (1 + 0.04 * (P.lv - 1)),
  };
}
// 得意度＋使いこんだぶん（熟練度20ごとに+1、最大+5）
export function apt(G, id, k) {
  const C = CHARS[id];
  const base = WEAPON[k] ? C.w[k] : ELEM[k] ? C.e[k] : C.s[k] || 0;
  return Math.min(12, base + Math.floor((G.party[id].mast[k] || 0) / 20));
}
function power(G, id, k, st) {
  const a = apt(G, id, k);
  return (WEAPON[k] ? st.atk * 1.2 : st.mag) * (0.55 + a * 0.11);
}
const hitChance = (G, id, k, flyKnown) => {
  if (!WEAPON[k]) return 1;
  let h = 0.8 + apt(G, id, k) * 0.015;
  if (flyKnown) h *= k === 'bow' ? 1.15 : 0.55;
  return Math.min(1, h);
};

// ---------------- 図鑑（パーティーが見て覚えたこと） ----------------
function bookOf(G, d) {
  const lk = lookKey(d);
  if (!G.book[lk]) G.book[lk] = { look: lookName(d), shape: d.shape, elem: d.elem, obs: {}, res: {}, stats: {}, traits: {}, wins: 0, losses: 0, met: 0 };
  return G.book[lk];
}
export function bookEntry(G, d) { return G.book[lookKey(d)] || null; }
// 見た目から思いこむ効き目（言い伝え）
// 形ごとの思いこみ（スライムは斬れる・鳥は弓・ゴーレムは拳で砕く…）
// 体がない亡霊に武器は効きにくい・硬いゴーレムに剣や矢は通りにくい・よろいの騎士はすき間を槍で突く…（ふつうの人が思いそうなことだけ）
const FOLK_SHAPE = {
  slime: { fist: 0.7, sword: 0.85, spear: 0.85, fire: 1.3 },
  beast: { spear: 1.3, bow: 1.15, fire: 1.2 },
  bird: { bow: 1.45, fist: 0.7, sword: 0.85 },
  golem: { sword: 0.7, bow: 0.6, spear: 0.8, fist: 0.85, water: 1.25 },
  ghost: { sword: 0.5, spear: 0.5, bow: 0.5, fist: 0.4, light: 1.45 },
  dragon: { spear: 1.3, bow: 0.85, fist: 0.7 },
  knight: { spear: 1.25, sword: 0.8, fist: 0.6, bow: 0.8 },
};
// 思いこみの理由（形からか、色＝属性からか）
const FOLK_SHAPE_TEXT = { slime: 'ぷよぷよしたスライム', beast: '獣', bird: '空を飛ぶ鳥', golem: '岩のゴーレム', ghost: '体のない亡霊', dragon: '大きなドラゴン', knight: 'よろいの騎士' };
export function folkText(d, k) {
  if (ELEM[k] && FOLK_WEAK[d.elem] === k) return `${ELEM[d.elem].name}の魔物なら、${keyName(k)}が効くはず……！`;
  return `${FOLK_SHAPE_TEXT[d.shape] || SHAPES[d.shape].name}なら、${keyName(k)}が効きそう……！`;
}
// 言い伝えのもと：属性からなら「水」、形からなら「スライム型」
const folkWhy = (d, k) => (ELEM[k] && FOLK_WEAK[d.elem] === k ? ELEM[d.elem].name : SHAPES[d.shape].name + '型');
function folkMult(d, k) {
  let m = FOLK_SHAPE[d.shape]?.[k] || 1;
  if (ELEM[k] && FOLK_WEAK[d.elem] === k) m *= 1.35;
  if (k === d.elem) m *= 0.6;
  return m;
}
// 効き目の見こみ。src：どこからそう思ったか（known 図鑑／fact 分析／folk 見た目／none わからない）
export function belief(G, d, k) {
  const b = G.book[lookKey(d)];
  if (b?.res[k] != null) return { m: b.res[k], src: 'fact' };
  const o = b?.obs[k];
  if (o && o.n > 0) return { m: o.v, src: 'known', n: o.n };
  const f = folkMult(d, k);
  return { m: f, src: f !== 1 ? 'folk' : 'none' };
}

// ---------------- 作戦会議（誰が出るか・何で攻めるか） ----------------
export function available(G) { return IDS.filter(id => !G.party[id].hurt); }
function bestKeyFor(G, id, d, focus) {
  const st = charStats(G, id), fly = !!G.book[lookKey(d)]?.traits.fly;
  let best = null;
  for (const k of KEYS) {
    const v = power(G, id, k, st) * belief(G, d, k).m * hitChance(G, id, k, fly) * (k === focus ? 1.15 : 1);
    if (!best || v > best.v) best = { k, v };
  }
  return best;
}
// 参謀がいま分かっていることを整理する
export function analyzeLook(G, d) {
  const b = G.book[lookKey(d)];
  const all = KEYS.map(k => ({ k, ...belief(G, d, k) }));
  const good = all.filter(x => (x.src === 'known' || x.src === 'fact') && x.m >= 1.25).sort((a, b) => b.m - a.m);
  const bad = all.filter(x => (x.src === 'known' || x.src === 'fact') && x.m <= 0.6).sort((a, b) => a.m - b.m);
  const folk = all.filter(x => x.src === 'folk' && x.m > 1).sort((a, b) => b.m - a.m);
  return { b, good, bad, folk, met: b?.met || 0, losses: b?.losses || 0 };
}
// ルールで決める会議。AIを使うときは ai に { team, focus, plan } が入る
export function meeting(G, d, ai = null) {
  const ev = [];
  const av = available(G);
  const strat = [...av].sort((a, b) => apt(G, b, 'scan') + CHARS[b].p.logic * 0.3 - (apt(G, a, 'scan') + CHARS[a].p.logic * 0.3))[0];
  const A = analyzeLook(G, d);
  const look = lookName(d);
  ev.push({ t: 'narr', text: A.met ? `また${look}が現れた。（これで${A.met + 1}回目）` : `見たことのない魔物――${look}が道をふさいでいる。` });
  // 方針
  let focus = null, plan = 'balanced';
  const useAI = ai && ai.team?.length === 4 && ai.team.every(id => av.includes(id));
  if (useAI) {
    // AIの作戦：参謀がその方針を口にする
    plan = ai.plan || 'balanced';
    const bl = KEYS.includes(ai.focus) ? belief(G, d, ai.focus) : null;
    if (bl && !(['known', 'fact'].includes(bl.src) && bl.m <= 0.6)) focus = ai.focus;
    if (plan === 'explore' || !focus) ev.push(say(strat, 'meet_unknown', {}));
    else if (['known', 'fact'].includes(bl.src)) ev.push(say(strat, 'meet_known', { k: keyName(focus) }));
    else ev.push(say(strat, 'meet_folk', { e: folkWhy(d, focus), k: keyName(focus) }));
    if (ai.reason) ev.push({ t: 'think', sp: strat, text: ai.reason });
  } else if (A.good.length) { focus = A.good[0].k; plan = 'focus'; ev.push(say(strat, 'meet_known', { k: keyName(focus) })); }
  else if (A.met && A.bad.length) { plan = 'explore'; ev.push(say(strat, 'meet_bad', { k: keyName(A.bad[0].k) })); }
  else if (A.folk.length) { focus = A.folk[0].k; plan = 'folk'; ev.push(say(strat, 'meet_folk', { e: folkWhy(d, focus), k: keyName(focus) })); }
  else { plan = 'explore'; ev.push(say(strat, 'meet_unknown', {})); }
  if (A.losses > 0 && !useAI) ev.push({ t: 'think', sp: strat, text: `前は負けた。${A.bad.length ? keyName(A.bad[0].k) + 'は効かなかったから、使わない。' : '同じやり方では勝てない。'}` });
  // 出撃の4人
  let team, why = {};
  if (useAI) {
    team = ai.team.slice();
  } else {
    const scored = av.map(id => {
      const bk = bestKeyFor(G, id, d, focus);
      let v = bk.v * (1 - 0.12 * G.party[id].tired);
      if (plan === 'explore') v *= 1 + CHARS[id].p.curious * 0.02 + apt(G, id, 'scan') * 0.02;
      why[id] = bk.k;
      return { id, v };
    }).sort((a, b) => b.v - a.v);
    team = [];
    const needHeal = A.losses > 0 || !A.met || d.stats.atk + d.stats.mag >= 10;
    const healer = scored.filter(x => apt(G, x.id, 'heal') >= 5).sort((a, b) => apt(G, b.id, 'heal') - apt(G, a.id, 'heal'))[0];
    if (needHeal && healer) team.push(healer.id);
    if ((A.losses > 0 || d.stats.atk + d.stats.mag >= 10) && !A.b?.traits?.keen) { const tank = scored.filter(x => apt(G, x.id, 'guard') >= 6 && !team.includes(x.id)).sort((a, b) => b.v + apt(G, b.id, 'guard') * 2 - a.v - apt(G, a.id, 'guard') * 2)[0]; if (tank) team.push(tank.id); }
    const untested = id => KEYS.filter(k => apt(G, id, k) >= 5 && ['none', 'folk'].includes(belief(G, d, k).src));
    const covered = new Set(team.flatMap(untested));
    while (team.length < 4) {
      let best = null;
      for (const x of scored) {
        if (team.includes(x.id)) continue;
        const fresh = untested(x.id).filter(k => !covered.has(k)).length;
        const v = x.v * (1 + (plan === 'explore' || !A.met || A.losses ? 0.18 : 0.05) * Math.min(2, fresh));
        if (!best || v > best.v) best = { id: x.id, v };
      }
      if (!best) break;
      team.push(best.id); untested(best.id).forEach(k => covered.add(k));
    }
  }
  // 出たがりが割りこむ
  const bench = av.filter(id => !team.includes(id));
  const eager = bench.filter(id => CHARS[id].p.bold >= 8 && G.party[id].tired < 2 && R() < 0.35)[0];
  if (eager) {
    ev.push(say(eager, 'volunteer', {}));
    const weakest = team[team.length - 1];
    const mine = bestKeyFor(G, eager, d, focus).v, theirs = bestKeyFor(G, weakest, d, focus).v;
    if (mine >= theirs * 0.85 && weakest !== strat) {
      team[team.length - 1] = eager;
      ev.push(say(strat, 'meet_accept', { t: eager }));
    } else {
      ev.push(say(strat, 'meet_reject', { t: eager }));
      ev.push(say(eager, 'bench', {}));
    }
  }
  ev.push({ t: 'team', team: team.slice(), text: `出撃：${team.map(nameOf).join('・')}` });
  for (const id of team) if (G.party[id].tired >= 2) ev.push(say(id, 'tired', {}));
  ev.push(say(team[0], 'go', {}));
  return { team, focus, plan, strat, ev, why };
}

// ---------------- 戦闘 ----------------
// 戦いを最後まで計算して、見せる出来事（ev）を返す。図鑑と仲間の成長もここで書きかえる
// hooks.onEvent：出来事が起きるたびに呼ぶ（画面は計算しながら順に見せる）
// hooks.tactic：大事な場面でAIに作戦を聞く（なければルールで決める）。maxAI 回まで・timeout ミリ秒で見切る
export async function battle(G, d, M, hooks = {}) {
  const ev = [];
  const B = bookOf(G, d);
  B.met++;
  // 戦う前から図鑑に書いてあった攻撃（この戦いで初めて見たものは「さっき見た」と言う）
  const inBook = new Set([...Object.keys(B.obs), ...Object.keys(B.res)]);
  const ms = monStats(d);
  const mon = { hp: ms.maxHp, max: ms.maxHp, raged: false, poisonOn: {} };
  const team = M.team.slice();
  const st = {}, hp = {}, used = {}, poison = {}, thinkLast = {}, saidWeak = new Set(), saidRes = new Set(), lowSaid = new Set();
  const bench = available(G).filter(id => !team.includes(id));
  let buff = 0, guardBy = null, swaps = 0, scanDone = 0;
  // ヘイト（モンスターからのねらわれやすさ）。目立つことをするほど上がり、ターンごとに少し下がる
  const hate = {}, shield = {};
  let taunt = { id: null, left: 0 }, benchSaid = 0;
  const tauntSaid = new Set();
  const join = id => { st[id] = charStats(G, id); hp[id] = st[id].maxHp; used[id] = used[id] || {}; hate[id] = 8 + R() * 4; };
  // 外野の分析役：控えの中でいちばん分析が得意な子（6以上）
  const analystOf = () => bench.filter(id => apt(G, id, 'scan') >= 6).sort((a, b) => apt(G, b, 'scan') - apt(G, a, 'scan'))[0] || null;
  team.forEach(join);
  const snap = () => ({ mon: mon.hp, max: mon.max, team: team.slice(), hp: { ...hp }, max2: Object.fromEntries(team.map(id => [id, st[id].maxHp])) });
  const push = e => { const x = { ...e, s: snap() }; ev.push(x); hooks.onEvent?.(x); };
  let stance = 'normal', pinchDone = false, surpriseFlag = false, lastTactic = 0, aiUsed = 0, tactics = 0;
  const recent = [];
  const alive = () => team.filter(id => hp[id] > 0);
  push({ t: 'start', text: `${d.name}（${lookName(d)}）との戦いが始まった！` });

  const think = (id, reason, text) => { if (thinkLast[id] === reason + text) return; thinkLast[id] = reason + text; push({ t: 'think', sp: id, text }); };

  // 1人ぶんの行動を決める
  function decide(id, round) {
    const C = CHARS[id], P = C.p, s = st[id];
    const fly = !!B.traits.fly;
    const opts = [];
    const dmgOf = k => power(G, id, k, s) * hitChance(G, id, k, fly) * (buff ? 1.15 : 1);
    for (const k of KEYS) {
      const a = apt(G, id, k);
      if (a < 1 && !(P.rash >= 7)) continue;
      const bl = belief(G, d, k);
      let m = bl.m;
      m = 1 + (m - 1) * (1 - P.rash / 20);         // 無鉄砲な人は効き目をあまり気にしない
      let v = dmgOf(k) * m;
      let reason = bl.src === 'known' || bl.src === 'fact' ? (m >= 1.2 ? 'known' : m <= 0.7 ? 'avoid' : 'best') : bl.src === 'folk' ? (bl.m > 1.05 ? 'folk' : bl.m < 0.95 ? 'folkbad' : 'best') : 'best';
      if (k === M.focus) { v *= 1.25; reason = bl.src === 'known' ? 'known' : reason === 'folkbad' ? 'folkbad' : 'plan'; }
      const untested = bl.src === 'none' || bl.src === 'folk';
      if (untested && round <= 4 && a >= 3) {
        const ex = (P.curious / 10) * 0.35 + (M.plan === 'explore' ? 0.35 : 0);
        if (ex > 0) { v *= 1 + ex * (bl.src === 'none' ? 1 : 0.5); if (reason === 'best') reason = 'explore'; }
      }
      const top = Math.max(...KEYS.map(x => apt(G, id, x)));
      if (a === top) v *= 1 + P.pride * 0.03;
      opts.push({ type: 'atk', k, v: v * (stance === 'attack' ? 1.2 : 1), reason, m: bl.m, src: bl.src });
    }
    const lowT = stance === 'defend' ? 0.6 : stance === 'attack' ? 0.25 : 0.45;
    const allyLow = alive().filter(x => hp[x] / st[x].maxHp < lowT).sort((a, b) => hp[a] / st[a].maxHp - hp[b] / st[b].maxHp)[0];
    const avgDmg = alive().reduce((a, x) => a + charStats(G, x).atk, 0) / Math.max(1, alive().length);
    if (allyLow && apt(G, id, 'heal') >= 3) {
      const amt = s.mag * (0.6 + apt(G, id, 'heal') * 0.12) * 1.6;
      opts.push({ type: 'heal', target: allyLow, v: amt * (1 + P.kind / 12) * (hp[allyLow] / st[allyLow].maxHp < 0.25 ? 1.6 : 1) * (stance === 'defend' ? 1.6 : 1), reason: 'heal' });
    }
    if (!buff && apt(G, id, 'song') >= 5 && round <= 3 && alive().length >= 3) opts.push({ type: 'song', v: avgDmg * alive().length * 0.32 * (apt(G, id, 'song') / 10) * 1.6, reason: 'song' });
    if (allyLow && allyLow !== id && apt(G, id, 'guard') >= 5 && guardBy !== id && hp[id] / s.maxHp > 0.5) opts.push({ type: 'guard', target: allyLow, v: ms.pow * 1.3 * (P.kind / 8) * (stance === 'defend' ? 1.6 : 1), reason: 'guard' });
    // 盾：挑発してねらいを自分に集める（見破りを知っていたらしない）
    const g = apt(G, id, 'guard');
    if (g >= 6 && hp[id] / s.maxHp > 0.4 && alive().length >= 2 && !(taunt.id === id && taunt.left > 0) && !B.traits.keen) {
      const top = alive().filter(x => x !== id).sort((a, b) => hate[b] - hate[a])[0];
      const other = top && hate[top] >= hate[id] * 0.8;
      const soft = top && hp[top] / st[top].maxHp < 0.7;
      opts.push({ type: 'taunt', v: ms.pow * (g / 8) * (other ? 0.9 : 0.3) * (soft ? 1.4 : 1) * (stance === 'defend' ? 1.5 : 1) * (round === 1 ? 1.2 : 1), reason: 'taunt' });
    }
    const unknown = KEYS.filter(k => B.res[k] == null).length + (B.stats.hp == null ? 1 : 0);
    if (apt(G, id, 'scan') >= 4 && unknown > 3 && round <= 3 && scanDone < 2) opts.push({ type: 'scan', v: avgDmg * (0.6 + P.logic * 0.08) * (M.plan === 'explore' ? 1.4 : 1), reason: 'scan' });
    // 自分が役に立てないなら、控えと交代
    const best = opts.filter(o => o.type === 'atk').sort((a, b) => b.v - a.v)[0];
    if (best && swaps < 2 && bench.length && (P.careful + P.logic) >= 11 && round >= 2 && hp[id] > 0) {
      const alt = bench.map(b => ({ b, v: bestKeyFor(G, b, d, M.focus).v })).sort((a, b) => b.v - a.v)[0];
      if (alt && alt.v > best.v * 2.2 && B.met >= 1) opts.push({ type: 'swap', target: alt.b, v: best.v * 2, reason: 'swap' });
    }
    // 迷い：理屈派ほど迷わない
    const noise = 0.32 - P.logic * 0.025;
    for (const o of opts) o.score = o.v * (1 + gauss() * noise);
    opts.sort((a, b) => b.score - a.score);
    return opts[0];
  }

  function attack(id, o) {
    const k = o.k, s = st[id];
    used[id][k] = (used[id][k] || 0) + 1;
    const nm = nameOf(id);
    if (o.reason === 'known') {
      if (B.res[k] != null) think(id, 'known', `分析では、${keyName(k)}がよく効くはず。`);
      else if (inBook.has(k)) think(id, 'known', `図鑑によると、${keyName(k)}がよく効くはず。`);
      else think(id, 'known', `さっきの${keyName(k)}がよく効いていた。続けて狙おう。`);
    } else if (o.reason === 'folk') think(id, 'folk', folkText(d, k));
    else if (o.reason === 'folkbad') think(id, 'folkbad', `${keyName(k)}は効きにくそうだけど……試してみる。`);
    else if (o.reason === 'explore') { think(id, 'explore', `まだ試していない${keyName(k)}を試してみよう。`); if (R() < 0.4) push(say(id, 'try', { k: keyName(k) })); }
    else if (o.reason === 'plan') think(id, 'plan', `作戦どおり、${keyName(k)}で攻める。`);
    else if (o.reason === 'avoid') think(id, 'avoid', `${keyName(k)}は効きが悪いけど……ほかに手がない。`);
    else think(id, 'best', `得意の${keyName(k)}でいく！`);
    const fly = d.traits.includes('fly');
    if (WEAPON[k]) {
      let h = 0.8 + apt(G, id, k) * 0.015;
      if (fly) h *= k === 'bow' ? 1.15 : 0.55;
      if (R() > h) {
        if (fly && k !== 'bow') {
          const first = !B.traits.fly; B.traits.fly = true;
          push({ t: 'miss', sp: id, text: `${nm}の${WEAPON[k].name}は、空を飛ぶ${d.name}に届かない！` });
          if (first) push(say(id, 'fly_found', {}));
        } else push({ t: 'miss', sp: id, text: `${nm}の${WEAPON[k].name}はかわされた！` });
        return;
      }
    }
    // 魔法の反射
    if (!WEAPON[k] && d.traits.includes('reflect') && R() < 0.3) {
      const dm = Math.round(power(G, id, k, s) * 0.5 * (1 - st[id].mdef * 0.02));
      hp[id] = Math.max(0, hp[id] - dm);
      const first = !B.traits.reflect; B.traits.reflect = true; if (first) surpriseFlag = true;
      push({ t: 'hurt', sp: id, text: `${d.name}が${keyName(k)}を跳ね返した！ ${nm}に${dm}のダメージ！` });
      if (first) push(say(id, 'reflect_found', {}));
      if (hp[id] <= 0) down(id);
      return;
    }
    const rm = RES_MULT[d.res[k] || 0];
    const df = WEAPON[k] ? ms.defF : ms.mdefF;
    const ran = 0.85 + R() * 0.3, crit = R() < 0.08;
    const base = power(G, id, k, s) * (buff ? 1.15 : 1);
    const dmg = Math.max(rm === 0 ? 0 : 1, Math.round(base * rm * df * ran * (crit ? 1.5 : 1)));
    mon.hp = Math.max(0, mon.hp - dmg);
    hate[id] += dmg * 0.5;
    // 見えた効き目を図鑑に書く（理屈派は会心の一撃を割り引いて考える）
    let seen = (dmg / base) / (crit && CHARS[id].p.logic >= 7 ? 1.5 : 1);
    const o2 = B.obs[k];
    let surprise = false;
    if (o2 && o2.n >= 2 && Math.abs(o2.v - seen) >= 0.55) { surprise = true; B.obs[k] = { v: seen, n: 1 }; }
    else if (o2) { o2.v = (o2.v * Math.min(o2.n, 4) + seen) / (Math.min(o2.n, 4) + 1); o2.n++; }
    else B.obs[k] = { v: seen, n: 1 };
    const verb = WEAPON[k] ? `${nm}は${WEAPON[k].name}で${WEAPON[k].verb}` : `${nm}は${keyName(k)}を唱えた`;
    push({ t: 'hit', sp: id, k, text: `${verb}！${crit ? ' 会心の一撃！' : ''} ${dmg === 0 ? 'まったく効いていない！' : dmg + 'のダメージ！'}`, crit, dmg });
    recent.push({ k, m: seen });
    if (surprise || (k === M.focus && seen <= 0.6)) surpriseFlag = true;
    if (surprise) push(say(id, 'surprise', { k: keyName(k) }));
    else if (seen >= 1.45 && !saidWeak.has(k)) { saidWeak.add(k); push(say(id, 'weak', { k: keyName(k) })); }
    else if (seen <= 0.5 && !saidRes.has(k)) { saidRes.add(k); push(say(id, 'resist', { k: keyName(k) })); }
  }

  function down(id) {
    push({ t: 'down', sp: id, text: `${nameOf(id)}は倒れた……！` });
    push(say(id, 'down', {}));
    if (guardBy === id) guardBy = null;
  }

  function act(id, round) {
    if (hp[id] <= 0) return;
    const o = decide(id, round);
    if (!o) return;
    if (o.type === 'atk') return attack(id, o);
    if (o.type === 'heal') {
      const amt = Math.round(st[id].mag * (0.6 + apt(G, id, 'heal') * 0.12) * 1.6);
      hp[o.target] = Math.min(st[o.target].maxHp, hp[o.target] + amt);
      hate[id] += amt * 0.7;
      used[id].heal = (used[id].heal || 0) + 1;
      const self = o.target === id;
      if (!self && R() < 0.6) push(say(id, 'heal', { t: o.target }));
      push({ t: 'heal', sp: id, text: self ? `${nameOf(id)}は自分の傷を手当てした。${amt}回復！` : `${nameOf(id)}は${nameOf(o.target)}の傷を手当てした。${amt}回復！` });
      if (poison[o.target]) poison[o.target] = 0;
      return;
    }
    if (o.type === 'song') {
      buff = 3; used[id].song = (used[id].song || 0) + 1; hate[id] += 12;
      push(say(id, 'song', {}));
      push({ t: 'buff', sp: id, text: `${nameOf(id)}の歌声が響く。みんなの力が上がった！` });
      return;
    }
    if (o.type === 'taunt') {
      used[id].guard = (used[id].guard || 0) + 1;
      taunt = { id, left: 3 }; shield[id] = 3;
      hate[id] = Math.max(...alive().map(x => hate[x])) + 20 + apt(G, id, 'guard') * 3;
      if (!tauntSaid.has(id) || R() < 0.25) { tauntSaid.add(id); push(say(id, 'taunt', {})); }
      push({ t: 'buff', sp: id, text: `${nameOf(id)}は盾を構えて、${d.name}の注意を引きつけた！` });
      return;
    }
    if (o.type === 'guard') {
      guardBy = id; used[id].guard = (used[id].guard || 0) + 1;
      push(say(id, 'guard', { t: o.target }));
      push({ t: 'buff', sp: id, text: `${nameOf(id)}は仲間の前に立って、かばう構えをとった。` });
      return;
    }
    if (o.type === 'scan') {
      scanDone++; used[id].scan = (used[id].scan || 0) + 1;
      push({ t: 'think', sp: id, text: `${d.name}の動きをよく観察する……。` });
      if (R() < apt(G, id, 'scan') * 0.085) {
        const r = reveal();
        if (r) { push(say(id, 'scan_ok', { s: r })); push({ t: 'scan', sp: id, text: `図鑑に書いた：${r}` }); }
      } else push(say(id, 'scan_ng', {}));
      return;
    }
    if (o.type === 'swap') {
      const inn = o.target;
      bench.splice(bench.indexOf(inn), 1); bench.push(id);
      team[team.indexOf(id)] = inn; swaps++;
      join(inn); hp[inn] = st[inn].maxHp;
      push(say(id, 'swap_out', { t: inn }));
      push({ t: 'swap', sp: inn, text: `${nameOf(id)}が下がり、${nameOf(inn)}が前に出た。` });
      push(say(inn, 'swap_in', {}));
      if (guardBy === id) guardBy = null;
    }
  }
  // 分析で分かること（効き目がずれていそうなものを優先）
  function reveal() {
    const cand = [];
    for (const k of KEYS) if (B.res[k] == null) {
      const real = RES_MULT[d.res[k] || 0] * (WEAPON[k] ? ms.defF : ms.mdefF);
      const gap = Math.abs(real - belief(G, d, k).m);
      cand.push({ w: gap + 0.15, f: () => { B.res[k] = Math.round(real * 100) / 100; return revealText(keyName(k), real); } });
    }
    for (const s of ['hp', 'def', 'mdef', 'atk', 'mag']) if (B.stats[s] == null) cand.push({ w: 0.35, f: () => { B.stats[s] = d.stats[s]; return `${STAT[s].name}は${lvText(d.stats[s])}`; } });
    for (const t of d.traits) if (!B.traits[t]) cand.push({ w: 0.6, f: () => { B.traits[t] = true; return `「${TRAITS[t].name}」の力を持っている`; } });
    if (!cand.length) return null;
    let sum = cand.reduce((a, c) => a + c.w, 0), x = R() * sum;
    for (const c of cand) { x -= c.w; if (x <= 0) return c.f(); }
    return cand[0].f();
  }

  function monAct() {
    const al = alive(); if (!al.length) return;
    const useMag = R() < ms.magShare;
    const pw = ms.pow * (mon.raged ? 1.5 : 1) * (useMag ? MON.magX : 1);
    const pierce = d.traits.includes('pierce');
    const hitOne = (id, mult) => {
      // 貫通：守りを6割無視し、盾の構え・かばうの軽減もなし
      const defv = (useMag ? st[id].mdef : st[id].def) * (pierce ? 0.4 : 1);
      let dm = Math.max(1, Math.round(pw * 1.7 * (30 / (30 + defv * 1.5)) * mult * (0.85 + R() * 0.3)));
      hp[id] = Math.max(0, hp[id] - dm);
      return dm;
    };
    if (d.traits.includes('sweep') && R() < 0.3) {
      B.traits.sweep = true;
      const parts = al.map(id => `${nameOf(id)}に${hitOne(id, 0.6)}`);
      push({ t: 'mon', text: `${d.name}の全体攻撃！ ${parts.join('、')}のダメージ！` });
      for (const id of al) if (hp[id] <= 0) down(id);
    } else {
      let target, txt = '';
      const tauntOn = taunt.left > 0 && hp[taunt.id] > 0;
      if (d.traits.includes('keen')) {
        // 見破り：挑発は無視。回復役か、いちばん弱っている子をねらう
        const healer = al.filter(id => apt(G, id, 'heal') >= 5).sort((a, b) => apt(G, b, 'heal') - apt(G, a, 'heal'))[0];
        target = healer && R() < 0.5 ? healer : al.slice().sort((a, b) => hp[a] / st[a].maxHp - hp[b] / st[b].maxHp)[0];
        if (tauntOn && target !== taunt.id && !B.traits.keen) {
          B.traits.keen = true; surpriseFlag = true;
          push({ t: 'mon', text: `${d.name}は挑発に乗らない！ ${nameOf(target)}をねらっている！` });
          think(taunt.id, 'keen', '挑発が効いていない……！ 見破られている。');
        }
      } else if (tauntOn && R() < 0.85) target = taunt.id;
      else {
        // ヘイトの高い子ほどねらわれやすい（少し気まぐれ）
        const w = al.map(id => Math.pow(Math.max(1, hate[id]), 1.3) * (0.7 + R() * 0.6));
        let x = R() * w.reduce((a, b) => a + b, 0);
        target = al[al.length - 1];
        for (let i = 0; i < al.length; i++) { x -= w[i]; if (x <= 0) { target = al[i]; break; } }
      }
      if (guardBy && hp[guardBy] > 0 && guardBy !== target && guardBy !== taunt.id) { txt = `${nameOf(guardBy)}がかばった！ `; target = guardBy; }
      let mult = 1;
      if (!pierce) {
        if (guardBy === target) mult *= 0.7;
        if (shield[target] > 0) { mult *= 1 - apt(G, target, 'guard') * 0.035; shield[target]--; }
      } else if ((shield[target] > 0 || guardBy === target) && !B.traits.pierce) {
        B.traits.pierce = true; surpriseFlag = true;
        txt += '盾ごと貫いた！ ';
      }
      const dm = hitOne(target, mult);
      push({ t: 'mon', sp: target, text: `${d.name}の${useMag ? '魔法' : '攻撃'}！ ${txt}${nameOf(target)}に${dm}のダメージ！` });
      if (d.traits.includes('poison') && hp[target] > 0 && !poison[target] && R() < 0.6) {
        poison[target] = 3; B.traits.poison = true;
        push({ t: 'mon', sp: target, text: `${nameOf(target)}は毒を受けた！` });
      }
      if (hp[target] <= 0) down(target);
      else if (hp[target] / st[target].maxHp < 0.3 && !lowSaid.has(target)) { lowSaid.add(target); push(say(target, 'low', {})); }
    }
  }

  // 作戦の見直し。AIの答え → なければルール
  async function tactic(trig, round) {
    const al = alive();
    const strat = analystOf() || [...al].sort((a, b) => apt(G, b, 'scan') + CHARS[b].p.logic - apt(G, a, 'scan') - CHARS[a].p.logic)[0];
    const leader = [...al].sort((a, b) => CHARS[b].p.careful - CHARS[a].p.careful)[0];
    if (!strat) return null;
    let t = null, byAI = false;
    if (hooks.tactic && aiUsed < (hooks.maxAI || 0)) {
      aiUsed++;
      push({ t: 'aiwait', sp: strat, text: `${nameOf(strat)}が考えている……` });
      const state = {
        trig, round, monHp: mon.hp / mon.max, focus: M.focus, stance,
        team: team.map(id => ({ id, hp: hp[id] / st[id].maxHp })), bench: bench.slice(),
        recent: recent.slice(-8),
      };
      try { t = await Promise.race([hooks.tactic(G, d, state), new Promise(r => setTimeout(() => r(null), hooks.timeout || 8000))]); } catch { t = null; }
      if (t) byAI = true;
    }
    if (!t && trig !== 'check') t = ruleTactic(trig, leader);
    if (!t) return null;
    if (t.reason) push({ t: 'think', sp: strat, text: t.reason });
    if (t.stance === 'retreat') { push(say(leader, 'retreat', {})); return 'retreat'; }
    let changed = false;
    if (t.focus && KEYS.includes(t.focus) && t.focus !== M.focus) {
      const bl = belief(G, d, t.focus);
      if (!(['known', 'fact'].includes(bl.src) && bl.m <= 0.6)) { M.focus = t.focus; M.plan = 'focus'; push(say(strat, 'order_focus', { k: keyName(t.focus) })); changed = true; }
    }
    if (t.stance && t.stance !== stance && ['attack', 'defend', 'normal'].includes(t.stance)) {
      stance = t.stance;
      if (stance !== 'normal') push(say(strat, stance === 'attack' ? 'order_attack' : 'order_defend', {}));
      changed = true;
    }
    if (!changed && byAI) push({ t: 'think', sp: strat, text: 'いまの作戦のままでいい。' });
    return null;
  }
  function ruleTactic(trig, leader) {
    const al = alive(), downN = team.length - al.length;
    if (trig === 'pinch') {
      const C = CHARS[leader].p;
      if (downN >= 2 && mon.hp / mon.max > 0.5 && C.careful >= 6) return { stance: 'retreat', reason: '仲間が倒れすぎた。ここは引くべき。' };
      if (mon.hp / mon.max < 0.3) return { stance: 'attack', reason: 'あと少しで倒せる。押し切る！' };
      if (C.careful + C.kind >= 11) return { stance: 'defend', reason: '危ない。まずは守りを固めよう。' };
      return { stance: 'attack', reason: 'やられる前に、攻めて倒す！' };
    }
    // 予想外：いちばん効きそうな攻撃に切りかえる
    let best = null;
    for (const k of KEYS) {
      const bl = belief(G, d, k);
      const v = Math.max(...al.map(id => power(G, id, k, st[id]))) * bl.m;
      if (!best || v > best.v) best = { k, v };
    }
    if (best && best.k !== M.focus) return { focus: best.k, reason: `思っていたのと違う。${keyName(best.k)}に切りかえよう。` };
    return null;
  }

  let outcome = null, round = 0, monAcc = 0;
  const hpHist = [];
  while (!outcome) {
    round++;
    if (round > 18) { outcome = 'timeup'; break; }
    push({ t: 'round', text: `― ${round}ターン目 ―` });
    const order = alive().map(id => ({ id, sp: st[id].spd + R() * 4 }));
    monAcc += ms.rate;
    for (let i = 0; monAcc >= 1; i++, monAcc--) order.push({ id: 'mon', sp: i === 0 ? ms.spd + R() * 4 : R() * 14 });
    order.sort((a, b) => b.sp - a.sp);
    for (const o of order) {
      if (o.id === 'mon') monAct(); else act(o.id, round);
      if (mon.hp <= 0) { outcome = 'win'; break; }
      if (!alive().length) { outcome = 'wipe'; break; }
    }
    if (outcome) break;
    // ターンの終わり
    for (const id of alive()) if (poison[id]) {
      const dm = Math.max(1, Math.round(st[id].maxHp * 0.06)); hp[id] = Math.max(0, hp[id] - dm); poison[id]--;
      push({ t: 'mon', sp: id, text: `${nameOf(id)}は毒で${dm}のダメージ。` });
      if (hp[id] <= 0) down(id);
    }
    if (!alive().length) { outcome = 'wipe'; break; }
    if (d.traits.includes('regen') && mon.hp < mon.max) {
      const h = Math.round(mon.max * 0.05); mon.hp = Math.min(mon.max, mon.hp + h);
      const first = !B.traits.regen; B.traits.regen = true;
      push({ t: 'mon', text: `${d.name}の傷がふさがっていく……（${h}回復）` });
      if (first) push(say(alive()[0], 'regen_found', {}));
    }
    if (d.traits.includes('rage') && !mon.raged && mon.hp < mon.max / 2) {
      mon.raged = true; B.traits.rage = true;
      push({ t: 'mon', text: `${d.name}は怒り狂っている！ 攻撃が激しくなった！` });
    }
    if (buff) buff--;
    for (const id of team) hate[id] = (hate[id] || 0) * 0.8;
    if (taunt.left > 0) taunt.left--;
    // 外野の分析役：控えから見て気づいたことを言う（3ターンごと・1戦で3回まで）
    const an = analystOf();
    if (an && round % 3 === 0 && benchSaid < 3) {
      benchSaid++;
      const hint = Object.entries(B.obs).filter(([k, o]) => o.v >= 1.25 && k !== M.focus && Math.max(...alive().map(x => apt(G, x, k))) >= 4).sort((a, b) => b[1].v - a[1].v)[0];
      if (R() < apt(G, an, 'scan') * 0.07) {
        const r = reveal();
        if (r) { push(say(an, 'bench_find', { s: r })); push({ t: 'scan', sp: an, text: `図鑑に書いた：${r}` }); }
      } else if (hint) {
        M.focus = hint[0]; M.plan = 'focus';
        push(say(an, 'bench_hint', { k: keyName(hint[0]) }));
      }
    }
    // 大事な場面：作戦を見直す（AIがあればAIに聞く）
    const downNow = team.length - alive().length;
    const avgHp = alive().reduce((a, x) => a + hp[x] / st[x].maxHp, 0) / Math.max(1, alive().length);
    let trig = null;
    if (!pinchDone && (downNow >= 1 || avgHp < 0.45)) { trig = 'pinch'; pinchDone = true; }
    else if (surpriseFlag) { trig = 'surprise'; surpriseFlag = false; }
    else if (hooks.periodic && hooks.tactic && aiUsed < (hooks.maxAI || 0) && round - lastTactic >= hooks.periodic && round >= 2) trig = 'check';
    if (trig && tactics < 6) {
      lastTactic = round; tactics++;
      if ((await tactic(trig, round)) === 'retreat') { outcome = 'retreat'; break; }
    }
    hpHist.push(mon.hp);
    // 削れていない：3ターン前とほとんど変わらないなら、慎重な人が「このままでは勝てない」と気づく
    if (round >= 6 && hpHist.length >= 4 && mon.hp >= hpHist[hpHist.length - 4] - mon.max * 0.05 && mon.hp / mon.max > 0.4) {
      const sp2 = [...alive()].sort((a, b) => CHARS[b].p.logic - CHARS[a].p.logic)[0];
      if (sp2 && CHARS[sp2].p.logic + CHARS[sp2].p.careful >= 10) {
        push({ t: 'think', sp: sp2, text: `削っても、すぐに戻されている……。このままでは勝てない。` });
        push(say(sp2, 'retreat', {}));
        outcome = 'retreat';
        break;
      }
    }
    // 撤退の判断：慎重な人が「これは無理」と思ったら
    const al = alive(), downN = team.length - al.length;
    const leader = [...al].sort((a, b) => CHARS[b].p.careful - CHARS[a].p.careful)[0];
    if (leader && downN >= 2 && mon.hp / mon.max > 0.55 && CHARS[leader].p.careful >= 6 && R() < 0.7) {
      push(say(leader, 'retreat', {}));
      outcome = 'retreat';
    }
  }

  // ---- 結果 ----
  const fightInfo = currentFight(G);
  const win = outcome === 'win';
  if (win) {
    const last = alive().sort(() => R() - 0.5)[0];
    push({ t: 'win', text: `${d.name}が倒された……。道を突破された！` });
    push(say(last, 'win', {}));
    B.wins++;
  } else {
    B.losses++;
    push({ t: 'lose', text: '撃退！ ' + (outcome === 'wipe' ? 'Liella!は全員倒れ、町まで逃げ帰った。' : outcome === 'timeup' ? 'Liella!は長い戦いに疲れ果て、引き上げていった。' : 'Liella!は町まで撤退していった。') });
  }
  // 成長：出た人は経験値と熟練度。控えは経験値半分
  const budget = fightInfo?.base || 40;
  const expAll = Math.round(budget * (win ? 3 : 1.2));
  const ups = [];
  const fought = new Set([...team, ...Object.keys(used)]);
  for (const id of IDS) {
    const P = G.party[id];
    const inTeam = fought.has(id);
    if (P.hurt && !inTeam) { P.hurt = Math.max(0, P.hurt - 1); }
    const gain = inTeam ? expAll : P.hurt ? 0 : Math.round(expAll / 2);
    P.exp += gain;
    while (P.exp >= 40 * P.lv) { P.exp -= 40 * P.lv; P.lv++; ups.push(id); }
    if (inTeam) {
      for (const [k, n] of Object.entries(used[id] || {})) P.mast[k] = Math.min(100, (P.mast[k] || 0) + n * 4);
      P.tired = Math.min(3, P.tired + 1);
      if (hp[id] === 0) P.hurt = 1;
    } else P.tired = Math.max(0, P.tired - 1);
  }
  if (ups.length) push({ t: 'lvup', text: `レベルアップ：${[...new Set(ups)].map(id => `${nameOf(id)}（Lv${G.party[id].lv}）`).join('、')}` });
  const key = `${G.stage}-${G.fight}`;
  G.tries[key] = (G.tries[key] || 0) + 1;
  G.history.push({ day: G.day, name: d.name, look: lookName(d), team: M.team, win, outcome, rounds: round });
  G.day++;
  // 魔王の成長：戦うたびに魔力が増える（撃退したら多め）
  const grow = win ? MAOU_GROW.lose : MAOU_GROW.win;
  G.power = (G.power || 0) + grow;
  return { ev, win, outcome, round, used, team };
}

// 戦いのあとの反省会
export function review(G, d, res) {
  const ev = [];
  const A = analyzeLook(G, d);
  const al = res.team.filter(id => !G.party[id].hurt);
  const sp = [...(al.length ? al : res.team)].sort((a, b) => CHARS[b].p.logic - CHARS[a].p.logic)[0];
  if (res.win) {
    ev.push(say(sp, 'review_win', { k: A.good[0] ? keyName(A.good[0].k) : '' }));
  } else {
    if (A.good.length) ev.push(say(sp, 'review_lose_good', { k: keyName(A.good[0].k) }));
    else if (A.bad.length) ev.push(say(sp, 'review_lose_bad', { k: keyName(A.bad[0].k) }));
    else ev.push(say(sp, 'review_lose', {}));
    const left = daysLeft(G);
    if (left > 0 && left <= 3) ev.push({ t: 'narr', text: `魔王が完全な力を取り戻すまで、あと${left}日。` });
    if (G.pname && R() < 0.4) ev.push(say(pick(res.team), 'maou_note', { p: G.pname }));
    const hurt = IDS.filter(id => G.party[id].hurt);
    if (hurt.length) ev.push({ t: 'narr', text: `${hurt.map(nameOf).join('・')}はケガで次の戦いを休む。` });
  }
  return ev;
}

// 期限：あと何日戦えるか（0になったら、それ以上は挑めない）
export function daysLeft(G) { return (G.limit ?? 9) - (G.day - 1); }
// 戦いのあとで呼ぶ：期限切れなら魔王の勝ち
export function checkDeadline(G) {
  if (!G.cleared && !G.maouWin && daysLeft(G) <= 0) G.maouWin = true;
  return G.maouWin;
}
// 勝ったら次の戦いへ
export function advance(G) {
  const S = STAGES[G.stage];
  G.fight++;
  G.next = null;
  if (G.fight >= S.fights.length) { G.cleared = true; }
  else G.limit = (G.limit ?? 9) + S.fights[G.fight].days; // 次の戦いのぶんの日数が増える（残りは持ちこし）
}

// 図鑑の表示用
export const revealText = (k, m) => (m >= 1.7 ? `${k}が大きな弱点` : m >= 1.25 ? `${k}がよく効く` : m >= 0.85 ? `${k}はふつうに効く` : m >= 0.45 ? `${k}は効きがいまいち` : m > 0.05 ? `${k}はほとんど効かない` : `${k}はまったく効かない`);
export const mText = m => (m >= 1.7 ? '大きな弱点' : m >= 1.25 ? 'よく効く' : m >= 0.85 ? 'ふつう' : m >= 0.45 ? 'いまいち' : m > 0.05 ? 'ほとんど効かない' : 'まったく効かない');
export const lvText = v => (v >= 9 ? 'とても高い' : v >= 7 ? '高い' : v >= 4 ? 'ふつう' : v >= 2 ? '低い' : 'とても低い');
export { KEYS, keyName };
