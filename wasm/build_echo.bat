@echo off
setlocal
cd /d %~dp0

rem Verify emcc is available
where emcc >nul 2>&1
if errorlevel 1 (
  echo ERROR: emcc not found in PATH.
  echo Install Emscripten SDK and load its environment before building.
  echo Quick start:
  echo   git clone https://github.com/emscripten-core/emsdk.git
  echo   cd emsdk
  echo   emsdk install latest
  echo   emsdk activate latest
  echo   call emsdk_env.bat
  exit /b 1
)

rem Build echo.wasm
emcc echo.cpp -O3 -s STANDALONE_WASM=1 ^
  -Wl,--export=echo -Wl,--export=malloc -Wl,--export=free ^
  -o echo.wasm
if errorlevel 1 (
  echo Build failed.
  exit /b 1
)

echo Built wasm\echo.wasm
endlocal
