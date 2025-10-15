const fs = require('fs');
const path = require('path');
const buildDir = path.resolve(__dirname);
const files = fs.readdirSync(buildDir).filter(f => ['.wasm', '.js'].includes(path.extname(f))).sort();
fs.writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify(files, null, 2), 'utf8');
console.log('Wrote build/manifest.json with', files.length, 'entries');
