@echo off
REM filepath: e:\WasmOs\build.bat
echo ========================================
echo   WasmOS Multi-Language Build System   
echo ========================================
echo.

if not exist build mkdir build

set SUCCESS=0
set FAILED=0

echo === Building C++ Modules ===
echo Building echo.wasm...
call emcc wasm\echo.cpp -O3 -s WASM=1 -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS="[\"_echo\"]" --no-entry -o build\echo.wasm
if %ERRORLEVEL%==0 (
    echo [SUCCESS] echo.wasm built
    set /a SUCCESS+=1
) else (
    echo [FAILED] echo.wasm failed
    set /a FAILED+=1
)

echo Building fileops.wasm...
call emcc wasm\fileops.cpp -O3 -s WASM=1 -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS="[\"_fs_write\",\"_fs_read\",\"_fs_size\",\"_fs_clear\"]" --no-entry -o build\fileops.wasm
if %ERRORLEVEL%==0 (
    echo [SUCCESS] fileops.wasm built
    set /a SUCCESS+=1
) else (
    echo [FAILED] fileops.wasm failed
    set /a FAILED+=1
)

echo Building math.wasm...
call emcc wasm\math.cpp -O3 -s WASM=1 -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS="[\"_math_add\",\"_math_multiply\",\"_math_factorial\",\"_math_power\",\"_math_sqrt\",\"_math_isprime\"]" --no-entry -o build\math.wasm
if %ERRORLEVEL%==0 (
    echo [SUCCESS] math.wasm built
    set /a SUCCESS+=1
) else (
    echo [FAILED] math.wasm failed
    set /a FAILED+=1
)

echo Building string_utils.wasm...
call emcc wasm\string_utils.cpp -O3 -s WASM=1 -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS="[\"_str_toupper\",\"_str_tolower\",\"_str_reverse\",\"_str_wordcount\",\"_str_length\"]" --no-entry -o build\string_utils.wasm
if %ERRORLEVEL%==0 (
    echo [SUCCESS] string_utils.wasm built
    set /a SUCCESS+=1
) else (
    echo [FAILED] string_utils.wasm failed
    set /a FAILED+=1
)

echo Building process.wasm...
call emcc wasm\process.cpp -O3 -s WASM=1 -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS="[\"_proc_getpid\",\"_proc_create\",\"_proc_count\",\"_sys_uptime\",\"_sys_version\",\"_sys_memused\"]" --no-entry -o build\process.wasm
if %ERRORLEVEL%==0 (
    echo [SUCCESS] process.wasm built
    set /a SUCCESS+=1
) else (
    echo [FAILED] process.wasm failed
    set /a FAILED+=1
)

echo Building sort.wasm...
call emcc wasm\sort.cpp -O3 -s WASM=1 -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS="[\"_bubble_sort\",\"_quick_sort\",\"_binary_search\",\"_find_min\",\"_find_max\",\"_calculate_average\"]" --no-entry -o build\sort.wasm
if %ERRORLEVEL%==0 (
    echo [SUCCESS] sort.wasm built
    set /a SUCCESS+=1
) else (
    echo [FAILED] sort.wasm failed
    set /a FAILED+=1
)

echo.
echo === Building C Modules ===
echo Building crypto.wasm...
call emcc wasm\crypto.c -O3 -s WASM=1 -s STANDALONE_WASM=1 -s EXPORTED_FUNCTIONS="[\"_xor_cipher\",\"_caesar_encrypt\",\"_caesar_decrypt\",\"_simple_hash\",\"_base64_encode\"]" --no-entry -o build\crypto.wasm
if %ERRORLEVEL%==0 (
    echo [SUCCESS] crypto.wasm built
    set /a SUCCESS+=1
) else (
    echo [FAILED] crypto.wasm failed
    set /a FAILED+=1
)

echo.
echo ========================================
echo   Build Summary
echo ========================================
echo Successful: %SUCCESS%
echo Failed: %FAILED%
echo.

if %FAILED%==0 (
    echo All builds completed successfully!
    echo Start server: python -m http.server 8000
    echo Open: http://localhost:8000/main.html
) else (
    echo Some builds failed. Check errors above.
)

REM Create manifest file
echo ["echo.wasm","fileops.wasm","math.wasm","string_utils.wasm","process.wasm","sort.wasm","crypto.wasm"] > build\manifest.json

pause