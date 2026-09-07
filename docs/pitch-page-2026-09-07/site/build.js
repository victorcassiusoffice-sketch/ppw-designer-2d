// The project keeps "node build.js" as its build command from its first deploy.
// This site is static: copy the page and its assets into public/ for Vercel to serve.
const fs = require('node:fs');
fs.rmSync('public', { recursive: true, force: true });
fs.mkdirSync('public', { recursive: true });
for (const f of ['index.html', 'demo-60s.mp4', 'PPW-Room-Designer-one-pager.pdf']) fs.copyFileSync(f, 'public/' + f);
fs.cpSync('img', 'public/img', { recursive: true });
console.log('static site staged in public/');
