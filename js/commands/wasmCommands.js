import { BaseCommand } from './baseCommand.js';

export class WasmCommands extends BaseCommand {
  async echo(args) {
    const instance = await this.loadModule('echo');
    if (!instance) return;
    
    if (!this.validateExports(instance, ['memory', 'echo'])) return;

    const msg = args.join(' ');
    const ptr = this.writeString(instance.exports.memory, msg);
    const resPtr = instance.exports.echo(ptr) >>> 0;
    const out = this.readString(instance.exports.memory, resPtr);
    this.terminal.printLine(out);
  }

  async cat(args) {
    if (args.length === 0) {
      this.terminal.printLine('Usage: cat <content...> or cat --read');
      return;
    }
    
    const instance = await this.loadModule('fileops');
    if (!instance) return;
    
    if (!this.validateExports(instance, ['memory', 'fs_write', 'fs_read', 'fs_size'])) return;

    const { memory, fs_write, fs_read, fs_size } = instance.exports;

    if (args[0] === '--read') {
      const size = fs_size();
      if (size === 0) {
        this.terminal.printLine('(file is empty)');
        return;
      }
      const heap = new Uint8Array(memory.buffer);
      const bytesRead = fs_read(1024, 2048);
      const content = this.wasmLoader.dec.decode(heap.subarray(1024, 1024 + bytesRead));
      this.terminal.printLine(content);
    } else {
      const content = args.join(' ');
      const ptr = this.writeString(memory, content);
      const written = fs_write(ptr, content.length);
      this.terminal.printLine(`Wrote ${written} bytes to virtual file`);
    }
  }

  async math(args) {
    if (args.length === 0) {
      this.terminal.printLine('Usage: math <operation> <args>');
      this.terminal.printLine('Operations: add, mul, fact, pow, sqrt, prime');
      return;
    }
    
    const instance = await this.loadModule('math');
    if (!instance) return;
    
    const op = args[0];
    const nums = args.slice(1).map(parseFloat);

    switch(op) {
      case 'add':
        if (nums.length < 2) { this.terminal.printLine('Need 2 numbers'); return; }
        this.terminal.printLine(`Result: ${instance.exports.math_add(nums[0], nums[1])}`);
        break;
      case 'mul':
        if (nums.length < 2) { this.terminal.printLine('Need 2 numbers'); return; }
        this.terminal.printLine(`Result: ${instance.exports.math_multiply(nums[0], nums[1])}`);
        break;
      case 'fact':
        if (nums.length < 1) { this.terminal.printLine('Need 1 number'); return; }
        this.terminal.printLine(`Result: ${instance.exports.math_factorial(Math.floor(nums[0]))}`);
        break;
      case 'pow':
        if (nums.length < 2) { this.terminal.printLine('Need 2 numbers'); return; }
        this.terminal.printLine(`Result: ${instance.exports.math_power(nums[0], nums[1])}`);
        break;
      case 'sqrt':
        if (nums.length < 1) { this.terminal.printLine('Need 1 number'); return; }
        this.terminal.printLine(`Result: ${instance.exports.math_sqrt(nums[0])}`);
        break;
      case 'prime':
        if (nums.length < 1) { this.terminal.printLine('Need 1 number'); return; }
        const isPrime = instance.exports.math_isprime(Math.floor(nums[0]));
        this.terminal.printLine(`${Math.floor(nums[0])} is ${isPrime ? 'PRIME' : 'NOT PRIME'}`);
        break;
      default:
        this.terminal.printLine(`Unknown operation: ${op}`);
    }
  }

  async str(args) {
    if (args.length === 0) {
      this.terminal.printLine('Usage: str <operation> <text>');
      this.terminal.printLine('Operations: upper, lower, reverse, wc, len');
      return;
    }
    
    const instance = await this.loadModule('string_utils');
    if (!instance) return;
    
    if (!this.validateExports(instance, ['memory'])) return;

    const op = args[0];
    const text = args.slice(1).join(' ');

    if (!text && op !== 'len' && op !== 'wc') {
      this.terminal.printLine('Need text input');
      return;
    }

    const ptr = this.writeString(instance.exports.memory, text);

    switch(op) {
      case 'upper':
        const upperPtr = instance.exports.str_toupper(ptr);
        this.terminal.printLine(this.readString(instance.exports.memory, upperPtr));
        break;
      case 'lower':
        const lowerPtr = instance.exports.str_tolower(ptr);
        this.terminal.printLine(this.readString(instance.exports.memory, lowerPtr));
        break;
      case 'reverse':
        const revPtr = instance.exports.str_reverse(ptr);
        this.terminal.printLine(this.readString(instance.exports.memory, revPtr));
        break;
      case 'wc':
        const count = instance.exports.str_wordcount(ptr);
        this.terminal.printLine(`Word count: ${count}`);
        break;
      case 'len':
        const len = instance.exports.str_length(ptr);
        this.terminal.printLine(`Length: ${len}`);
        break;
      default:
        this.terminal.printLine(`Unknown operation: ${op}`);
    }
  }

  async sort(args) {
    if (args.length === 0) {
      this.terminal.printLine('Usage: sort <algorithm> <numbers...>');
      this.terminal.printLine('Algorithms: bubble, quick, min, max, avg');
      return;
    }
    
    const instance = await this.loadModule('sort');
    if (!instance) return;
    
    if (!this.validateExports(instance, ['memory'])) return;

    const op = args[0];
    const numbers = args.slice(1).map(n => parseInt(n)).filter(n => !isNaN(n));
    
    if (numbers.length === 0) {
      this.terminal.printLine('Please provide numbers to sort');
      return;
    }

    const arrayPtr = 1024;
    const arrayIndex = arrayPtr / 4;
    const heap = new Int32Array(instance.exports.memory.buffer);
    
    for (let i = 0; i < numbers.length; i++) {
      heap[arrayIndex + i] = numbers[i];
    }

    switch(op) {
      case 'bubble':
        instance.exports.bubble_sort(arrayPtr, numbers.length);
        const bubbleSorted = Array.from(heap.slice(arrayIndex, arrayIndex + numbers.length));
        this.terminal.printLine(`Bubble Sort: [${bubbleSorted.join(', ')}]`);
        break;
      case 'quick':
        instance.exports.quick_sort(arrayPtr, numbers.length);
        const quickSorted = Array.from(heap.slice(arrayIndex, arrayIndex + numbers.length));
        this.terminal.printLine(`Quick Sort: [${quickSorted.join(', ')}]`);
        break;
      case 'min':
        const min = instance.exports.find_min(arrayPtr, numbers.length);
        this.terminal.printLine(`Minimum: ${min}`);
        break;
      case 'max':
        const max = instance.exports.find_max(arrayPtr, numbers.length);
        this.terminal.printLine(`Maximum: ${max}`);
        break;
      case 'avg':
        const avg = instance.exports.calculate_average(arrayPtr, numbers.length);
        this.terminal.printLine(`Average: ${Number(avg).toFixed(2)}`);
        break;
      default:
        this.terminal.printLine(`Unknown operation: ${op}`);
    }
  }

  async crypto(args) {
    if (args.length === 0) {
      this.terminal.printLine('Usage: crypto <operation> <args>');
      this.terminal.printLine('Operations: caesar, hash, base64');
      return;
    }

    const instance = await this.loadModule('crypto');
    if (!instance) return;
    
    if (!this.validateExports(instance, ['memory'])) return;

    const op = args[0];

    switch(op) {
      case 'caesar':
        if (args.length < 2) { 
          this.terminal.printLine('Usage: crypto caesar [shift] <text>'); 
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

        const inPtr = this.writeString(instance.exports.memory, text);
        const outPtr = 4096;
        instance.exports.caesar_encrypt(inPtr, outPtr, shift);
        const encrypted = this.readString(instance.exports.memory, outPtr);
        this.terminal.printLine(`Encrypted: ${encrypted}`);
        break;

      case 'hash':
        if (args.length < 2) { 
          this.terminal.printLine('Usage: crypto hash <text>'); 
          return; 
        }
        
        const hashText = args.slice(1).join(' ');
        const ptr = this.writeString(instance.exports.memory, hashText);
        const hash = instance.exports.simple_hash(ptr);
        this.terminal.printLine(`Hash: ${hash >>> 0}`);
        break;

      case 'base64':
        if (args.length < 2) { 
          this.terminal.printLine('Usage: crypto base64 <text>'); 
          return; 
        }
        
        const b64Text = args.slice(1).join(' ');
        const inPtr2 = this.writeString(instance.exports.memory, b64Text);
        const outPtr2 = 8192;
        instance.exports.base64_encode(inPtr2, outPtr2, b64Text.length);
        const encoded = this.readString(instance.exports.memory, outPtr2);
        this.terminal.printLine(`Base64: ${encoded}`);
        break;

      default:
        this.terminal.printLine(`Unknown operation: ${op}`);
    }
  }

  async ps(args) {
    const instance = await this.loadModule('process');
    if (!instance) return;
    
    if (!this.validateExports(instance, ['memory', 'proc_count', 'sys_version', 'sys_uptime', 'sys_memused'])) return;

    const count = instance.exports.proc_count();
    
    this.terminal.printLine('PID  STATUS  NAME');
    this.terminal.printLine('---  ------  ----');
    
    if (count === 0) {
      this.terminal.printLine('No processes running');
    } else {
      this.terminal.printLine(`${count} process(es) in memory`);
    }

    const version = this.readString(instance.exports.memory, instance.exports.sys_version());
    const uptime = instance.exports.sys_uptime();
    const memUsed = instance.exports.sys_memused();
    
    this.terminal.printLine(`\nSystem: ${version}`);
    this.terminal.printLine(`Uptime: ${uptime}s`);
    this.terminal.printLine(`Memory: ${memUsed} bytes`);
  }

  async exec(args) {
    if (args.length === 0) {
      this.terminal.printLine('Usage: exec <process_name>');
      return;
    }

    const instance = await this.loadModule('process');
    if (!instance) return;
    
    if (!this.validateExports(instance, ['memory', 'proc_create'])) return;

    const name = args.join(' ');
    const ptr = this.writeString(instance.exports.memory, name);
    const pid = instance.exports.proc_create(ptr);
    
    this.terminal.printLine(`Started process '${name}' with PID ${pid}`);
  }
}
