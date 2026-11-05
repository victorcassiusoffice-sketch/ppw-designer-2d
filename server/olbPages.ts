import { OLB_AUDIENCES } from './olbDecks';

/** Server-rendered One Live Build pages for onelivebuild.com: the landing ("Who are you?"),
 * the admin sign-in and the deck "not found" page. No script, no app bundle: plain HTML
 * and one style block, so a slow tablet shows them at once. Fonts, logo and picture come
 * from /fonts/ and /brand/olb/, which open without the studio code. */

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Where "I have a code" leads: the existing code entry, then the One Live Build home. */
export const CODE_ENTRY_HREF = '/access?next=%2Fhome';
export const OWNERSHIP_LINE = 'One Live Build · owned by Peak Performance Wellness Ltd, Curepipe, Mauritius';

const BASE_CSS = `@font-face{font-family:Fraunces;font-style:normal;font-weight:600;font-display:swap;src:url(/fonts/fraunces-600-latin.woff2) format('woff2')}
@font-face{font-family:Outfit;font-style:normal;font-weight:100 900;font-display:swap;src:url(/fonts/outfit-latin.woff2) format('woff2')}
:root{--paper:#F3EFE6;--card:#FBF9F4;--ink:#1A1814;--palm:#1E3D32;--palm-hover:#2A5546;--copper:#8F4E2A;--sand:#E7DCC8;--line:#DDD6C8;--edge:#CFC6B5;--muted:#5C574E;--error:#8C302B;--wrap:1160px;--gutter:16px}
*{box-sizing:border-box}
html{background:var(--paper);-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;min-height:100vh;min-height:100svh;display:flex;flex-direction:column;background:var(--paper);color:var(--ink);font:400 17px/1.5 Outfit,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--palm);text-underline-offset:3px}
:focus-visible{outline:3px solid var(--copper);outline-offset:3px}
.top,.page,.foot{width:100%;max-width:var(--wrap);margin:0 auto;padding-left:var(--gutter);padding-right:var(--gutter)}
.top{display:flex;align-items:center;padding-top:10px;padding-bottom:10px}
.top a{display:inline-flex;align-items:center;min-height:48px}
.top img{display:block;width:auto;height:30px}
.tag{margin:0;color:var(--copper);font-weight:600;font-size:13px;letter-spacing:.14em;text-transform:uppercase}
h1{margin:0;font:600 clamp(30px,8vw,46px)/1.08 Fraunces,Georgia,serif;letter-spacing:-.015em}
h1 label{cursor:pointer}
.card{padding:20px;border:1px solid var(--line);border-radius:18px;background:var(--card);box-shadow:0 22px 50px -34px #1a181466}
.field{display:grid;gap:6px}
.field label{font-weight:600;font-size:15px}
input,select{display:block;width:100%;min-height:56px;margin:0;padding:12px 16px;border:1px solid var(--edge);border-radius:14px;background:#fff;color:var(--ink);font:inherit;font-size:18px}
input:focus,select:focus{border-color:var(--palm)}
input:disabled{background:#f1eee8}
button,.button{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:56px;margin:0;padding:12px 22px;border:0;border-radius:999px;background:var(--palm);color:var(--paper);font:inherit;font-weight:600;font-size:17px;line-height:1.3;text-decoration:none;cursor:pointer}
button:hover,.button:hover{background:var(--palm-hover)}
button:disabled{opacity:.55;cursor:not-allowed}
button svg,.button svg{flex:none;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ghost{background:transparent;color:var(--palm);border:1.5px solid var(--palm)}
.ghost:hover{background:#1e3d3212}
.foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0 16px;padding-top:8px;padding-bottom:12px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
.foot span{padding:12px 0}
.foot a{display:inline-flex;align-items:center;min-height:48px;font-size:15px}
@media(prefers-reduced-motion:no-preference){button,.button{transition:background-color .15s ease}}`;

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const LOGO = '<header class="top"><a href="/" aria-label="One Live Build home"><img src="/brand/olb/olb-lockup.svg" alt="One Live Build" width="165" height="34"></a></header>';

function head(title: string, description: string, extraCss: string): string {
  return `<!doctype html><html lang="en" data-brand="olb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#1E3D32"><meta name="description" content="${escape(description)}"><link rel="icon" type="image/svg+xml" href="/brand/olb/favicon.svg"><link rel="apple-touch-icon" href="/brand/olb/apple-touch-icon.png"><link rel="preload" href="/fonts/outfit-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/fraunces-600-latin.woff2" as="font" type="font/woff2" crossorigin><title>${escape(title)}</title><style>
${BASE_CSS}
${extraCss}
</style></head>`;
}

/* Phone first. 720-959 px (a tablet held upright): one column, centred, picture on top.
 * 960 px and wider (a tablet on its side, a laptop): the question left, the picture right. */
const LANDING_CSS = `.page{flex:1;display:grid;gap:16px;align-content:start;padding-top:2px;padding-bottom:24px}
.art{margin:0;overflow:hidden;border-radius:18px;background:var(--sand);aspect-ratio:5/2}
.art img{display:block;width:100%;height:100%;object-fit:cover;object-position:80% 100%}
.copy{display:grid;gap:16px;align-content:start}
.intro{display:grid;gap:4px}
.intro p{margin:0}
.intro p:last-child{color:var(--muted)}
.ask{display:grid;gap:14px}
.ask .hint{margin:-6px 0 0;color:var(--muted);font-size:15px}
.pick{position:relative}
.pick select{appearance:none;-webkit-appearance:none;padding-right:52px;cursor:pointer}
.pick::after{content:"";position:absolute;right:22px;top:50%;width:10px;height:10px;margin-top:-7px;border-right:2px solid var(--palm);border-bottom:2px solid var(--palm);transform:rotate(45deg);pointer-events:none}
.code{display:flex;align-items:flex-start;margin:0}
.code .button{width:auto;min-height:48px;padding:10px 24px}
@media(min-width:520px){.art{aspect-ratio:2/1}.card{padding:26px}}
@media(min-width:720px) and (max-width:959px){:root{--wrap:672px}.page{align-content:center;gap:24px;padding-bottom:40px}.art{aspect-ratio:16/10}.copy{gap:20px}}
@media(min-width:960px){
:root{--gutter:40px}
.page{grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);align-items:center;align-content:center;column-gap:56px;padding-top:8px;padding-bottom:40px}
.art{grid-column:2;grid-row:1;aspect-ratio:auto;height:min(66vh,560px)}
.copy{grid-column:1;grid-row:1;gap:20px}
.card{padding:30px}
}`;

/** onelivebuild.com/ for everyone: one question, one dropdown, one button. The form works
 * without any script: GET /decks/?for=<choice> answers with the deck's address. */
export function landingPage(): string {
  const options = OLB_AUDIENCES.map((audience) => `<option value="${escape(audience.id)}">${escape(audience.label)}</option>`).join('');
  return `${head('One Live Build', 'Every build, one live plan. Choose who you are and open the short deck for your kind of company.', LANDING_CSS)}<body>
${LOGO}
<main class="page">
<figure class="art"><img src="/brand/olb/hero-1200x630.jpg" alt="A block house on a sandy plot with palms" width="1200" height="630" decoding="async"></figure>
<div class="copy">
<div class="intro"><p class="tag">Every build, one live plan</p><p>Suppliers, designer, customer and workers on one drawing.</p></div>
<form class="ask card" action="/decks/" method="get">
<h1><label for="who">Who are you?</label></h1>
<p class="hint" id="who-hint">Pick the closest one. Your short deck opens.</p>
<div class="pick"><select id="who" name="for" required aria-describedby="who-hint"><option value="" selected disabled>Choose one</option>${options}</select></div>
<button type="submit">Open the deck ${ARROW}</button>
</form>
<p class="code"><a class="button ghost" href="${CODE_ENTRY_HREF}">I have a code</a></p>
</div>
</main>
<footer class="foot"><span>${escape(OWNERSHIP_LINE)}</span><a href="/admin">Sign in</a></footer>
</body></html>`;
}

const ADMIN_CSS = `.page{flex:1;display:grid;align-content:start;justify-items:center;padding-top:8px;padding-bottom:32px}
.card{width:100%;max-width:440px;display:grid;gap:16px}
.card h1{font-size:clamp(28px,7vw,36px)}
.card p{margin:0;color:var(--muted)}
.card .tag{color:var(--copper)}
.card .message{padding:10px 14px;border-radius:12px;background:#f6e9e6;color:var(--error);font-size:15px}
.card .note{padding:10px 14px;border-radius:12px;background:#e6eee8;color:var(--palm);font-size:15px}
.links{display:grid;gap:10px}
form{display:grid;gap:16px;margin:0}
@media(min-width:720px){.page{align-content:center;padding-bottom:64px}.card{padding:32px}}`;

export type AdminView =
  | { readonly state: 'sign-in'; readonly next: string; readonly error?: string; readonly notice?: string; readonly email?: string }
  | { readonly state: 'signed-in'; readonly email: string; readonly next: string }
  | { readonly state: 'not-set-up' };

/** onelivebuild.com/admin: the email + password form, the signed-in page (with Sign out),
 * or "not set up" when the server has no admin settings. */
export function adminPage(view: AdminView): string {
  let body: string;
  if (view.state === 'signed-in') {
    const open = view.next === '/home' ? '' : `<a class="button" href="${escape(view.next)}">Continue ${ARROW}</a>`;
    body = `<p class="tag">Admin</p><h1>You are signed in</h1><p>Signed in as ${escape(view.email)}.</p>
<div class="links">${open}<a class="button${open ? ' ghost' : ''}" href="/home">Open One Live Build ${ARROW}</a><a class="button ghost" href="/designer">Open the designer</a></div>
<form method="post" action="/admin/sign-out"><button class="ghost" type="submit">Sign out</button></form>`;
  } else if (view.state === 'not-set-up') {
    body = `<p class="tag">Admin</p><h1>Sign in</h1><p class="message" role="alert">Sign-in is not set up yet.</p>
<div class="field"><label for="email">Email</label><input id="email" type="email" disabled></div>
<div class="field"><label for="password">Password</label><input id="password" type="password" disabled></div>
<button type="button" disabled>Sign in</button>`;
  } else {
    const error = view.error ? `<p class="message" id="sign-in-error" role="alert">${escape(view.error)}</p>` : '';
    const notice = view.notice ? `<p class="note" role="status">${escape(view.notice)}</p>` : '';
    const invalid = view.error ? ' aria-invalid="true" aria-describedby="sign-in-error"' : '';
    body = `<p class="tag">Admin</p><h1>Sign in</h1><p>For the One Live Build team.</p>${notice}${error}
<form method="post" action="/admin"><input type="hidden" name="next" value="${escape(view.next)}">
<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="254" required value="${escape(view.email ?? '')}"${invalid}></div>
<div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required${invalid}></div>
<button type="submit">Sign in ${ARROW}</button></form>`;
  }
  return `${head('Sign in · One Live Build', 'One Live Build admin sign-in.', ADMIN_CSS)}<body>
${LOGO}
<main class="page"><div class="card">${body}</div></main>
<footer class="foot"><span>${escape(OWNERSHIP_LINE)}</span><a href="/">Back to One Live Build</a></footer>
</body></html>`;
}

/** /decks/<unknown>: point back to the choice. */
export function deckNotFoundPage(): string {
  return `${head('Deck not found · One Live Build', 'This deck is not here.', ADMIN_CSS)}<body>
${LOGO}
<main class="page"><div class="card"><h1>This deck is not here</h1><p>Choose who you are and the right deck opens.</p><a class="button" href="/">Choose your deck ${ARROW}</a></div></main>
<footer class="foot"><span>${escape(OWNERSHIP_LINE)}</span></footer>
</body></html>`;
}
