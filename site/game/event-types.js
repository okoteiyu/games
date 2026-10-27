/* Shared presentation metadata for game events. Samples are UI demonstrations. */
export const EVENT_TYPES = Object.freeze([
  { id: 'daily', label: '日常・会話', shortLabel: '日常', color: '#715E4B', sample: 'おこていゆは、焼いたベーコンをじっと見つめている。どうやら、研究の手が止まってしまったようだ。' },
  { id: 'enemy', label: '敵の攻撃・行動', shortLabel: '敵', color: '#91474D', sample: '敵の攻撃で、おこていゆは少しよろけた。' },
  { id: 'action', label: 'おこていゆの攻撃・行動', shortLabel: '行動', color: '#435F7D', sample: '全身を使って、パンチを放った。' },
  { id: 'move', label: 'マップ移動', shortLabel: '移動', color: '#3F6669', sample: 'おこていゆハウスへ移動した。' },
  { id: 'anger', label: '怒り・感情の変化', shortLabel: '感情', color: '#924C2C', sample: 'おこていゆは、静かに怒っている。' },
  { id: 'meal', label: '食事・飲み物', shortLabel: '食事', color: '#566638', sample: '焼いたベーコンを食べた。んま。' },
  { id: 'research', label: '研究・発見', shortLabel: '研究', color: '#715581', sample: '研究ノートに、小さな発見を書き込んだ。' },
  { id: 'growth', label: '獲得・成長', shortLabel: '成長', color: '#7F5B22', sample: 'おこていゆは、少しだけ強くなった。' },
  { id: 'system', label: '案内・その他', shortLabel: '案内', color: '#59616A', sample: '出来事は、ここに記録されます。' }
].map(type => Object.freeze(type)));
const TYPES_BY_ID = new Map(EVENT_TYPES.map(type => [type.id, type]));

/** Unknown types retain their text and use the neutral system presentation. */
export function getEventType(type) {
  return TYPES_BY_ID.get(type) || TYPES_BY_ID.get('system');
}

/** Keep text as supplied and accept only the metadata used by the UI. */
export function normalizeGameEvent(input) {
  const value = typeof input === 'string' ? { text: input } : input;
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.text !== 'string') {
    throw new TypeError('イベントの本文は文字列で指定してください。');
  }
  if (!value.text.trim()) return null;
  const type = getEventType(value.type === undefined ? 'daily' : value.type).id;
  const kind = value.kind === undefined ? 'narration' : value.kind;
  if (kind !== 'narration' && kind !== 'speech') {
    throw new TypeError('イベントの表示種別はnarrationまたはspeechで指定してください。');
  }
  const speaker = value.speaker === undefined ? (kind === 'speech' ? 'おこていゆ' : 'ナレーション') : value.speaker;
  if (typeof speaker !== 'string' || !speaker.trim()) {
    throw new TypeError('イベントの話者は空でない文字列で指定してください。');
  }
  return Object.freeze({ type, text: value.text, kind, speaker });
}
