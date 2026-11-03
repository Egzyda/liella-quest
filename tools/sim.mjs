// 自動テスト：魔王がランダムにモンスターを作り、ステージを最後まで進める。エラー・セリフ抜け・バランスを確認
// 使い方：node tools/sim.mjs 50
import * as E from '../js/engine.js';
import { STATS, KEYS, TRAITS, SHAPES, ELEMS, STAGES, FOLK_WEAK, IDS } from '../js/data.js';
import { freePhase, learnable } from '../js/camp.js';
// 4番目：魔王の自由行動（mix／none／power／learn／scout／assassin）、5番目：号令（auto／none）
const ACT = process.argv[4] || 'mix', CMD = process.argv[5] || 'auto';
function maouAct(G) {
  const t = ACT === 'mix' ? pick(['power', 'learn', 'assassin', 'learn']) : ACT;
  if (t === 'none') return null;
  if (t === 'learn') { const l = learnable(G); return l.length ? { type: 'learn', cmd: pick(l) } : { type: 'power' }; }
  if (t === 'scout') return { type: 'scout', ids: [pick(IDS), pick(IDS)] };
  if (t === 'assassin') { const av = IDS.filter(id => !G.party[id].hurt).sort((a, b) => G.party[b].lv - G.party[a].lv); return { type: 'assassin', id: av[0] || IDS[0] }; }
  return { type: t };
}
const STYLE = process.argv[3] || 'mix';
const N = +process.argv[2] || 30;
const R = Math.random, pick = a => a[Math.floor(R() * a.length)];
function randomDesign(budget, style) {
  for (let tries = 0; tries < 400; tries++) {
    const d = E.blankDesign();
    d.name = 'テスト'; d.shape = pick(Object.keys(SHAPES)); d.elem = pick(ELEMS);
    for (const s of STATS) d.stats[s] = Math.floor(R() * Math.min(16, budget / 4));
    if (style === 'smart') {
      // 言い伝えの弱点を逆に無効化し、魔法防御を上げ、ほかは弱点にして魔力を取り戻す
      for (const s of STATS) d.stats[s] = 0;
      d.res = { [FOLK_WEAK[d.elem]]: 3, [d.elem]: -3 };
      d.res[pick(['fist', 'spear'])] = -3;
      d.stats.mdef = 7; d.stats.hp = 6 + Math.floor(R() * 3); d.stats.atk = 4 + Math.floor(R() * 4); d.stats.def = Math.floor(R() * 5); d.stats.spd = Math.floor(R() * 6);
      if (R() < 0.5) d.traits.push(pick(['regen', 'fly', 'sweep']));
      for (let i = 0; i < 60 && E.costOf(d) < budget - 3; i++) { const k = pick(['hp', 'atk', 'mdef', 'def', 'spd', 'hp']); if (d.stats[k] < 15) d.stats[k]++; }
      while (E.costOf(d) > budget) { const k = pick(['atk', 'def', 'spd', 'hp']); if (d.stats[k] > 0) d.stats[k]--; }
      return d;
    } else {
      for (let i = 0; i < 3; i++) if (R() < 0.5) d.res[pick(KEYS)] = Math.floor(R() * 7) - 3;
      if (R() < 0.4) d.traits.push(pick(Object.keys(TRAITS)));
    }
    const c = E.costOf(d);
    if (c <= budget && c >= budget - 8) return d;
    if (style === 'smart' && c > budget) continue;
  }
  const d = E.blankDesign(); return d;
}
let maou = 0, err = 0, empty = 0, total = 0, tries = [], wins = 0, fights = 0, rounds = [];
const out = {};
for (let g = 0; g < N; g++) {
  const G = E.newGame();
  let guard = 0;
  const per = [];
  while (!G.cleared && !G.maouWin && guard++ < 60) {
    const f = E.currentFight(G);
    if (!G.next) G.next = randomDesign(f.budget, STYLE === 'mix' ? (R() < 0.3 ? 'smart' : '') : STYLE);
    try {
      const M = E.meeting(G, G.next);
      const res = await E.battle(G, G.next, M, { auto: CMD === 'auto' });
      const rv = E.review(G, G.next, res);
      for (const e of [...M.ev, ...res.ev, ...rv]) { total++; if (e.t === 'say' && e.text === '……。') { empty++; out[e.sp + ':' + e.key] = 1; } }
      fights++; rounds.push(res.round);
      if (res.win) { wins++; per.push(G.tries[`${G.stage}-${G.fight}`]); E.advance(G); }
      E.checkDeadline(G);
      if (!G.cleared && !G.maouWin) freePhase(G, maouAct(G));
    } catch (e) { err++; console.error(e); break; }
  }
  if (G.maouWin) maou++; else tries.push(per);
}
const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
const totals = tries.map(t => t.reduce((a, b) => a + b, 0)).sort((a, b) => a - b);
console.log('魔王の勝ち', Math.round(maou / N * 100) + '%');
if (totals.length) console.log('（突破されたとき）日数 中央値', totals[Math.floor(totals.length / 2)], '80%の人', totals[Math.floor(totals.length * 0.8)], '最大', totals[totals.length - 1]);
console.log(`ゲーム${N} 戦闘${fights} 勝率${(wins / fights * 100).toFixed(0)}% 平均ターン${avg(rounds)} エラー${err} セリフ抜け${empty}/${total}`, Object.keys(out).slice(0, 10));
for (let i = 0; i < 4 && tries.length; i++) console.log(`戦い${i + 1}：1回目で突破 ${Math.round(tries.filter(t => t[i] === 1).length / Math.max(1, tries.filter(t => t[i]).length) * 100)}%　突破までの挑戦回数 平均${avg(tries.map(t => t[i] || 0))} 最大${Math.max(...tries.map(t => t[i] || 0))}`);
