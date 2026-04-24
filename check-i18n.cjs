const fs = require('fs');
const path = require('path');
const en = JSON.parse(fs.readFileSync('src/i18n/locales/en.json','utf8'));
const hi = JSON.parse(fs.readFileSync('src/i18n/locales/hi.json','utf8'));
const te = JSON.parse(fs.readFileSync('src/i18n/locales/te.json','utf8'));

function flatten(obj, prefix) {
  prefix = prefix || '';
  let keys = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? prefix+'.'+k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null) keys = keys.concat(flatten(obj[k], full));
    else keys.push(full);
  }
  return keys;
}
const enKeys = new Set(flatten(en));
const hiKeys = new Set(flatten(hi));
const teKeys = new Set(flatten(te));

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) files = files.concat(walk(p));
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) files.push(p);
  }
  return files;
}

const files = walk('src');
const usedKeys = new Set();
const re = /\bt\('([^'`]+)'\)/g;
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(content)) !== null) {
    const key = m[1];
    // skip dynamic keys
    if (!key.includes('${') && key.includes('.')) {
      usedKeys.add(key);
    }
  }
}

const missingEn = [...usedKeys].filter(k => !enKeys.has(k)).sort();
const missingHi = [...usedKeys].filter(k => !hiKeys.has(k)).sort();
const missingTe = [...usedKeys].filter(k => !teKeys.has(k)).sort();

console.log('Total t() keys found:', usedKeys.size);
console.log('\n=== MISSING FROM en.json (' + missingEn.length + ') ===');
missingEn.forEach(k => console.log(' ', k));
console.log('\n=== MISSING FROM hi.json (' + missingHi.length + ') ===');
missingHi.forEach(k => console.log(' ', k));
console.log('\n=== MISSING FROM te.json (' + missingTe.length + ') ===');
missingTe.forEach(k => console.log(' ', k));
