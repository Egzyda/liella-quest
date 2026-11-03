// 自由行動：戦いのあと、Liella!と魔王がそれぞれ1つずつ動く（日は進まない）
// Liella!：休む（体力・ケガ・疲れが全部戻る）／鍛える（レベルアップのポイントを方針どおりに使う）／情報集め（図鑑が埋まる）／自主練（熟練度）
// 魔王（1回）：号令を覚える／力をためる／偵察（2人を全部見る）／刺客（1人の体力を削って疲れ+1）
import { IDS, CHARS, KEYS, WEAPON, keyName, RES_MULT, GROW_KEYS, growCap, CMDS, MAOU_POWER_ACT } from './data.js?v=2026.11.03-23';
import { apt, belief, monStats, lookKey, revealText } from './engine.js?v=2026.11.03-23';
import { nameOf } from './talk.js?v=2026.11.03-23';

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
export function freePhase(G, act) {
  decidePolicy(G);
  const rows = [];
  for (const id of IDS) {
    const o = planOne(G, id), P = G.party[id];
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
    rows.push(o);
  }
  // 魔王の行動（夜のうちに）
  let maou = '';
  if (act?.type === 'learn' && CMDS[act.cmd] && !G.maou.cmds.includes(act.cmd)) { G.maou.cmds.push(act.cmd); maou = `号令「${CMDS[act.cmd].name}」を覚えた。`; }
  else if (act?.type === 'power') { G.power = (G.power || 0) + MAOU_POWER_ACT; maou = `力をためた。使える魔力+${MAOU_POWER_ACT}。`; }
  else if (act?.type === 'scout') { for (const id of act.ids || []) G.scout[id] = true; maou = `偵察した：${(act.ids || []).map(nameOf).join('・')}。得意・能力・育ち方がすべてわかった。`; }
  else if (act?.type === 'assassin' && G.party[act.id]) {
    const P = G.party[act.id];
    P.hpR = Math.max(0.05, (P.hpR ?? 1) - 0.7); P.tired = Math.min(3, P.tired + 2);
    // そばにいた2人も巻きこまれる
    const near = IDS.filter(x => x !== act.id && !G.party[x].hurt).sort(() => R() - 0.5).slice(0, 2);
    for (const x of near) { G.party[x].hpR = Math.max(0.05, (G.party[x].hpR ?? 1) - 0.4); G.party[x].tired = Math.min(3, G.party[x].tired + 1); }
    maou = `刺客が夜の町で${nameOf(act.id)}を襲った！ 体力が大きく減り、ひどく疲れた。そばにいた${near.map(nameOf).join('・')}も傷を負って疲れた。`;
  }
  G.free = rows; G.phase = null;
  return { rows, maou };
}
// 魔王から見た自由行動の結果（鍛えた中身は偵察した子だけ見える）
export const ACT_NAME = { rest: '休んだ', train: '鍛えた', info: '情報を集めた', drill: '自主練をした' };
export function rowText(G, o) {
  const known = G.scout[o.id];
  if (o.act === 'train') return known && o.got ? `鍛えた（${Object.entries(o.got).map(([k, n]) => `${keyName(k)}+${n}`).join('・')}）` : '鍛えた（中身は見えなかった）';
  if (o.act === 'drill') return known ? `自主練をした（${keyName(o.k)}）` : '自主練をした';
  if (o.act === 'info') return o.found ? `情報を集めた（図鑑に「${o.found}」と書いた）` : '情報を集めた';
  return '休んだ（体力・ケガ・疲れが回復）';
}
