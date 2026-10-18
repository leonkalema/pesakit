// Make `require('pesakit')` return the Pesakit class with named exports attached,
// so CommonJS users do not need `.default`.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../dist/index.cjs', import.meta.url);
let src = readFileSync(file, 'utf8');
const marker = '\n// pesakit: cjs default interop\n';
if (!src.includes(marker)) {
  src += `${marker}module.exports = Object.assign(module.exports.default, module.exports);\n`;
  writeFileSync(file, src);
}
console.log('postbuild: cjs default interop applied');
