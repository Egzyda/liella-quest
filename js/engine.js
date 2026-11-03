// リエラクエストの中身（画面なし・Node でも動く）
// 魔王（プレイヤー）が作ったモンスターに、Liella! 11人が作戦を立てて挑む。
// ・戦いはターン制。誰が何をするかは、性格と「図鑑」（これまでに見たこと）から決める
// ・図鑑には見たことだけが書かれる（会心の一撃を「弱点」と勘ちがいすることもある）
// ・負けたら町に戻って反省し、もう一度挑む
import { ELEMS, ELEM, FOLK_WEAK, WEAPONS, WEAPON, KEYS, keyName, STATS, STAT, RES_MULT, SHAPES, TRAITS, STAGES, IDS, CHARS } from './data.js?v=2026.11.03-2';
import { say, nameOf } from './talk.js?v=2026.11.03-2';

export const rnd = { f: Math.random };
const R = () => rnd.f();
const pick = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => (R() + R() + R() - 1.5) / 1.5;

// ---------------- 新しい旅 ----------------
export function newGame() {
  const party = {};
  for (const id of IDS) party[id] = { lv: 1, exp: 0, mast: {}, tired: 0, hurt: 0 };
  return { v: 1, stage: 0, fight: 0, party, book: {}, designs: [], next: null, tries: {}, history: [], cleared: false, day: 1 };
}

// ---------------- モンスター ----------------
export function blankDesign() {
  return { name: 'はじまりのスライム', shape: 'slime', elem: 'water', stats: { hp: 4, atk: 3, mag: 2, def: 3, mdef: 3, spd: 3 }, res: {}, traits: [] };
}
const statCost = v => v + Math.max(0, v - 5) * 0.6 + Math.max(0, v - 8);
const RES_COST = { 1: 2, 2: 4, 3: 7 };
// 魔力（コスト）の計算：強い数字ほど割高。弱点を作ると少し戻ってくる（最大9まで）
export function costOf(d) {
  let c = 0;
  for (const s of STATS) c += statCost(d.stats[s] || 0);
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
export function monStats(d) {
  const s = d.stats;
  return {
    maxHp: Math.round(110 + s.hp * 62), atk: 7 + s.atk * 3.1, mag: 7 + s.mag * 3.1,
    defF: 1 - s.def * 0.055, mdefF: 1 - s.mdef * 0.055, spd: 4 + s.spd * 1.4, twice: s.spd >= 8,
  };
}
export function currentFight(G) { return STAGES[G.stage]?.fights[G.fight]; }

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
  return (WEAPON[k] ? st.atk : st.mag) * (0.55 + a * 0.11);
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
function folkMult(d, k) {
  if (ELEM[k] && FOLK_WEAK[d.elem] === k) return 1.5;
  if (k === d.elem) return 0.6;
  if (d.shape === 'ghost' && WEAPON[k]) return 0.7;
  if (d.shape === 'ghost' && k === 'light') return 1.3;
  if (d.shape === 'golem' && (k === 'sword' || k === 'bow')) return 0.8;
  return 1;
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
    else ev.push(say(strat, 'meet_folk', { e: ELEM[d.elem].name, k: keyName(focus) }));
    if (ai.reason) ev.push({ t: 'think', sp: strat, text: ai.reason });
  } else if (A.good.length) { focus = A.good[0].k; plan = 'focus'; ev.push(say(strat, 'meet_known', { k: keyName(focus) })); }
  else if (A.met && A.bad.length) { plan = 'explore'; ev.push(say(strat, 'meet_bad', { k: keyName(A.bad[0].k) })); }
  else if (A.folk.length) { focus = A.folk[0].k; plan = 'folk'; ev.push(say(strat, 'meet_folk', { e: ELEM[d.elem].name, k: keyName(focus) })); }
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
    if (A.losses > 0) { const tank = scored.find(x => apt(G, x.id, 'guard') >= 6 && !team.includes(x.id)); if (tank) team.push(tank.id); }
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
export function battle(G, d, M) {
  const ev = [];
  const B = bookOf(G, d);
  B.met++;
  const ms = monStats(d);
  const mon = { hp: ms.maxHp, max: ms.maxHp, raged: false, poisonOn: {} };
  const team = M.team.slice();
  const st = {}, hp = {}, used = {}, poison = {}, thinkLast = {}, saidWeak = new Set(), saidRes = new Set(), lowSaid = new Set();
  const bench = available(G).filter(id => !team.includes(id));
  let buff = 0, guardBy = null, swaps = 0, scanDone = 0;
  const join = id => { st[id] = charStats(G, id); hp[id] = st[id].maxHp; used[id] = used[id] || {}; };
  team.forEach(join);
  const snap = () => ({ mon: mon.hp, max: mon.max, team: team.slice(), hp: { ...hp }, max2: Object.fromEntries(team.map(id => [id, st[id].maxHp])) });
  const push = e => ev.push({ ...e, s: snap() });
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
      let reason = bl.src === 'known' || bl.src === 'fact' ? (m >= 1.2 ? 'known' : m <= 0.7 ? 'avoid' : 'best') : bl.src === 'folk' ? 'folk' : 'best';
      if (k === M.focus) { v *= 1.25; reason = bl.src === 'known' ? 'known' : 'plan'; }
      const untested = bl.src === 'none' || bl.src === 'folk';
      if (untested && round <= 4 && a >= 3) {
        const ex = (P.curious / 10) * 0.35 + (M.plan === 'explore' ? 0.35 : 0);
        if (ex > 0) { v *= 1 + ex * (bl.src === 'none' ? 1 : 0.5); if (reason === 'best') reason = 'explore'; }
      }
      const top = Math.max(...KEYS.map(x => apt(G, id, x)));
      if (a === top) v *= 1 + P.pride * 0.03;
      opts.push({ type: 'atk', k, v, reason, m: bl.m, src: bl.src });
    }
    const allyLow = alive().filter(x => hp[x] / st[x].maxHp < 0.45).sort((a, b) => hp[a] / st[a].maxHp - hp[b] / st[b].maxHp)[0];
    const avgDmg = alive().reduce((a, x) => a + charStats(G, x).atk, 0) / Math.max(1, alive().length);
    if (allyLow && apt(G, id, 'heal') >= 3) {
      const amt = s.mag * (0.6 + apt(G, id, 'heal') * 0.12) * 1.6;
      opts.push({ type: 'heal', target: allyLow, v: amt * (1 + P.kind / 12) * (hp[allyLow] / st[allyLow].maxHp < 0.25 ? 1.6 : 1), reason: 'heal' });
    }
    if (!buff && apt(G, id, 'song') >= 5 && round <= 3 && alive().length >= 3) opts.push({ type: 'song', v: avgDmg * alive().length * 0.32 * (apt(G, id, 'song') / 10) * 1.6, reason: 'song' });
    if (allyLow && allyLow !== id && apt(G, id, 'guard') >= 5 && guardBy !== id && hp[id] / s.maxHp > 0.5) opts.push({ type: 'guard', target: allyLow, v: ms.atk * 1.3 * (P.kind / 8), reason: 'guard' });
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
    if (o.reason === 'known') think(id, 'known', `図鑑によると、${keyName(k)}がよく効くはず。`);
    else if (o.reason === 'folk') think(id, 'folk', `${ELEM[d.elem].name}の魔物なら、${keyName(k)}が効くはず……！`);
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
      const first = !B.traits.reflect; B.traits.reflect = true;
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
    // 見えた効き目を図鑑に書く（理屈派は会心の一撃を割り引いて考える）
    let seen = (dmg / base) / (crit && CHARS[id].p.logic >= 7 ? 1.5 : 1);
    const o2 = B.obs[k];
    let surprise = false;
    if (o2 && o2.n >= 2 && Math.abs(o2.v - seen) >= 0.55) { surprise = true; B.obs[k] = { v: seen, n: 1 }; }
    else if (o2) { o2.v = (o2.v * Math.min(o2.n, 4) + seen) / (Math.min(o2.n, 4) + 1); o2.n++; }
    else B.obs[k] = { v: seen, n: 1 };
    const verb = WEAPON[k] ? `${nm}は${WEAPON[k].name}で${WEAPON[k].verb}` : `${nm}は${keyName(k)}を唱えた`;
    push({ t: 'hit', sp: id, k, text: `${verb}！${crit ? ' 会心の一撃！' : ''} ${dmg === 0 ? 'まったく効いていない！' : dmg + 'のダメージ！'}`, crit, dmg });
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
      used[id].heal = (used[id].heal || 0) + 1;
      const self = o.target === id;
      if (!self && R() < 0.6) push(say(id, 'heal', { t: o.target }));
      push({ t: 'heal', sp: id, text: self ? `${nameOf(id)}は自分の傷を手当てした。${amt}回復！` : `${nameOf(id)}は${nameOf(o.target)}の傷を手当てした。${amt}回復！` });
      if (poison[o.target]) poison[o.target] = 0;
      return;
    }
    if (o.type === 'song') {
      buff = 3; used[id].song = (used[id].song || 0) + 1;
      push(say(id, 'song', {}));
      push({ t: 'buff', sp: id, text: `${nameOf(id)}の歌声が響く。みんなの力が上がった！` });
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
    let atkV = ms.atk * (mon.raged ? 1.5 : 1), magV = ms.mag * (mon.raged ? 1.5 : 1);
    const useMag = magV > atkV ? R() < 0.8 : R() < 0.2 * (magV / atkV);
    const pw = useMag ? magV : atkV;
    const hitOne = (id, mult) => {
      const defv = useMag ? st[id].mdef : st[id].def;
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
      let target = al.sort(() => R() - 0.5).sort((a, b) => (hp[a] / st[a].maxHp) - (hp[b] / st[b].maxHp) + (R() - 0.5))[0];
      let txt = '';
      if (guardBy && hp[guardBy] > 0 && guardBy !== target) { txt = `${nameOf(guardBy)}がかばった！ `; target = guardBy; }
      const dm = hitOne(target, guardBy === target ? 0.7 : 1);
      push({ t: 'mon', sp: target, text: `${d.name}の${useMag ? '魔法' : '攻撃'}！ ${txt}${nameOf(target)}に${dm}のダメージ！` });
      if (d.traits.includes('poison') && hp[target] > 0 && !poison[target] && R() < 0.6) {
        poison[target] = 3; B.traits.poison = true;
        push({ t: 'mon', sp: target, text: `${nameOf(target)}は毒を受けた！` });
      }
      if (hp[target] <= 0) down(target);
      else if (hp[target] / st[target].maxHp < 0.3 && !lowSaid.has(target)) { lowSaid.add(target); push(say(target, 'low', {})); }
    }
  }

  let outcome = null, round = 0;
  const hpHist = [];
  while (!outcome) {
    round++;
    if (round > 18) { outcome = 'timeup'; break; }
    push({ t: 'round', text: `― ${round}ターン目 ―` });
    const order = [...alive().map(id => ({ id, sp: st[id].spd + R() * 4 })), { id: 'mon', sp: ms.spd + R() * 4 }];
    if (ms.twice) order.push({ id: 'mon', sp: ms.spd * 0.4 });
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
    push({ t: 'win', text: `${d.name}をたおした！` });
    push(say(last, 'win', {}));
    B.wins++;
  } else {
    B.losses++;
    push({ t: 'lose', text: outcome === 'wipe' ? '全員倒れてしまった……。町まで逃げ帰った。' : outcome === 'timeup' ? '長い戦いに疲れ果て、一度引き上げた。' : 'パーティーは町まで撤退した。' });
  }
  // 成長：出た人は経験値と熟練度。控えは経験値半分
  const budget = fightInfo?.budget || 40;
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
    const hurt = IDS.filter(id => G.party[id].hurt);
    if (hurt.length) ev.push({ t: 'narr', text: `${hurt.map(nameOf).join('・')}はケガで次の戦いを休む。` });
  }
  return ev;
}

// 勝ったら次の戦いへ
export function advance(G) {
  const S = STAGES[G.stage];
  G.fight++;
  G.next = null;
  if (G.fight >= S.fights.length) { G.cleared = true; }
}

// 図鑑の表示用
export const revealText = (k, m) => (m >= 1.7 ? `${k}が大きな弱点` : m >= 1.25 ? `${k}がよく効く` : m >= 0.85 ? `${k}はふつうに効く` : m >= 0.45 ? `${k}は効きがいまいち` : m > 0.05 ? `${k}はほとんど効かない` : `${k}はまったく効かない`);
export const mText = m => (m >= 1.7 ? '大きな弱点' : m >= 1.25 ? 'よく効く' : m >= 0.85 ? 'ふつう' : m >= 0.45 ? 'いまいち' : m > 0.05 ? 'ほとんど効かない' : 'まったく効かない');
export const lvText = v => (v >= 9 ? 'とても高い' : v >= 7 ? '高い' : v >= 4 ? 'ふつう' : v >= 2 ? '低い' : 'とても低い');
export { KEYS, keyName };
