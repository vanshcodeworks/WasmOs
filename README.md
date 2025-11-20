# WasmOS - Polyglot Mini Operating System

A lightweight, browser-based operating system that demonstrates how code written in multiple languages can be compiled to WebAssembly and executed in real-time.

## Features

- **Multi-language Support**: C++ modules compiled to WASM
- **Real-time Execution**: All commands run via WebAssembly
- **Module System**: Dynamic loading of WASM modules
- **File Operations**: Virtual file system operations
- **Math Engine**: Complex calculations via WASM
- **String Processing**: Text manipulation utilities
- **Process Management**: Simulated process control
- **Terminal Interface**: Unix-like shell experience

## Architecture


## Prerequisites

- **Emscripten SDK**: For compiling C++ to WebAssembly
  ```bash
  # Install Emscripten
  git clone https://github.com/emscripten-core/emsdk.git
  cd emsdk
  ./emsdk install latest
  ./emsdk activate latest
  source ./emsdk_env.sh
  ```

- **Python HTTP Server**: For local testing
  ```bash
  python -m http.server 8000
  ```

## Building

### Linux/Mac:
```bash
chmod +x build.sh
./build.sh
```

### Windows:
```batch
build.bat
```

This compiles all C++ modules to WebAssembly and places them in the `build/` directory.

## Running

1. Build the WASM modules (see above)
2. Start a local web server:
   ```bash
   python -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser
4. Start using commands!

## Available Commands

### Basic Commands
- `help` - Display all available commands
- `clear` - Clear the terminal screen
- `date` - Show current date and time
- `modules` - List loaded WASM modules

### Echo (String I/O)
```bash
echo Hello from WebAssembly!
```

### File Operations
```bash
cat This is file content          # Write to virtual file
cat --read                         # Read from virtual file
```

### Math Operations
```bash
math add 5 3                       # Addition: 8
math mul 4 7                       # Multiplication: 28
math fact 5                        # Factorial: 120
math pow 2 8                       # Power: 256
math sqrt 144                      # Square root: 12
math prime 17                      # Check if prime: PRIME
```

### String Operations
```bash
str upper hello world              # HELLO WORLD
str lower TESTING                  # testing
str reverse WasmOS                 # SOmsaW
str wc the quick brown fox         # Word count: 4
str len WebAssembly                # Length: 11
```

### Process Management
```bash
ps                                 # Show system info
exec myapp                         # Create simulated process
```

## Project Structure

```
WasmOs/
├── index.html              # UI and terminal interface
├── app.js                  # Shell logic and WASM loader
├── build.sh / build.bat    # Build scripts
├── README.md               # This file
├── report.md              # Project report
├── wasm/                  # Source code for WASM modules
│   ├── echo.cpp           # String echo
│   ├── fileops.cpp        # File system operations
│   ├── math.cpp           # Mathematical functions
│   ├── string_utils.cpp   # String manipulation
│   └── process.cpp        # Process management
└── build/                 # Compiled WASM modules (generated)
    ├── echo.wasm
    ├── fileops.wasm
    ├── math.wasm
    ├── string_utils.wasm
    └── process.wasm
```

## Sandboxing Model

WasmOS relies on WebAssembly’s built‑in sandbox:

- Each `.wasm` file is a **separate module** with its own linear memory.
- Modules cannot:
  - Access host OS resources directly (files, network, devices)
  - Access JS variables or other modules’ memory
- The only way to talk to a module is through its **exported functions**.
- The host (`wasmOS.js`) decides:
  - Which imports are given to the module
  - Which exports are callable from the shell

**Data flow (safe boundary):**

1. JS encodes a string → writes into the module’s memory (`writeString`)
2. JS calls a WASM function with a memory pointer and length
3. WASM reads from its own memory, computes, writes result back into its own buffer
4. WASM returns a pointer
5. JS reads bytes from that pointer and decodes back to a JS string

This pattern makes it easy to reason about isolation and to log all cross‑boundary calls.

## Loading New Modules (Any Language → WASM → WasmOS)

Any language that can compile to WebAssembly can become a **first‑class “process”** inside WasmOS.

### Step 1 – Write code in your language

Example in C++:

```cpp
// filepath: wasm/mymodule.cpp
extern "C" {
  // Pure computation: no OS calls, no global state
  int my_function(int x) {
    return x * 2;
  }
}
```

For Go, Rust, AssemblyScript, etc. you write the same logic in that language and compile to a standalone WASM module.

### Step 2 – Compile to `.wasm`

Using Emscripten (C/C++):

```bash
emcc wasm/mymodule.cpp -O3 \
  -s WASM=1 \
  -s STANDALONE_WASM=1 \
  --no-entry \
  -s EXPORTED_FUNCTIONS='["_my_function"]' \
  -o build/mymodule.wasm
```

For Go (TinyGo):

```bash
tinygo build -o build/mymodule.wasm -target wasm wasm/mymodule.go
```

For AssemblyScript:

```bash
asc wasm/mymodule.ts -O3 --exportRuntime -o build/mymodule.wasm
```

### Step 3 – Expose it as a WasmOS command

Inside the JS host (terminal layer), you load the module and call its exports:

```javascript
// filepath: e:\WasmOs\app.js
// ...existing code...
async function cmdMyModule(args) {
  const instance = await loadWasmModule('mymodule');
  if (!instance) return;

  const result = instance.exports.my_function(42);
  printLine(`Result: ${result}`);
}
// Then register 'mymodule' as a command in runCommand()
// ...existing code...
```

Now from the WasmOS terminal:

```bash
WasmOS $ mymodule
Result: 84
```

### Step 4 – Security / Sandboxing for New Modules

When you add a module like `mymodule.wasm`:

- It runs inside the **same WASM sandbox** as all other modules
- It only uses:
  - Its own memory
  - Functions you explicitly imported (`env.*`)
- It cannot:
  - Read/write host files
  - Access the network
  - Touch other modules’ memory

If you want to sandbox higher‑level languages (Python, Ruby, etc.), you compile their runtimes to WASM (e.g. Pyodide) and then:

1. Load `python_runtime.wasm` as a module
2. Expose a small API like: `_py_eval(codePointer, len, outPtr, maxLen)`
3. From the terminal, write Python code into its memory, call `_py_eval`, and read back the result

This keeps user code **fully contained** inside the WASM runtime.

## Future Enhancements

- [ ] Persistent file system (IndexedDB)
- [ ] Multi-threading with Web Workers
- [ ] Graphics UI layer
- [ ] Network stack simulation
- [ ] Package manager for WASM modules
- [ ] Full Linux-like command set

## Technical Details

### Memory Management
- Each WASM module has its own linear memory
- Strings are passed via memory pointers
- UTF-8 encoding/decoding via TextEncoder/TextDecoder

### Module Loading
- Dynamic module loading via `fetch()` and `WebAssembly.instantiate()`
- Module caching for performance
- Lazy loading on first command use

### Performance
- Compiled with `-O3` optimization
- Near-native execution speed
- No runtime overhead for pure computation

## Contributing

This is a demonstration project showing polyglot WebAssembly development. Feel free to:
- Add new language examples (Rust, Go, AssemblyScript)
- Implement more system calls
- Improve the shell interface
- Add comprehensive testing

## License

Open source for educational purposes.
