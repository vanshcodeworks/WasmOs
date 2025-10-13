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

```
┌─────────────┐
│  Browser    │
│  (HTML/JS)  │
└──────┬──────┘
       │
       ├─> WASM Module Loader
       │
       ├─> echo.wasm (C++)
       ├─> fileops.wasm (C++)
       ├─> math.wasm (C++)
       ├─> string_utils.wasm (C++)
       └─> process.wasm (C++)
```

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

## Adding New Modules

1. **Write your module** in C++ (or Rust, Go, etc.):
   ```cpp
   // wasm/mymodule.cpp
   extern "C" {
     int my_function(int x) {
       return x * 2;
     }
   }
   ```

2. **Add to build script**:
   ```bash
   emcc wasm/mymodule.cpp -O3 \
     -s WASM=1 \
     -s EXPORTED_FUNCTIONS='["_my_function"]' \
     -o build/mymodule.wasm
   ```

3. **Use in app.js**:
   ```javascript
   async function cmdMyCommand(args) {
     const instance = await loadWasmModule('mymodule');
     const result = instance.exports.my_function(42);
     printLine(`Result: ${result}`);
   }
   ```

## Future Enhancements

- [ ] Rust module examples
- [ ] Go module examples
- [ ] Python (Pyodide) integration
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
