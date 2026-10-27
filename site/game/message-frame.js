/* Two-line pagination uses actual font measurements. It never hides story text. */
export class OkoteiyuMessage {
  constructor(element, { onAdvance = () => {} } = {}) {
    this.element = element;
    this.body = element.querySelector('.message-frame__text');
    this.speaker = element.querySelector('.message-frame__speaker');
    this.next = element.querySelector('.message-frame__continue');
    this.onAdvance = onAdvance;
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    this.text = ''; this.page = 0; this.pages = [['', '']];
    this.next.addEventListener('click', () => this.advance());
    element.addEventListener('click', event => {
      if (!event.target.closest('button, a')) this.advance();
    });
    this.resizeObserver = new ResizeObserver(() => this.paginate());
    this.resizeObserver.observe(this.body);
    document.fonts?.ready.then(() => this.paginate());
  }
  set({ speaker = 'ナレーション', text = '', kind = 'narration' }) {
    this.speaker.textContent = speaker;
    this.element.dataset.kind = kind;
    this.text = text; this.page = 0; this.paginate();
  }
  paginate() {
    const style = getComputedStyle(this.body);
    this.context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const width = this.body.clientWidth - 1;
    if (width <= 0) return;
    const characters = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(this.text)].map(x => x.segment)
      : Array.from(this.text);
    const lines = []; let remaining = characters;
    const closing = /^[、。，．！？!?」』）】〉》〕…ーぁぃぅぇぉゃゅょっァィゥェォャュョッ]/u;
    const opening = /[「『（【〈《〔]$/u;
    while (remaining.length) {
      if (remaining[0] === '\n') { lines.push(''); remaining = remaining.slice(1); continue; }
      let take = 0;
      while (take < remaining.length && remaining[take] !== '\n' && this.context.measureText(remaining.slice(0, take + 1).join('')).width <= width) take++;
      take = Math.max(1, take);
      if (take < remaining.length && closing.test(remaining[take]) && take > 1) take--;
      if (opening.test(remaining[take - 1]) && take > 1) take--;
      lines.push(remaining.slice(0, take).join(''));
      remaining = remaining.slice(take);
      if (remaining[0] === '\n') remaining = remaining.slice(1);
    }
    this.pages = [];
    for (let i = 0; i < Math.max(1, lines.length); i += 2) this.pages.push([lines[i] || '', lines[i + 1] || '']);
    this.page = Math.min(this.page, this.pages.length - 1);
    this.paint();
  }
  paint() {
    this.body.replaceChildren(...this.pages[this.page].map(line => {
      const span = document.createElement('span'); span.className = 'message-frame__line'; span.textContent = line; return span;
    }));
    this.next.setAttribute('aria-label', this.page < this.pages.length - 1 ? 'メッセージの続きを表示' : '次のメッセージを表示');
    this.element.dispatchEvent(new CustomEvent('messagepage', { detail: { page: this.page + 1, pages: this.pages.length, lines: this.pages[this.page] } }));
  }
  advance() {
    if (this.page < this.pages.length - 1) { this.page++; this.paint(); }
    else this.onAdvance();
  }
  destroy() { this.resizeObserver.disconnect(); }
}
