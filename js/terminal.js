export class Terminal {
  constructor() {
    this.term = document.getElementById('terminal');
    this.input = document.getElementById('input');
    this.promptEl = document.getElementById('prompt');
    this.history = [];
    this.histIdx = -1;
    this.cwd = '~';
  }

  printLine(text = "") {
    this.term.textContent += text + "\n";
    this.term.scrollTop = this.term.scrollHeight;
  }

  setPrompt() {
    this.promptEl.textContent = `WasmOS ${this.cwd} $`;
  }

  showBanner() {
    this.printLine('╔════════════════════════════════════════════════╗');
    this.printLine('║    WasmOS - Pure WebAssembly Operating System ║');
    this.printLine('║  Multi-language modules compiled to WASM      ║');
    this.printLine('╚════════════════════════════════════════════════╝');
    this.printLine('');
    this.printLine('Available Languages: C++, C, Go, TypeScript, Python');
    this.printLine('Type "help" for commands or "lang" for details');
    this.printLine('');
  }

  autocomplete(current, commands) {
    const hits = commands.filter(c => c.startsWith(current));
    if (hits.length === 1) return hits[0] + ' ';
    if (hits.length > 1) this.printLine(hits.join('  '));
    return current;
  }

  setupEventListeners(commandHandler, commands) {
    this.input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const line = this.input.value;
        this.printLine(this.promptEl.textContent + ' ' + line);
        this.history.push(line);
        this.histIdx = this.history.length;
        this.input.value = '';
        await commandHandler(line);
      } else if (e.key === 'ArrowUp') {
        if (this.histIdx > 0) {
          this.histIdx--;
          this.input.value = this.history[this.histIdx] || '';
          setTimeout(() => this.input.setSelectionRange(this.input.value.length, this.input.value.length));
        }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (this.histIdx < this.history.length) {
          this.histIdx++;
          this.input.value = this.history[this.histIdx] || '';
          setTimeout(() => this.input.setSelectionRange(this.input.value.length, this.input.value.length));
        }
        e.preventDefault();
      } else if (e.key === 'Tab') {
        const before = this.input.value;
        this.input.value = this.autocomplete(before, commands);
        e.preventDefault();
      } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
        this.term.textContent = '';
        e.preventDefault();
      } else if (e.key === 'c' && e.ctrlKey) {
        this.printLine(this.promptEl.textContent + ' ' + this.input.value);
        this.input.value = '';
        e.preventDefault();
      }
    });

    document.addEventListener('click', () => this.input.focus());
  }

  focus() {
    this.input.focus();
  }
}
