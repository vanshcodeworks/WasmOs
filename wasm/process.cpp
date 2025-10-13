#include <stdint.h>
#include <string.h>

extern "C" {
  static uint32_t processCounter = 0;
  static char versionBuffer[64] = "WasmOS v1.0.0";
  
  struct ProcessInfo {
    uint32_t pid;
    uint32_t status;
    char name[32];
  };

  static ProcessInfo processes[16];
  static uint32_t processCount = 0;

  // Get next PID
  uint32_t proc_getpid() {
    return ++processCounter;
  }

  // Create a simulated process
  uint32_t proc_create(const char* name) {
    if (processCount >= 16) return 0;
    
    uint32_t pid = proc_getpid();
    processes[processCount].pid = pid;
    processes[processCount].status = 1; // running
    strncpy(processes[processCount].name, name, 31);
    processes[processCount].name[31] = '\0';
    processCount++;
    
    return pid;
  }

  // Get process count
  uint32_t proc_count() {
    return processCount;
  }

  // Get system uptime (simulated)
  uint32_t sys_uptime() {
    return processCounter * 42; // Fake uptime
  }

  // Get version string
  const char* sys_version() {
    return versionBuffer;
  }

  // Get memory usage (simulated)
  uint32_t sys_memused() {
    return processCount * 1024 + processCounter * 128;
  }
}
