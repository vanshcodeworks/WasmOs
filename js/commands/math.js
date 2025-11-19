export class MathCommand {
  constructor(wasmLoader) {
    this.wasmLoader = wasmLoader;
  }

  async execute(args, printLine) {
    if (args.length === 0) {
      printLine('Usage: math <operation> <args>');
      printLine('Operations: add, mul, fact, pow, sqrt, prime');
      return;
    }

    try {
      const instance = await this.wasmLoader.loadModule('math');
      const exports = instance.exports;
      
      const op = args[0];
      const nums = args.slice(1).map(parseFloat);

      switch(op) {
        case 'add':
          if (nums.length < 2) { printLine('Need 2 numbers'); return; }
          if (!exports.math_add) { printLine('math_add not available'); return; }
          printLine(`Result: ${exports.math_add(nums[0], nums[1])}`);
          break;
          
        case 'mul':
          if (nums.length < 2) { printLine('Need 2 numbers'); return; }
          if (!exports.math_multiply) { printLine('math_multiply not available'); return; }
          printLine(`Result: ${exports.math_multiply(nums[0], nums[1])}`);
          break;
          
        case 'fact':
          if (nums.length < 1) { printLine('Need 1 number'); return; }
          if (!exports.math_factorial) { printLine('math_factorial not available'); return; }
          printLine(`Result: ${exports.math_factorial(Math.floor(nums[0]))}`);
          break;
          
        case 'pow':
          if (nums.length < 2) { printLine('Need 2 numbers'); return; }
          if (!exports.math_power) { printLine('math_power not available'); return; }
          printLine(`Result: ${exports.math_power(nums[0], nums[1])}`);
          break;
          
        case 'sqrt':
          if (nums.length < 1) { printLine('Need 1 number'); return; }
          if (!exports.math_sqrt) { printLine('math_sqrt not available'); return; }
          printLine(`Result: ${exports.math_sqrt(nums[0])}`);
          break;
          
        case 'prime':
          if (nums.length < 1) { printLine('Need 1 number'); return; }
          if (!exports.math_isprime) { printLine('math_isprime not available'); return; }
          const isPrime = exports.math_isprime(Math.floor(nums[0]));
          printLine(`${Math.floor(nums[0])} is ${isPrime ? 'PRIME' : 'NOT PRIME'}`);
          break;
          
        default:
          printLine(`Unknown operation: ${op}`);
      }
    } catch (error) {
      printLine(`math: ${error.message}`);
    }
  }
}
