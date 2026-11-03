// AI（作戦会議だけで使う）。頭脳は「ふつう（AIなし）／クラウドAI／PCのAI（Ollama）」
// AIにはセリフを書かせない。数字の表を見て「誰が出るか・何で攻めるか」を選ばせ、理由を短く言わせるだけ。
// 答えはプログラムが確かめ、おかしければルールで決める。
import { IDS, CHARS, KEYS, keyName, ELEM, SHAPES, TRAITS } from './data.js?v=2026.11.03-3';
import { apt, belief, available, charStats, lookName, mText } from './engine.js?v=2026.11.03-3';

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
      return `${id}(${C.name}) Lv${P.lv} 疲れ${P.tired}/3 得意:${top} 回復${apt(G, id, 'heal')} 歌${apt(G, id, 'song')} かばう${apt(G, id, 'guard')} 分析${apt(G, id, 'scan')} 性格:慎重${C.p.careful} 無鉄砲${C.p.rash}`;
    }).join('\n');
    const sys = 'あなたはRPGのパーティーの参謀です。表の数字（0〜10、大きいほど得意）を見て、次の戦いに出る4人と、主に使う攻撃を決めます。'
      + '答えはJSONだけで返します：{"team":["id","id","id","id"],"focus":"攻撃のキー","plan":"focus|explore|balanced","reason":"30文字以内の日本語の理由"}。'
      + 'focusは sword spear bow fist fire water wind earth light dark のどれか。効き目が分からないときは plan を explore にして、いろいろな攻撃を持つ人を選ぶ。'
      + '効かないと分かっている攻撃は focus にしない。疲れが2以上の人はなるべく休ませる。回復できる人を1人入れると安全。';
    const user = `敵の見た目：${lookName(d)}（${ELEM[d.elem].name}属性・${SHAPES[d.shape].name}）。会うのは${(b?.met || 0) + 1}回目、これまで${b?.wins || 0}勝${b?.losses || 0}敗。\n`
      + `図鑑で分かっている効き目：${know.length ? know.join('、') : 'なし'}\n分かっている能力：${traits.length ? traits.join('、') : 'なし'}\n`
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
      return { team, focus, plan, reason: reason ? `AIの作戦：${reason}` : '' };
    } catch (e) { console.warn('AIの作戦会議に失敗', e); return null; }
  },
};
