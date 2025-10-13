#!/bin/bash

echo "========================================"
echo "  WasmOS Multi-Language Build System   "
echo "========================================"
echo ""

# Create build directory
mkdir -p build

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Build counter
SUCCESS=0
FAILED=0

build_module() {
    local name=$1
    local cmd=$2
    echo -e "${BLUE}Building ${name}...${NC}"
    if eval $cmd; then
        echo -e "${GREEN}✓ ${name} built successfully${NC}"
        ((SUCCESS++))
    else
        echo -e "${RED}✗ ${name} build failed${NC}"
        ((FAILED++))
    fi
    echo ""
}

# C++ Modules
echo "=== Building C++ Modules ==="
build_module "echo (C++)" \
    "emcc wasm/echo.cpp -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='[\"_echo\"]' -s EXPORTED_RUNTIME_METHODS='[]' -o build/echo.wasm"

build_module "fileops (C++)" \
    "emcc wasm/fileops.cpp -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='[\"_fs_write\",\"_fs_read\",\"_fs_size\",\"_fs_clear\"]' -s EXPORTED_RUNTIME_METHODS='[]' -o build/fileops.wasm"

build_module "math (C++)" \
    "emcc wasm/math.cpp -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='[\"_math_add\",\"_math_multiply\",\"_math_factorial\",\"_math_power\",\"_math_sqrt\",\"_math_isprime\"]' -s EXPORTED_RUNTIME_METHODS='[]' -o build/math.wasm"

build_module "string_utils (C++)" \
    "emcc wasm/string_utils.cpp -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='[\"_str_toupper\",\"_str_tolower\",\"_str_reverse\",\"_str_wordcount\",\"_str_length\"]' -s EXPORTED_RUNTIME_METHODS='[]' -o build/string_utils.wasm"

build_module "process (C++)" \
    "emcc wasm/process.cpp -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='[\"_proc_getpid\",\"_proc_create\",\"_proc_count\",\"_sys_uptime\",\"_sys_version\",\"_sys_memused\"]' -s EXPORTED_RUNTIME_METHODS='[]' -o build/process.wasm"

build_module "sort (C++)" \
    "emcc wasm/sort.cpp -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='[\"_bubble_sort\",\"_quick_sort\",\"_binary_search\",\"_find_min\",\"_find_max\",\"_calculate_average\"]' -s EXPORTED_RUNTIME_METHODS='[]' -o build/sort.wasm"

# C Modules
echo "=== Building C Modules ==="
build_module "crypto (C)" \
    "emcc wasm/crypto.c -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='[\"_xor_cipher\",\"_caesar_encrypt\",\"_caesar_decrypt\",\"_simple_hash\",\"_base64_encode\"]' -s EXPORTED_RUNTIME_METHODS='[]' -o build/crypto.wasm"

# Go Modules (requires TinyGo)
if command -v tinygo &> /dev/null; then
    echo "=== Building Go Modules ==="
    build_module "json_parser (Go)" \
        "tinygo build -o build/json_parser.wasm -target wasm wasm/json_parser.go"
else
    echo -e "${RED}TinyGo not found. Skipping Go modules.${NC}"
    echo "Install TinyGo from: https://tinygo.org/getting-started/install/"
    echo ""
fi

# TypeScript/AssemblyScript Modules
if command -v asc &> /dev/null; then
    echo "=== Building AssemblyScript Modules ==="
    build_module "image_processing (AssemblyScript)" \
        "asc wasm/image_processing.ts -O3 --exportRuntime -o build/image_processing.wasm"
else
    echo -e "${RED}AssemblyScript compiler not found. Skipping TS modules.${NC}"
    echo "Install with: npm install -g assemblyscript"
    echo ""
fi

# Rust Modules (if you add them)
if command -v rustc &> /dev/null && command -v wasm-pack &> /dev/null; then
    echo "=== Building Rust Modules ==="
    # Add rust builds here when you create Rust modules
    echo "No Rust modules defined yet"
else
    echo -e "${RED}Rust/wasm-pack not found. Skipping Rust modules.${NC}"
    echo ""
fi

echo "========================================"
echo "  Build Summary"
echo "========================================"
echo -e "${GREEN}Successful: $SUCCESS${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All builds completed successfully!${NC}"
    exit 0
else
    echo -e "${RED}Some builds failed. Check errors above.${NC}"
    exit 1
fi
