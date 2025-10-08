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

  // Minimal wasm module embedded: memory + echo(ptr)->ptr
  const wasmBytes = new Uint8Array([
    0,97,115,109,1,0,0,0,
    1,6,1,96,1,127,1,127,
    3,2,1,0,
    5,3,1,0,1,
    7,17,2,6,109,101,109,111,114,121,2,0,4,101,99,104,111,0,0,
    10,6,1,4,0,32,0,11
  ]);

  let echoInstancePromise = null;
  async function getEchoInstance() {
    if (echoInstancePromise) return echoInstancePromise;
    echoInstancePromise = (async () => {
      const { instance } = await WebAssembly.instantiate(wasmBytes, {});
      return instance;
    })();
    return echoInstancePromise;
  }

  async function runEcho(args) {
    const instance = await getEchoInstance();
    const { memory, echo } = instance.exports;
    const msg = args.join(' ');
    const msgBytes = enc.encode(msg);
    const basePtr = 0;
    const heap = new Uint8Array(memory.buffer);
    if (msgBytes.length + 1 > heap.length) { printLine('message too long'); return; }
    heap.set(msgBytes, basePtr);
    heap[basePtr + msgBytes.length] = 0;

    const resPtr = echo(basePtr) >>> 0;
    let end = resPtr; while (heap[end] !== 0) end++;
    const out = dec.decode(heap.subarray(resPtr, end));
    printLine(out);
  }

  // Shell UX features
  const commands = ['echo','help','clear','date'];
  let history = [];
  let histIdx = -1;
  let cwd = '~';

  function setPrompt() {
    promptEl.textContent = `MyWasmOS ${cwd} >`;
  }

  function runCommand(line) {
    if (!line.trim()) return;
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    switch(cmd){
      case 'echo':
        return runEcho(args);
      case 'help':
        printLine('Commands: echo, help, clear, date');
        return;
      case 'clear':
        term.textContent = '';
        return;
      case 'date':
        printLine(new Date().toString());
        return;
      default:
        printLine(`command not found: ${cmd}`);
        return;
    }
  }

  function autocomplete(current) {
    const hits = commands.filter(c => c.startsWith(current));
    if (hits.length === 1) return hits[0] + ' ';
    if (hits.length > 1) printLine(hits.join('  '));
    return current;
  }

  // Initial banner
  printLine('Welcome to MyWasmOS');
  printLine('Type "help" to list commands.');
  setPrompt();
  input.focus();

  // Key handling
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const line = input.value;
      printLine(promptEl.textContent + ' ' + line);
      history.push(line); histIdx = history.length;
      input.value = '';
      runCommand(line);
    } else if (e.key === 'ArrowUp') {
      if (histIdx > 0) { histIdx--; input.value = history[histIdx] || ''; setTimeout(()=>input.setSelectionRange(input.value.length,input.value.length)); }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (histIdx < history.length) { histIdx++; input.value = history[histIdx] || ''; setTimeout(()=>input.setSelectionRange(input.value.length,input.value.length)); }
      e.preventDefault();
    } else if (e.key === 'Tab') {
      const before = input.value;
      input.value = autocomplete(before);
      e.preventDefault();
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      term.textContent = '';
      e.preventDefault();
    } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      // Simulate SIGINT: move to new line, keep prompt
      printLine(promptEl.textContent + ' ' + input.value);
      input.value = '';
      e.preventDefault();
    }
  });

  // Keep focus on input when clicking anywhere
  document.addEventListener('click', () => input.focus());
})();
