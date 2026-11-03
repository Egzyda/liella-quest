// AI（作戦会議だけで使う）。頭脳は「ふつう（AIなし）／クラウドAI／PCのAI（Ollama）」
// AIにはセリフを書かせない。数字の表を見て「誰が出るか・何で攻めるか」を選ばせ、理由を短く言わせるだけ。
// 答えはプログラムが確かめ、おかしければルールで決める。
import { IDS, CHARS, KEYS, keyName, ELEM, SHAPES, TRAITS, HABIT_TEXT, ITEMS } from './data.js?v=2026.11.03-26';
import { apt, belief, available, charStats, lookName, mText, topHabit, monStats } from './engine.js?v=2026.11.03-26';

export const OLLAMA_URL = 'http://localhost:11434';
export const OLLAMA_MODEL = 'gemma3:12b';
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

async function fetchT(url, opt, ms) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opt, signal: c.signal }); } finally { clearTimeout(t); }
}

export const AI = {
  mode: 'none', ready: false, quotaOut: false, model: OLLAMA_MODEL, served: '',
  isMobile() { const ua = navigator.userAgent || ''; return /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.maxTouchPoints > 1 && Math.min(innerWidth, innerHeight) < 820); },
  usable() { return this.mode !== 'none' && this.ready && !this.quotaOut; },
  async connect(mode, model) {
    this.mode = mode; this.ready = false;
    if (mode === 'none') return true;
    if (mode === 'cloud') {
      try { if (localStorage.getItem('lq-quota') === today()) { this.quotaOut = true; throw new Error('quota'); } } catch (e) { if (e.message === 'quota') throw e; }
      let r; try { r = await fetchT('api/chat', { cache: 'no-store' }, 8000); } catch { throw new Error('connect'); }
      if (!r.ok) throw new Error('connect');
      const j = await r.json().catch(() => ({}));
      if (!j.ai) throw new Error('nobind');
      this.ready = true; return true;
    }
    // PCのAI（Ollama）
    this.model = (model || OLLAMA_MODEL).trim();
    let r; try { r = await fetchT(`${OLLAMA_URL}/api/tags`, { cache: 'no-store' }, 6000); } catch { throw new Error('connect'); }
    if (!r.ok) throw new Error('connect');
    const names = ((await r.json().catch(() => ({}))).models || []).map(m => m.name);
    const hit = names.find(n => n === this.model || n === this.model + ':latest') || names.find(n => n.split(':')[0] === this.model);
    if (!hit) { const e = new Error('nomodel'); e.names = names; throw e; }
    this.served = hit;
    fetch(`${OLLAMA_URL}/api/chat`, { method: 'POST', body: JSON.stringify({ model: hit, messages: [{ role: 'user', content: 'こんにちは' }], stream: false, keep_alive: '30m', options: { num_predict: 1 } }) }).catch(() => {});
    this.ready = true; return true;
  },
  async ask(messages, max = 300) {
    if (this.mode === 'cloud') {
      const r = await fetchT('api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, max_tokens: max, temperature: 0.6, tier: 'main' }) }, 20000);
      if (r.status === 429) { this.quotaOut = true; try { localStorage.setItem('lq-quota', today()); } catch {} throw new Error('quota'); }
      if (!r.ok) throw new Error('cloud ' + r.status);
      return String((await r.json()).text || '');
    }
    const body = { model: this.served || this.model, messages, stream: false, keep_alive: '30m', format: 'json', options: { temperature: 0.6, num_predict: max, num_ctx: 4096 } };
    if (/qwen3/i.test(body.model)) body.think = false;
    const r = await fetchT(`${OLLAMA_URL}/api/chat`, { method: 'POST', body: JSON.stringify(body) }, 60000);
    if (!r.ok) throw new Error('ollama ' + r.status);
    return String((await r.json()).message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  },

  // 作戦会議：出撃の4人と、主に使う攻撃を選ばせる
  async plan(G, d) {
    if (!this.usable()) return null;
    const av = available(G);
    const b = G.book[`${d.shape}:${d.elem}`];
    const know = KEYS.map(k => { const x = belief(G, d, k); return x.src === 'known' || x.src === 'fact' ? `${k}(${keyName(k)}):${mText(x.m)}` : null; }).filter(Boolean);
    const traits = b ? Object.keys(b.traits).map(t => TRAITS[t].name) : [];
    const rows = av.map(id => {
      const C = CHARS[id], P = G.party[id];
      const top = KEYS.map(k => [k, apt(G, id, k)]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}${v}`).join(' ');
      return `${id}(${C.name}) Lv${P.lv} 体力${Math.round((P.hpR ?? 1) * 100)}% 疲れ${P.tired}/3 得意:${top} 回復${apt(G, id, 'heal')} 歌${apt(G, id, 'song')} 盾${apt(G, id, 'guard')} 分析${apt(G, id, 'scan')} 性格:慎重${C.p.careful} 無鉄砲${C.p.rash}`;
    }).join('\n');
    const sys = 'あなたはRPGのパーティーの参謀です。表の数字（0〜10、大きいほど得意）を見て、次の戦いに出る4人と、主に使う攻撃を決めます。'
      + '答えはJSONだけで返します：{"team":["id","id","id","id"],"focus":"攻撃のキー","plan":"focus|explore|balanced","reason":"30文字以内の日本語の理由"}。'
      + 'focusは sword spear bow fist fire water wind earth light dark のどれか。効き目が分からないときは plan を explore にして、いろいろな攻撃を持つ人を選ぶ。'
      + '効かないと分かっている攻撃は focus にしない。疲れが2以上の人・体力が減っている人はなるべく休ませる。回復できる人を1人入れると安全。'
      + '魔王は戦闘中に号令（狙いの指示・ため・威嚇など）を出してくる。魔王のくせが分かっていれば、それに強い顔ぶれ（盾が得意な人など）にする。';
    const user = `敵の見た目：${lookName(d)}（${ELEM[d.elem].name}属性・${SHAPES[d.shape].name}）。会うのは${(b?.met || 0) + 1}回目、これまで${b?.wins || 0}勝${b?.losses || 0}敗。\n`
      + `図鑑で分かっている効き目：${know.length ? know.join('、') : 'なし'}\n分かっている能力：${traits.length ? traits.join('、') : 'なし'}\n`
      + `魔王のくせ：${topHabit(G) ? HABIT_TEXT[topHabit(G)] : 'まだ分からない'}\n`
      + `出られる人：\n${rows}`;
    try {
      const out = await this.ask([{ role: 'system', content: sys }, { role: 'user', content: user }]);
      const s = out.indexOf('{'), e = out.lastIndexOf('}');
      const j = JSON.parse(out.slice(s, e + 1));
      const team = [...new Set((j.team || []).map(String))].filter(id => av.includes(id)).slice(0, 4);
      if (team.length !== 4) return null;
      const focus = KEYS.includes(j.focus) ? j.focus : null;
      const plan = ['focus', 'explore', 'balanced'].includes(j.plan) ? j.plan : 'balanced';
      let reason = String(j.reason || '').replace(/["「」]/g, '').slice(0, 40);
      if (!/[ぁ-んァ-ヶ一-龥]/.test(reason)) reason = '';
      return { team, focus, plan, reason };
    } catch (e) { console.warn('AIの作戦会議に失敗', e); return null; }
  },

  // 戦闘中の大事な場面：攻める／守る／いまのまま／撤退、と主に使う攻撃を選ばせる
  async tactic(G, d, st) {
    if (!this.usable()) return null;
    const TRIG = { pinch: '仲間がピンチ（倒れた人がいる、または体力が少ない）', surprise: '予想と違うことが起きた（効くはずの攻撃が効かない・跳ね返された）', check: '戦いの途中の見直し' };
    const know = KEYS.map(k => { const x = belief(G, d, k); return x.src === 'known' || x.src === 'fact' ? `${k}:${mText(x.m)}` : null; }).filter(Boolean);
    const team = st.team.map(x => `${CHARS[x.id].name}(${x.id}) 体力${Math.round(x.hp * 100)}%${x.hp <= 0 ? '・倒れている' : ''} 得意:${KEYS.map(k => [k, apt(G, x.id, k)]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + v).join(' ')}`).join('\n');
    const recent = st.recent.map(r => `${r.k}→${mText(r.m)}`).join('、');
    const sys = 'あなたはRPGのパーティーの参謀です。戦いの途中で、これからの方針を決めます。答えはJSONだけ：'
      + '{"stance":"attack|defend|normal|retreat","focus":"攻撃のキーかnull","reason":"25文字以内の日本語"}。'
      + 'attack＝回復を減らして攻める、defend＝回復と盾（挑発・かばう）を優先、retreat＝逃げる（負けになるが全滅よりまし）。'
      + 'focusは sword spear bow fist fire water wind earth light dark のどれか。効かないと分かっている攻撃は選ばない。';
    const user = `状況：${TRIG[st.trig]}。${st.round}ターン目。\n敵：${lookName(d)}。敵の残り体力の見た目：約${Math.round(st.monHp * 100)}%。\n`
      + `いまの方針：${st.stance}、主に使う攻撃：${st.focus || 'なし'}\n図鑑の効き目：${know.join('、') || 'まだ分からない'}\n最近の攻撃の手応え：${recent || 'なし'}\n仲間：\n${team}`;
    try {
      const out = await this.ask([{ role: 'system', content: sys }, { role: 'user', content: user }], 160);
      const s2 = out.indexOf('{'), e = out.lastIndexOf('}');
      const j = JSON.parse(out.slice(s2, e + 1));
      const stance = ['attack', 'defend', 'normal', 'retreat'].includes(j.stance) ? j.stance : null;
      const focus = KEYS.includes(j.focus) ? j.focus : null;
      let reason = String(j.reason || '').replace(/["「」]/g, '').slice(0, 36);
      if (!/[ぁ-んァ-ヶ一-龥]/.test(reason)) reason = '';
      if (!stance && !focus) return null;
      return { stance, focus, reason };
    } catch (e) { console.warn('AIの戦闘中の判断に失敗', e); return null; }
  },
  // 自由行動：1人ずつの過ごし方と、次に鍛える攻撃を決めさせる（無理なものはプログラムが直す）
  async freePlan(G) {
    if (!this.usable()) return null;
    const d = G.lastD;
    const rows = IDS.map(id => {
      const C = CHARS[id], P = G.party[id];
      const top = KEYS.map(k => [k, apt(G, id, k)]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}${v}`).join(' ');
      return `${id}(${C.name}) Lv${P.lv} 体力${Math.round((P.hpR ?? 1) * 100)}% 疲れ${P.tired}/3${P.hurt ? ' ケガ' : ''} 鍛えるポイント${P.pts} 得意:${top} 分析${apt(G, id, 'scan')} 装備:武器+${P.gear?.wpn || 0} よろい${P.gear?.armor || 0} お守り${(P.gear?.charm || []).map(e => ELEM[e].name).join('') || 'なし'}`;
    }).join('\n');
    const know = d ? KEYS.map(k => { const x = belief(G, d, k); return x.src === 'known' || x.src === 'fact' ? `${k}:${mText(x.m)}` : null; }).filter(Boolean) : [];
    const sys = 'あなたはRPGのパーティーの司令塔です。戦いのあとの自由時間に、仲間ひとりひとりの過ごし方と、次に鍛える攻撃を決めます。答えはJSONだけ：'
      + '{"acts":{"id":"rest|train|shop|info|drill", ...11人ぶん},"policy":["攻撃のキー","攻撃のキー"],"reason":"30文字以内の日本語"}。'
      + 'rest＝休む（体力・ケガ・疲れが全部戻る。ケガの人は必ずrest）、train＝鍛える（鍛えるポイントがある人だけ。policyの攻撃が伸びる）、shop＝装備を買う（お金があるとき。武器・よろい・お守り）、info＝情報集め（分析が高い人向け。敵の効き目がわかる）、drill＝自主練。'
      + 'policy は sword spear bow fist fire water wind earth light dark から2つ。効いた攻撃や、得意な人が多い攻撃を伸ばすと強い。';
    const user = `前の敵：${d ? lookName(d) : 'なし'}（結果：${G.lastOutcome === 'win' ? '勝ち' : '負け'}、${d ? (monStats(d).magShare >= 0.5 ? '魔法が多い' : '物理が多い') : ''}）\n図鑑の効き目：${know.join('、') || 'まだ分からない'}\n`
      + `お金：${G.gold}（武器${ITEMS.wpn.price}・よろい${ITEMS.armor.price}・お守り${ITEMS.charm.price}）\n魔王のくせ：${topHabit(G) ? HABIT_TEXT[topHabit(G)] : 'まだ分からない'}\n仲間：\n${rows}`;
    try {
      const out = await this.ask([{ role: 'system', content: sys }, { role: 'user', content: user }], 420);
      const s2 = out.indexOf('{'), e = out.lastIndexOf('}');
      const j = JSON.parse(out.slice(s2, e + 1));
      const acts = {};
      for (const id of IDS) if (['rest', 'train', 'shop', 'info', 'drill'].includes(j.acts?.[id])) acts[id] = j.acts[id];
      const policy = (j.policy || []).filter(k => KEYS.includes(k)).slice(0, 2);
      let reason = String(j.reason || '').replace(/["「」]/g, '').slice(0, 40);
      if (!/[ぁ-んァ-ヶ一-龥]/.test(reason)) reason = '';
      if (!Object.keys(acts).length && !policy.length) return null;
      return { acts, policy, reason };
    } catch (e) { console.warn('AIの自由行動に失敗', e); return null; }
  },
  // 頭脳ごとの使い方：PCのAIはたくさん、クラウドAIは大事な場面だけ
  battleHooks() {
    if (!this.usable()) return {};
    if (this.mode === 'ollama') return { maxAI: 6, periodic: 3, timeout: 15000 };
    return { maxAI: 2, periodic: 0, timeout: 7000 };
  },
};
