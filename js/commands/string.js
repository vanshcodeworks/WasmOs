export class StringCommand {
  constructor(wasmLoader) {
    this.wasmLoader = wasmLoader;
  }

  async execute(args, printLine) {
    if (args.length === 0) {
      printLine('Usage: str <operation> <text>');
      printLine('Operations: upper, lower, reverse, wc, len');
      return;
    }

    try {
      const instance = await this.wasmLoader.loadModule('string_utils');
      const { memory } = instance.exports;
      
      if (!memory) {
        printLine('str: memory not available');
        return;
      }

      const op = args[0];
      const text = args.slice(1).join(' ');

      if (!text && op !== 'len' && op !== 'wc') {
        printLine('Need text input');
        return;
      }

      const ptr = this.wasmLoader.writeString(memory, text);

      switch(op) {
        case 'upper':
          if (!instance.exports.str_toupper) { printLine('str_toupper not available'); return; }
          const upperPtr = instance.exports.str_toupper(ptr);
          printLine(this.wasmLoader.readString(memory, upperPtr));
          break;
          
        case 'lower':
          if (!instance.exports.str_tolower) { printLine('str_tolower not available'); return; }
          const lowerPtr = instance.exports.str_tolower(ptr);
          printLine(this.wasmLoader.readString(memory, lowerPtr));
          break;
          
        case 'reverse':
          if (!instance.exports.str_reverse) { printLine('str_reverse not available'); return; }
          const revPtr = instance.exports.str_reverse(ptr);
          printLine(this.wasmLoader.readString(memory, revPtr));
          break;
          
        case 'wc':
          if (!instance.exports.str_wordcount) { printLine('str_wordcount not available'); return; }
          const count = instance.exports.str_wordcount(ptr);
          printLine(`Word count: ${count}`);
          break;
          
        case 'len':
          if (!instance.exports.str_length) { printLine('str_length not available'); return; }
          const len = instance.exports.str_length(ptr);
          printLine(`Length: ${len}`);
          break;
          
        default:
          printLine(`Unknown operation: ${op}`);
      }
    } catch (error) {
      printLine(`str: ${error.message}`);
    }
  }
}
