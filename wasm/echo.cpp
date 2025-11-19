#include <stdint.h>
#include <stddef.h>
#include <string.h>

extern "C" {
    // Standard echo - returns input pointer
    uint32_t echo(const char* input) {
        return (uint32_t)(uintptr_t)input;
    }
    
    // Echo with timestamp
    static char timestamped_buffer[512];
    const char* echo_with_timestamp(const char* input) {
        // Simple timestamp simulation
        static uint32_t counter = 0;
        snprintf(timestamped_buffer, sizeof(timestamped_buffer), 
                "[%u] %s", ++counter, input);
        return timestamped_buffer;
    }
    
    // Echo with length info
    static char length_buffer[512];
    const char* echo_with_length(const char* input) {
        size_t len = strlen(input);
        snprintf(length_buffer, sizeof(length_buffer), 
                "%s (length: %zu)", input, len);
        return length_buffer;
    }
    
    // Repeat echo
    static char repeat_buffer[1024];
    const char* echo_repeat(const char* input, uint32_t count) {
        if (count == 0 || count > 10) return input; // Limit repetitions
        
        repeat_buffer[0] = '\0';
        size_t input_len = strlen(input);
        size_t total_len = 0;
        
        for (uint32_t i = 0; i < count && total_len + input_len < sizeof(repeat_buffer) - 1; i++) {
            if (i > 0) {
                strcat(repeat_buffer, " ");
                total_len++;
            }
            strcat(repeat_buffer, input);
            total_len += input_len;
        }
        
        return repeat_buffer;
    }
}
