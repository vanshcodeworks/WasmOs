#include <stdint.h>
#include <string.h>
#include <ctype.h>

extern "C" {
  static char buffer[2048];

  // Convert string to uppercase
  const char* str_toupper(const char* s) {
    int i = 0;
    while (s[i] && i < sizeof(buffer) - 1) {
      buffer[i] = toupper(s[i]);
      i++;
    }
    buffer[i] = '\0';
    return buffer;
  }

  // Convert string to lowercase
  const char* str_tolower(const char* s) {
    int i = 0;
    while (s[i] && i < sizeof(buffer) - 1) {
      buffer[i] = tolower(s[i]);
      i++;
    }
    buffer[i] = '\0';
    return buffer;
  }

  // Reverse string
  const char* str_reverse(const char* s) {
    int len = strlen(s);
    if (len >= sizeof(buffer)) len = sizeof(buffer) - 1;
    for (int i = 0; i < len; i++) {
      buffer[i] = s[len - 1 - i];
    }
    buffer[len] = '\0';
    return buffer;
  }

  // Count words
  uint32_t str_wordcount(const char* s) {
    uint32_t count = 0;
    bool inWord = false;
    while (*s) {
      if (isspace(*s)) {
        inWord = false;
      } else if (!inWord) {
        inWord = true;
        count++;
      }
      s++;
    }
    return count;
  }

  // String length
  uint32_t str_length(const char* s) {
    return strlen(s);
  }
}
