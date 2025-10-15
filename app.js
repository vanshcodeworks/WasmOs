(function(){
  const term = document.getElementById('terminal');
  const input = document.getElementById('input');
  const promptEl = document.getElementById('prompt');

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  // Debug flag: set ?debug=1 in URL or window.__wasm_debug = true to enable
  const urlParams = new URLSearchParams(window.location.search);
  const WASM_DEBUG = urlParams.get('debug') === '1' || !!window.__wasm_debug;

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
      if (WASM_DEBUG) printLine(`[wasm-loader] probing module: ${name}`);
      // Try build/ first (common build output), then fallback to wasm/ folder next to sources
      let response = await fetch(`build/${name}.wasm`);
      if (WASM_DEBUG) printLine(`[wasm-loader] fetch build/${name}.wasm -> ${response.status}`);
      if (!response.ok) {
        if (WASM_DEBUG) printLine(`[wasm-loader] build/${name}.wasm not found, trying wasm/${name}.wasm`);
        response = await fetch(`wasm/${name}.wasm`);
        if (WASM_DEBUG) printLine(`[wasm-loader] fetch wasm/${name}.wasm -> ${response.status}`);
      }

      if (!response.ok) throw new Error(`Module ${name} not found in build/ or wasm/`);

      // Read the wasm bytes (we may still prefer glue, but keep the bytes for
      // a fallback raw instantiation path).
      const bytes = await response.arrayBuffer();

      // First, prefer loading Emscripten JS glue if present (build/{name}.js).
      // Loading the glue first avoids double-instantiating the wasm and ensures
      // friendly exported names (Module._foo) are available.
      try {
        const scriptUrl = `build/${name}.js`;
        const scriptResp = await fetch(scriptUrl);
        if (WASM_DEBUG) printLine(`[wasm-loader] fetch ${scriptUrl} -> ${scriptResp.status}`);
        if (scriptResp.ok) {
          if (WASM_DEBUG) printLine(`[wasm-loader] loading emscripten glue for ${name}`);
          window.Module = window.Module || {};
          window.Module.locateFile = (file) => `build/${file}`;

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

          // Wait up to 10s for Module to populate exported symbols (prefixed with '_').
          const waitForExports = (timeout = 10000) => new Promise((res, rej) => {
            const start = Date.now();
            (function poll() {
              const mod = window.Module || {};
              const keys = Object.keys(mod);
              const hasExport = keys.some(k => k.startsWith('_') && typeof mod[k] !== 'undefined');
              if (hasExport) return res(mod);
              if (Date.now() - start > timeout) return rej(new Error('Emscripten module did not initialize in time'));
              setTimeout(poll, 100);
            })();
          });

          const resolvedModule = await waitForExports();
          wasmModules[name] = resolvedModule;
          if (WASM_DEBUG) printLine(`[wasm-loader] emscripten module ${name} initialized`);
          return resolvedModule;
        }
      } catch (e) {
        if (WASM_DEBUG) printLine(`[wasm-loader] emscripten glue load failed for ${name}: ${e && e.message}`);
        // No glue or failed to load — fall back to raw wasm below.
      }

      // Fall back: instantiate the raw wasm bytes and return the instance.
      try {
        const { instance } = await WebAssembly.instantiate(bytes, {});
        wasmModules[name] = instance;
        return instance;
      } catch (instErr) {
        throw instErr;
      }
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

    // resolve memory and echo function for raw instance or emscripten Module
    let memory = null;
    let echoFn = null;

    // raw wasm instance
    if (instance.exports && instance.exports.memory) {
      memory = instance.exports.memory;
      echoFn = instance.exports.echo;
    }

    // emscripten Module style
    if (!echoFn && instance._echo) echoFn = instance._echo;
    if (!echoFn && instance.Module && instance.Module._echo) echoFn = instance.Module._echo;
    if (!echoFn && instance.cwrap) {
      try { echoFn = instance.cwrap('echo', 'number', ['number']); } catch(e){}
    }
    if (!echoFn && window.Module && window.Module._echo) echoFn = window.Module._echo;

    if (!memory && instance.Module && instance.Module.HEAP8) {
      // Emscripten exposes HEAP8/HEAPU8 views; wrap them in an object with buffer
      memory = { buffer: instance.Module.HEAP8.buffer };
    }

    if (!echoFn || !memory) {
      printLine('echo: module does not expose required API');
      return;
    }

    const msg = args.join(' ');
    const ptr = writeString(memory, msg);

    const resPtr = echoFn(ptr) >>> 0;
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
    // resolve function helper (raw wasm or emscripten Module)
    function resolveFn(obj, name) {
      if (!obj) return null;
      // raw wasm instance
      if (obj.exports && typeof obj.exports[name] === 'function') return obj.exports[name];
      // direct function on module object
      if (typeof obj[name] === 'function') return obj[name];
      const mname = '_' + name;
      // exported as _name on the Module (common with emscripten glue)
      if (typeof obj[mname] === 'function') return obj[mname];
      if (obj.Module && typeof obj.Module[mname] === 'function') return obj.Module[mname];
      // Emscripten's cwrap helper (Module.cwrap) can provide a callable JS wrapper
      if (obj.cwrap && typeof obj.cwrap === 'function') {
        try { return obj.cwrap(name, 'number', ['number','number']); } catch(e) {}
      }
      if (obj.Module && obj.Module.cwrap && typeof obj.Module.cwrap === 'function') {
        try { return obj.Module.cwrap(name, 'number', ['number','number']); } catch(e) {}
      }
      // Last resort: look for _name on global Module
      if (window.Module && typeof window.Module[mname] === 'function') return window.Module[mname];
      return null;
    }

    if (instance) {
      // prefer raw memory if available
      const memory = (instance.exports && instance.exports.memory) ? instance.exports.memory : (instance.memory || (window.Module && window.Module.HEAP8 && window.Module.HEAP8.buffer ? { buffer: window.Module.HEAP8.buffer } : null));

      const fs_write = resolveFn(instance, 'fs_write');
      const fs_read = resolveFn(instance, 'fs_read');
      const fs_size = resolveFn(instance, 'fs_size');

      if (fs_write && fs_read && fs_size && memory) {
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
    
    // Try wasm module first; fall back to JS implementations if missing
    const instance = await loadWasmModule('string_utils', { silent: true });

    const op = args[0];
    const text = args.slice(1).join(' ');

    if (!text && op !== 'len' && op !== 'wc') {
      printLine('Need text input');
      return;
    }

    // Helper JS fallbacks
    const jsUpper = (s) => s.toUpperCase();
    const jsLower = (s) => s.toLowerCase();
    const jsReverse = (s) => s.split('').reverse().join('');
    const jsWordCount = (s) => {
      if (!s) return 0;
      return s.trim().split(/\s+/).filter(Boolean).length;
    };
    const jsLen = (s) => s.length;

    if (!instance) {
      // Use JS fallback
      switch(op) {
        case 'upper': printLine(jsUpper(text)); break;
        case 'lower': printLine(jsLower(text)); break;
        case 'reverse': printLine(jsReverse(text)); break;
        case 'wc': printLine(`Word count: ${jsWordCount(text)}`); break;
        case 'len': printLine(`Length: ${jsLen(text)}`); break;
        default: printLine(`Unknown operation: ${op}`);
      }
      return;
    }

    // If we have a wasm instance, resolve memory & functions (emscripten or raw)
    function resolveFn(obj, name) {
      if (!obj) return null;
      if (obj.exports && typeof obj.exports[name] === 'function') return obj.exports[name];
      if (typeof obj[name] === 'function') return obj[name];
      const mname = '_' + name;
      if (typeof obj[mname] === 'function') return obj[mname];
      if (obj.Module && typeof obj.Module[mname] === 'function') return obj.Module[mname];
      if (obj.cwrap && typeof obj.cwrap === 'function') {
        try { return obj.cwrap(name, 'number', ['number']); } catch(e) {}
      }
      return null;
    }

    const memory = (instance.exports && instance.exports.memory) ? instance.exports.memory : (instance.Module && instance.Module.HEAP8 ? { buffer: instance.Module.HEAP8.buffer } : null);
    const ptr = memory ? writeString(memory, text) : 0;

    switch(op) {
      case 'upper': {
        const fn = resolveFn(instance, 'str_toupper');
        if (!fn) { printLine(jsUpper(text)); break; }
        const resPtr = fn(ptr);
        printLine(readString(memory, resPtr));
        break;
      }
      case 'lower': {
        const fn = resolveFn(instance, 'str_tolower');
        if (!fn) { printLine(jsLower(text)); break; }
        const resPtr = fn(ptr);
        printLine(readString(memory, resPtr));
        break;
      }
      case 'reverse': {
        const fn = resolveFn(instance, 'str_reverse');
        if (!fn) { printLine(jsReverse(text)); break; }
        const resPtr = fn(ptr);
        printLine(readString(memory, resPtr));
        break;
      }
      case 'wc': {
        const fn = resolveFn(instance, 'str_wordcount');
        if (!fn) { printLine(`Word count: ${jsWordCount(text)}`); break; }
        const count = fn(ptr) >>> 0;
        printLine(`Word count: ${count}`);
        break;
      }
      case 'len': {
        const fn = resolveFn(instance, 'str_length');
        if (!fn) { printLine(`Length: ${jsLen(text)}`); break; }
        const len = fn(ptr) >>> 0;
        printLine(`Length: ${len}`);
        break;
      }
      default:
        printLine(`Unknown operation: ${op}`);
    }
  }

  async function cmdPs(args) {
    const instance = await loadWasmModule('process', { silent: true });

    // JS fallback: simple in-memory process table
    if (!instance) {
      if (!window.__wasmos_processes) window.__wasmos_processes = { counter: 0, procs: [] };
      const ptab = window.__wasmos_processes;

      printLine('PID  STATUS  NAME');
      printLine('---  ------  ----');

      const count = ptab.procs.length;
      if (count === 0) {
        printLine('No processes running');
      } else {
        printLine(`${count} process(es) in memory`);
        for (const p of ptab.procs) {
          printLine(`${p.pid.toString().padEnd(4)} ${p.status === 1 ? 'RUN' : 'STOP'}   ${p.name}`);
        }
      }

      printLine('\nSystem: WasmOS (JS fallback)');
      printLine(`Uptime: ${ptab.counter * 42}s`);
      printLine(`Memory: ${count * 1024} bytes`);
      return;
    }

    // Wasm-backed path
    const memory = (instance.exports && instance.exports.memory) ? instance.exports.memory : (instance.Module && instance.Module.HEAP8 ? { buffer: instance.Module.HEAP8.buffer } : null);
    const count = instance.exports.proc_count();

    printLine('PID  STATUS  NAME');
    printLine('---  ------  ----');
    
    if (count === 0) {
      printLine('No processes running');
    } else {
      printLine(`${count} process(es) in memory`);
      // The wasm module doesn't expose per-process enumerator in this demo; in a full impl
      // we'd call a function to get each ProcessInfo. For now, only display counts and system info.
    }

    const version = memory ? readString(memory, instance.exports.sys_version()) : 'WasmOS';
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
    
    const instance = await loadWasmModule('process', { silent: true });

    const name = args.join(' ');

    if (!instance) {
      if (!window.__wasmos_processes) window.__wasmos_processes = { counter: 0, procs: [] };
      const ptab = window.__wasmos_processes;
      const pid = ++ptab.counter;
      ptab.procs.push({ pid, status: 1, name });
      printLine(`Started process '${name}' with PID ${pid} (JS fallback)`);
      return;
    }

    // Resolve memory & proc_create across different module shapes
    let memory = null;
    if (instance.exports && instance.exports.memory) memory = instance.exports.memory;
    else if (instance.Module && instance.Module.HEAP8) memory = { buffer: instance.Module.HEAP8.buffer };

    // resolve c-style function or emscripten wrapper
    function resolveFn(obj, name) {
      if (!obj) return null;
      if (obj.exports && typeof obj.exports[name] === 'function') return obj.exports[name];
      if (typeof obj[name] === 'function') return obj[name];
      const mname = '_' + name;
      if (typeof obj[mname] === 'function') return obj[mname];
      if (obj.cwrap && typeof obj.cwrap === 'function') {
        try { return obj.cwrap(name, 'number', ['number']); } catch(e){}
      }
      if (obj.Module && obj.Module.cwrap && typeof obj.Module.cwrap === 'function') {
        try { return obj.Module.cwrap(name, 'number', ['number']); } catch(e){}
      }
      return null;
    }

    const procCreate = resolveFn(instance, 'proc_create') || resolveFn(instance, 'procCreate') || resolveFn(instance, 'proc_create');

    if (!procCreate || !memory) {
      // If wasm shape doesn't match, fallback to JS table
      if (!window.__wasmos_processes) window.__wasmos_processes = { counter: 0, procs: [] };
      const ptab = window.__wasmos_processes;
      const pid = ++ptab.counter;
      ptab.procs.push({ pid, status: 1, name });
      printLine(`Started process '${name}' with PID ${pid} (JS fallback)`);
      return;
    }

    const ptr = writeString(memory, name);
    const pid = procCreate(ptr);
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
    
    // Try to load wasm sort module; if missing, fall back to JS implementations
    const instance = await loadWasmModule('sort', { silent: true });
    const useWasm = !!instance;
    let memory = null;
    // Helper to resolve function that may be on raw instance.exports or on emscripten Module
    function resolveFn(obj, name) {
      if (!obj) return null;
      if (obj.exports && typeof obj.exports[name] === 'function') return obj.exports[name];
      if (typeof obj[name] === 'function') return obj[name];
      const mname = '_' + name;
      if (typeof obj[mname] === 'function') return obj[mname];
      if (obj.Module && typeof obj.Module[mname] === 'function') return obj.Module[mname];
      if (obj.cwrap && typeof obj.cwrap === 'function') {
        try { return obj.cwrap(name, 'number', ['number','number']); } catch(e){}
      }
      if (obj.Module && obj.Module.cwrap && typeof obj.Module.cwrap === 'function') {
        try { return obj.Module.cwrap(name, 'number', ['number','number']); } catch(e){}
      }
      // Last resort: check global Module
      if (window.Module && typeof window.Module[mname] === 'function') return window.Module[mname];
      return null;
    }

    if (useWasm) {
      memory = (instance.exports && instance.exports.memory) ? instance.exports.memory : (instance.Module && instance.Module.HEAP32 ? { buffer: instance.Module.HEAP32.buffer } : null);
    }
    const op = args[0];
    const numbers = args.slice(1).map(n => parseInt(n)).filter(n => !isNaN(n));
    
    if (numbers.length === 0) {
      printLine('Please provide numbers to sort');
      return;
    }
    
    // If using wasm, write numbers to WASM memory; otherwise use JS arrays
    const arrayPtr = 1024; // Start at offset 1024
    const arrayIndex = arrayPtr / 4;
    let heap = null;
    if (useWasm && memory) {
      // Ensure memory buffer is large enough (best-effort; real code should check/grow)
      heap = new Int32Array(memory.buffer);
      for (let i = 0; i < numbers.length; i++) heap[arrayIndex + i] = numbers[i];
    }
    
    switch(op) {
      case 'bubble': {
        const fn = resolveFn(instance, 'bubble_sort');
        if (useWasm && fn && heap) {
          fn(arrayPtr, numbers.length);
          const bubbleSorted = Array.from(heap.slice(arrayIndex, arrayIndex + numbers.length));
          printLine(`Bubble Sort: [${bubbleSorted.join(', ')}]`);
        } else {
          // JS bubble sort
          const arr = numbers.slice();
          for (let i = 0; i < arr.length - 1; i++) {
            for (let j = 0; j < arr.length - i - 1; j++) {
              if (arr[j] > arr[j+1]) {
                const t = arr[j]; arr[j] = arr[j+1]; arr[j+1] = t;
              }
            }
          }
          printLine(`Bubble Sort: [${arr.join(', ')}]`);
        }
        break;
      }
        break;
        
      case 'quick': {
        const fn = resolveFn(instance, 'quick_sort');
        if (useWasm && fn && heap) {
          fn(arrayPtr, numbers.length);
          const quickSorted = Array.from(heap.slice(arrayIndex, arrayIndex + numbers.length));
          printLine(`Quick Sort: [${quickSorted.join(', ')}]`);
        } else {
          const arr = numbers.slice().sort((a,b)=>a-b);
          printLine(`Quick Sort: [${arr.join(', ')}]`);
        }
        break;
      }
        
      case 'bsearch': {
        if (args.length < 3) {
          printLine('Usage: sort bsearch <target> <sorted_numbers...>');
          return;
        }
        const target = parseInt(args[1]);
        const searchNums = args.slice(2).map(n => parseInt(n)).filter(n => !isNaN(n));
        const original = searchNums.slice(); // preserve original order to map back

        if (useWasm && heap) {
          for (let i = 0; i < searchNums.length; i++) heap[arrayIndex + i] = searchNums[i];
          const qfn = resolveFn(instance, 'quick_sort');
          if (qfn) qfn(arrayPtr, searchNums.length);
          const bfn = resolveFn(instance, 'binary_search') || resolveFn(instance, 'bsearch') || resolveFn(instance, 'binarySearch');
          const index = bfn ? bfn(arrayPtr, searchNums.length, target) : -1;
          if (index !== -1) {
            const val = heap[arrayIndex + index];
            const origIndex = original.indexOf(val);
            printLine(`Found ${target} at index ${origIndex}`);
          } else {
            printLine(`${target} not found in array`);
          }
        } else {
          const sorted = searchNums.slice().sort((a,b)=>a-b);
          // JS binary search
          let l=0, r=sorted.length-1, found=-1;
          while (l<=r) {
            const m = l + Math.floor((r-l)/2);
            if (sorted[m]===target) { found = m; break; }
            if (sorted[m] < target) l = m+1; else r = m-1;
          }
          if (found !== -1) {
            const val = sorted[found];
            const origIndex = original.indexOf(val);
            printLine(`Found ${target} at index ${origIndex}`);
          } else {
            printLine(`${target} not found in array`);
          }
        }
        break;
      }
        
      case 'min': {
        const fn = resolveFn(instance, 'find_min') || resolveFn(instance, 'findMin');
        if (useWasm && fn && heap) {
          const min = fn(arrayPtr, numbers.length);
          printLine(`Minimum: ${min}`);
        } else {
          const min = numbers.length ? Math.min(...numbers) : 0;
          printLine(`Minimum: ${min}`);
        }
        break;
      }
        
      case 'max': {
        const fn = resolveFn(instance, 'find_max') || resolveFn(instance, 'findMax');
        if (useWasm && fn && heap) {
          const max = fn(arrayPtr, numbers.length);
          printLine(`Maximum: ${max}`);
        } else {
          const max = numbers.length ? Math.max(...numbers) : 0;
          printLine(`Maximum: ${max}`);
        }
        break;
      }
        
      case 'avg': {
        const fn = resolveFn(instance, 'calculate_average') || resolveFn(instance, 'calculateAverage') || resolveFn(instance, 'average');
        if (useWasm && fn && heap) {
          const avg = fn(arrayPtr, numbers.length);
          // ensure numeric and format
          printLine(`Average: ${Number(avg).toFixed(2)}`);
        } else {
          const avg = numbers.length ? (numbers.reduce((a,b)=>a+b,0)/numbers.length) : 0;
          printLine(`Average: ${avg.toFixed(2)}`);
        }
        break;
      }
        
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

    try {
      // Try wasm crypto module, but allow JS fallbacks
    const instance = await loadWasmModule('crypto', { silent: true });
    const useWasm = !!instance;

      if (WASM_DEBUG) printLine(`[crypto] op=${args[0]} args=${args.slice(1).join(' /// ')}`);
      if (WASM_DEBUG) printLine(`[crypto] wasm module present: ${useWasm}`);

    // helper to resolve exported function across raw wasm and emscripten Module
    function resolveFn(obj, name) {
      if (!obj) return null;
      if (obj.exports && typeof obj.exports[name] === 'function') return obj.exports[name];
      if (typeof obj[name] === 'function') return obj[name];
      const mname = '_' + name;
      if (typeof obj[mname] === 'function') return obj[mname];
      if (obj.Module && typeof obj.Module[mname] === 'function') return obj.Module[mname];
      if (obj.cwrap && typeof obj.cwrap === 'function') {
        try { return obj.cwrap(name, 'number', ['number','number','number']); } catch(e){}
      }
      if (obj.Module && obj.Module.cwrap && typeof obj.Module.cwrap === 'function') {
        try { return obj.Module.cwrap(name, 'number', ['number','number','number']); } catch(e){}
      }
      return null;
    }

  const op = args[0];

    // JS fallbacks
    const jsCaesar = (s, shift) => s.split('').map(ch => {
      const code = ch.charCodeAt(0);
      // Basic ASCII letter shift only
      if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + shift) % 26 + 26) % 26 + 65);
      if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + shift) % 26 + 26) % 26 + 97);
      return ch;
    }).join('');

    const jsHash = (s) => {
      // simple 32-bit FNV-1a-ish hash for demo
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h >>> 0;
    };

    const jsBase64 = (s) => {
      try { return btoa(unescape(encodeURIComponent(s))); } catch(e) { return btoa(s); }
    };

    // If we have a wasm module, prefer wasm functions (but tolerate missing exports)
    let memory = null;
    if (useWasm && instance) {
      if (instance.exports && instance.exports.memory) memory = instance.exports.memory;
      else if (instance.Module && instance.Module.HEAP8) memory = { buffer: instance.Module.HEAP8.buffer };
    } else if (instance && instance.Module && instance.Module.HEAP8) {
      // fallback when instance is present but useWasm is false-ish
      memory = { buffer: instance.Module.HEAP8.buffer };
    }

  switch(op) {
  case 'caesar': {
        // allow optional shift: if first arg after 'caesar' is numeric, treat as shift
        if (args.length < 2) { printLine('Usage: crypto caesar [shift] <text>'); return; }
        let shift = 3; // default shift
        let text = '';
        const maybe = args[1];
        if (!isNaN(parseInt(maybe)) && args.length >= 3) {
          shift = parseInt(maybe);
          text = args.slice(2).join(' ');
        } else {
          // no numeric shift provided; use default and treat everything after as text
          text = args.slice(1).join(' ');
        }

        // wasm path
        const caesarFn = resolveFn(instance, 'caesar_encrypt') || resolveFn(instance, 'caesar');
        if (useWasm && caesarFn && memory) {
          try {
            const inPtr = writeString(memory, text);
            const outPtr = 4096;
            caesarFn(inPtr, outPtr, shift);
            const encrypted = readString(memory, outPtr);
            printLine(`Encrypted: ${encrypted}`);
            return;
          } catch (e) {
            if (WASM_DEBUG) printLine(`[crypto] wasm caesar failed: ${e && e.message}`);
            // fall through to JS fallback
          }
        }

        // JS fallback
        printLine(`Encrypted: ${jsCaesar(text, shift)}`);
        return;
      }

      case 'hash': {
        if (args.length < 2) { printLine('Usage: crypto hash <text>'); return; }
        const hashText = args.slice(1).join(' ');
        const hashFn = resolveFn(instance, 'simple_hash') || resolveFn(instance, 'hash') || resolveFn(instance, 'simpleHash');
        if (useWasm && hashFn && memory) {
          const ptr = writeString(memory, hashText);
          const h = hashFn(ptr);
          printLine(`Hash: ${h >>> 0}`);
          return;
        }
        printLine(`Hash: ${jsHash(hashText)}`);
        return;
      }

      case 'base64': {
        if (args.length < 2) { printLine('Usage: crypto base64 <text>'); return; }
        const b64Text = args.slice(1).join(' ');
        const b64Fn = resolveFn(instance, 'base64_encode') || resolveFn(instance, 'base64');
        if (useWasm && b64Fn && memory) {
          const inPtr = writeString(memory, b64Text);
          const outPtr = 8192;
          // many wasm base64 implementations accept (inPtr, outPtr, len)
          try { b64Fn(inPtr, outPtr, b64Text.length); } catch(e) { /* fall back */ }
          const encoded = readString(memory, outPtr);
          if (encoded) { printLine(`Base64: ${encoded}`); return; }
        }
        printLine(`Base64: ${jsBase64(b64Text)}`);
        return;
      }

      default:
        printLine(`Unknown operation: ${op}`);
        return;
    }
    } catch (e) {
      printLine(`[crypto] unexpected error: ${e && e.message ? e.message : e}`);
      if (WASM_DEBUG) console.error(e);
    }
  }

  // Text analysis command (JS fallback matching wasm/text_analyzer.py)
  async function cmdText(args) {
    if (args.length === 0) {
      printLine('Usage: text <operation> <text>');
      printLine('Operations: stats, common, sentiment, keywords, readability');
      return;
    }

    const op = args[0];
    const text = args.slice(1).join(' ');
    if (!text) { printLine('No text provided'); return; }

    const countWords = (s) => s.trim() ? s.trim().split(/\s+/).length : 0;
    const countSentences = (s) => (s.match(/[.!?]+/g) || []).length || (s.trim() ? 1 : 0);
    const countParagraphs = (s) => s.split(/\n\n+/).filter(p=>p.trim()).length;
    const readingTime = (s, wpm=200) => +(countWords(s) / wpm).toFixed(1);

    const textStatistics = (s) => {
      const words = s.trim() ? s.trim().split(/\s+/) : [];
      const chars = s.length;
      const charsNoSpaces = s.replace(/\s+/g, '').length;
      return {
        characters: chars,
        characters_no_spaces: charsNoSpaces,
        words: words.length,
        sentences: countSentences(s),
        paragraphs: countParagraphs(s),
        avg_word_length: words.length ? +(words.reduce((a,b)=>a+b.length,0)/words.length).toFixed(1) : 0,
        reading_time: readingTime(s)
      };
    };

    const findMostCommonWords = (s, n=10) => {
      const words = (s.toLowerCase().match(/\b\w+\b/g) || []);
      const stop = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','was','are','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','can','this','that','these','those']);
      const filtered = words.filter(w => !stop.has(w) && w.length > 2);
      const counts = {};
      for (const w of filtered) counts[w] = (counts[w]||0) + 1;
      return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,n);
    };

    const sentimentAnalysis = (s) => {
      const pos = new Set(['good','great','excellent','amazing','wonderful','fantastic','love','happy','joy','beautiful','perfect','best','awesome']);
      const neg = new Set(['bad','terrible','awful','horrible','hate','sad','angry','worst','poor','disappointing','negative','ugly','disgusting']);
      const words = (s.toLowerCase().match(/\b\w+\b/g) || []);
      const posCount = words.reduce((c,w)=> c + (pos.has(w)?1:0), 0);
      const negCount = words.reduce((c,w)=> c + (neg.has(w)?1:0), 0);
      const total = posCount + negCount;
      if (!total) return { sentiment: 'neutral', score: 0, positive: 0, negative: 0 };
      const score = +( (posCount - negCount) / total ).toFixed(2);
      const sentiment = score > 0.2 ? 'positive' : (score < -0.2 ? 'negative' : 'neutral');
      return { sentiment, score, positive: posCount, negative: negCount };
    };

    const extractKeywords = (s, n=5) => {
      const words = (s.toLowerCase().match(/\b\w+\b/g) || []);
      const uniq = Array.from(new Set(words));
      const scores = {};
      for (const w of uniq) if (w.length > 3) scores[w] = words.filter(x=>x===w).length * (1 + w.length/10);
      return Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,n).map(x=>x[0]);
    };

    const countSyllables = (word) => {
      word = word.toLowerCase();
      const vowels = 'aeiouy';
      let syll=0; let prev=false;
      for (const ch of word) {
        const v = vowels.indexOf(ch) !== -1;
        if (v && !prev) syll++;
        prev = v;
      }
      if (word.endsWith('e')) syll = Math.max(1, syll-1);
      return Math.max(1, syll);
    };

    const readabilityScore = (s) => {
      const words = countWords(s);
      const sentences = countSentences(s);
      if (!words || !sentences) return 0;
      const syllables = (s.match(/\b\w+\b/g) || []).reduce((sum,w)=>sum + countSyllables(w), 0);
      const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
      return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
    };

    switch(op) {
      case 'stats': {
        const stats = textStatistics(text);
        Object.entries(stats).forEach(([k,v]) => printLine(`${k}: ${v}`));
        break;
      }
      case 'common': {
        const top = findMostCommonWords(text, 10);
        top.forEach(([w,c]) => printLine(`${w}: ${c}`));
        break;
      }
      case 'sentiment': {
        const out = sentimentAnalysis(text);
        printLine(`Sentiment: ${out.sentiment} (score=${out.score}) +${out.positive} -${out.negative}`);
        break;
      }
      case 'keywords': {
        const keys = extractKeywords(text, 5);
        printLine(`Keywords: ${keys.join(', ')}`);
        break;
      }
      case 'readability': {
        printLine(`Flesch Reading Ease: ${readabilityScore(text)}`);
        break;
      }
      default:
        printLine('Unknown text operation');
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
        printLine('  sort <op> <nums>     - Sorting & array operations (bubble, quick, bsearch, min, max, avg)');
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
        // Show both available modules (from manifest) and currently loaded modules
        try {
          let resp = await fetch('build/manifest.json');
          if (!resp.ok) resp = await fetch('wasm/manifest.json');
          if (resp.ok) {
            const files = await resp.json();
            printLine('Available WASM modules:');
            // Dedupe base names so pairs like foo.js + foo.wasm show once
            const seen = new Set();
            const bases = [];
            files.forEach(f => {
              const base = f.replace(/\.wasm$|\.js$/,'');
              if (!seen.has(base)) { seen.add(base); bases.push(base); }
            });
            bases.sort();
            bases.forEach(base => {
              const lang = moduleLanguages[base] || '';
              printLine(`  - ${base}${lang ? ` (${lang})` : ''}`);
            });
          } else {
            printLine('Available WASM modules: (manifest not found)');
          }
        } catch (e) {
          printLine(`Available WASM modules: error reading manifest (${e && e.message ? e.message : e})`);
        }

        printLine('');
        printLine('Loaded WASM modules:');
        const loadedKeys = Object.keys(wasmModules);
        if (loadedKeys.length === 0) {
          printLine('  (none loaded yet)');
        } else {
          loadedKeys.forEach(m => printLine(`  - ${m} (${moduleLanguages[m] || 'unknown'})`));
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
