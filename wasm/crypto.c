#include <stdint.h>
#include <string.h>

// Simple XOR encryption/decryption
void xor_cipher(const char* input, const char* key, char* output, int len) {
  int keyLen = strlen(key);
  for (int i = 0; i < len; i++) {
    output[i] = input[i] ^ key[i % keyLen];
  }
  output[len] = '\0';
}

// Caesar cipher encryption
void caesar_encrypt(const char* input, char* output, int shift) {
  int i = 0;
  while (input[i]) {
    char c = input[i];
    if (c >= 'a' && c <= 'z') {
      output[i] = 'a' + (c - 'a' + shift) % 26;
    } else if (c >= 'A' && c <= 'Z') {
      output[i] = 'A' + (c - 'A' + shift) % 26;
    } else {
      output[i] = c;
    }
    i++;
  }
  output[i] = '\0';
}

// Caesar cipher decryption
void caesar_decrypt(const char* input, char* output, int shift) {
  caesar_encrypt(input, output, 26 - shift);
}

// Simple hash function
uint32_t simple_hash(const char* str) {
  uint32_t hash = 5381;
  int c;
  while ((c = *str++)) {
    hash = ((hash << 5) + hash) + c;
  }
  return hash;
}

// Base64-like encoding (simplified)
static const char base64_chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

void base64_encode(const char* input, char* output, int len) {
  int i = 0, j = 0;
  unsigned char arr3[3], arr4[4];
  
  while (len--) {
    arr3[i++] = *(input++);
    if (i == 3) {
      arr4[0] = (arr3[0] & 0xfc) >> 2;
      arr4[1] = ((arr3[0] & 0x03) << 4) + ((arr3[1] & 0xf0) >> 4);
      arr4[2] = ((arr3[1] & 0x0f) << 2) + ((arr3[2] & 0xc0) >> 6);
      arr4[3] = arr3[2] & 0x3f;
      
      for (i = 0; i < 4; i++) output[j++] = base64_chars[arr4[i]];
      i = 0;
    }
  }
  
  if (i) {
    for (int k = i; k < 3; k++) arr3[k] = '\0';
    arr4[0] = (arr3[0] & 0xfc) >> 2;
    arr4[1] = ((arr3[0] & 0x03) << 4) + ((arr3[1] & 0xf0) >> 4);
    arr4[2] = ((arr3[1] & 0x0f) << 2) + ((arr3[2] & 0xc0) >> 6);
    
    for (int k = 0; k < i + 1; k++) output[j++] = base64_chars[arr4[k]];
    while (i++ < 3) output[j++] = '=';
  }
  output[j] = '\0';
}
