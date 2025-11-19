export class CryptoCommand {
  constructor(wasmLoader) {
    this.wasmLoader = wasmLoader;
  }

  async execute(args, printLine) {
    if (args.length === 0) {
      printLine('Usage: crypto <operation> <args>');
      printLine('Operations:');
      printLine('  caesar <shift> <text>  - Caesar cipher');
      printLine('  hash <text>            - Simple hash');
      printLine('  base64 <text>          - Base64 encode');
      return;
    }

    try {
      const instance = await this.wasmLoader.loadModule('crypto');
      const { memory } = instance.exports;
      
      if (!memory) {
        printLine('crypto: memory not available');
        return;
      }

      const op = args[0];

      switch(op) {
        case 'caesar': {
          if (args.length < 2) { 
            printLine('Usage: crypto caesar [shift] <text>'); 
            return; 
          }
          
          let shift = 3;
          let text = '';
          
          if (!isNaN(parseInt(args[1])) && args.length >= 3) {
            shift = parseInt(args[1]);
            text = args.slice(2).join(' ');
          } else {
            text = args.slice(1).join(' ');
          }

          if (!instance.exports.caesar_encrypt) {
            printLine('caesar_encrypt not available');
            return;
          }

          const inPtr = this.wasmLoader.writeString(memory, text);
          const outPtr = 4096;
          instance.exports.caesar_encrypt(inPtr, outPtr, shift);
          const encrypted = this.wasmLoader.readString(memory, outPtr);
          printLine(`Encrypted: ${encrypted}`);
          break;
        }

        case 'hash': {
          if (args.length < 2) { 
            printLine('Usage: crypto hash <text>'); 
            return; 
          }
          
          if (!instance.exports.simple_hash) {
            printLine('simple_hash not available');
            return;
          }

          const hashText = args.slice(1).join(' ');
          const ptr = this.wasmLoader.writeString(memory, hashText);
          const hash = instance.exports.simple_hash(ptr);
          printLine(`Hash: ${hash >>> 0}`);
          break;
        }

        case 'base64': {
          if (args.length < 2) { 
            printLine('Usage: crypto base64 <text>'); 
            return; 
          }
          
          if (!instance.exports.base64_encode) {
            printLine('base64_encode not available');
            return;
          }

          const b64Text = args.slice(1).join(' ');
          const inPtr = this.wasmLoader.writeString(memory, b64Text);
          const outPtr = 8192;
          instance.exports.base64_encode(inPtr, outPtr, b64Text.length);
          const encoded = this.wasmLoader.readString(memory, outPtr);
          printLine(`Base64: ${encoded}`);
          break;
        }

        default:
          printLine(`Unknown operation: ${op}`);
      }
    } catch (error) {
      printLine(`crypto: ${error.message}`);
    }
  }
}
