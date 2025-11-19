export class WasmLoader {
  constructor(statusCallback = null) {
    this.modules = {};
    this.statusCallback = statusCallback;
    this.enc = new TextEncoder();
    this.dec = new TextDecoder();
  }

  setStatus(message) {
    if (this.statusCallback) {
      this.statusCallback(message);
    }
  }

  async loadModule(name) {
    if (this.modules[name]) return this.modules[name];
    
    this.setStatus(`Loading ${name}.wasm...`);
    
    try {
      const response = await fetch(`build/${name}.wasm`);
      if (!response.ok) {
        throw new Error(`Module ${name}.wasm not found in build/ directory`);
      }
      
      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      this.modules[name] = instance;
      
      this.setStatus(`WasmOS Ready - ${Object.keys(this.modules).length} modules loaded`);
      return instance;
    } catch (error) {
      this.setStatus('WasmOS - Build required');
      throw error;
    }
  }

  writeString(memory, str, offset = 1024) {
    const bytes = this.enc.encode(str + '\0');
    const heap = new Uint8Array(memory.buffer);
    if (offset + bytes.length > heap.length) {
      throw new Error('String too long for WASM memory');
    }
    heap.set(bytes, offset);
    return offset;
  }

  readString(memory, ptr) {
    const heap = new Uint8Array(memory.buffer);
    let end = ptr;
    while (end < heap.length && heap[end] !== 0) end++;
    return this.dec.decode(heap.subarray(ptr, end));
  }

  getLoadedModules() {
    return Object.keys(this.modules);
  }
}
