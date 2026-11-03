// バージョンを上げる（タイトルの「最新版に更新」とキャッシュ対策に使う）
// index.html と、すべての js の import にバージョン番号（?v=）を付けて、更新したら必ず新しいファイルが読まれるようにする
import fs from 'node:fs';
import path from 'node:path';
const d = new Date(Date.now() + 9 * 3600e3);
const ymd = `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
let n = 1;
try { const m = fs.readFileSync('js/version.js', 'utf8').match(/'(\d{4}\.\d\d\.\d\d)-(\d+)'/); if (m && m[1] === ymd) n = +m[2] + 1; } catch {}
const v = `${ymd}-${n}`;
fs.writeFileSync('js/version.js', `export const VERSION = '${v}';\n`);
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/\?v=[^"']+/g, `?v=${v}`);
fs.writeFileSync('index.html', html);
// js の中の import 'xxx.js' にもバージョンを付ける
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
for (const f of walk('js')) {
  const s = fs.readFileSync(f, 'utf8');
  const t = s.replace(/(from\s+['"])(\.{1,2}\/[^'"?]+\.js)(\?v=[^'"]*)?(['"])/g, `$1$2?v=${v}$4`);
  if (t !== s) fs.writeFileSync(f, t);
}
console.log('version', v);
