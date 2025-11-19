import { BaseCommand } from './baseCommand.js';

export class BasicCommands extends BaseCommand {
  constructor(wasmLoader, terminal, moduleLanguages) {
    super(wasmLoader, terminal);
    this.moduleLanguages = moduleLanguages;
  }

  help() {
    this.terminal.printLine('Available Commands (Pure WASM):');
    this.terminal.printLine('  echo <text>          - Echo text using WASM (C++)');
    this.terminal.printLine('  cat <text>           - Write to virtual file (C++)');
    this.terminal.printLine('  cat --read           - Read from virtual file (C++)');
    this.terminal.printLine('  math <op> <nums>     - Math operations (C++)');
    this.terminal.printLine('  str <op> <text>      - String operations (C++)');
    this.terminal.printLine('  sort <op> <nums>     - Sorting algorithms (C++)');
    this.terminal.printLine('  crypto <op> <args>   - Cryptography operations (C)');
    this.terminal.printLine('  ps                   - Show processes (C++)');
    this.terminal.printLine('  exec <name>          - Create process (C++)');
    this.terminal.printLine('  modules              - List loaded WASM modules');
    this.terminal.printLine('  lang                 - Show language information');
    this.terminal.printLine('  date                 - Show current date');
    this.terminal.printLine('  clear                - Clear screen');
    this.terminal.printLine('  help                 - Show this help');
    this.terminal.printLine('');
    this.terminal.printLine('All operations use compiled WebAssembly modules');
  }

  clear() {
    this.terminal.term.textContent = '';
  }

  date() {
    this.terminal.printLine(new Date().toString());
  }

  modules() {
    this.terminal.printLine('Loaded WASM modules:');
    const loaded = this.wasmLoader.getLoadedModules();
    if (loaded.length === 0) {
      this.terminal.printLine('  (none loaded yet - modules load on first use)');
    } else {
      loaded.forEach(m => {
        const lang = this.moduleLanguages[m] || 'Unknown';
        this.terminal.printLine(`  ✓ ${m} (${lang})`);
      });
    }
  }

  lang() {
    this.terminal.printLine('╔════════════════════════════════════════════════╗');
    this.terminal.printLine('║  WasmOS - Pure WebAssembly Multi-Language OS  ║');
    this.terminal.printLine('╚════════════════════════════════════════════════╝');
    this.terminal.printLine('');
    this.terminal.printLine('Supported Languages (All compile to WASM):');
    this.terminal.printLine('  ✓ C++            - Systems programming, high performance');
    this.terminal.printLine('  ✓ C              - Low-level operations, cryptography');
    this.terminal.printLine('  ○ Go             - JSON processing, concurrency');
    this.terminal.printLine('  ○ TypeScript     - Image processing, type safety');
    this.terminal.printLine('  ○ Python         - Text analysis, AI/ML');
    this.terminal.printLine('');
    this.terminal.printLine('Module Distribution:');
    Object.entries(this.moduleLanguages).forEach(([module, lang]) => {
      const status = this.wasmLoader.modules[module] ? '✓' : '○';
      this.terminal.printLine(`  ${status} ${module.padEnd(20)} → ${lang}`);
    });
  }
}
