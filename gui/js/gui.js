// WasmOS GUI - Combined JavaScript file

class WasmLoader {
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
            const response = await fetch(`../build/${name}.wasm`);
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
            console.error(`Failed to load ${name}:`, error);
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

class WindowManager {
    constructor() {
        this.windows = new Map();
        this.zIndexCounter = 100;
        this.activeWindow = null;
        this.container = document.getElementById('windowsContainer');
    }

    createWindow(id, title, icon, content, options = {}) {
        const defaultOptions = {
            width: 600,
            height: 400,
            x: Math.random() * 200 + 100,
            y: Math.random() * 100 + 50,
            resizable: true,
            minimizable: true,
            maximizable: true,
            closable: true
        };

        const config = { ...defaultOptions, ...options };
        
        const window = document.createElement('div');
        window.className = 'window';
        window.id = `window-${id}`;
        window.style.width = `${config.width}px`;
        window.style.height = `${config.height}px`;
        window.style.left = `${config.x}px`;
        window.style.top = `${config.y}px`;
        window.style.zIndex = ++this.zIndexCounter;

        window.innerHTML = `
            <div class="window-header">
                <div class="window-title">
                    <i class="${icon}"></i>
                    <span>${title}</span>
                </div>
                <div class="window-controls">
                    ${config.minimizable ? '<button class="window-control minimize" data-action="minimize"><i class="fas fa-minus"></i></button>' : ''}
                    ${config.maximizable ? '<button class="window-control maximize" data-action="maximize"><i class="fas fa-square"></i></button>' : ''}
                    ${config.closable ? '<button class="window-control close" data-action="close"><i class="fas fa-times"></i></button>' : ''}
                </div>
            </div>
            <div class="window-content">
                ${content}
            </div>
        `;

        this.container.appendChild(window);
        this.setupWindowControls(window, id);
        this.makeWindowDraggable(window);
        this.makeWindowFocusable(window);

        this.windows.set(id, {
            element: window,
            title,
            icon,
            minimized: false,
            maximized: false,
            originalBounds: null
        });

        this.focusWindow(id);
        this.updateTaskbar();

        return window;
    }

    setupWindowControls(window, id) {
        const controls = window.querySelectorAll('.window-control');
        controls.forEach(control => {
            control.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = control.getAttribute('data-action');
                
                switch (action) {
                    case 'minimize':
                        this.minimizeWindow(id);
                        break;
                    case 'maximize':
                        this.toggleMaximizeWindow(id);
                        break;
                    case 'close':
                        this.closeWindow(id);
                        break;
                }
            });
        });
    }

    makeWindowDraggable(window) {
        const header = window.querySelector('.window-header');
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.window-control')) return;
            
            isDragging = true;
            dragOffset.x = e.clientX - window.offsetLeft;
            dragOffset.y = e.clientY - window.offsetTop;
            
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', stopDrag);
            
            window.style.cursor = 'grabbing';
            header.style.cursor = 'grabbing';
        });

        const handleDrag = (e) => {
            if (!isDragging) return;
            
            const newX = e.clientX - dragOffset.x;
            const newY = e.clientY - dragOffset.y;
            
            window.style.left = `${Math.max(0, newX)}px`;
            window.style.top = `${Math.max(0, newY)}px`;
        };

        const stopDrag = () => {
            isDragging = false;
            window.style.cursor = '';
            header.style.cursor = 'move';
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
        };
    }

    makeWindowFocusable(window) {
        window.addEventListener('mousedown', () => {
            const id = window.id.replace('window-', '');
            this.focusWindow(id);
        });
    }

    focusWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        this.windows.forEach((data) => {
            data.element.style.zIndex = Math.max(100, parseInt(data.element.style.zIndex) - 1);
        });

        windowData.element.style.zIndex = ++this.zIndexCounter;
        this.activeWindow = id;
    }

    minimizeWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        windowData.element.classList.add('minimized');
        windowData.minimized = true;
        this.updateTaskbar();
    }

    restoreWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        windowData.element.classList.remove('minimized');
        windowData.minimized = false;
        this.focusWindow(id);
        this.updateTaskbar();
    }

    toggleMaximizeWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        if (windowData.maximized) {
            if (windowData.originalBounds) {
                windowData.element.style.left = windowData.originalBounds.left;
                windowData.element.style.top = windowData.originalBounds.top;
                windowData.element.style.width = windowData.originalBounds.width;
                windowData.element.style.height = windowData.originalBounds.height;
            }
            windowData.element.classList.remove('maximized');
            windowData.maximized = false;
        } else {
            windowData.originalBounds = {
                left: windowData.element.style.left,
                top: windowData.element.style.top,
                width: windowData.element.style.width,
                height: windowData.element.style.height
            };
            windowData.element.classList.add('maximized');
            windowData.maximized = true;
        }
    }

    closeWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        windowData.element.remove();
        this.windows.delete(id);
        
        if (this.activeWindow === id) {
            this.activeWindow = null;
        }
        
        this.updateTaskbar();
    }

    updateTaskbar() {
        const taskbarApps = document.getElementById('taskbarApps');
        if (!taskbarApps) return;
        
        taskbarApps.innerHTML = '';

        this.windows.forEach((windowData, id) => {
            const taskbarItem = document.createElement('button');
            taskbarItem.className = `taskbar-item ${windowData.minimized ? 'minimized' : ''}`;
            taskbarItem.innerHTML = `
                <i class="${windowData.icon}"></i>
                <span>${windowData.title}</span>
            `;
            
            taskbarItem.addEventListener('click', () => {
                if (windowData.minimized) {
                    this.restoreWindow(id);
                } else {
                    this.focusWindow(id);
                }
            });

            taskbarApps.appendChild(taskbarItem);
        });
    }

    getWindow(id) {
        return this.windows.get(id);
    }
}

class AppManager {
    constructor(windowManager, wasmLoader) {
        this.windowManager = windowManager;
        this.wasmLoader = wasmLoader;
        this.runningApps = new Map();
        this.setupApps();
    }

    setupApps() {
        this.apps = {
            terminal: {
                title: 'Terminal',
                icon: 'fas fa-terminal',
                factory: () => this.createTerminalApp()
            },
            about: {
                title: 'About WasmOS',
                icon: 'fas fa-info-circle',
                factory: () => this.createAboutApp()
            },
            calculator: {
                title: 'Calculator',
                icon: 'fas fa-calculator',
                factory: () => this.createCalculatorApp()
            }
        };
    }

    launchApp(appName) {
        const app = this.apps[appName];
        if (!app) {
            console.error(`App ${appName} not found`);
            return;
        }

        const windowId = `${appName}-${Date.now()}`;
        const content = app.factory();
        
        const window = this.windowManager.createWindow(
            windowId,
            app.title,
            app.icon,
            content,
            this.getAppWindowOptions(appName)
        );

        // Attach app-specific event handlers
        this.attachAppHandlers(windowId, appName, window);

        this.runningApps.set(appName, windowId);
        return windowId;
    }

    getAppWindowOptions(appName) {
        const options = {
            terminal: { width: 700, height: 500 },
            about: { width: 600, height: 500, resizable: false },
            calculator: { width: 320, height: 480, resizable: false }
        };
        return options[appName] || {};
    }

    createTerminalApp() {
        return `
            <div class="terminal-window">
                <div class="terminal-output" id="terminal-output">
╔════════════════════════════════════════════════╗
║    WasmOS Terminal - WebAssembly CLI           ║
║  Type 'help' for available commands            ║
╚════════════════════════════════════════════════╝

WasmOS ~ $ 
                </div>
                <div class="terminal-input-line">
                    <span class="terminal-prompt">WasmOS ~ $</span>
                    <input type="text" class="terminal-input" autofocus>
                </div>
            </div>
        `;
    }

    createAboutApp() {
        return `
            <div class="about-dialog">
                <div class="about-logo">
                    <i class="fas fa-microchip"></i>
                </div>
                <h1 class="about-title">WasmOS</h1>
                <div class="about-version">Version 1.0.0</div>
                <div class="about-description">
                    A revolutionary operating system built entirely with WebAssembly technology.
                    Experience the future of computing with multi-language support and 
                    near-native performance in your browser.
                </div>
                
                <div class="about-features">
                    <h3>Key Features</h3>
                    <div class="feature-list">
                        <div class="feature-item">
                            <i class="fas fa-check"></i>
                            <span>Pure WebAssembly</span>
                        </div>
                        <div class="feature-item">
                            <i class="fas fa-check"></i>
                            <span>Multi-language Support</span>
                        </div>
                        <div class="feature-item">
                            <i class="fas fa-check"></i>
                            <span>Modern GUI</span>
                        </div>
                        <div class="feature-item">
                            <i class="fas fa-check"></i>
                            <span>Real-time Performance</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createCalculatorApp() {
        return `
            <div class="calculator">
                <input type="text" class="calculator-display" value="0" readonly>
                <div class="calculator-buttons">
                    <button class="calc-button" data-action="clear">C</button>
                    <button class="calc-button" data-action="clear-entry">CE</button>
                    <button class="calc-button" data-action="backspace">←</button>
                    <button class="calc-button operator" data-action="divide">÷</button>
                    
                    <button class="calc-button" data-value="7">7</button>
                    <button class="calc-button" data-value="8">8</button>
                    <button class="calc-button" data-value="9">9</button>
                    <button class="calc-button operator" data-action="multiply">×</button>
                    
                    <button class="calc-button" data-value="4">4</button>
                    <button class="calc-button" data-value="5">5</button>
                    <button class="calc-button" data-value="6">6</button>
                    <button class="calc-button operator" data-action="subtract">−</button>
                    
                    <button class="calc-button" data-value="1">1</button>
                    <button class="calc-button" data-value="2">2</button>
                    <button class="calc-button" data-value="3">3</button>
                    <button class="calc-button operator" data-action="add">+</button>
                    
                    <button class="calc-button" data-value="0" style="grid-column: span 2;">0</button>
                    <button class="calc-button" data-value=".">.</button>
                    <button class="calc-button equals" data-action="equals">=</button>
                </div>
            </div>
        `;
    }

    attachAppHandlers(windowId, appName, windowElement) {
        switch (appName) {
            case 'terminal':
                this.setupTerminalHandlers(windowElement);
                break;
            case 'calculator':
                this.setupCalculatorHandlers(windowElement);
                break;
        }
    }

    setupTerminalHandlers(windowElement) {
        const input = windowElement.querySelector('.terminal-input');
        const output = windowElement.querySelector('.terminal-output');

        if (!input || !output) return;

        let history = [];
        let historyIndex = -1;

        const printLine = (text) => {
            output.textContent += text + '\n';
            output.scrollTop = output.scrollHeight;
        };

        const runCommand = async (line) => {
            if (!line.trim()) return;

            const parts = line.trim().split(/\s+/);
            const cmd = parts[0];
            const args = parts.slice(1);

            switch (cmd) {
                case 'echo':
                    try {
                        const instance = await this.wasmLoader.loadModule('echo');
                        const { memory, echo } = instance.exports;
                        const msg = args.join(' ');
                        const ptr = this.wasmLoader.writeString(memory, msg);
                        const resPtr = echo(ptr) >>> 0;
                        const out = this.wasmLoader.readString(memory, resPtr);
                        printLine(out);
                    } catch (error) {
                        printLine(`echo: ${error.message}`);
                    }
                    break;

                case 'math':
                    if (args.length < 2) {
                        printLine('Usage: math <operation> <args>');
                        return;
                    }
                    try {
                        const instance = await this.wasmLoader.loadModule('math');
                        const op = args[0];
                        const nums = args.slice(1).map(parseFloat);
                        
                        let result;
                        switch (op) {
                            case 'add':
                                if (nums.length < 2) { printLine('Need 2 numbers'); return; }
                                result = instance.exports.math_add(nums[0], nums[1]);
                                break;
                            case 'mul':
                                if (nums.length < 2) { printLine('Need 2 numbers'); return; }
                                result = instance.exports.math_multiply(nums[0], nums[1]);
                                break;
                            case 'fact':
                                if (nums.length < 1) { printLine('Need 1 number'); return; }
                                result = instance.exports.math_factorial(Math.floor(nums[0]));
                                break;
                            default:
                                printLine(`Unknown operation: ${op}`);
                                return;
                        }
                        printLine(`Result: ${result}`);
                    } catch (error) {
                        printLine(`math: ${error.message}`);
                    }
                    break;

                case 'help':
                    printLine('Available commands:');
                    printLine('  echo <text>         - Echo text via WASM');
                    printLine('  math <op> <args>    - Math operations (add, mul, fact)');
                    printLine('  modules             - List loaded WASM modules');
                    printLine('  clear               - Clear terminal');
                    printLine('  help                - Show this help');
                    break;

                case 'modules':
                    const modules = this.wasmLoader.getLoadedModules();
                    printLine('Loaded WASM modules:');
                    if (modules.length === 0) {
                        printLine('  (none loaded yet)');
                    } else {
                        modules.forEach(m => printLine(`  - ${m}`));
                    }
                    break;

                case 'clear':
                    output.textContent = '';
                    break;

                default:
                    printLine(`Command not found: ${cmd}`);
            }
        };

        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const line = input.value;
                printLine(`WasmOS ~ $ ${line}`);
                history.push(line);
                historyIndex = history.length;
                input.value = '';
                await runCommand(line);
            }
        });
    }

    setupCalculatorHandlers(windowElement) {
        const display = windowElement.querySelector('.calculator-display');
        const buttons = windowElement.querySelectorAll('.calc-button');

        if (!display || !buttons.length) return;

        let currentValue = '0';
        let operation = null;
        let waitingForNewValue = false;

        const updateDisplay = () => {
            display.value = currentValue;
        };

        const calculate = async (firstValue, operator, secondValue) => {
            const a = parseFloat(firstValue);
            const b = parseFloat(secondValue);

            try {
                const instance = await this.wasmLoader.loadModule('math');
                switch (operator) {
                    case 'add':
                        return await instance.exports.math_add(a, b);
                    case 'multiply':
                        return await instance.exports.math_multiply(a, b);
                    case 'subtract':
                        return a - b;
                    case 'divide':
                        return b !== 0 ? a / b : 'Error';
                    default:
                        return secondValue;
                }
            } catch (error) {
                return 'Error';
            }
        };

        buttons.forEach(button => {
            button.addEventListener('click', async () => {
                const action = button.getAttribute('data-action');
                const value = button.getAttribute('data-value');

                if (value) {
                    if (waitingForNewValue) {
                        currentValue = value;
                        waitingForNewValue = false;
                    } else {
                        currentValue = currentValue === '0' ? value : currentValue + value;
                    }
                    updateDisplay();
                } else if (action) {
                    switch (action) {
                        case 'clear':
                            currentValue = '0';
                            operation = null;
                            waitingForNewValue = false;
                            break;
                        case 'equals':
                            if (operation && !waitingForNewValue) {
                                const result = await calculate(operation.firstValue, operation.operator, currentValue);
                                currentValue = result.toString();
                                operation = null;
                                waitingForNewValue = true;
                            }
                            break;
                        default:
                            if (!waitingForNewValue && operation) {
                                const result = await calculate(operation.firstValue, operation.operator, currentValue);
                                currentValue = result.toString();
                                waitingForNewValue = true;
                            }
                            operation = {
                                firstValue: currentValue,
                                operator: action
                            };
                            waitingForNewValue = true;
                    }
                    updateDisplay();
                }
            });
        });
    }
}

class WasmOSGUI {
    constructor() {
        this.bootScreen = document.getElementById('bootScreen');
        this.desktop = document.getElementById('desktop');
        this.startButton = document.getElementById('startButton');
        this.startMenu = document.getElementById('startMenu');
        this.closeStartMenu = document.getElementById('closeStartMenu');
        this.moduleStatus = document.getElementById('moduleStatus');
        this.systemTime = document.getElementById('systemTime');
        
        this.wasmLoader = new WasmLoader((message) => {
            const statusEl = document.getElementById('status');
            if (statusEl) statusEl.textContent = message;
        });
        
        this.windowManager = new WindowManager();
        this.appManager = new AppManager(this.windowManager, this.wasmLoader);
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.updateSystemTime();
        setInterval(() => this.updateSystemTime(), 1000);
        
        await this.bootSequence();
        this.showDesktop();
        
        // Preload essential WASM modules
        await this.preloadWasmModules();
    }

    async bootSequence() {
        const bootProgress = document.getElementById('bootProgress');
        const bootStatus = document.getElementById('bootStatus');
        
        const steps = [
            { progress: 20, status: 'Loading WebAssembly runtime...' },
            { progress: 40, status: 'Initializing GUI components...' },
            { progress: 60, status: 'Setting up window manager...' },
            { progress: 80, status: 'Preparing desktop environment...' },
            { progress: 100, status: 'WasmOS ready!' }
        ];

        for (const step of steps) {
            bootProgress.style.width = `${step.progress}%`;
            bootStatus.textContent = step.status;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    async preloadWasmModules() {
        const essentialModules = ['echo', 'math'];
        
        for (const module of essentialModules) {
            try {
                await this.wasmLoader.loadModule(module);
                console.log(`Preloaded ${module}.wasm`);
            } catch (error) {
                console.warn(`Failed to preload ${module}.wasm:`, error);
            }
        }
        
        this.updateModuleStatus();
    }

    showDesktop() {
        this.bootScreen.classList.add('hidden');
        this.desktop.classList.remove('hidden');
        this.updateModuleStatus();
    }

    setupEventListeners() {
        // Start menu toggle
        if (this.startButton) {
            this.startButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleStartMenu();
            });
        }

        if (this.closeStartMenu) {
            this.closeStartMenu.addEventListener('click', () => {
                this.hideStartMenu();
            });
        }

        // Close start menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.startMenu && !this.startMenu.contains(e.target) && 
                this.startButton && !this.startButton.contains(e.target)) {
                this.hideStartMenu();
            }
        });

        // App launchers
        document.querySelectorAll('[data-app]').forEach(element => {
            element.addEventListener('click', () => {
                const appName = element.getAttribute('data-app');
                this.appManager.launchApp(appName);
                this.hideStartMenu();
            });
        });

        // Desktop double-click
        if (this.desktop) {
            this.desktop.addEventListener('dblclick', (e) => {
                if (e.target === this.desktop) {
                    this.appManager.launchApp('terminal');
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key === 't') {
                e.preventDefault();
                this.appManager.launchApp('terminal');
            }
            if (e.key === 'Escape') {
                this.hideStartMenu();
            }
        });
    }

    toggleStartMenu() {
        if (this.startMenu) {
            this.startMenu.classList.toggle('hidden');
        }
    }

    hideStartMenu() {
        if (this.startMenu) {
            this.startMenu.classList.add('hidden');
        }
    }

    updateSystemTime() {
        if (this.systemTime) {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const span = this.systemTime.querySelector('span');
            if (span) span.textContent = timeString;
        }
    }

    updateModuleStatus() {
        if (this.moduleStatus) {
            const loadedModules = this.wasmLoader.getLoadedModules();
            const span = this.moduleStatus.querySelector('span');
            if (span) {
                span.textContent = `${loadedModules.length} modules`;
            }
            
            // Update tooltip with module names
            this.moduleStatus.title = loadedModules.length > 0 
                ? `Loaded: ${loadedModules.join(', ')}` 
                : 'No modules loaded';
        }
    }
}

// Initialize the GUI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WasmOSGUI();
});