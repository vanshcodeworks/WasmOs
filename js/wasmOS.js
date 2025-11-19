class WasmOSCore {
    constructor() {
        this.modules = new Map();
        this.moduleCache = new Map();
        this.activeOperations = new Set();
        this.enc = new TextEncoder();
        this.dec = new TextDecoder();
        this.memoryManager = new WasmMemoryManager();
        this.commandRegistry = new WasmCommandRegistry(this);
        
        // Performance monitoring
        this.stats = {
            modulesLoaded: 0,
            operationsExecuted: 0,
            totalMemoryUsed: 0,
            startTime: Date.now()
        };
    }

    async initialize() {
        console.log('🚀 Initializing WasmOS Core...');
        
        // Pre-validate WASM support
        if (!this.validateWasmSupport()) {
            throw new Error('WebAssembly not supported');
        }
        
        // Load essential modules in parallel
        const essentialModules = ['echo', 'math', 'string_utils', 'fileops', 'process'];
        await this.preloadModules(essentialModules);
        
        // Initialize command system
        await this.commandRegistry.initialize();
        
        console.log('✅ WasmOS Core initialized successfully');
        return this;
    }

    validateWasmSupport() {
        return typeof WebAssembly === 'object' && 
               typeof WebAssembly.instantiate === 'function';
    }

    async preloadModules(moduleNames) {
        const loadPromises = moduleNames.map(name => 
            this.loadModule(name).catch(err => {
                console.warn(`⚠️ Failed to preload ${name}:`, err.message);
                return null;
            })
        );
        
        const results = await Promise.allSettled(loadPromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
        
        console.log(`📦 Preloaded ${successful}/${moduleNames.length} modules`);
        return successful;
    }

    async loadModule(moduleName) {
        // Return cached module if available
        if (this.modules.has(moduleName)) {
            return this.modules.get(moduleName);
        }

        // Check if module is currently loading
        const cacheKey = `loading_${moduleName}`;
        if (this.moduleCache.has(cacheKey)) {
            return this.moduleCache.get(cacheKey);
        }

        console.log(`📥 Loading WASM module: ${moduleName}`);

        const loadPromise = this.fetchAndInstantiateModule(moduleName);
        this.moduleCache.set(cacheKey, loadPromise);

        try {
            const module = await loadPromise;
            this.modules.set(moduleName, module);
            this.moduleCache.delete(cacheKey);
            this.stats.modulesLoaded++;
            
            console.log(`✅ Module ${moduleName} loaded successfully`);
            this.updateSystemStatus();
            
            return module;
        } catch (error) {
            this.moduleCache.delete(cacheKey);
            console.error(`❌ Failed to load module ${moduleName}:`, error);
            throw new Error(`Module ${moduleName} unavailable: ${error.message}`);
        }
    }

    async fetchAndInstantiateModule(moduleName) {
        const response = await fetch(`build/${moduleName}.wasm`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${moduleName}.wasm not found`);
        }

        const wasmBytes = await response.arrayBuffer();
        
        // Enhanced instantiation with imports if needed
        const importObject = this.createImportObject(moduleName);
        const { instance } = await WebAssembly.instantiate(wasmBytes, importObject);
        
        return this.wrapModuleInstance(instance, moduleName);
    }

    createImportObject(moduleName) {
        return {
            env: {
                // Memory management callbacks
                __memory_base: 0,
                __table_base: 0,
                
                // System calls
                abort: () => {
                    throw new Error(`WASM module ${moduleName} aborted`);
                },
                
                // Performance monitoring
                __perf_start: () => performance.now(),
                __perf_end: (start) => {
                    const duration = performance.now() - start;
                    console.log(`⏱️ ${moduleName} operation took ${duration.toFixed(2)}ms`);
                }
            }
        };
    }

    wrapModuleInstance(instance, moduleName) {
        const wrapped = {
            name: moduleName,
            exports: instance.exports,
            memory: instance.exports.memory,
            
            // Add helper methods
            writeString: (str, offset = 1024) => {
                return this.memoryManager.writeString(instance.exports.memory, str, offset);
            },
            
            readString: (ptr) => {
                return this.memoryManager.readString(instance.exports.memory, ptr);
            },
            
            // Performance wrapper for function calls
            call: (funcName, ...args) => {
                const startTime = performance.now();
                this.activeOperations.add(`${moduleName}.${funcName}`);
                
                try {
                    const result = instance.exports[funcName](...args);
                    this.stats.operationsExecuted++;
                    return result;
                } finally {
                    this.activeOperations.delete(`${moduleName}.${funcName}`);
                    const duration = performance.now() - startTime;
                    
                    if (duration > 10) { // Log slow operations
                        console.log(`🐌 Slow operation: ${moduleName}.${funcName} took ${duration.toFixed(2)}ms`);
                    }
                }
            }
        };

        return wrapped;
    }

    updateSystemStatus() {
        const statusEl = document.getElementById('wasmStatus');
        const countEl = document.getElementById('moduleCount');
        
        if (statusEl) {
            const uptime = ((Date.now() - this.stats.startTime) / 1000).toFixed(1);
            statusEl.textContent = `🟢 WasmOS Runtime (${uptime}s uptime)`;
        }
        
        if (countEl) {
            countEl.textContent = `${this.stats.modulesLoaded} modules loaded`;
        }
    }

    getSystemStats() {
        const uptime = Date.now() - this.stats.startTime;
        
        return {
            ...this.stats,
            uptime: uptime,
            activeOperations: Array.from(this.activeOperations),
            loadedModules: Array.from(this.modules.keys()),
            memoryUsage: this.memoryManager.getTotalUsage()
        };
    }

    // High-level WASM operation executor
    async executeWasmOperation(moduleName, operation, ...args) {
        const module = await this.loadModule(moduleName);
        
        if (!module.exports[operation]) {
            throw new Error(`Operation ${operation} not found in module ${moduleName}`);
        }

        return module.call(operation, ...args);
    }
}

class WasmMemoryManager {
    constructor() {
        this.enc = new TextEncoder();
        this.dec = new TextDecoder();
        this.allocations = new Map();
    }

    writeString(memory, str, offset = 1024) {
        const bytes = this.enc.encode(str + '\0');
        const heap = new Uint8Array(memory.buffer);
        
        if (offset + bytes.length > heap.length) {
            throw new Error(`String too long: needs ${bytes.length} bytes, available ${heap.length - offset}`);
        }
        
        heap.set(bytes, offset);
        this.allocations.set(offset, bytes.length);
        return offset;
    }

    readString(memory, ptr) {
        const heap = new Uint8Array(memory.buffer);
        let end = ptr;
        
        while (end < heap.length && heap[end] !== 0) {
            end++;
        }
        
        if (end >= heap.length) {
            throw new Error('Unterminated string in WASM memory');
        }
        
        return this.dec.decode(heap.subarray(ptr, end));
    }

    writeArray(memory, array, offset = 2048) {
        const heap = new Uint8Array(memory.buffer);
        
        if (offset + array.length > heap.length) {
            throw new Error(`Array too large: needs ${array.length} bytes`);
        }
        
        heap.set(array, offset);
        this.allocations.set(offset, array.length);
        return offset;
    }

    getTotalUsage() {
        return Array.from(this.allocations.values()).reduce((sum, size) => sum + size, 0);
    }
}

class WasmCommandRegistry {
    constructor(wasmCore) {
        this.core = wasmCore;
        this.commands = new Map();
    }

    async initialize() {
        // Register all WASM-based commands
        this.registerCommand('echo', new EchoCommand(this.core));
        this.registerCommand('math', new MathCommand(this.core));
        this.registerCommand('str', new StringCommand(this.core));
        this.registerCommand('file', new FileCommand(this.core));
        this.registerCommand('proc', new ProcessCommand(this.core));
        this.registerCommand('crypto', new CryptoCommand(this.core));
        this.registerCommand('sort', new SortCommand(this.core));
        this.registerCommand('system', new SystemCommand(this.core));
        
        console.log(`📝 Registered ${this.commands.size} WASM commands`);
    }

    registerCommand(name, handler) {
        this.commands.set(name, handler);
    }

    async executeCommand(commandLine) {
        const parts = commandLine.trim().split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);

        const handler = this.commands.get(cmd);
        if (!handler) {
            throw new Error(`Unknown command: ${cmd}`);
        }

        return await handler.execute(args);
    }

    getAvailableCommands() {
        return Array.from(this.commands.keys()).sort();
    }
}

// WASM Command Implementations
class BaseWasmCommand {
    constructor(wasmCore) {
        this.core = wasmCore;
    }

    async executeWasm(moduleName, operation, ...args) {
        return await this.core.executeWasmOperation(moduleName, operation, ...args);
    }
}

class EchoCommand extends BaseWasmCommand {
    async execute(args) {
        if (args.length === 0) {
            return '';
        }
        
        const text = args.join(' ');
        const module = await this.core.loadModule('echo');
        const ptr = module.writeString(text);
        const resultPtr = module.call('echo', ptr);
        return module.readString(resultPtr);
    }
}

class MathCommand extends BaseWasmCommand {
    async execute(args) {
        if (args.length < 2) {
            return 'Usage: math <operation> <numbers...>\nOperations: add, mul, sub, div, pow, sqrt, fact, prime';
        }

        const [op, ...numArgs] = args;
        const numbers = numArgs.map(n => parseFloat(n));

        switch (op) {
            case 'add':
                if (numbers.length < 2) throw new Error('Addition requires 2 numbers');
                return `${numbers[0]} + ${numbers[1]} = ${await this.executeWasm('math', 'math_add', numbers[0], numbers[1])}`;
                
            case 'mul':
                if (numbers.length < 2) throw new Error('Multiplication requires 2 numbers');
                return `${numbers[0]} × ${numbers[1]} = ${await this.executeWasm('math', 'math_multiply', numbers[0], numbers[1])}`;
                
            case 'pow':
                if (numbers.length < 2) throw new Error('Power requires 2 numbers');
                return `${numbers[0]}^${numbers[1]} = ${await this.executeWasm('math', 'math_power', numbers[0], numbers[1])}`;
                
            case 'sqrt':
                if (numbers.length < 1) throw new Error('Square root requires 1 number');
                return `√${numbers[0]} = ${await this.executeWasm('math', 'math_sqrt', numbers[0])}`;
                
            case 'fact':
                if (numbers.length < 1) throw new Error('Factorial requires 1 number');
                const n = Math.floor(numbers[0]);
                return `${n}! = ${await this.executeWasm('math', 'math_factorial', n)}`;
                
            case 'prime':
                if (numbers.length < 1) throw new Error('Prime check requires 1 number');
                const num = Math.floor(numbers[0]);
                const isPrime = await this.executeWasm('math', 'math_isprime', num);
                return `${num} is ${isPrime ? 'PRIME' : 'NOT PRIME'}`;
                
            default:
                throw new Error(`Unknown math operation: ${op}`);
        }
    }
}

class StringCommand extends BaseWasmCommand {
    async execute(args) {
        if (args.length < 2) {
            return 'Usage: str <operation> <text>\nOperations: upper, lower, reverse, len, wc, hash';
        }

        const [op, ...textArgs] = args;
        const text = textArgs.join(' ');
        const module = await this.core.loadModule('string_utils');

        switch (op) {
            case 'upper':
                const upperPtr = module.writeString(text);
                const upperResult = module.call('str_toupper', upperPtr);
                return module.readString(upperResult);
                
            case 'lower':
                const lowerPtr = module.writeString(text);
                const lowerResult = module.call('str_tolower', lowerPtr);
                return module.readString(lowerResult);
                
            case 'reverse':
                const revPtr = module.writeString(text);
                const revResult = module.call('str_reverse', revPtr);
                return module.readString(revResult);
                
            case 'len':
                const lenPtr = module.writeString(text);
                return `Length: ${module.call('str_length', lenPtr)}`;
                
            case 'wc':
                const wcPtr = module.writeString(text);
                return `Word count: ${module.call('str_wordcount', wcPtr)}`;
                
            default:
                throw new Error(`Unknown string operation: ${op}`);
        }
    }
}

class SystemCommand extends BaseWasmCommand {
    async execute(args) {
        const [subCmd] = args;

        switch (subCmd) {
            case 'stats':
                return this.formatStats(this.core.getSystemStats());
                
            case 'modules':
                return this.formatModules();
                
            case 'memory':
                return this.formatMemoryInfo();
                
            case 'version':
                return 'WasmOS v2.0.0 - Pure WebAssembly Operating System';
                
            default:
                return 'Usage: system <stats|modules|memory|version>';
        }
    }

    formatStats(stats) {
        const uptime = (stats.uptime / 1000).toFixed(1);
        return [
            '=== WasmOS System Statistics ===',
            `Uptime: ${uptime}s`,
            `Modules loaded: ${stats.modulesLoaded}`,
            `Operations executed: ${stats.operationsExecuted}`,
            `Memory used: ${stats.memoryUsage} bytes`,
            `Active operations: ${stats.activeOperations.length}`,
            stats.activeOperations.length > 0 ? `  - ${stats.activeOperations.join(', ')}` : ''
        ].filter(Boolean).join('\n');
    }

    formatModules() {
        const modules = Array.from(this.core.modules.keys());
        return [
            '=== Loaded WASM Modules ===',
            ...modules.map(m => `✓ ${m}.wasm`),
            '',
            `Total: ${modules.length} modules`
        ].join('\n');
    }

    formatMemoryInfo() {
        const usage = this.core.memoryManager.getTotalUsage();
        return [
            '=== Memory Information ===',
            `WASM Memory Usage: ${usage} bytes`,
            `Active Allocations: ${this.core.memoryManager.allocations.size}`,
            `Browser Memory: ${(performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(2) || 'N/A'} MB`
        ].join('\n');
    }
}

// Enhanced Terminal Interface
class WasmTerminal {
    constructor(wasmCore) {
        this.core = wasmCore;
        this.history = [];
        this.historyIndex = -1;
        this.isProcessing = false;
        
        this.elements = {
            terminal: document.getElementById('terminal'),
            input: document.getElementById('input'),
            prompt: document.getElementById('prompt'),
            status: document.getElementById('status')
        };
        
        this.setupEventListeners();
        this.showWelcome();
    }

    setupEventListeners() {
        this.elements.input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !this.isProcessing) {
                await this.processCommand();
            } else if (e.key === 'ArrowUp') {
                this.navigateHistory(-1);
                e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                this.navigateHistory(1);
                e.preventDefault();
            } else if (e.key === 'Tab') {
                this.handleTabCompletion();
                e.preventDefault();
            } else if (e.ctrlKey) {
                if (e.key === 'c' || e.key === 'C') {
                    this.handleInterrupt();
                } else if (e.key === 'l' || e.key === 'L') {
                    this.clearTerminal();
                }
                e.preventDefault();
            }
        });
        
        // Keep input focused
        document.addEventListener('click', () => {
            this.elements.input.focus();
        });
    }

    showWelcome() {
        this.printLine('╔══════════════════════════════════════════════════╗');
        this.printLine('║              WasmOS v2.0.0                      ║');
        this.printLine('║         Pure WebAssembly Operating System       ║');
        this.printLine('╚══════════════════════════════════════════════════╝');
        this.printLine('');
        this.printLine('🚀 All operations powered by WebAssembly modules');
        this.printLine('💡 Type "help" for available commands');
        this.printLine('📊 Type "system stats" for system information');
        this.printLine('');
        this.setPrompt();
    }

    async processCommand() {
        const command = this.elements.input.value.trim();
        if (!command) return;

        this.printLine(`${this.elements.prompt.textContent} ${command}`);
        this.history.push(command);
        this.historyIndex = this.history.length;
        this.elements.input.value = '';
        this.isProcessing = true;
        
        try {
            this.showProcessingIndicator();
            
            if (command === 'help') {
                this.showHelp();
            } else if (command === 'clear') {
                this.clearTerminal();
            } else {
                const result = await this.core.commandRegistry.executeCommand(command);
                if (result) {
                    this.printLine(result);
                }
            }
        } catch (error) {
            this.printError(error.message);
        } finally {
            this.hideProcessingIndicator();
            this.isProcessing = false;
        }
    }

    showHelp() {
        const commands = this.core.commandRegistry.getAvailableCommands();
        this.printLine('Available WASM Commands:');
        this.printLine('========================');
        commands.forEach(cmd => {
            this.printLine(`  ${cmd.padEnd(12)} - ${this.getCommandDescription(cmd)}`);
        });
        this.printLine('');
        this.printLine('System Commands:');
        this.printLine('  help         - Show this help');
        this.printLine('  clear        - Clear terminal');
        this.printLine('');
        this.printLine('Keyboard Shortcuts:');
        this.printLine('  Ctrl+C       - Interrupt command');
        this.printLine('  Ctrl+L       - Clear terminal');
        this.printLine('  Tab          - Auto-complete');
        this.printLine('  ↑/↓          - Command history');
    }

    getCommandDescription(cmd) {
        const descriptions = {
            echo: 'Echo text via WASM',
            math: 'Mathematical operations',
            str: 'String manipulation',
            file: 'File operations',
            proc: 'Process management',
            crypto: 'Cryptographic functions',
            sort: 'Array sorting algorithms',
            system: 'System information'
        };
        return descriptions[cmd] || 'WASM operation';
    }

    printLine(text) {
        this.elements.terminal.textContent += text + '\n';
        this.elements.terminal.scrollTop = this.elements.terminal.scrollHeight;
    }

    printError(message) {
        this.printLine(`❌ Error: ${message}`);
    }

    setPrompt() {
        this.elements.prompt.textContent = 'WasmOS $ ';
    }

    clearTerminal() {
        this.elements.terminal.textContent = '';
        this.setPrompt();
    }

    showProcessingIndicator() {
        this.elements.status.innerHTML = '🔄 Processing WASM operation...';
    }

    hideProcessingIndicator() {
        this.elements.status.textContent = '';
        this.core.updateSystemStatus();
    }

    navigateHistory(direction) {
        const newIndex = this.historyIndex + direction;
        if (newIndex >= 0 && newIndex <= this.history.length) {
            this.historyIndex = newIndex;
            this.elements.input.value = this.history[newIndex] || '';
        }
    }

    handleTabCompletion() {
        const input = this.elements.input.value;
        const commands = this.core.commandRegistry.getAvailableCommands();
        const matches = commands.filter(cmd => cmd.startsWith(input));
        
        if (matches.length === 1) {
            this.elements.input.value = matches[0] + ' ';
        } else if (matches.length > 1) {
            this.printLine(`Possible completions: ${matches.join(', ')}`);
        }
    }

    handleInterrupt() {
        this.printLine('^C');
        this.elements.input.value = '';
        this.isProcessing = false;
        this.hideProcessingIndicator();
    }
}

// Initialize WasmOS
async function initializeWasmOS() {
    try {
        console.log('🎯 Starting WasmOS initialization...');
        
        const wasmCore = new WasmOSCore();
        await wasmCore.initialize();
        
        const terminal = new WasmTerminal(wasmCore);
        
        // Make core available globally for debugging
        window.wasmOS = wasmCore;
        
        console.log('🎉 WasmOS successfully initialized!');
        
    } catch (error) {
        console.error('💥 WasmOS initialization failed:', error);
        
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.innerHTML = `❌ Initialization failed: ${error.message}`;
        }
    }
}

// Start WasmOS when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWasmOS);
} else {
    initializeWasmOS();
}
