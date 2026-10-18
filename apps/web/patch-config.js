const fs = require('fs');
const p = '.vercel/output/functions/render.func/.vc-config.json';
if (fs.existsSync(p)) {
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  d.runtime = 'nodejs20.x';
  d.handler = d.handler.split(String.fromCharCode(92)).join('/');
  fs.writeFileSync(p, JSON.stringify(d, null, 4) + String.fromCharCode(10));
  console.log('patched', d.handler);
}