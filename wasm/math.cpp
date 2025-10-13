#include <stdint.h>
#include <math.h>

extern "C" {
  // Add two numbers
  double math_add(double a, double b) {
    return a + b;
  }

  // Multiply two numbers
  double math_multiply(double a, double b) {
    return a * b;
  }

  // Calculate factorial
  uint64_t math_factorial(uint32_t n) {
    if (n <= 1) return 1;
    uint64_t result = 1;
    for (uint32_t i = 2; i <= n && i <= 20; i++) {
      result *= i;
    }
    return result;
  }

  // Calculate power
  double math_power(double base, double exp) {
    return pow(base, exp);
  }

  // Calculate square root
  double math_sqrt(double x) {
    return sqrt(x);
  }

  // Check if prime
  uint32_t math_isprime(uint32_t n) {
    if (n <= 1) return 0;
    if (n <= 3) return 1;
    if (n % 2 == 0 || n % 3 == 0) return 0;
    for (uint32_t i = 5; i * i <= n; i += 6) {
      if (n % i == 0 || n % (i + 2) == 0) return 0;
    }
    return 1;
  }
}
