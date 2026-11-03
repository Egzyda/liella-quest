// 戦闘中の状態アイコン（線画のSVG。絵文字は使わない）
const P = {
  taunt: '<path d="M8 1.5 13.5 3.5v4c0 3.4-2.4 5.9-5.5 7-3.1-1.1-5.5-3.6-5.5-7v-4Z"/><path d="M8 5v3.6M8 10.6v.4"/>',
  guard: '<path d="M8 1.5 13.5 3.5v4c0 3.4-2.4 5.9-5.5 7-3.1-1.1-5.5-3.6-5.5-7v-4Z"/><path d="m5.6 8 1.7 1.7L10.6 6.4"/>',
  shield: '<path d="M8 1.5 13.5 3.5v4c0 3.4-2.4 5.9-5.5 7-3.1-1.1-5.5-3.6-5.5-7v-4Z"/>',
  song: '<path d="M6 12.5V3.5l7-1.5v9"/><circle cx="4.5" cy="12.5" r="1.8"/><circle cx="11.5" cy="11" r="1.8"/>',
  poison: '<path d="M8 1.8C8 1.8 3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.8 8 1.8Z"/><path d="M6.2 10.5a1.9 1.9 0 0 0 1.8 1.6"/>',
  scared: '<path d="M2 8l2.5-3 2.5 3 2-3 2.5 3 2.5-3"/><path d="M4 12h8"/>',
  target: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2"/><path d="M8 .8v2.4M8 12.8v2.4M.8 8h2.4M12.8 8h2.4"/>',
  sword: '<path d="M12.5 2 13.9 2.1 14 3.5 6.5 11 5 9.5Z"/><path d="m3.5 9.5 3 3M2 14l2.5-2.5"/>',
  charge: '<path d="M9.5 1.5 3.5 9h4l-1 5.5 6-7.5h-4Z"/>',
  rage: '<path d="M8 14.5c-3 0-4.8-2-4.8-4.6C3.2 6.5 6.5 5 6 1.5c2.6 1.4 3.4 3.4 3 5.4 1-.5 1.6-1.4 1.7-2.6 1.6 1.4 2.1 3.4 2.1 5.4 0 2.8-1.8 4.8-4.8 4.8Z"/>',
  reflect: '<path d="M8 1.5 14 8l-6 6.5L2 8Z"/><path d="M8 4.5v7"/>',
  fly: '<path d="M1.5 9c3-4.5 6.5-5 8-4.5-1 1-.5 2.5 1 3 1.5.5 3.2-.2 4-1.5-.2 3.6-3.6 6-7.5 5.5C5 11.2 3 10.2 1.5 9Z"/>',
  keen: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2.2"/>',
  pierce: '<path d="M2 14 11 5M8 2h6v6"/>',
  heart: '<path d="M8 14S2 10.2 2 5.9A3.3 3.3 0 0 1 8 4a3.3 3.3 0 0 1 6 1.9C14 10.2 8 14 8 14Z"/>',
  tired: '<path d="M3 4h4L3 9h4M9 7h4l-4 5h4"/>',
};
export const ICON_NAME = {
  taunt: '挑発', guard: 'かばう', shield: '盾の構え', song: '歌の力', poison: '毒', scared: 'すくみ', target: '狙われている',
  sword: '攻めの構え', charge: 'ため', rage: '怒り', reflect: '反射', fly: '飛行', keen: '見破り', pierce: '貫通', heart: '回復', tired: '疲れ',
};
export const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-label="${ICON_NAME[n] || n}">${P[n] || ''}</svg>`;
