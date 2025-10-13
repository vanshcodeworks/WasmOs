package main

import (
	"encoding/json"
	"unsafe"
)

//export json_validate
func json_validate(jsonStr *byte, length int) int {
	data := goString(jsonStr, length)
	var js interface{}
	err := json.Unmarshal([]byte(data), &js)
	if err != nil {
		return 0 // Invalid
	}
	return 1 // Valid
}

//export json_minify
func json_minify(jsonStr *byte, length int, output *byte, maxLen int) int {
	data := goString(jsonStr, length)
	var js interface{}
	err := json.Unmarshal([]byte(data), &js)
	if err != nil {
		return 0
	}
	
	minified, err := json.Marshal(js)
	if err != nil {
		return 0
	}
	
	if len(minified) >= maxLen {
		return 0
	}
	
	copyToOutput(output, minified)
	return len(minified)
}

//export json_prettify
func json_prettify(jsonStr *byte, length int, output *byte, maxLen int) int {
	data := goString(jsonStr, length)
	var js interface{}
	err := json.Unmarshal([]byte(data), &js)
	if err != nil {
		return 0
	}
	
	pretty, err := json.MarshalIndent(js, "", "  ")
	if err != nil {
		return 0
	}
	
	if len(pretty) >= maxLen {
		return 0
	}
	
	copyToOutput(output, pretty)
	return len(pretty)
}

//export json_get_key_count
func json_get_key_count(jsonStr *byte, length int) int {
	data := goString(jsonStr, length)
	var js map[string]interface{}
	err := json.Unmarshal([]byte(data), &js)
	if err != nil {
		return -1
	}
	return len(js)
}

// Helper functions
func goString(ptr *byte, length int) string {
	if length == 0 {
		return ""
	}
	bytes := (*[1 << 30]byte)(unsafe.Pointer(ptr))[:length:length]
	return string(bytes)
}

func copyToOutput(output *byte, data []byte) {
	outputSlice := (*[1 << 30]byte)(unsafe.Pointer(output))
	copy(outputSlice[:], data)
	outputSlice[len(data)] = 0 // Null terminate
}

func main() {}
