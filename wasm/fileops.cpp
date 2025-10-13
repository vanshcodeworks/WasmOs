#include <stdint.h>
#include <stddef.h>
#include <string.h>

extern "C" {
  // Simple in-memory file system simulation
  static char fileBuffer[4096];
  static int fileSize = 0;

  // Write data to buffer
  uint32_t fs_write(const char* data, uint32_t len) {
    if (len > sizeof(fileBuffer)) len = sizeof(fileBuffer);
    memcpy(fileBuffer, data, len);
    fileSize = len;
    return len;
  }

  // Read data from buffer
  uint32_t fs_read(char* dest, uint32_t maxLen) {
    uint32_t toRead = (fileSize < maxLen) ? fileSize : maxLen;
    memcpy(dest, fileBuffer, toRead);
    return toRead;
  }

  // Get file size
  uint32_t fs_size() {
    return fileSize;
  }

  // Clear buffer
  void fs_clear() {
    fileSize = 0;
    memset(fileBuffer, 0, sizeof(fileBuffer));
  }
}
