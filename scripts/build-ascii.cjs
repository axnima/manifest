const path = require('node:path');
const fs = require('node:fs');
const {buildSync} = require('esbuild');
const root = path.join(__dirname, '..');
const license = fs.readFileSync(path.join(root,'vendor/ascii-sharks/LICENSE'),'utf8');
buildSync({
  entryPoints:[path.join(__dirname,'landing-ocean.ts')],
  bundle:true, minify:true, target:'es2020', format:'iife',
  outfile:path.join(root,'public/ascii-ocean.js'),
  banner:{js:'/* ASCII Sharks: https://github.com/stackedlol/ascii-sharks\n'+license+'*/'},
});
console.log('Built local ASCII ocean bundle.');
