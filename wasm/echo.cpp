#include <stdint.h>
#include <stddef.h>

extern "C" {
  // echo returns the same pointer passed in. The host (JS) reads the null-terminated string.
  uint32_t echo(const char* s) {
    return (uint32_t)(uintptr_t)s; // wasm32 pointers fit in 32-bit
  }
}
