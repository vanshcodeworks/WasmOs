# Build script for sort.cpp using emcc
# Requires emcc (Emscripten) installed and activated in the shell

# Resolve script directory so relative paths work regardless of cwd
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$src = Join-Path $scriptDir "..\wasm\sort.cpp"
$outJs = "sort.js"
$outWasm = "sort.wasm"

Write-Host "Building $src -> $scriptDir\$outJs + $scriptDir\$outWasm"

# Example emcc command; adjust optimization and exported functions as needed
emcc $src -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='["_bubble_sort","_quick_sort","_binary_search","_find_min","_find_max","_calculate_average"]' -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall"]' -o (Join-Path $scriptDir $outJs)

if ($LASTEXITCODE -ne 0) {
  Write-Error "emcc failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

# regenerate manifest for the build directory
Get-ChildItem (Join-Path $scriptDir '.') -File | Where-Object { $_.Extension -in ('.wasm', '.js') } | Select-Object -ExpandProperty Name | ConvertTo-Json -Depth 1 | Set-Content (Join-Path $scriptDir 'manifest.json') -Encoding UTF8
Write-Host "Updated build/manifest.json"