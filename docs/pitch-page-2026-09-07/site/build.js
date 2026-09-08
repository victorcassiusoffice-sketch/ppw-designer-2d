// The project keeps "node build.js" as its build command from its first deploy.
// This site is static: copy the page and its assets into public/ for Vercel to serve.
const fs = require('node:fs');
fs.rmSync('public', { recursive: true, force: true });
fs.mkdirSync('public', { recursive: true });
const page = fs.readFileSync('index.html', 'utf8');
for (const f of ['index.html', 'PPW-Room-Designer-one-pager.pdf']) fs.copyFileSync(f, 'public/' + f);
// demo-60s.mp4 lives only on the deployed project - it is not in the repo copy of this folder.
// Deploying without it would silently strip the video from a live sales page, so stop instead.
for (const f of ['demo-60s.mp4']) {
  if (fs.existsSync(f)) fs.copyFileSync(f, 'public/' + f);
  else if (page.includes(f)) throw new Error(f + ' is referenced by index.html but is not in this folder. Deploying now would drop it from the live page. Recover the file first, or remove the reference deliberately.');
}
fs.cpSync('img', 'public/img', { recursive: true });
console.log('static site staged in public/');
