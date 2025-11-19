export class EchoCommand {
  constructor(wasmLoader) {
    this.wasmLoader = wasmLoader;
  }

  async execute(args, printLine) {
    try {
      const instance = await this.wasmLoader.loadModule('echo');
      const { memory, echo } = instance.exports;
      
      if (!echo || !memory) {
        printLine('echo: module exports not found');
        return;
      }

      const msg = args.join(' ');
      const ptr = this.wasmLoader.writeString(memory, msg);
      const resPtr = echo(ptr) >>> 0;
      const output = this.wasmLoader.readString(memory, resPtr);
      
      printLine(output);
    } catch (error) {
      printLine(`echo: ${error.message}`);
    }
  }
}
