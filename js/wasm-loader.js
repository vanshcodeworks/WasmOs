// Load and cache WASM modules dynamically
const wasmModules = {};

async function loadWasmModule(name) {
  if (wasmModules[name]) return wasmModules[name];
  const response = await fetch(`./wasm/${name}.wasm`);
  const bytes = await response.arrayBuffer();
  const wasm = await WebAssembly.instantiate(bytes, {});
  wasmModules[name] = wasm.instance.exports;
  return wasmModules[name];
}
