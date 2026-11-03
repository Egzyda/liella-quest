// セリフ選び：キャラごとのセリフ集から選ぶ（同じセリフが続かない）。口調はAIに作らせない
import { CHARS, callName, callYou } from './data.js?v=2026.11.03-25';
import { LINES } from './lines/index.js?v=2026.11.03-25';

const recent = {};
export const nameOf = id => CHARS[id]?.name || id;

export function line(sp, key, vars = {}) {
  const list = LINES[sp]?.[key];
  if (!list || !list.length) return null;
  const rk = sp + ':' + key;
  const used = recent[rk] || (recent[rk] = []);
  let pool = list.filter((_, i) => !used.includes(i));
  if (!pool.length) { used.length = 0; pool = list; }
  const t = pool[Math.floor(Math.random() * pool.length)];
  used.push(list.indexOf(t));
  if (used.length > Math.max(0, list.length - 1)) used.shift();
  return t.replace(/\{t\}/g, () => (vars.t ? callName(sp, vars.t) : ''))
    .replace(/\{k\}/g, vars.k ?? '').replace(/\{e\}/g, vars.e ?? '').replace(/\{s\}/g, vars.s ?? '').replace(/\{p\}/g, () => callYou(sp, vars.p));
}

export function say(sp, key, vars) {
  return { t: 'say', sp, key, text: line(sp, key, vars) || '……。' };
}
