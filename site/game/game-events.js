import { normalizeGameEvent } from './event-types.js';

/** Dispatch game events without retaining a UI history. */
export class GameEvents {
  constructor({ onMessage = () => {} }) {
    if (typeof onMessage !== 'function') throw new TypeError('イベントの表示先は関数で指定してください。');
    this.onMessage = onMessage;
  }

  dispatch(input, { showMessage = false } = {}) {
    if (typeof showMessage !== 'boolean') throw new TypeError('メッセージ表示はtrueまたはfalseで指定してください。');
    const event = normalizeGameEvent(input);
    if (!event) return null;
    if (showMessage) this.onMessage(event);
    return event;
  }
}
