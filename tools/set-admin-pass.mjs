// Sets up the One Live Build admin sign-in (onelivebuild.com/admin) on Vercel.
// Victor runs this himself, in a terminal, from the repo folder:
//
//   node tools/set-admin-pass.mjs --users "first@example.com,second@example.com"
//
// It asks for the password twice with nothing shown on screen. The password is never an
// argument, never printed, never logged and never written to a file: only its PBKDF2-SHA256
// hash leaves this computer. It then writes three settings to the Vercel project
// ppw-designer-2d, for Preview and Production:
//   OLB_ADMIN_USERS      the emails that may sign in (comma list)
//   OLB_ADMIN_PASS_HASH  pbkdf2:<rounds>:<salt hex>:<hash hex>   (sensitive: unreadable after)
//   OLB_ADMIN_SECRET     a fresh random key that signs the 30-day cookie (sensitive)
// A fresh secret signs everyone out. The Vercel token is read from the junk files folder at
// run time and never printed. Settings apply to the next deployment (a merge, or Redeploy).
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PBKDF2_ROUNDS = 600_000; // the server accepts 200,000 and more
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 256;
const TEAM_ID = 'team_bptfse7K2LapV0JdqPKKuRiM'; // victor-ppw
const PROJECT = 'ppw-designer-2d';
const TOKEN_FILE = 'C:\\Users\\Victor\\Documents\\junk files\\vercel-token.txt';
const EMAIL = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+$/;

/** "pbkdf2:<rounds>:<salt hex>:<hash hex>", the format server/adminAuth.ts reads. */
export function makePasswordHash(password, { rounds = PBKDF2_ROUNDS, salt = randomBytes(16) } = {}) {
  const hash = pbkdf2Sync(password.normalize('NFC'), salt, rounds, 32, 'sha256');
  return `pbkdf2:${rounds}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function makeSecret() {
  return randomBytes(32).toString('hex');
}

/** Comma list -> lower-case emails; throws on anything that is not an email. */
export function parseUsers(text) {
  const users = [...new Set(String(text ?? '').split(',').map((user) => user.trim().toLowerCase()).filter(Boolean))];
  if (!users.length) throw new Error('No email given.');
  const bad = users.filter((user) => user.length > 254 || !EMAIL.test(user));
  if (bad.length) throw new Error(`Not an email: ${bad.join(', ')}`);
  return users;
}

export function checkPassword(password) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Too short. Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Too long. Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  return null;
}

/** Reads one line from the keyboard with nothing echoed (raw mode). */
function askHidden(question) {
  return new Promise((done, fail) => {
    const input = process.stdin;
    process.stdout.write(question);
    input.setRawMode(true);
    input.setEncoding('utf8');
    input.resume();
    let value = '';
    let escape = 0; // arrow and other special keys arrive as ESC [ ... letter: skip them
    const finish = (error) => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      if (error) fail(error);
      else done(value);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (escape === 1) { escape = character === '[' || character === 'O' ? 2 : 0; continue; }
        if (escape === 2) { if (character >= '@' && character <= '~') escape = 0; continue; }
        if (character === '\u001b') { escape = 1; continue; }
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0003' || character === '\u0004') return finish(new Error('Stopped. Nothing was changed.'));
        if (character === '\u0008' || character === '\u007f') value = [...value].slice(0, -1).join('');
        else if (character >= ' ') value += character;
      }
    };
    input.on('data', onData);
  });
}

function askVisible(question) {
  return new Promise((done) => {
    process.stdout.write(question);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.once('data', (chunk) => {
      process.stdin.pause();
      done(String(chunk).split(/\r?\n/)[0].trim());
    });
  });
}

async function main() {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run this in a terminal window: it reads the password from the keyboard.');
  }
  const flag = process.argv.indexOf('--users');
  const users = parseUsers(flag >= 0 ? process.argv[flag + 1] : await askVisible('Emails that may sign in (comma list): '));

  const password = await askHidden('Password (nothing shows while you type): ');
  const problem = checkPassword(password);
  if (problem) throw new Error(`${problem} Nothing was changed.`);
  const again = await askHidden('Type it again: ');
  if (again !== password) throw new Error('The two did not match. Nothing was changed.');

  console.log(`\nProject ${PROJECT}, Preview and Production:`);
  console.log(`  OLB_ADMIN_USERS     ${users.join(', ')}`);
  console.log(`  OLB_ADMIN_PASS_HASH PBKDF2-SHA256, ${PBKDF2_ROUNDS.toLocaleString('en')} rounds, new random salt`);
  console.log('  OLB_ADMIN_SECRET    new random key (anyone signed in is signed out)');
  if ((await askVisible('Write these to Vercel now? Type yes: ')).toLowerCase() !== 'yes') throw new Error('Nothing was changed.');

  const token = readFileSync(TOKEN_FILE, 'utf8').trim();
  if (token.length < 10) throw new Error('The Vercel token file is empty.');
  const targets = ['production', 'preview'];
  const body = [
    { key: 'OLB_ADMIN_USERS', value: users.join(','), type: 'encrypted', target: targets },
    { key: 'OLB_ADMIN_PASS_HASH', value: makePasswordHash(password), type: 'sensitive', target: targets },
    { key: 'OLB_ADMIN_SECRET', value: makeSecret(), type: 'sensitive', target: targets },
  ];
  const response = await fetch(`https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${TEAM_ID}&upsert=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = JSON.stringify(result?.error ?? result).split(token).join('***').slice(0, 300);
    throw new Error(`Vercel said ${response.status}: ${reason}`);
  }
  const written = (result.created ? [].concat(result.created) : []).map((entry) => entry.key).filter(Boolean);
  const failed = (result.failed ?? []).map((entry) => entry.error?.key ?? entry.error?.code ?? 'unknown');
  console.log(`Saved on Vercel: ${written.join(', ') || '(none reported)'}${failed.length ? `. Failed: ${failed.join(', ')}` : ''}`);
  if (failed.length) process.exitCode = 1;
  else console.log('Done. The next deployment (the merge, or Redeploy in Vercel) uses them.');
}

const runDirectly = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (runDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Stopped.');
    process.exitCode = 1;
  });
}
