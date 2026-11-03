// 自由行動：戦いのあと、Liella!と魔王がそれぞれ1つずつ動く（日は進まない）
// Liella!：休む（体力・ケガ・疲れが全部戻る）／鍛える（レベルアップのポイントを方針どおりに使う）／情報集め（図鑑が埋まる）／自主練（熟練度）
// 買い物（お金 G.gold で装備を買う）。魔王（1回）：号令を覚える／力をためる／偵察（2人を全部見る）／盗み聞き／噂を流す／刺客
// plan：AIが決めた過ごし方 { acts: { id: 'rest'|'train'|'shop'|'info'|'drill' }, policy: [攻撃,攻撃] }（おかしいところはルールで直す）
import { IDS, CHARS, KEYS, WEAPONS, WEAPON, ELEM, keyName, RES_MULT, GROW_KEYS, growCap, CMDS, MAOU_POWER_ACT, ITEMS } from './data.js?v=2026.11.03-26';
import { apt, belief, monStats, lookKey, revealText, designHabit, favElem } from './engine.js?v=2026.11.03-26';
import { nameOf } from './talk.js?v=2026.11.03-26';

const R = () => Math.random();

// 方針：次に伸ばす攻撃を2つ。効いた攻撃（図鑑）×パーティーの得意で決める。なければ得意な攻撃
export function decidePolicy(G) {
  const d = G.lastD;
  const score = k => {
    const top = IDS.map(id => apt(G, id, k)).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    let m = 1;
    if (d) { const bl = belief(G, d, k); if (bl.src === 'known' || bl.src === 'fact') m = bl.m; }
    return top * m * (0.85 + R() * 0.3);
  };
  const pol = KEYS.map(k => ({ k, v: score(k) })).sort((a, b) => b.v - a.v).slice(0, 2).map(x => x.k);
  if (G.lastOutcome === 'wipe') pol.push('heal');
  G.policy = pol;
  return pol;
}
// 1人ぶんの自由行動を決める
function planOne(G, id) {
  const P = G.party[id];
  if (P.hurt || (P.hpR ?? 1) < 0.55 || P.tired >= 2) return { id, act: 'rest' };
  const pol = G.policy || [];
  const best = (keys) => keys.map(k => ({ k, a: apt(G, id, k) })).sort((a, b) => b.a - a.a)[0];
  const fromPol = best(pol.filter(k => apt(G, id, k) >= 4));
  const own = best(GROW_KEYS);
  const k = (fromPol || own).k;
  if (P.pts > 0) return { id, act: 'train', k };
  if (apt(G, id, 'scan') >= 6 && G.lastD && R() < 0.6) return { id, act: 'info' };
  return { id, act: 'drill', k };
}
// 覚えられる号令（まだ覚えていない・前の段階を覚えている）
export function learnable(G) {
  const has = new Set(G.maou.cmds);
  return Object.keys(CMDS).filter(c => !has.has(c) && CMDS[c].tier > 0 && (!CMDS[c].req || has.has(CMDS[c].req)));
}
// 自由行動を行う。act：魔王の行動 { type:'learn', cmd } / { type:'power' } / { type:'scout', ids } / { type:'assassin', id }
// 買い物の候補：前の敵が魔法で攻めてきて負けたらお守り、主力には武器、盾役にはよろい
function shopList(G, rows) {
  const out = [];
  const d = G.lastD, magHeavy = d && monStats(d).magShare >= 0.5 && G.lastOutcome !== 'win';
  // 魔王が魔法の魔物ばかり使うと覚えていたら、よく出る属性のお守りを先に買っておく
  const fav = designHabit(G) === 'magic' ? favElem(G) : null;
  const fighters = rows.filter(o => o.act !== 'rest' && o.act !== 'train').map(o => o.id)
    .sort((a, b) => Math.max(...KEYS.map(k => apt(G, b, k))) - Math.max(...KEYS.map(k => apt(G, a, k))));
  for (const id of fighters.slice(0, 5)) {
    const g = G.party[id].gear;
    if (magHeavy && !g.charm.includes(d.elem)) out.push({ id, item: 'charm', el: d.elem });
    else if (fav && !g.charm.includes(fav)) out.push({ id, item: 'charm', el: fav });
    else if (g.wpn < ITEMS.wpn.max) out.push({ id, item: 'wpn' });
    else if (apt(G, id, 'guard') >= 6 && g.armor < ITEMS.armor.max) out.push({ id, item: 'armor' });
  }
  return out;
}
function buy(G, o, b) {
  const it = ITEMS[b.item], P = G.party[o.id];
  if (G.gold < it.price) return false;
  G.gold -= it.price;
  if (b.item === 'wpn') { P.gear.wpnK = WEAPONS.slice().sort((x, y) => apt(G, o.id, y) - apt(G, o.id, x))[0]; P.gear.wpn++; o.buy = `${WEAPON[P.gear.wpnK].name}（業物）`; }
  else if (b.item === 'armor') { P.gear.armor++; o.buy = 'よろい'; }
  else { P.gear.charm.push(b.el); o.buy = `${ELEM[b.el].name}のお守り`; }
  o.act = 'shop';
  return true;
}
export function freePhase(G, act, plan = null) {
  decidePolicy(G);
  if (plan?.policy?.length) G.policy = plan.policy.filter(k => KEYS.includes(k)).slice(0, 2).concat(G.policy.includes('heal') ? ['heal'] : []);
  if (!G.policy.length) decidePolicy(G);
  const rows = IDS.map(id => {
    let o = planOne(G, id);
    const want = plan?.acts?.[id];
    // AIの案：無理なものは直す（鍛えるポイントがなければ自主練、ケガなら休む）
    if (want && !G.party[id].hurt) {
      if (want === 'rest') o = { id, act: 'rest' };
      else if (want === 'train' && G.party[id].pts > 0) o = { id, act: 'train', k: o.k || G.policy[0] };
      else if (want === 'info' && apt(G, id, 'scan') >= 5 && G.lastD) o = { id, act: 'info' };
      else if (want === 'shop' || want === 'drill') o = { id, act: o.act === 'rest' ? 'rest' : 'drill', k: o.k || G.policy[0], wantShop: want === 'shop' };
    }
    return o;
  });
  // 買い物（自主練の予定だった子が、お金があれば買いに行く）
  for (const b of shopList(G, rows)) {
    const o = rows.find(x => x.id === b.id);
    if (o && (o.act === 'drill' || o.act === 'info' || o.wantShop)) buy(G, o, b);
  }
  for (const o of rows) {
    const id = o.id, P = G.party[id];
    if (o.act === 'rest') { P.hpR = 1; P.hurt = 0; P.tired = 0; }
    else {
      P.hpR = Math.min(1, (P.hpR ?? 1) + 0.15);
      if (o.act === 'train') {
        // ポイントを使って伸ばす（伸びにくいものは上限が低い。上限なら次に得意なものへ）
        const got = {};
        while (P.pts > 0) {
          const k = [o.k, ...GROW_KEYS.slice().sort((a, b) => apt(G, id, b) - apt(G, id, a))].find(x => (P.bonus[x] || 0) < growCap(id, x) + 2);
          if (!k) break;
          P.bonus[k] = (P.bonus[k] || 0) + 1; P.pts--; got[k] = (got[k] || 0) + 1;
        }
        o.got = got;
      } else if (o.act === 'drill') P.mast[o.k] = Math.min(100, (P.mast[o.k] || 0) + 10);
      else if (o.act === 'shop') { /* 買ったものは buy で反映ずみ */ }
      else if (o.act === 'info') {
        // 情報集め：最後に戦った魔物の効き目を1つ図鑑に書く
        const d = G.lastD, B = G.book[lookKey(d)];
        const ms = monStats(d);
        const cand = KEYS.filter(k => B && B.res[k] == null);
        if (cand.length) {
          const k = cand[Math.floor(R() * cand.length)];
          const real = RES_MULT[d.res[k] || 0] * (WEAPON[k] ? ms.defF : ms.mdefF);
          B.res[k] = Math.round(real * 100) / 100;
          o.found = revealText(keyName(k), real);
        }
      }
    }
  }
  G.heard = false;
  // 魔王の行動（夜のうちに）
  let maou = '';
  if (act?.type === 'learn' && CMDS[act.cmd] && !G.maou.cmds.includes(act.cmd)) { G.maou.cmds.push(act.cmd); maou = `号令「${CMDS[act.cmd].name}」を覚えた。`; }
  else if (act?.type === 'power') { G.power = (G.power || 0) + MAOU_POWER_ACT; maou = `力をためた。使える魔力+${MAOU_POWER_ACT}。`; }
  else if (act?.type === 'scout') { for (const id of act.ids || []) G.scout[id] = true; maou = `偵察した：${(act.ids || []).map(nameOf).join('・')}。得意・能力・育ち方がすべてわかった。`; }
  else if (act?.type === 'eavesdrop') {
    G.heard = true;
    maou = `酒場で盗み聞きした。Liella!は次に${G.policy.map(keyName).join('と')}を鍛えるつもりらしい。今夜の過ごし方も全部わかった。（残りのお金 ${G.gold}）`;
  } else if (act?.type === 'rumor' && KEYS.includes(act.k)) {
    G.rumor = { k: act.k };
    maou = `町に「次の魔物は${keyName(act.k)}に弱いらしい」という噂を流した。`;
  }
  else if (act?.type === 'assassin' && G.party[act.id]) {
    const P = G.party[act.id];
    P.hpR = Math.max(0.05, (P.hpR ?? 1) - 0.7); P.tired = Math.min(3, P.tired + 2);
    // そばにいた2人も巻きこまれる
    const near = IDS.filter(x => x !== act.id && !G.party[x].hurt).sort(() => R() - 0.5).slice(0, 3);
    for (const x of near) { G.party[x].hpR = Math.max(0.05, (G.party[x].hpR ?? 1) - 0.45); G.party[x].tired = Math.min(3, G.party[x].tired + 1); }
    maou = `刺客が夜の町で${nameOf(act.id)}を襲った！ 体力が大きく減り、ひどく疲れた。そばにいた${near.map(nameOf).join('・')}も傷を負って疲れた。`;
  }
  G.free = rows; G.phase = null;
  return { rows, maou };
}
// 魔王から見た自由行動の結果（鍛えた中身は偵察した子だけ見える）
export const ACT_NAME = { rest: '休んだ', train: '鍛えた', info: '情報を集めた', drill: '自主練をした', shop: '買い物をした' };
export function rowText(G, o) {
  const known = G.scout[o.id] || G.heard;
  if (o.act === 'shop') return known ? `買い物をした（${o.buy}）` : '買い物をした（中身は見えなかった）';
  if (o.act === 'train') return known && o.got ? `鍛えた（${Object.entries(o.got).map(([k, n]) => `${keyName(k)}+${n}`).join('・')}）` : '鍛えた（中身は見えなかった）';
  if (o.act === 'drill') return known ? `自主練をした（${keyName(o.k)}）` : '自主練をした';
  if (o.act === 'info') return o.found ? `情報を集めた（図鑑に「${o.found}」と書いた）` : '情報を集めた';
  return '休んだ（体力・ケガ・疲れが回復）';
}
