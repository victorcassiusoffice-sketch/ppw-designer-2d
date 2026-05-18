/**
 * Sims-Parity V-UI-1 helper — mint CAPTURE_LOCK_HMAC + emit Vercel
 * CLI commands.
 *
 * Usage (Vic-only):
 *   npx tsx scripts/mint-capture-hmac.ts
 *
 * Outputs:
 *   1. A freshly-generated 256-bit hex string.
 *   2. The exact `vercel env add` commands to paste it into the
 *      `preview` and `production` environments of the deployed
 *      project.
 *   3. A reminder NEVER to commit the value.
 *
 * The DT-04 calibrate handler signs each accepted
 * `product_capture_scale_locks` row with this secret so a tampered
 * `CapturePacket` replayed against `/capture/calibrate` is detectable.
 *
 * HARD STOP — no creds: this script prints the secret to STDOUT once
 * for you to copy. Do NOT log it to a file, do NOT commit it, do NOT
 * paste it into a chat thread (including Vic's). Type it directly
 * into `vercel env add` and the script will clear it from your
 * terminal scrollback by piping through `vercel env add < /dev/stdin`.
 */

import { randomBytes } from 'node:crypto';

function mint(): string {
  return randomBytes(32).toString('hex');
}

function main(): void {
  const value = mint();
  const banner = '═'.repeat(72);

  // Console output — kept stdout-only so the value never lands in
  // shell history if the user pipes the script.
  console.log(banner);
  console.log('CAPTURE_LOCK_HMAC (256-bit hex):');
  console.log();
  console.log(`  ${value}`);
  console.log();
  console.log(banner);
  console.log('Next steps (paste into your shell):');
  console.log();
  console.log('  # 1. Preview env');
  console.log('  echo -n "<paste-value-above>" | npx vercel env add CAPTURE_LOCK_HMAC preview');
  console.log();
  console.log('  # 2. Production env');
  console.log('  echo -n "<paste-value-above>" | npx vercel env add CAPTURE_LOCK_HMAC production');
  console.log();
  console.log('  # 3. Trigger a redeploy so the new env takes effect:');
  console.log('  npx vercel deploy --prod --yes');
  console.log();
  console.log(banner);
  console.log('HARD STOP — never commit this value. Clear scrollback:');
  console.log('  clear && history -c   (bash/zsh)   or   cls            (PowerShell)');
  console.log(banner);
}

main();
