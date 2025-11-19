export class FileOpsCommand {
  constructor(wasmLoader) {
    this.wasmLoader = wasmLoader;
  }

  async execute(args, printLine) {
    if (args.length === 0) {
      printLine('Usage: cat <content...> or cat --read');
      return;
    }

    try {
      const instance = await this.wasmLoader.loadModule('fileops');
      const { memory, fs_write, fs_read, fs_size } = instance.exports;
      
      if (!memory || !fs_write || !fs_read || !fs_size) {
        printLine('cat: module exports not found');
        return;
      }

      if (args[0] === '--read') {
        const size = fs_size();
        if (size === 0) {
          printLine('(file is empty)');
          return;
        }
        
        const heap = new Uint8Array(memory.buffer);
        const bytesRead = fs_read(1024, 2048);
        const content = this.wasmLoader.dec.decode(heap.subarray(1024, 1024 + bytesRead));
        printLine(content);
      } else {
        const content = args.join(' ');
        const ptr = this.wasmLoader.writeString(memory, content);
        const written = fs_write(ptr, content.length);
        printLine(`Wrote ${written} bytes to virtual file`);
      }
    } catch (error) {
      printLine(`cat: ${error.message}`);
    }
  }
}
