import { WindowManager } from './windowManager.js';
import { AppManager } from './appManager.js';
import { AppHandlers } from './appHandlers.js';
import { WasmIntegration } from './wasmIntegration.js';

class WasmOSGUI {
    constructor() {
        this.bootScreen = document.getElementById('bootScreen');
        this.desktop = document.getElementById('desktop');
        this.startButton = document.getElementById('startButton');
        this.startMenu = document.getElementById('startMenu');
        this.closeStartMenu = document.getElementById('closeStartMenu');
        this.moduleStatus = document.getElementById('moduleStatus');
        this.systemTime = document.getElementById('systemTime');
        
        this.windowManager = new WindowManager();
        this.appManager = new AppManager(this.windowManager);
        this.appHandlers = new AppHandlers(this.windowManager);
        this.wasm = new WasmIntegration();
        
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
            { progress: 10, status: 'Loading WebAssembly runtime...' },
            { progress: 25, status: 'Initializing GUI components...' },
            { progress: 40, status: 'Setting up window manager...' },
            { progress: 60, status: 'Loading WASM modules...' },
            { progress: 80, status: 'Preparing desktop environment...' },
            { progress: 100, status: 'WasmOS ready!' }
        ];

        for (const step of steps) {
            bootProgress.style.width = `${step.progress}%`;
            bootStatus.textContent = step.status;
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    async preloadWasmModules() {
        const essentialModules = ['echo', 'math', 'string_utils', 'crypto'];
        
        for (const module of essentialModules) {
            try {
                await this.wasm.loadModule(module);
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
        this.startButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStartMenu();
        });

        this.closeStartMenu.addEventListener('click', () => {
            this.hideStartMenu();
        });

        // Close start menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.startMenu.contains(e.target) && !this.startButton.contains(e.target)) {
                this.hideStartMenu();
            }
        });

        // App launchers
        document.querySelectorAll('[data-app]').forEach(element => {
            element.addEventListener('click', () => {
                const appName = element.getAttribute('data-app');
                this.launchAppWithHandlers(appName);
                this.hideStartMenu();
            });
        });

        // Desktop double-click
        this.desktop.addEventListener('dblclick', (e) => {
            if (e.target === this.desktop) {
                this.launchAppWithHandlers('terminal');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key === 't') {
                e.preventDefault();
                this.launchAppWithHandlers('terminal');
            }
            if (e.key === 'Escape') {
                this.hideStartMenu();
            }
        });
    }

    launchAppWithHandlers(appName) {
        const windowId = this.appManager.launchApp(appName);
        
        // Dispatch event for app handlers to attach
        setTimeout(() => {
            const event = new CustomEvent('windowCreated', {
                detail: { windowId, appName }
            });
            document.dispatchEvent(event);
        }, 100);
        
        return windowId;
    }

    toggleStartMenu() {
        this.startMenu.classList.toggle('hidden');
    }

    hideStartMenu() {
        this.startMenu.classList.add('hidden');
    }

    updateSystemTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        this.systemTime.querySelector('span').textContent = timeString;
    }

    updateModuleStatus() {
        const loadedModules = this.wasm.getLoadedModules();
        this.moduleStatus.querySelector('span').textContent = 
            `${loadedModules.length} modules`;
        
        // Update tooltip with module names
        this.moduleStatus.title = loadedModules.length > 0 
            ? `Loaded: ${loadedModules.join(', ')}` 
            : 'No modules loaded';
    }
}

// Initialize the GUI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WasmOSGUI();
});
