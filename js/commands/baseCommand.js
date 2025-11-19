export class BaseCommand {
  constructor(wasmLoader, terminal) {
    this.wasmLoader = wasmLoader;
    this.terminal = terminal;
  }

  async loadModule(name) {
    try {
      return await this.wasmLoader.loadModule(name);
    } catch (error) {
      this.terminal.printLine(`Error loading ${name}: ${error.message}`);
      this.terminal.printLine('Make sure to run build.bat first to compile WASM modules');
      return null;
    }
  }

  writeString(memory, str, offset = 1024) {
    return this.wasmLoader.writeString(memory, str, offset);
  }

  readString(memory, ptr) {
    return this.wasmLoader.readString(memory, ptr);
  }

  validateExports(instance, requiredExports) {
    const missing = requiredExports.filter(exp => !instance.exports[exp]);
    if (missing.length > 0) {
      this.terminal.printLine(`Required exports not found: ${missing.join(', ')}`);
      return false;
    }
    return true;
  }
}
