// リエラクエストのデータ：属性・武器・モンスターの形・Liella! 11人の能力
// 能力の数字はすべて 0〜10（10がいちばん得意）。AIもこの数字を見て判断する。

export const ELEMS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
export const ELEM = {
  fire: { name: '火', color: '#ff6a3d' },
  water: { name: '水', color: '#3d9bff' },
  wind: { name: '風', color: '#4fd18b' },
  earth: { name: '土', color: '#c08a4a' },
  light: { name: '光', color: '#ffd84a' },
  dark: { name: '闇', color: '#9b6bff' },
  none: { name: '無', color: '#b8b8c8' },
};
// 言い伝え（見た目の属性から、効きそうだと思いこむもの）：火の敵は水に弱い…
export const FOLK_WEAK = { fire: 'water', water: 'earth', earth: 'wind', wind: 'fire', light: 'dark', dark: 'light' };

export const WEAPONS = ['sword', 'spear', 'bow', 'fist'];
export const WEAPON = {
  sword: { name: '剣', verb: '斬りつけた' },
  spear: { name: '槍', verb: '突いた' },
  bow: { name: '弓', verb: '矢を放った' },
  fist: { name: '拳', verb: '殴りかかった' },
};
// 攻撃のしかた（キー）：武器4種＋属性6種
export const KEYS = [...WEAPONS, ...ELEMS];
export const keyName = k => (WEAPON[k] ? WEAPON[k].name : ELEM[k] ? ELEM[k].name + '魔法' : k);

// モンスターの数値（シークバー）
export const STATS = ['hp', 'atk', 'mag', 'def', 'mdef', 'spd'];
export const STAT = {
  hp: { name: '体力' }, atk: { name: '物理攻撃' }, mag: { name: '魔法攻撃' },
  def: { name: '物理防御' }, mdef: { name: '魔法防御' }, spd: { name: '素早さ' },
};
// 耐性（-3：大きな弱点 … 0：ふつう … +3：まったく効かない）
export const RES_MULT = { '-3': 2.0, '-2': 1.6, '-1': 1.3, 0: 1, 1: 0.7, 2: 0.4, 3: 0 };

export const SHAPES = {
  slime: { name: 'スライム' }, beast: { name: '獣' }, bird: { name: '怪鳥' }, golem: { name: 'ゴーレム' },
  ghost: { name: '亡霊' }, dragon: { name: 'ドラゴン' }, knight: { name: '騎士' },
};
export const TRAITS = {
  regen: { name: '再生', cost: 6, desc: '毎ターン体力が少し戻る' },
  fly: { name: '飛行', cost: 5, desc: '剣・槍・拳が当たりにくい（弓はよく当たる）' },
  reflect: { name: '反射', cost: 6, desc: '魔法をときどき跳ね返す' },
  poison: { name: '毒', cost: 4, desc: '攻撃した相手を毒にする' },
  rage: { name: '怒り', cost: 4, desc: '体力が半分を切ると攻撃が強くなる' },
  sweep: { name: '全体攻撃', cost: 6, desc: 'ときどき4人まとめて攻撃する' },
};

// ステージ：戦い4つ（最後はボス）。魔力＝モンスターに使えるポイント。
// days＝その戦いにたどり着いたときに増える日数（1回戦うと1日。残った日は持ちこし。0になったら魔王の勝ち）。後の戦いほど強いので日数も多い
export const STAGES = [
  { name: '草原', bg: 'plain', fights: [{ budget: 34, days: 3 }, { budget: 42, days: 3 }, { budget: 50, days: 4 }, { budget: 64, boss: true, days: 5 }] },
];
// 魔王の成長：戦うたびに使える魔力が増える（撃退したときは多め）
export const MAOU_GROW = { win: 2, lose: 1 };

// Liella! 11人（呼び方は資料「口調一覧」と同じ）
// base：体力・力・魔力・守り・魔法の守り・素早さ（レベル1のとき）
// w：武器の得意度 / e：属性の得意度 / s：そのほかの得意度（heal 回復・song 歌で励ます・guard かばう・scan 分析）
// p：性格（careful 慎重・rash 無鉄砲・curious 試したがり・pride 自分の得意技にこだわる・logic 理屈で考える・bold 出たがり・kind 仲間思い）
export const IDS = ['kanon', 'keke', 'chisato', 'sumire', 'ren', 'kinako', 'mei', 'shiki', 'natsumi', 'margarete', 'tomari'];
export const CHARS = {
  kanon: {
    name: 'かのん', color: '#FF7F32', role: '歌で支える何でも屋', I: '私',
    call: { keke: '可可ちゃん', chisato: 'ちーちゃん', sumire: 'すみれちゃん', ren: '恋ちゃん', kinako: 'きな子ちゃん', mei: 'メイちゃん', shiki: '四季ちゃん', natsumi: '夏美ちゃん', margarete: 'マルガレーテちゃん', tomari: '冬毬ちゃん' },
    base: { hp: 62, atk: 11, mag: 12, def: 9, mdef: 10, spd: 10 },
    w: { sword: 6, spear: 3, bow: 4, fist: 2 }, e: { fire: 3, water: 3, wind: 4, earth: 2, light: 7, dark: 1 },
    s: { heal: 5, song: 9, guard: 4, scan: 3 },
    p: { careful: 5, rash: 4, curious: 5, pride: 3, logic: 5, bold: 5, kind: 8 },
  },
  keke: {
    name: '可可', color: '#A0D8EF', role: '風の魔法と応援', I: 'クゥクゥ',
    call: { kanon: 'かのん', chisato: '千砂都', sumire: 'すみれ', ren: 'レンレン', kinako: 'きなきな', mei: 'メーメー', shiki: 'シッキー', natsumi: 'ナッツ', margarete: 'マルマル', tomari: '冬毬' },
    base: { hp: 54, atk: 8, mag: 14, def: 7, mdef: 11, spd: 11 },
    w: { sword: 2, spear: 3, bow: 4, fist: 3 }, e: { fire: 4, water: 2, wind: 8, earth: 1, light: 5, dark: 2 },
    s: { heal: 2, song: 7, guard: 2, scan: 2 },
    p: { careful: 2, rash: 8, curious: 6, pride: 6, logic: 3, bold: 9, kind: 6 },
  },
  chisato: {
    name: '千砂都', color: '#FF8C90', role: '素早い格闘家', I: '私',
    call: { kanon: 'かのんちゃん', keke: '可可ちゃん', sumire: 'すみれちゃん', ren: '恋ちゃん', kinako: 'きな子ちゃん', mei: 'メイちゃん', shiki: '四季ちゃん', natsumi: '夏美ちゃん', margarete: 'マルガレーテちゃん', tomari: '冬毬ちゃん' },
    base: { hp: 60, atk: 14, mag: 7, def: 9, mdef: 7, spd: 16 },
    w: { sword: 3, spear: 3, bow: 2, fist: 9 }, e: { fire: 3, water: 2, wind: 5, earth: 2, light: 2, dark: 1 },
    s: { heal: 2, song: 5, guard: 5, scan: 4 },
    p: { careful: 5, rash: 4, curious: 5, pride: 4, logic: 6, bold: 6, kind: 7 },
  },
  sumire: {
    name: 'すみれ', color: '#74F466', role: '光の魔法と槍', I: '私',
    call: { kanon: 'かのん', keke: '可可', chisato: '千砂都', ren: '恋', kinako: 'きな子', mei: 'メイ', shiki: '四季', natsumi: '夏美', margarete: 'マルガレーテ', tomari: '冬毬' },
    base: { hp: 58, atk: 11, mag: 13, def: 8, mdef: 10, spd: 10 },
    w: { sword: 2, spear: 6, bow: 3, fist: 1 }, e: { fire: 2, water: 1, wind: 3, earth: 2, light: 8, dark: 3 },
    s: { heal: 4, song: 4, guard: 2, scan: 3 },
    p: { careful: 3, rash: 6, curious: 3, pride: 9, logic: 4, bold: 9, kind: 4 },
  },
  ren: {
    name: '恋', color: '#004CE3', role: '剣と水の魔法の剣士', I: 'わたくし',
    call: { kanon: 'かのんさん', keke: '可可さん', chisato: '千砂都さん', sumire: 'すみれさん', kinako: 'きな子さん', mei: 'メイさん', shiki: '四季さん', natsumi: '夏美さん', margarete: 'マルガレーテさん', tomari: '冬毬さん' },
    base: { hp: 64, atk: 13, mag: 11, def: 11, mdef: 9, spd: 10 },
    w: { sword: 9, spear: 4, bow: 3, fist: 2 }, e: { fire: 2, water: 6, wind: 2, earth: 2, light: 3, dark: 1 },
    s: { heal: 3, song: 3, guard: 6, scan: 5 },
    p: { careful: 7, rash: 2, curious: 4, pride: 5, logic: 7, bold: 6, kind: 7 },
  },
  kinako: {
    name: 'きな子', color: '#F6F052', role: '仲間を守る盾役', I: 'きな子',
    call: { kanon: 'かのん先輩', keke: 'クゥクゥ先輩', chisato: '千砂都先輩', sumire: 'すみれ先輩', ren: '恋先輩', mei: 'メイちゃん', shiki: '四季ちゃん', natsumi: '夏美ちゃん', margarete: 'マルガレーテちゃん', tomari: '冬毬ちゃん' },
    base: { hp: 80, atk: 11, mag: 7, def: 14, mdef: 10, spd: 6 },
    w: { sword: 2, spear: 5, bow: 2, fist: 6 }, e: { fire: 1, water: 3, wind: 2, earth: 7, light: 2, dark: 1 },
    s: { heal: 3, song: 4, guard: 9, scan: 1 },
    p: { careful: 6, rash: 2, curious: 3, pride: 1, logic: 3, bold: 2, kind: 9 },
  },
  mei: {
    name: 'メイ', color: '#E70F47', role: '火の力で押す攻め役', I: '私',
    call: { kanon: 'かのん先輩', keke: '可可先輩', chisato: '千砂都先輩', sumire: 'すみれ先輩', ren: '恋先輩', kinako: 'きな子', shiki: '四季', natsumi: '夏美', margarete: 'マルガレーテ', tomari: '冬毬' },
    base: { hp: 66, atk: 15, mag: 10, def: 10, mdef: 7, spd: 11 },
    w: { sword: 5, spear: 4, bow: 2, fist: 7 }, e: { fire: 8, water: 1, wind: 2, earth: 3, light: 1, dark: 2 },
    s: { heal: 1, song: 3, guard: 5, scan: 2 },
    p: { careful: 2, rash: 8, curious: 3, pride: 6, logic: 4, bold: 8, kind: 7 },
  },
  shiki: {
    name: '四季', color: '#9FE3DA', role: '分析と薬の研究者', I: '私',
    call: { kanon: 'かのん先輩', keke: '可可先輩', chisato: '千砂都先輩', sumire: 'すみれ先輩', ren: '恋先輩', kinako: 'きな子ちゃん', mei: 'メイ', natsumi: '夏美ちゃん', margarete: 'マルガレーテちゃん', tomari: '冬毬ちゃん' },
    base: { hp: 50, atk: 7, mag: 14, def: 7, mdef: 12, spd: 9 },
    w: { sword: 1, spear: 2, bow: 5, fist: 1 }, e: { fire: 4, water: 5, wind: 3, earth: 4, light: 1, dark: 6 },
    s: { heal: 7, song: 1, guard: 2, scan: 9 },
    p: { careful: 7, rash: 1, curious: 9, pride: 2, logic: 9, bold: 3, kind: 6 },
  },
  natsumi: {
    name: '夏美', color: '#F653A2', role: '弓と道具の商人', I: '私',
    call: { kanon: 'かのん先輩', keke: '可可先輩', chisato: '千砂都先輩', sumire: 'すみれ先輩', ren: '恋先輩', kinako: 'きな子', mei: 'メイ', shiki: '四季', margarete: 'マルガレーテ', tomari: '冬毬' },
    base: { hp: 56, atk: 12, mag: 9, def: 8, mdef: 8, spd: 13 },
    w: { sword: 2, spear: 2, bow: 8, fist: 2 }, e: { fire: 2, water: 4, wind: 4, earth: 2, light: 2, dark: 4 },
    s: { heal: 5, song: 4, guard: 2, scan: 5 },
    p: { careful: 6, rash: 4, curious: 5, pride: 4, logic: 6, bold: 7, kind: 4 },
  },
  margarete: {
    name: 'マルガレーテ', color: '#AF4993', role: '闇と炎の魔法使い', I: '私',
    call: { kanon: 'かのん', keke: '可可先輩', chisato: '千砂都先輩', sumire: 'すみれ先輩', ren: '恋先輩', kinako: 'きな子先輩', mei: 'メイ先輩', shiki: '四季先輩', natsumi: '夏美先輩', tomari: '冬毬' },
    base: { hp: 52, atk: 8, mag: 17, def: 7, mdef: 12, spd: 10 },
    w: { sword: 3, spear: 1, bow: 2, fist: 1 }, e: { fire: 6, water: 3, wind: 2, earth: 2, light: 2, dark: 9 },
    s: { heal: 1, song: 8, guard: 1, scan: 4 },
    p: { careful: 4, rash: 5, curious: 3, pride: 9, logic: 7, bold: 8, kind: 3 },
  },
  tomari: {
    name: '冬毬', color: '#57C0C7', role: '作戦を立てる参謀', I: '私',
    call: { kanon: 'かのん先輩', keke: '可可先輩', chisato: '千砂都先輩', sumire: 'すみれ先輩', ren: '恋先輩', kinako: 'きな子先輩', mei: 'メイ先輩', shiki: '四季先輩', natsumi: '姉者', margarete: 'マルガレーテ' },
    base: { hp: 54, atk: 10, mag: 13, def: 8, mdef: 10, spd: 11 },
    w: { sword: 3, spear: 3, bow: 6, fist: 1 }, e: { fire: 2, water: 7, wind: 4, earth: 3, light: 3, dark: 2 },
    s: { heal: 4, song: 3, guard: 3, scan: 10 },
    p: { careful: 8, rash: 1, curious: 6, pride: 3, logic: 10, bold: 5, kind: 5 },
  },
};

// 話し手 sp から見た who の呼び方
export function callName(sp, who) {
  if (!CHARS[sp]) return CHARS[who].name;
  if (sp === who) return CHARS[sp].I;
  return CHARS[sp].call[who] || CHARS[who].name;
}
