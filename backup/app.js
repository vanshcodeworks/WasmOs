import { WasmLoader } from '../js/wasmLoader.js';
import { Terminal } from '../js/terminal.js';
import { CommandRegistry } from '../js/commandRegistry.js';

(function(){
  const term = document.getElementById('terminal');
  const input = document.getElementById('input');
  const promptEl = document.getElementById('prompt');

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function printLine(text="") {
    term.textContent += text + "\n";
    term.scrollTop = term.scrollHeight;
  }

  // WASM module cache
  const wasmModules = {};
  const moduleLanguages = {
    echo: 'C++',
    fileops: 'C++', 
    math: 'C++',
    string_utils: 'C++',
    process: 'C++',
    sort: 'C++',
    crypto: 'C'
  };

  // Load a WASM module from build directory
  async function loadWasmModule(name) {
    if (wasmModules[name]) return wasmModules[name];
    
    try {
      const response = await fetch(`build/${name}.wasm`);
      if (!response.ok) {
        throw new Error(`Module ${name}.wasm not found in build/ directory`);
      }
      
      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      wasmModules[name] = instance;
      return instance;
    } catch (error) {
      printLine(`Error loading ${name}: ${error.message}`);
      printLine('Make sure to run build.sh first to compile WASM modules');
      return null;
    }
  }

  // Helper: write string to WASM memory
  function writeString(memory, str, offset = 1024) {
    const bytes = enc.encode(str + '\0');
    const heap = new Uint8Array(memory.buffer);
    if (offset + bytes.length > heap.length) {
      printLine('Error: String too long for WASM memory');
      return 0;
    }
    heap.set(bytes, offset);
    return offset;
  }

  // Helper: read string from WASM memory
  function readString(memory, ptr) {
    const heap = new Uint8Array(memory.buffer);
    let end = ptr;
    while (end < heap.length && heap[end] !== 0) end++;
    return dec.decode(heap.subarray(ptr, end));
  }

  // ===== Command Implementations =====

  async function cmdEcho(args) {
    const instance = await loadWasmModule('echo');
    if (!instance) return;
    
    const { memory, echo } = instance.exports;
    if (!echo || !memory) {
      printLine('echo: Required exports not found in WASM module');
      return;
    }

    const msg = args.join(' ');
    const ptr = writeString(memory, msg);
    const resPtr = echo(ptr) >>> 0;
    const out = readString(memory, resPtr);
    printLine(out);
  }

  async function cmdCat(args) {
    if (args.length === 0) {
      printLine('Usage: cat <content...> or cat --read');
      return;
    }
    
    const instance = await loadWasmModule('fileops');
    if (!instance) return;
    
    const { memory, fs_write, fs_read, fs_size } = instance.exports;
    if (!memory || !fs_write || !fs_read || !fs_size) {
      printLine('cat: Required exports not found in WASM module');
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
      const content = dec.decode(heap.subarray(1024, 1024 + bytesRead));
      printLine(content);
    } else {
      const content = args.join(' ');
      const ptr = writeString(memory, content);
      const written = fs_write(ptr, content.length);
      printLine(`Wrote ${written} bytes to virtual file`);
    }
  }

  async function cmdMath(args) {
    if (args.length === 0) {
      printLine('Usage: math <operation> <args>');
      printLine('Operations: add, mul, fact, pow, sqrt, prime');
      return;
    }
    
    const instance = await loadWasmModule('math');
    if (!instance) return;
    
    const op = args[0];
    const nums = args.slice(1).map(parseFloat);

    switch(op) {
      case 'add':
        if (nums.length < 2) { printLine('Need 2 numbers'); return; }
        printLine(`Result: ${instance.exports.math_add(nums[0], nums[1])}`);
        break;
      case 'mul':
        if (nums.length < 2) { printLine('Need 2 numbers'); return; }
        printLine(`Result: ${instance.exports.math_multiply(nums[0], nums[1])}`);
        break;
      case 'fact':
        if (nums.length < 1) { printLine('Need 1 number'); return; }
        printLine(`Result: ${instance.exports.math_factorial(Math.floor(nums[0]))}`);
        break;
      case 'pow':
        if (nums.length < 2) { printLine('Need 2 numbers'); return; }
        printLine(`Result: ${instance.exports.math_power(nums[0], nums[1])}`);
        break;
      case 'sqrt':
        if (nums.length < 1) { printLine('Need 1 number'); return; }
        printLine(`Result: ${instance.exports.math_sqrt(nums[0])}`);
        break;
      case 'prime':
        if (nums.length < 1) { printLine('Need 1 number'); return; }
        const isPrime = instance.exports.math_isprime(Math.floor(nums[0]));
        printLine(`${Math.floor(nums[0])} is ${isPrime ? 'PRIME' : 'NOT PRIME'}`);
        break;
      default:
        printLine(`Unknown operation: ${op}`);
    }
  }

  async function cmdStr(args) {
    if (args.length === 0) {
      printLine('Usage: str <operation> <text>');
      printLine('Operations: upper, lower, reverse, wc, len');
      return;
    }
    
    const instance = await loadWasmModule('string_utils');
    if (!instance) return;
    
    const { memory } = instance.exports;
    if (!memory) {
      printLine('str: Memory not available in WASM module');
      return;
    }

    const op = args[0];
    const text = args.slice(1).join(' ');

    if (!text && op !== 'len' && op !== 'wc') {
      printLine('Need text input');
      return;
    }

    const ptr = writeString(memory, text);

    switch(op) {
      case 'upper':
        const upperPtr = instance.exports.str_toupper(ptr);
        printLine(readString(memory, upperPtr));
        break;
      case 'lower':
        const lowerPtr = instance.exports.str_tolower(ptr);
        printLine(readString(memory, lowerPtr));
        break;
      case 'reverse':
        const revPtr = instance.exports.str_reverse(ptr);
        printLine(readString(memory, revPtr));
        break;
      case 'wc':
        const count = instance.exports.str_wordcount(ptr);
        printLine(`Word count: ${count}`);
        break;
      case 'len':
        const len = instance.exports.str_length(ptr);
        printLine(`Length: ${len}`);
        break;
      default:
        printLine(`Unknown operation: ${op}`);
    }
  }

  // ===== Shell Infrastructure =====

  const commands = [
    'echo', 'help', 'clear', 'date', 'cat', 'math', 'str', 'ps', 'exec', 'modules'
  ];
  let history = [];
  let histIdx = -1;
  let cwd = '~';

  function setPrompt() {
    promptEl.textContent = `WasmOS ${cwd} $`;
  }

  async function runCommand(line) {
    if (!line.trim()) return;
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    
    switch(cmd){
      case 'echo':
        await cmdEcho(args);
        break;
      case 'help':
        printLine('Available Commands (WASM-only):');
        printLine('  echo <text>          - Echo text using WASM');
        printLine('  cat <text>           - Write to virtual file');
        printLine('  cat --read           - Read from virtual file');  
        printLine('  math <op> <nums>     - Math operations (add, mul, fact, pow, sqrt, prime)');
        printLine('  str <op> <text>      - String operations (upper, lower, reverse, wc, len)');
        printLine('  modules              - List loaded WASM modules');
        printLine('  date                 - Show current date');
        printLine('  clear                - Clear screen');
        printLine('  help                 - Show this help');
        printLine('');
        printLine('Note: Run build.sh first to compile WASM modules');
        break;
      case 'clear':
        term.textContent = '';
        break;
      case 'date':
        printLine(new Date().toString());
        break;
      case 'cat':
        await cmdCat(args);
        break;
      case 'math':
        await cmdMath(args);
        break;
      case 'str':
        await cmdStr(args);
        break;
      case 'modules':
        printLine('Loaded WASM modules:');
        const loaded = Object.keys(wasmModules);
        if (loaded.length === 0) {
          printLine('  (none loaded yet - modules load on first use)');
        } else {
          loaded.forEach(m => {
            const lang = moduleLanguages[m] || 'Unknown';
            printLine(`  ✓ ${m} (${lang})`);
          });
        }
        break;
      default:
        printLine(`command not found: ${cmd}`);
        printLine('Type "help" for available commands');
    }
  }

  function autocomplete(current) {
    const hits = commands.filter(c => c.startsWith(current));
    if (hits.length === 1) return hits[0] + ' ';
    if (hits.length > 1) printLine(hits.join('  '));
    return current;
  }

  // Initial banner
  printLine('╔════════════════════════════════════════════════╗');
  printLine('║    WasmOS - Pure WebAssembly Mini OS          ║');
  printLine('║  All functions powered by compiled WASM       ║');
  printLine('╚════════════════════════════════════════════════╝');
  printLine('');
  printLine('Type "help" for commands. Run build.sh first!');
  printLine('');
  setPrompt();
  input.focus();

  // Key handling
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const line = input.value;
      printLine(promptEl.textContent + ' ' + line);
      history.push(line);
      histIdx = history.length;
      input.value = '';
      await runCommand(line);
    } else if (e.key === 'ArrowUp') {
      if (histIdx > 0) {
        histIdx--;
        input.value = history[histIdx] || '';
        setTimeout(() => input.setSelectionRange(input.value.length, input.value.length));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (histIdx < history.length) {
        histIdx++;
        input.value = history[histIdx] || '';
        setTimeout(() => input.setSelectionRange(input.value.length, input.value.length));
      }
      e.preventDefault();
    } else if (e.key === 'Tab') {
      const before = input.value;
      input.value = autocomplete(before);
      e.preventDefault();
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      term.textContent = '';
      e.preventDefault();
    } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      printLine(promptEl.textContent + ' ' + input.value);
      input.value = '';
      e.preventDefault();
    }
  });

  document.addEventListener('click', () => input.focus());
})();
