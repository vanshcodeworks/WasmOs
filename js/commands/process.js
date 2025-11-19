export class ProcessCommand {
  constructor(wasmLoader) {
    this.wasmLoader = wasmLoader;
  }

  async ps(args, printLine) {
    try {
      const instance = await this.wasmLoader.loadModule('process');
      const { memory } = instance.exports;
      
      if (!memory || !instance.exports.proc_count) {
        printLine('ps: module exports not found');
        return;
      }

      const count = instance.exports.proc_count();
      
      printLine('PID  STATUS  NAME');
      printLine('---  ------  ----');
      
      if (count === 0) {
        printLine('No processes running');
      } else {
        printLine(`${count} process(es) in memory`);
      }

      if (instance.exports.sys_version && instance.exports.sys_uptime && instance.exports.sys_memused) {
        const version = this.wasmLoader.readString(memory, instance.exports.sys_version());
        const uptime = instance.exports.sys_uptime();
        const memUsed = instance.exports.sys_memused();
        
        printLine(`\nSystem: ${version}`);
        printLine(`Uptime: ${uptime}s`);
        printLine(`Memory: ${memUsed} bytes`);
      }
    } catch (error) {
      printLine(`ps: ${error.message}`);
    }
  }

  async exec(args, printLine) {
    if (args.length === 0) {
      printLine('Usage: exec <process_name>');
      return;
    }

    try {
      const instance = await this.wasmLoader.loadModule('process');
      const { memory } = instance.exports;
      
      if (!memory || !instance.exports.proc_create) {
        printLine('exec: module exports not found');
        return;
      }

      const name = args.join(' ');
      const ptr = this.wasmLoader.writeString(memory, name);
      const pid = instance.exports.proc_create(ptr);
      
      printLine(`Started process '${name}' with PID ${pid}`);
    } catch (error) {
      printLine(`exec: ${error.message}`);
    }
  }
}
