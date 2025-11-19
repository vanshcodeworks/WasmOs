import { BasicCommands } from './commands/basicCommands.js';
import { WasmCommands } from './commands/wasmCommands.js';

export class CommandRegistry {
  constructor(wasmLoader, terminal) {
    this.wasmLoader = wasmLoader;
    this.terminal = terminal;
    
    this.moduleLanguages = {
      echo: 'C++',
      fileops: 'C++',
      math: 'C++',
      string_utils: 'C++',
      process: 'C++',
      sort: 'C++',
      crypto: 'C',
      json_parser: 'Go',
      image_processing: 'TypeScript',
      network: 'JavaScript',
      text_analyzer: 'Python'
    };

    this.basicCommands = new BasicCommands(wasmLoader, terminal, this.moduleLanguages);
    this.wasmCommands = new WasmCommands(wasmLoader, terminal);

    this.commands = [
      'echo', 'help', 'clear', 'date', 'cat', 'math', 'str', 'sort', 
      'crypto', 'ps', 'exec', 'modules', 'lang'
    ];
  }

  getCommands() {
    return this.commands;
  }

  async executeCommand(line) {
    if (!line.trim()) return;
    
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    
    try {
      switch(cmd) {
        case 'echo':
          await this.wasmCommands.echo(args);
          break;
        case 'cat':
          await this.wasmCommands.cat(args);
          break;
        case 'math':
          await this.wasmCommands.math(args);
          break;
        case 'str':
          await this.wasmCommands.str(args);
          break;
        case 'sort':
          await this.wasmCommands.sort(args);
          break;
        case 'crypto':
          await this.wasmCommands.crypto(args);
          break;
        case 'ps':
          await this.wasmCommands.ps(args);
          break;
        case 'exec':
          await this.wasmCommands.exec(args);
          break;
        case 'help':
          this.basicCommands.help();
          break;
        case 'clear':
          this.basicCommands.clear();
          break;
        case 'date':
          this.basicCommands.date();
          break;
        case 'modules':
          this.basicCommands.modules();
          break;
        case 'lang':
          this.basicCommands.lang();
          break;
        default:
          this.terminal.printLine(`command not found: ${cmd}`);
          this.terminal.printLine('Type "help" for available commands');
      }
    } catch (error) {
      this.terminal.printLine(`${cmd}: ${error.message}`);
    }
  }
}
