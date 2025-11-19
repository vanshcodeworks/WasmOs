import { WasmIntegration } from './wasmIntegration.js';

export class AppHandlers {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.wasm = new WasmIntegration();
        this.setupHandlers();
    }

    setupHandlers() {
        // Listen for window creation to attach handlers
        document.addEventListener('windowCreated', (e) => {
            const { windowId, appName } = e.detail;
            this.attachAppHandlers(windowId, appName);
        });
    }

    attachAppHandlers(windowId, appName) {
        const windowData = this.windowManager.getWindow(windowId);
        if (!windowData) return;

        const windowElement = windowData.element;

        switch (appName) {
            case 'terminal':
                this.setupTerminalHandlers(windowElement);
                break;
            case 'calculator':
                this.setupCalculatorHandlers(windowElement);
                break;
            case 'cryptotool':
                this.setupCryptoHandlers(windowElement);
                break;
            case 'filemanager':
                this.setupFileManagerHandlers(windowElement);
                break;
            case 'texteditor':
                this.setupTextEditorHandlers(windowElement);
                break;
        }
    }

    setupTerminalHandlers(windowElement) {
        const input = windowElement.querySelector('.terminal-input');
        const output = windowElement.querySelector('.terminal-output');
        const prompt = windowElement.querySelector('.terminal-prompt');

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
                    printLine(args.join(' '));
                    break;
                case 'math':
                    if (args.length < 2) {
                        printLine('Usage: math <operation> <args>');
                        return;
                    }
                    const result = await this.wasm.performMathOperation(args[0], ...args.slice(1).map(parseFloat));
                    if (result !== null) {
                        printLine(`Result: ${result}`);
                    } else {
                        printLine('Math operation failed');
                    }
                    break;
                case 'str':
                    if (args.length < 2) {
                        printLine('Usage: str <operation> <text>');
                        return;
                    }
                    const strResult = await this.wasm.performStringOperation(args[0], args.slice(1).join(' '));
                    if (strResult !== null) {
                        printLine(typeof strResult === 'number' ? `Result: ${strResult}` : strResult);
                    } else {
                        printLine('String operation failed');
                    }
                    break;
                case 'crypto':
                    if (args.length < 2) {
                        printLine('Usage: crypto <operation> <text>');
                        return;
                    }
                    const cryptoResult = await this.wasm.performCryptoOperation(args[0], args.slice(1).join(' '));
                    if (cryptoResult !== null) {
                        printLine(`Result: ${cryptoResult}`);
                    } else {
                        printLine('Crypto operation failed');
                    }
                    break;
                case 'sysinfo':
                    const sysInfo = await this.wasm.getSystemInfo();
                    if (sysInfo) {
                        printLine(`System: ${sysInfo.version}`);
                        printLine(`Uptime: ${sysInfo.uptime}s`);
                        printLine(`Memory: ${sysInfo.memoryUsed} bytes`);
                        printLine(`Processes: ${sysInfo.processCount}`);
                    } else {
                        printLine('System info unavailable');
                    }
                    break;
                case 'modules':
                    const modules = this.wasm.getLoadedModules();
                    printLine('Loaded WASM modules:');
                    modules.forEach(m => printLine(`  - ${m}`));
                    break;
                case 'clear':
                    output.textContent = '';
                    break;
                case 'help':
                    printLine('Available commands:');
                    printLine('  echo <text>         - Echo text');
                    printLine('  math <op> <args>    - Math operations (add, multiply, factorial, power, sqrt, isprime)');
                    printLine('  str <op> <text>     - String operations (upper, lower, reverse, wordcount, length)');
                    printLine('  crypto <op> <text>  - Crypto operations (caesar, hash, base64)');
                    printLine('  sysinfo             - Show system information');
                    printLine('  modules             - List loaded WASM modules');
                    printLine('  clear               - Clear terminal');
                    printLine('  help                - Show this help');
                    break;
                default:
                    printLine(`Command not found: ${cmd}`);
            }
        };

        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const line = input.value;
                printLine(`${prompt.textContent} ${line}`);
                history.push(line);
                historyIndex = history.length;
                input.value = '';
                await runCommand(line);
            } else if (e.key === 'ArrowUp') {
                if (historyIndex > 0) {
                    historyIndex--;
                    input.value = history[historyIndex] || '';
                }
                e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                if (historyIndex < history.length) {
                    historyIndex++;
                    input.value = history[historyIndex] || '';
                }
                e.preventDefault();
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

            switch (operator) {
                case 'add':
                    return await this.wasm.performMathOperation('add', a, b);
                case 'subtract':
                    return a - b; // Simple subtraction
                case 'multiply':
                    return await this.wasm.performMathOperation('multiply', a, b);
                case 'divide':
                    return b !== 0 ? a / b : 'Error';
                default:
                    return secondValue;
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

    setupCryptoHandlers(windowElement) {
        const processBtn = windowElement.querySelector('button');
        const inputTextarea = windowElement.querySelector('textarea:first-of-type');
        const outputTextarea = windowElement.querySelector('textarea:last-of-type');
        const operationSelect = windowElement.querySelector('select');

        if (!processBtn || !inputTextarea || !outputTextarea || !operationSelect) return;

        processBtn.addEventListener('click', async () => {
            const operation = operationSelect.value.toLowerCase().replace(' ', '');
            const inputText = inputTextarea.value;

            if (!inputText.trim()) {
                outputTextarea.value = 'Please enter text to process';
                return;
            }

            let result;
            switch (operation) {
                case 'caesarcipher':
                    result = await this.wasm.performCryptoOperation('caesar', inputText, 3);
                    break;
                case 'base64encode':
                    result = await this.wasm.performCryptoOperation('base64', inputText);
                    break;
                case 'hash(sha-256)':
                    result = await this.wasm.performCryptoOperation('hash', inputText);
                    break;
                default:
                    result = 'Operation not supported';
            }

            outputTextarea.value = result || 'Operation failed';
        });
    }

    setupFileManagerHandlers(windowElement) {
        const fileItems = windowElement.querySelectorAll('.file-item');
        const pathInput = windowElement.querySelector('.file-path');

        fileItems.forEach(item => {
            item.addEventListener('click', () => {
                // Remove selection from other items
                fileItems.forEach(f => f.classList.remove('selected'));
                // Select this item
                item.classList.add('selected');
                
                const fileName = item.querySelector('.file-name').textContent;
                console.log(`Selected file: ${fileName}`);
            });

            item.addEventListener('dblclick', () => {
                const fileName = item.querySelector('.file-name').textContent;
                const isFolder = item.classList.contains('folder');
                
                if (isFolder) {
                    // Navigate to folder
                    const currentPath = pathInput.value;
                    pathInput.value = `${currentPath}/${fileName}`;
                } else {
                    // Open file (could trigger another app)
                    console.log(`Opening file: ${fileName}`);
                }
            });
        });
    }

    setupTextEditorHandlers(windowElement) {
        const textarea = windowElement.querySelector('textarea');
        const saveBtn = windowElement.querySelector('button[title="Save"]');
        const newBtn = windowElement.querySelector('button[title="New"]');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const content = textarea.value;
                // In a real implementation, this would save to the virtual file system
                console.log('Saving content:', content.length, 'characters');
                
                // Show save notification
                const notification = document.createElement('div');
                notification.textContent = 'File saved successfully';
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--success-color);
                    color: white;
                    padding: 0.75rem 1rem;
                    border-radius: 6px;
                    z-index: 10000;
                    font-size: 0.9rem;
                `;
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
            });
        }

        if (newBtn) {
            newBtn.addEventListener('click', () => {
                if (textarea.value.trim() && !confirm('Discard current content?')) {
                    return;
                }
                textarea.value = '';
                textarea.focus();
            });
        }
    }
}
