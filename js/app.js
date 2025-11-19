import { WasmLoader } from './wasmLoader.js';
import { Terminal } from './terminal.js';
import { CommandRegistry } from './commandRegistry.js';

export class WasmOSApp {
  constructor() {
    this.statusEl = document.getElementById('status');
    this.wasmLoader = new WasmLoader((message) => {
      this.statusEl.textContent = message;
    });
    this.terminal = new Terminal();
    this.commandRegistry = new CommandRegistry(this.wasmLoader, this.terminal);
  }

  async init() {
    this.terminal.showBanner();
    this.terminal.setPrompt();
    this.terminal.focus();
    this.statusEl.textContent = 'WasmOS Ready - Modules load on demand';

    this.terminal.setupEventListeners(
      (line) => this.commandRegistry.executeCommand(line),
      this.commandRegistry.getCommands()
    );
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new WasmOSApp();
  app.init();
});
