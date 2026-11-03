// モンスターの見た目（SVG）。形・属性の色・数値で姿が変わる
// 攻撃が高い→トゲや角、防御が高い→よろい、魔法防御が高い→魔法の輪、素早さ→風の線、体力→大きさ
import { ELEM } from './data.js?v=2026.11.03-2';

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
};

const BODY = {
  slime: c => `<path d="M40 150 Q30 110 60 80 Q100 30 140 80 Q170 110 160 150 Q100 165 40 150Z" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <ellipse cx="78" cy="88" rx="14" ry="8" fill="#fff" opacity=".35"/>`,
  beast: c => `<ellipse cx="110" cy="115" rx="58" ry="34" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <path d="M70 140 L64 168 M92 145 L90 170 M128 145 L130 170 M150 138 L158 166" stroke="${c.line}" stroke-width="9" stroke-linecap="round"/>
    <circle cx="60" cy="88" r="28" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <path d="M42 66 L40 44 L56 60Z M68 60 L78 40 L80 64Z" fill="${c.dark}" stroke="${c.line}" stroke-width="3"/>
    <path d="M166 110 Q186 96 180 76" fill="none" stroke="${c.line}" stroke-width="6" stroke-linecap="round"/>`,
  bird: c => `<ellipse cx="100" cy="110" rx="34" ry="40" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <circle cx="100" cy="64" r="22" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <path d="M100 70 L118 78 L100 84Z" fill="#ffcf4a" stroke="${c.line}" stroke-width="3"/>
    <path d="M92 150 L86 172 M108 150 L114 172" stroke="${c.line}" stroke-width="5" stroke-linecap="round"/>`,
  golem: c => `<rect x="62" y="70" width="76" height="78" rx="6" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <rect x="76" y="36" width="48" height="38" rx="5" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <rect x="32" y="76" width="28" height="56" rx="6" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <rect x="140" y="76" width="28" height="56" rx="6" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <rect x="68" y="148" width="24" height="24" rx="4" fill="${c.dark}" stroke="${c.line}" stroke-width="4"/>
    <rect x="108" y="148" width="24" height="24" rx="4" fill="${c.dark}" stroke="${c.line}" stroke-width="4"/>
    <path d="M80 100 L96 112 L88 126 M120 96 L112 118" stroke="${c.line}" stroke-width="2" fill="none" opacity=".6"/>`,
  ghost: c => `<path d="M50 160 L50 90 Q50 40 100 40 Q150 40 150 90 L150 160 L137 148 L125 162 L112 148 L100 162 L88 148 L75 162 L63 148Z" fill="url(#GID)" stroke="${c.line}" stroke-width="4" opacity=".92"/>
    <path d="M50 110 Q30 120 34 140 M150 110 Q170 120 166 140" stroke="${c.line}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  dragon: c => `<path d="M150 150 Q190 150 186 112" fill="none" stroke="${c.line}" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="112" cy="128" rx="48" ry="34" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <path d="M86 112 Q70 80 72 60" fill="none" stroke="${c.line}" stroke-width="22" stroke-linecap="round"/>
    <path d="M86 112 Q70 80 72 60" fill="none" stroke="${c.fill}" stroke-width="14" stroke-linecap="round"/>
    <path d="M50 46 Q76 30 96 52 Q90 70 64 70 Q48 64 50 46Z" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <path d="M62 36 L56 16 L72 32 M82 36 L92 18 L90 40" stroke="${c.line}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M90 150 L86 172 M134 152 L138 172" stroke="${c.line}" stroke-width="10" stroke-linecap="round"/>`,
  knight: c => `<path d="M64 168 L72 96 Q100 84 128 96 L136 168Z" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <path d="M74 60 Q74 30 100 30 Q126 30 126 60 L126 88 Q100 98 74 88Z" fill="url(#GID)" stroke="${c.line}" stroke-width="4"/>
    <path d="M80 64 L120 64" stroke="${c.line}" stroke-width="6"/>
    <path d="M100 30 Q104 14 116 10" stroke="#e8455a" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M150 50 L150 150 M138 128 L162 128" stroke="#d9dde8" stroke-width="7" stroke-linecap="round"/>
    <path d="M150 50 L150 150" stroke="${c.line}" stroke-width="2"/>`,
};
// 目の位置（形ごと）
const EYES = { slime: [[82, 112], [118, 112]], beast: [[52, 86], [70, 86]], bird: [[92, 60], [108, 60]], golem: [[90, 54], [110, 54]], ghost: [[84, 92], [116, 92]], dragon: [[66, 50], [82, 50]], knight: [[90, 76], [110, 76]] };

let uid = 0;
export function monsterSVG(d, { size = 180, hurt = false } = {}) {
  const gid = 'mg' + (++uid);
  const base = ELEM[d.elem]?.color || '#aaa';
  const c = { fill: base, light: shade(base, 0.45), dark: shade(base, -0.35), line: shade(base, -0.65) };
  const s = d.stats;
  const scale = 0.72 + s.hp * 0.03;
  const parts = [];
  // 魔法防御：うしろに魔法の輪
  if (s.mdef >= 4) parts.push(`<circle cx="100" cy="105" r="${70 + s.mdef * 2}" fill="none" stroke="${shade(base, 0.6)}" stroke-width="${1 + s.mdef * 0.35}" stroke-dasharray="6 6" opacity="${0.25 + s.mdef * 0.05}"/>`);
  // 素早さ：風の線
  if (s.spd >= 5) for (let i = 0; i < Math.min(4, s.spd - 4); i++) parts.push(`<path d="M${8 + i * 4} ${70 + i * 22} L${36 + i * 2} ${70 + i * 22}" stroke="#fff" stroke-width="3" opacity=".55" stroke-linecap="round"/>`);
  // 飛行：つばさ
  if (d.traits.includes('fly')) parts.push(`<path d="M80 92 Q30 40 6 70 Q30 80 40 104 Q56 96 80 108Z M120 92 Q170 40 194 70 Q170 80 160 104 Q144 96 120 108Z" fill="${c.light}" stroke="${c.line}" stroke-width="3" opacity=".9"/>`);
  parts.push((BODY[d.shape] || BODY.slime)(c));
  // 攻撃：トゲ
  const spikes = Math.min(6, Math.floor(s.atk / 2));
  for (let i = 0; i < spikes; i++) {
    const x = 60 + i * (80 / Math.max(1, spikes - 1 || 1)), y = d.shape === 'slime' ? 72 + Math.abs(i - (spikes - 1) / 2) * 6 : 46 + Math.abs(i - (spikes - 1) / 2) * 5;
    if (d.shape === 'slime' || d.shape === 'golem' || d.shape === 'ghost') parts.push(`<path d="M${x - 6} ${y + 10} L${x} ${y - 6 - s.atk} L${x + 6} ${y + 10}Z" fill="${c.dark}" stroke="${c.line}" stroke-width="2"/>`);
  }
  // 防御：よろい
  if (s.def >= 5) parts.push(`<path d="M74 ${120} Q100 ${108 - s.def} 126 120 L122 146 Q100 154 78 146Z" fill="#9aa3b8" stroke="#3a4050" stroke-width="3" opacity="${0.4 + s.def * 0.05}"/>`);
  // 目（怒りなら眉、魔法攻撃が高いと光る）
  const glow = s.mag >= 6 ? `<circle cx="0" cy="0" r="10" fill="${shade(base, 0.7)}" opacity=".6"/>` : '';
  for (const [x, y] of EYES[d.shape] || EYES.slime) {
    parts.push(`<g transform="translate(${x} ${y})">${glow}<circle r="6" fill="#fff" stroke="${c.line}" stroke-width="2"/><circle r="3" fill="#1a1a2a" cx="${hurt ? 0 : 1}"/></g>`);
    if (d.traits.includes('rage')) parts.push(`<path d="M${x - 8} ${y - 12} L${x + 8} ${y - 6}" stroke="${c.line}" stroke-width="3" transform="${x > 100 ? `scale(-1 1) translate(${-2 * x} 0)` : ''}"/>`);
  }
  if (d.traits.includes('regen')) parts.push(`<g fill="#7dffa8" opacity=".85"><path d="M40 60 h8 v-8 h4 v8 h8 v4 h-8 v8 h-4 v-8 h-8Z"/><path d="M150 150 h6 v-6 h3 v6 h6 v3 h-6 v6 h-3 v-6 h-6Z"/></g>`);
  if (d.traits.includes('poison')) parts.push(`<g fill="#b45cff" opacity=".8"><ellipse cx="70" cy="176" rx="5" ry="7"/><ellipse cx="128" cy="180" rx="4" ry="6"/></g>`);
  if (d.traits.includes('reflect')) parts.push(`<path d="M160 120 L184 110 L186 150 L162 156Z" fill="#dff4ff" stroke="#6aa8c8" stroke-width="3" opacity=".9"/>`);
  if (d.traits.includes('sweep')) parts.push(`<path d="M20 180 Q100 150 180 180" stroke="${c.dark}" stroke-width="4" fill="none" stroke-dasharray="3 7" opacity=".7"/>`);
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" class="mon-svg">
    <defs><radialGradient id="${gid}" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="${c.light}"/><stop offset="1" stop-color="${c.fill}"/></radialGradient></defs>
    <ellipse cx="100" cy="182" rx="${60 * scale}" ry="8" fill="#000" opacity=".25"/>
    <g transform="translate(100 110) scale(${scale.toFixed(2)}) translate(-100 -110)">${parts.join('').replaceAll('#GID', '#' + gid)}</g></svg>`;
}
