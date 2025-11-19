export class WasmIntegration {
    constructor() {
        this.modules = {};
        this.enc = new TextEncoder();
        this.dec = new TextDecoder();
    }

    async loadModule(name) {
        if (this.modules[name]) return this.modules[name];
        
        try {
            const response = await fetch(`build/${name}.wasm`);
            if (!response.ok) {
                throw new Error(`Module ${name}.wasm not found in build/ directory`);
            }
            
            const bytes = await response.arrayBuffer();
            const { instance } = await WebAssembly.instantiate(bytes, {});
            this.modules[name] = instance;
            return instance;
        } catch (error) {
            console.error(`Failed to load WASM module ${name}:`, error);
            return null;
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

    // Math operations using WASM
    async performMathOperation(operation, ...args) {
        const instance = await this.loadModule('math');
        if (!instance) return null;

        switch (operation) {
            case 'add':
                return instance.exports.math_add(args[0], args[1]);
            case 'multiply':
                return instance.exports.math_multiply(args[0], args[1]);
            case 'factorial':
                return instance.exports.math_factorial(Math.floor(args[0]));
            case 'power':
                return instance.exports.math_power(args[0], args[1]);
            case 'sqrt':
                return instance.exports.math_sqrt(args[0]);
            case 'isprime':
                return instance.exports.math_isprime(Math.floor(args[0]));
            default:
                return null;
        }
    }

    // String operations using WASM
    async performStringOperation(operation, text) {
        const instance = await this.loadModule('string_utils');
        if (!instance) return null;

        const { memory } = instance.exports;
        const ptr = this.writeString(memory, text);

        switch (operation) {
            case 'upper':
                const upperPtr = instance.exports.str_toupper(ptr);
                return this.readString(memory, upperPtr);
            case 'lower':
                const lowerPtr = instance.exports.str_tolower(ptr);
                return this.readString(memory, lowerPtr);
            case 'reverse':
                const revPtr = instance.exports.str_reverse(ptr);
                return this.readString(memory, revPtr);
            case 'wordcount':
                return instance.exports.str_wordcount(ptr);
            case 'length':
                return instance.exports.str_length(ptr);
            default:
                return null;
        }
    }

    // Crypto operations using WASM
    async performCryptoOperation(operation, text, ...args) {
        const instance = await this.loadModule('crypto');
        if (!instance) return null;

        const { memory } = instance.exports;
        const inPtr = this.writeString(memory, text);

        switch (operation) {
            case 'caesar':
                const shift = args[0] || 3;
                const outPtr = 4096;
                instance.exports.caesar_encrypt(inPtr, outPtr, shift);
                return this.readString(memory, outPtr);
            case 'hash':
                return instance.exports.simple_hash(inPtr);
            case 'base64':
                const b64OutPtr = 8192;
                instance.exports.base64_encode(inPtr, b64OutPtr, text.length);
                return this.readString(memory, b64OutPtr);
            default:
                return null;
        }
    }

    // Sorting operations using WASM
    async performSortOperation(operation, numbers) {
        const instance = await this.loadModule('sort');
        if (!instance) return null;

        const { memory } = instance.exports;
        const arrayPtr = 1024;
        const arrayIndex = arrayPtr / 4;
        const heap = new Int32Array(memory.buffer);
        
        for (let i = 0; i < numbers.length; i++) {
            heap[arrayIndex + i] = numbers[i];
        }

        switch (operation) {
            case 'bubble':
                instance.exports.bubble_sort(arrayPtr, numbers.length);
                return Array.from(heap.slice(arrayIndex, arrayIndex + numbers.length));
            case 'quick':
                instance.exports.quick_sort(arrayPtr, numbers.length);
                return Array.from(heap.slice(arrayIndex, arrayIndex + numbers.length));
            case 'min':
                return instance.exports.find_min(arrayPtr, numbers.length);
            case 'max':
                return instance.exports.find_max(arrayPtr, numbers.length);
            case 'average':
                return instance.exports.calculate_average(arrayPtr, numbers.length);
            case 'search':
                const target = args[0];
                return instance.exports.binary_search(arrayPtr, numbers.length, target);
            default:
                return null;
        }
    }

    // Get system information using WASM
    async getSystemInfo() {
        const instance = await this.loadModule('process');
        if (!instance) return null;

        const { memory } = instance.exports;
        return {
            version: this.readString(memory, instance.exports.sys_version()),
            uptime: instance.exports.sys_uptime(),
            memoryUsed: instance.exports.sys_memused(),
            processCount: instance.exports.proc_count()
        };
    }

    getLoadedModules() {
        return Object.keys(this.modules);
    }
}
