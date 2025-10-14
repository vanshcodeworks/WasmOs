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
    crypto: 'C',
    json_parser: 'Go',
    image_processing: 'TypeScript',
    network: 'JavaScript'
  };

  // Load a WASM module from build directory
  async function loadWasmModule(name, options = {}) {
    const { silent = false } = options;
    if (wasmModules[name]) return wasmModules[name];
    
    try {
      // Try build/ first (common build output), then fallback to wasm/ folder next to sources
      let response = await fetch(`build/${name}.wasm`);
      if (!response.ok) {
        response = await fetch(`wasm/${name}.wasm`);
      }

      if (!response.ok) throw new Error(`Module ${name} not found in build/ or wasm/`);

      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});

      // If the module doesn't have a memory export or the expected function names,
      // try to load emscripten JS glue (build/{name}.js) which initializes the
      // runtime and provides the proper exports.
      const exports = instance && instance.exports ? Object.keys(instance.exports) : [];
      const expected = ['memory'];
      const hasExpected = expected.every(k => exports.includes(k));

      if (!hasExpected) {
        // Try loading Emscripten JS glue (build/{name}.js) by injecting a script tag.
        // This handles the common emcc output which maps mangled exports to friendly names.
        try {
          const scriptUrl = `build/${name}.js`;
          const scriptResp = await fetch(scriptUrl);
          if (scriptResp.ok) {
            // Prepare a Module object that Emscripten glue will use.
            // Provide locateFile so the glue finds the wasm in build/.
            window.Module = window.Module || {};
            window.Module.locateFile = (file) => `build/${file}`;

            // Inject the script so it runs in the page context.
            const scriptText = await scriptResp.text();
            const blob = new Blob([scriptText], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = blobUrl;
              s.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
              s.onerror = (e) => { URL.revokeObjectURL(blobUrl); reject(new Error('Failed to load emscripten glue')); };
              document.head.appendChild(s);
            });

            // Wait for Module to initialize exports. Emscripten sets Module._<symbol> for exported functions.
            const waitForExports = (timeout = 3000) => new Promise((res, rej) => {
              const start = Date.now();
              (function poll() {
                // If Module has any exported property starting with '_', consider it ready
                const mod = window.Module || {};
                const keys = Object.keys(mod);
                const hasExport = keys.some(k => k.startsWith('_') && typeof mod[k] !== 'undefined');
                if (hasExport) return res(mod);
                if (Date.now() - start > timeout) return rej(new Error('Emscripten module did not initialize in time'));
                setTimeout(poll, 50);
              })();
            });

            const resolvedModule = await waitForExports();
            wasmModules[name] = resolvedModule;
            return resolvedModule;
          }
        } catch (e) {
          // ignore and fall back to raw instance below
        }
      }

      wasmModules[name] = instance;
      return instance;
    } catch (e) {
      if (!silent) printLine(`Error loading ${name}: ${e && e.message ? e.message : e}`);
      return null;
    }
  }

  // Helper: write string to WASM memory
  function writeString(memory, str, offset = 1024) {
    // Use a safe default scratch area (1024) to avoid writing at address 0 which
    // some modules may reserve for internal data.
    const bytes = enc.encode(str + '\0');
    const heap = new Uint8Array(memory.buffer);
    heap.set(bytes, offset);
    return offset;
  }

  // Helper: read string from WASM memory
  function readString(memory, ptr) {
    const heap = new Uint8Array(memory.buffer);
    let end = ptr;
    while (heap[end] !== 0 && end < heap.length) end++;
    return dec.decode(heap.subarray(ptr, end));
  }

  // ===== Command Implementations =====

  async function cmdEcho(args) {
    const instance = await loadWasmModule('echo');
    if (!instance) return;
    
    const { memory, echo } = instance.exports;
    const msg = args.join(' ');
    const ptr = writeString(memory, msg);
    const resPtr = echo(ptr) >>> 0;
    const out = readString(memory, resPtr);
    printLine(out);
  }

  async function cmdCat(args) {
    if (args.length === 0) {
      printLine('Usage: cat <content...>  or  cat --read');
      return;
    }
  // Try to use wasm fileops module; if not available, use JS fallback virtual file
  const instance = await loadWasmModule('fileops', { silent: true });
    if (instance && instance.exports && instance.exports.fs_write) {
      const { memory, fs_write, fs_read, fs_size } = instance.exports;

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
      return;
    }

    // JS fallback: simple in-memory virtual file
    // Store content in a variable; this is ephemeral (not persisted)
    if (!window.__wasmos_virtual_file) window.__wasmos_virtual_file = '';

    if (args[0] === '--read') {
      const content = window.__wasmos_virtual_file;
      if (!content) printLine('(file is empty)'); else printLine(content);
    } else {
      const content = args.join(' ');
      window.__wasmos_virtual_file = content;
      printLine(`Wrote ${content.length} bytes to virtual file (JS fallback)`);
    }
  }

  async function cmdLs(args) {
    // Prefer build/manifest.json (built artifacts) and fall back to wasm/manifest.json
    try {
      let resp = await fetch('build/manifest.json');
      if (!resp.ok) resp = await fetch('wasm/manifest.json');
      if (!resp.ok) {
        printLine('ls: could not read manifest (tried build/manifest.json and wasm/manifest.json)');
        return;
      }
      const files = await resp.json();

      if (args.length > 0 && args[0] === '-l') {
        // long listing: show language if known
        for (const f of files) {
          const base = f.replace(/\.wasm$/,'');
          const lang = moduleLanguages[base] || '';
          printLine(`${(lang || '').padEnd(10)} ${f}`);
        }
      } else {
        // default: print in columns
        printLine(files.join('  '));
      }
    } catch (e) {
      printLine(`ls: ${e && e.message ? e.message : e}`);
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

    // Helper to resolve a function from either a raw WebAssembly instance.exports
    // or an Emscripten Module object which exposes functions as _name
    function resolveFn(obj, name) {
      if (!obj) return null;
      if (obj.exports && typeof obj.exports[name] === 'function') return obj.exports[name];
      if (typeof obj[name] === 'function') return obj[name];
      const mname = '_' + name;
      if (typeof obj[mname] === 'function') return obj[mname];
      if (obj.Module && typeof obj.Module[mname] === 'function') return obj.Module[mname];
      return null;
    }

    const op = args[0];
    const nums = args.slice(1).map(parseFloat);

    switch(op) {
      case 'add': {
        if (nums.length < 2) { printLine('Need 2 numbers'); return; }
        const fn = resolveFn(instance, 'math_add');
        if (!fn) { printLine('math_add not available'); return; }
        printLine(`Result: ${fn(nums[0], nums[1])}`);
        break;
      }
      case 'mul': {
        if (nums.length < 2) { printLine('Need 2 numbers'); return; }
        const fn = resolveFn(instance, 'math_multiply');
        if (!fn) { printLine('math_multiply not available'); return; }
        printLine(`Result: ${fn(nums[0], nums[1])}`);
        break;
      }
      case 'fact': {
        if (nums.length < 1) { printLine('Need 1 number'); return; }
        const fn = resolveFn(instance, 'math_factorial');
        if (!fn) { printLine('math_factorial not available'); return; }
        printLine(`Result: ${fn(Math.floor(nums[0]))}`);
        break;
      }
      case 'pow': {
        if (nums.length < 2) { printLine('Need 2 numbers'); return; }
        const fn = resolveFn(instance, 'math_power');
        if (!fn) { printLine('math_power not available'); return; }
        printLine(`Result: ${fn(nums[0], nums[1])}`);
        break;
      }
      case 'sqrt': {
        if (nums.length < 1) { printLine('Need 1 number'); return; }
        const fn = resolveFn(instance, 'math_sqrt');
        if (!fn) { printLine('math_sqrt not available'); return; }
        printLine(`Result: ${fn(nums[0])}`);
        break;
      }
      case 'prime': {
        if (nums.length < 1) { printLine('Need 1 number'); return; }
        const fn = resolveFn(instance, 'math_isprime');
        if (!fn) { printLine('math_isprime not available'); return; }
        const isPrime = fn(Math.floor(nums[0]));
        printLine(`${Math.floor(nums[0])} is ${isPrime ? 'PRIME' : 'NOT PRIME'}`);
        break;
      }
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

  async function cmdPs(args) {
    const instance = await loadWasmModule('process');
    if (!instance) return;
    
    const { memory } = instance.exports;
    const count = instance.exports.proc_count();
    
    printLine('PID  STATUS  NAME');
    printLine('---  ------  ----');
    
    // In a real implementation, we'd query each process
    // For demo, show system info
    if (count === 0) {
      printLine('No processes running');
    } else {
      printLine(`${count} process(es) in memory`);
    }
    
    const version = readString(memory, instance.exports.sys_version());
    const uptime = instance.exports.sys_uptime();
    const memUsed = instance.exports.sys_memused();
    
    printLine(`\nSystem: ${version}`);
    printLine(`Uptime: ${uptime}s`);
    printLine(`Memory: ${memUsed} bytes`);
  }

  async function cmdExec(args) {
    if (args.length === 0) {
      printLine('Usage: exec <process_name>');
      return;
    }
    
    const instance = await loadWasmModule('process');
    if (!instance) return;
    
    const { memory } = instance.exports;
    const name = args.join(' ');
    const ptr = writeString(memory, name);
    const pid = instance.exports.proc_create(ptr);
    
    printLine(`Started process '${name}' with PID ${pid}`);
  }

  // ===== NEW Command Implementations =====

  async function cmdSort(args) {
    if (args.length === 0) {
      printLine('Usage: sort <algorithm> <numbers...>');
      printLine('Algorithms: bubble, quick, bsearch, min, max, avg');
      printLine('Example: sort quick 64 34 25 12 22 11 90');
      return;
    }
    
    const instance = await loadWasmModule('sort');
    if (!instance) return;
    
    const { memory } = instance.exports;
    const op = args[0];
    const numbers = args.slice(1).map(n => parseInt(n)).filter(n => !isNaN(n));
    
    if (numbers.length === 0) {
      printLine('Please provide numbers to sort');
      return;
    }
    
    // Write numbers to WASM memory
    const heap = new Int32Array(memory.buffer);
    const arrayPtr = 1024; // Start at offset 1024
    const arrayIndex = arrayPtr / 4;
    
    for (let i = 0; i < numbers.length; i++) {
      heap[arrayIndex + i] = numbers[i];
    }
    
    switch(op) {
      case 'bubble':
        instance.exports.bubble_sort(arrayPtr, numbers.length);
        const bubbleSorted = Array.from(heap.slice(arrayIndex, arrayIndex + numbers.length));
        printLine(`Bubble Sort: [${bubbleSorted.join(', ')}]`);
        printLine(`Language: ${moduleLanguages.sort}`);
        break;
        
      case 'quick':
        instance.exports.quick_sort(arrayPtr, numbers.length);
        const quickSorted = Array.from(heap.slice(arrayIndex, arrayIndex + numbers.length));
        printLine(`Quick Sort: [${quickSorted.join(', ')}]`);
        printLine(`Language: ${moduleLanguages.sort}`);
        break;
        
      case 'bsearch':
        if (args.length < 3) {
          printLine('Usage: sort bsearch <target> <sorted_numbers...>');
          return;
        }
        const target = parseInt(args[1]);
        const searchNums = args.slice(2).map(n => parseInt(n)).filter(n => !isNaN(n));
        
        for (let i = 0; i < searchNums.length; i++) {
          heap[arrayIndex + i] = searchNums[i];
        }
        
        instance.exports.quick_sort(arrayPtr, searchNums.length);
        const index = instance.exports.binary_search(arrayPtr, searchNums.length, target);
        
        if (index !== -1) {
          printLine(`Found ${target} at index ${index}`);
        } else {
          printLine(`${target} not found in array`);
        }
        printLine(`Language: ${moduleLanguages.sort}`);
        break;
        
      case 'min':
        const min = instance.exports.find_min(arrayPtr, numbers.length);
        printLine(`Minimum: ${min}`);
        printLine(`Language: ${moduleLanguages.sort}`);
        break;
        
      case 'max':
        const max = instance.exports.find_max(arrayPtr, numbers.length);
        printLine(`Maximum: ${max}`);
        printLine(`Language: ${moduleLanguages.sort}`);
        break;
        
      case 'avg':
        const avg = instance.exports.calculate_average(arrayPtr, numbers.length);
        printLine(`Average: ${avg.toFixed(2)}`);
        printLine(`Language: ${moduleLanguages.sort}`);
        break;
        
      default:
        printLine(`Unknown operation: ${op}`);
    }
  }

  async function cmdCrypto(args) {
    if (args.length === 0) {
      printLine('Usage: crypto <operation> <args>');
      printLine('Operations:');
      printLine('  caesar <shift> <text>  - Caesar cipher');
      printLine('  hash <text>            - Simple hash');
      printLine('  base64 <text>          - Base64 encode');
      return;
    }
    
    const instance = await loadWasmModule('crypto');
    if (!instance) return;
    
    const { memory } = instance.exports;
    const op = args[0];
    
    switch(op) {
      case 'caesar':
        if (args.length < 3) {
          printLine('Usage: crypto caesar <shift> <text>');
          return;
        }
        const shift = parseInt(args[1]);
        const text = args.slice(2).join(' ');
        
        const inputPtr = writeString(memory, text);
        const outputPtr = 2048;
        
        instance.exports.caesar_encrypt(inputPtr, outputPtr, shift);
        const encrypted = readString(memory, outputPtr);
        
        printLine(`Encrypted: ${encrypted}`);
        printLine(`Language: ${moduleLanguages.crypto}`);
        break;
        
      case 'hash':
        if (args.length < 2) {
          printLine('Usage: crypto hash <text>');
          return;
        }
        const hashText = args.slice(1).join(' ');
        const hashPtr = writeString(memory, hashText);
        const hash = instance.exports.simple_hash(hashPtr);
        
        printLine(`Hash: ${hash >>> 0}`);
        printLine(`Language: ${moduleLanguages.crypto}`);
        break;
        
      case 'base64':
        if (args.length < 2) {
          printLine('Usage: crypto base64 <text>');
          return;
        }
        const b64Text = args.slice(1).join(' ');
        const b64InputPtr = writeString(memory, b64Text);
        const b64OutputPtr = 3072;
        
        instance.exports.base64_encode(b64InputPtr, b64OutputPtr, b64Text.length);
        const encoded = readString(memory, b64OutputPtr);
        
        printLine(`Base64: ${encoded}`);
        printLine(`Language: ${moduleLanguages.crypto}`);
        break;
        
      default:
        printLine(`Unknown operation: ${op}`);
    }
  }

  async function cmdLang(args) {
    printLine('╔════════════════════════════════════════════════╗');
    printLine('║  WasmOS - Polyglot Multi-Language System      ║');
    printLine('╚════════════════════════════════════════════════╝');
    printLine('');
    printLine('Supported Languages:');
    printLine('  ✓ C++            - High performance, systems programming');
    printLine('  ✓ C              - Low-level operations, cryptography');
    printLine('  ✓ Go             - Concurrent operations, JSON processing');
    printLine('  ✓ TypeScript     - Type-safe, image processing');
    printLine('  ✓ JavaScript     - Network utilities, dynamic operations');
    printLine('  ○ Python         - Text analysis, AI/ML (coming soon)');
    printLine('  ○ Rust           - Memory safety, performance (coming soon)');
    printLine('');
    printLine('Module Distribution:');
    Object.entries(moduleLanguages).forEach(([module, lang]) => {
      printLine(`  ${module.padEnd(20)} → ${lang}`);
    });
    printLine('');
    printLine('Loaded Modules:');
    const loaded = Object.keys(wasmModules);
    if (loaded.length === 0) {
      printLine('  (none loaded yet - modules load on first use)');
    } else {
      loaded.forEach(m => {
        printLine(`  ✓ ${m} (${moduleLanguages[m]})`);
      });
    }
  }

  async function cmdBench(args) {
    printLine('Running performance benchmarks...');
    printLine('');
    
    // Benchmark: Factorial
    printLine('Test 1: Factorial(20)');
    const mathMod = await loadWasmModule('math');
    if (mathMod) {
      const start1 = performance.now();
      const result = mathMod.exports.math_factorial(20);
      const end1 = performance.now();
      printLine(`  Result: ${result}`);
      printLine(`  Time: ${(end1 - start1).toFixed(3)}ms`);
      printLine(`  Language: C++`);
    }
    printLine('');
    
    // Benchmark: String operations
    printLine('Test 2: String Reverse (1000 chars)');
    const strMod = await loadWasmModule('string_utils');
    if (strMod) {
      const { memory } = strMod.exports;
      const longStr = 'A'.repeat(1000);
      const ptr = writeString(memory, longStr);
      
      const start2 = performance.now();
      const revPtr = strMod.exports.str_reverse(ptr);
      const end2 = performance.now();
      
      printLine(`  Time: ${(end2 - start2).toFixed(3)}ms`);
      printLine(`  Language: C++`);
    }
    printLine('');
    
    // Benchmark: Sorting
    printLine('Test 3: Quick Sort (1000 numbers)');
    const sortMod = await loadWasmModule('sort');
    if (sortMod) {
      const { memory } = sortMod.exports;
      const heap = new Int32Array(memory.buffer);
      const arrayPtr = 1024;
      const arrayIndex = arrayPtr / 4;
      const count = 1000;
      
      // Generate random numbers
      for (let i = 0; i < count; i++) {
        heap[arrayIndex + i] = Math.floor(Math.random() * 10000);
      }
      
      const start3 = performance.now();
      sortMod.exports.quick_sort(arrayPtr, count);
      const end3 = performance.now();
      
      printLine(`  Time: ${(end3 - start3).toFixed(3)}ms`);
      printLine(`  Language: C++`);
    }
    printLine('');
    
    printLine('Benchmark complete!');
  }

  // ===== Shell Infrastructure =====

  const commands = [
    'echo', 'help', 'clear', 'date', 'cat', 'math', 'str', 'ps', 'exec', 
    'modules', 'sort', 'crypto', 'lang', 'bench'
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
        printLine('Available Commands:');
        printLine('  echo <text>          - Echo text using WASM');
        printLine('  cat <text>           - Write to virtual file');
        printLine('  cat --read           - Read from virtual file');
        printLine('  math <op> <nums>     - Math operations (add, mul, fact, pow, sqrt, prime)');
        printLine('  str <op> <text>      - String operations (upper, lower, reverse, wc, len)');
        printLine('  sort <op> <nums>     - Sorting & array operations');
        printLine('  crypto <op> <args>   - Cryptography operations');
        printLine('  ps                   - Show processes and system info');
        printLine('  exec <name>          - Create a simulated process');
        printLine('  modules              - List loaded WASM modules');
        printLine('  lang                 - Show language support information');
        printLine('  bench                - Run performance benchmarks');
        printLine('  date                 - Show current date');
        printLine('  clear                - Clear screen');
        printLine('  help                 - Show this help');
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
      case 'ls':
        await cmdLs(args);
        break;
      case 'math':
        await cmdMath(args);
        break;
      case 'str':
        await cmdStr(args);
        break;
      case 'ps':
        await cmdPs(args);
        break;
      case 'exec':
        await cmdExec(args);
        break;
      case 'modules':
        printLine('Loaded WASM modules:');
        Object.keys(wasmModules).forEach(m => printLine(`  - ${m} (${moduleLanguages[m]})`));
        if (Object.keys(wasmModules).length === 0) {
          printLine('  (none loaded yet)');
        }
        break;
      case 'sort':
        await cmdSort(args);
        break;
      case 'crypto':
        await cmdCrypto(args);
        break;
      case 'lang':
        await cmdLang(args);
        break;
      case 'bench':
        await cmdBench(args);
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
  printLine('║    WasmOS - Polyglot Mini Operating System    ║');
  printLine('║  Powered by C++, C, Go, TypeScript, and more  ║');
  printLine('╚════════════════════════════════════════════════╝');
  printLine('');
  printLine('Type "help" for commands or "lang" for language info');
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
