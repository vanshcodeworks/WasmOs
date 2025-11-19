export class SortCommand {
  constructor(wasmLoader) {
    this.wasmLoader = wasmLoader;
  }

  async execute(args, printLine) {
    if (args.length === 0) {
      printLine('Usage: sort <algorithm> <numbers...>');
      printLine('Algorithms: bubble, quick, bsearch, min, max, avg');
      printLine('Example: sort quick 64 34 25 12 22 11 90');
      return;
    }

    try {
      const instance = await this.wasmLoader.loadModule('sort');
      const { memory } = instance.exports;
      
      if (!memory) {
        printLine('sort: memory not available');
        return;
      }

      const op = args[0];
      const numbers = args.slice(1).map(n => parseInt(n)).filter(n => !isNaN(n));
      
      if (numbers.length === 0) {
        printLine('Please provide numbers to sort');
        return;
      }

      const arrayPtr = 1024;
      const arrayIndex = arrayPtr / 4;
      const heap = new Int32Array(memory.buffer);
      
      for (let i = 0; i < numbers.length; i++) {
        heap[arrayIndex + i] = numbers[i];
      }

      switch(op) {
        case 'bubble':
          if (!instance.exports.bubble_sort) { 
            printLine('bubble_sort not available'); 
            return; 
          }
          instance.exports.bubble_sort(arrayPtr, numbers.length);
          const bubbleSorted = Array.from(heap.slice(arrayIndex, arrayIndex + numbers.length));
          printLine(`Bubble Sort: [${bubbleSorted.join(', ')}]`);
          break;

        case 'quick':
          if (!instance.exports.quick_sort) { 
            printLine('quick_sort not available'); 
            return; 
          }
          instance.exports.quick_sort(arrayPtr, numbers.length);
          const quickSorted = Array.from(heap.slice(arrayIndex, arrayIndex + numbers.length));
          printLine(`Quick Sort: [${quickSorted.join(', ')}]`);
          break;

        case 'bsearch':
          if (args.length < 3) {
            printLine('Usage: sort bsearch <target> <sorted_numbers...>');
            return;
          }
          const target = parseInt(args[1]);
          const searchNums = args.slice(2).map(n => parseInt(n)).filter(n => !isNaN(n));
          
          if (!instance.exports.quick_sort || !instance.exports.binary_search) {
            printLine('binary_search or quick_sort not available');
            return;
          }
          
          for (let i = 0; i < searchNums.length; i++) {
            heap[arrayIndex + i] = searchNums[i];
          }
          
          instance.exports.quick_sort(arrayPtr, searchNums.length);
          const index = instance.exports.binary_search(arrayPtr, searchNums.length, target);
          
          if (index !== -1) {
            printLine(`Found ${target} at index ${index}`);
          } else {
            printLine(`${target} not found in array`);
          }
          break;

        case 'min':
          if (!instance.exports.find_min) { 
            printLine('find_min not available'); 
            return; 
          }
          const min = instance.exports.find_min(arrayPtr, numbers.length);
          printLine(`Minimum: ${min}`);
          break;

        case 'max':
          if (!instance.exports.find_max) { 
            printLine('find_max not available'); 
            return; 
          }
          const max = instance.exports.find_max(arrayPtr, numbers.length);
          printLine(`Maximum: ${max}`);
          break;

        case 'avg':
          if (!instance.exports.calculate_average) { 
            printLine('calculate_average not available'); 
            return; 
          }
          const avg = instance.exports.calculate_average(arrayPtr, numbers.length);
          printLine(`Average: ${Number(avg).toFixed(2)}`);
          break;

        default:
          printLine(`Unknown operation: ${op}`);
      }
    } catch (error) {
      printLine(`sort: ${error.message}`);
    }
  }
}
