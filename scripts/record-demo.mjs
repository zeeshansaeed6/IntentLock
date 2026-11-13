// Records a captioned walkthrough of the running app (about 4.5 minutes) and converts it to MP4.
// Usage: start the app (npm run dev, or build + vite preview on :5173), then `node scripts/record-demo.mjs`.
// Env: APP_URL (default http://localhost:5173), ADMIN_PASSWORD (default: the .env.example value), CHROMIUM_PATH.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'recordings');
const APP = process.env.APP_URL ?? 'http://localhost:5173';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'replace-with-a-secure-admin-password';
const chromiumPath = process.env.CHROMIUM_PATH ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();
const stamp = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;

/** Overlay injected on every page load: caption bar, section tag, highlight ring and a visible cursor. */
const OVERLAY = () => {
  // The init script runs before <html>/<body> exist, so DOM work waits for the document.
  window.__say = (tag, text) => {
    const cap = document.getElementById('il-cap');
    if (!cap) return;
    cap.style.opacity = text ? '1' : '0';
    cap.innerHTML = text ? `<small>${tag}</small>${text}` : '';
  };
  window.__hl = (sel) => {
    document.querySelectorAll('.il-hl').forEach((el) => el.classList.remove('il-hl'));
    if (sel) document.querySelectorAll(sel).forEach((el) => el.classList.add('il-hl'));
  };
  const setup = () => {
    if (document.getElementById('il-cap')) return;
    const css = document.createElement('style');
    css.textContent = `
      #il-cap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483647;max-width:1020px;width:calc(100% - 80px);
        padding:14px 22px;border-radius:16px;background:rgba(6,9,18,.92);border:1px solid rgba(99,102,241,.55);color:#f1f5f9;
        font:600 21px/1.4 Manrope,system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.6);text-align:center;transition:opacity .25s;opacity:0}
      #il-cap small{display:block;font:500 12px 'DM Mono',monospace;letter-spacing:.16em;color:#22d3ee;margin-bottom:5px;text-transform:uppercase}
      #il-cur{position:fixed;z-index:2147483647;width:20px;height:20px;margin:-3px 0 0 -3px;border-radius:50%;pointer-events:none;
        background:rgba(34,211,238,.35);border:2px solid #22d3ee;box-shadow:0 0 18px #22d3ee}
      .il-hl{outline:3px solid #fbbf24!important;outline-offset:4px;border-radius:12px;animation:il-p 1.2s ease-in-out infinite}
      @keyframes il-p{50%{outline-color:#22d3ee}}`;
    const cap = document.createElement('div');
    cap.id = 'il-cap';
    const cur = document.createElement('div');
    cur.id = 'il-cur';
    document.head.appendChild(css);
    document.body.append(cap, cur);
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', setup);
  else setup();
};

const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] });

// Reset server state with a throwaway context so the recording starts from a clean seed.
{
  const warm = await (await browser.newContext()).newPage();
  await warm.goto(APP);
  await warm.evaluate(async (password) => {
    await fetch('/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@intentlock.io', password }) });
    await fetch('/api/reset', { method: 'POST', credentials: 'include' });
  }, PASSWORD);
  await warm.close();
}

fs.mkdirSync(outDir, { recursive: true });
const framesDir = path.join(outDir, 'frames');
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
await context.addInitScript(OVERLAY);
const page = await context.newPage();

// Capture frames through the DevTools screencast (no dependency on Playwright's bundled ffmpeg).
const frames = [];
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  const file = path.join(framesDir, `f${String(frames.length).padStart(6, '0')}.jpg`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push({ file, t: metadata.timestamp });
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });

let section = 'IntentLock';
const say = async (text, ms) => {
  await page.evaluate(([t, s]) => window.__say?.(s, t), [text, section]);
  await sleep(ms);
};
const highlight = (sel) => page.evaluate((s) => window.__hl?.(s), sel);
const glide = async (locator) => {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
};
const click = async (locator) => {
  await glide(locator);
  await sleep(250);
  await locator.click();
};
const nav = async (label) => {
  await click(page.locator('.side-nav', { hasText: label }));
  await sleep(900);
};
const dismissApproval = async () => {
  const later = page.getByText('Review Later');
  if (await later.isVisible().catch(() => false)) await later.click();
};

// ---------- 1. Landing ----------
section = '1 · Landing page';
await page.goto(APP);
await sleep(1200);
await say('IntentLock: tell an agent what to buy. It decides, signs a contract, and issues a card that can pay for exactly that.', 5200);
await say('Core principle: the LLM proposes. Deterministic code and the card dispose. The model never holds spending authority.', 4800);
await page.evaluate(() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }));
await say('Five steps from a sentence to a locked-down card. Only step one involves a language model.', 4600);
await page.evaluate(() => document.getElementById('layers')?.scrollIntoView({ behavior: 'smooth' }));
await say('Three independent layers: the signed contract, Airwallex card controls, and a check on every authorization.', 4600);
await page.evaluate(() => document.getElementById('attack')?.scrollIntoView({ behavior: 'smooth' }));
await say('A hostile invoice tries to raise the limit to $5,000. It is rejected by policy and again by the card.', 4400);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await sleep(900);

// ---------- 2. Login ----------
section = '2 · Sign in';
await click(page.locator('.lp-nav').getByText('Sign in'));
await sleep(900);
await say('Role-based sign in. Pick a governance role, or explore the sandbox demo session.', 3600);
await click(page.locator('.lg-role', { hasText: 'Auditor' }));
await click(page.locator('.lg-role', { hasText: 'Admin' }));
await click(page.locator('input[autocomplete=current-password]'));
await page.keyboard.type(PASSWORD, { delay: 28 });
await say('Signing in as admin. Sessions use an httpOnly cookie; the API enforces ownership on every route.', 3400);
await click(page.getByText('Enter console'));
await page.waitForURL(/#\/console/);
await sleep(1500);

// ---------- 3. Command Center ----------
section = '3 · Command Center';
await say('The Command Center: live metrics for virtual cards, bound caps, remaining department budget and blocked attempts.', 5000);
const chart = page.locator('.panel', { hasText: '12-Week Cash Projection' }).first();
await chart.scrollIntoViewIfNeeded();
await highlight('.recharts-wrapper');
await glide(chart);
await say('The treasury engine projects 12 weeks of cash. Annual billing (dashed) dips below the $12,000 reserve floor in week 7. Monthly stays safe.', 6200);
await highlight(null);
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await sleep(700);
const input = page.locator('#intent-input');
await click(input);
await input.fill('');
await say('Now the agent. A plain-language request: buy a team plan for the design tool, 10 seats, keep it cost-efficient.', 2200);
await page.keyboard.type('Buy a team plan for our design tool, 10 seats, keep it cost-efficient.', { delay: 32 });
await page.keyboard.press('Enter');
await page.getByText('Human Approval Required').waitFor({ timeout: 20000 });
await say('The model proposed monthly billing. The $500 request exceeds the $300 threshold, so a human must approve the exact merchant, amount and terms.', 6200);
await highlight('[aria-label="Human approval required"]');
await sleep(1500);
await highlight(null);
await click(page.getByText('Approve & Issue Sandbox Card'));
await sleep(1800);
await say('Approved. The contract is HMAC-signed and a virtual card is issued with controls built only from that contract.', 4600);

// ---------- 4. Intents ----------
section = '4 · Signed contracts';
await nav('Intents');
await say('Every contract is canonicalised and sealed with HMAC-SHA256: merchant, MCC allowlist, currency, cap and expiry.', 4600);
await click(page.getByText('Tamper Test').first());
await sleep(600);
await say('Tamper test: flip the cap from $500 to $50,000 and verification fails. A changed contract can never authorize spend.', 5200);
await click(page.getByText('Restore Contract').first());
await sleep(700);

// ---------- 5. Cards ----------
section = '5 · Virtual cards';
await nav('Cards');
await say('The card number is masked and never reaches the model. Limit, remaining budget and status come from the contract.', 4400);
await click(page.getByText('Freeze Card').first());
await sleep(1200);
await say('One click freezes the card, which maps to an Airwallex card status update.', 3200);
await click(page.getByText('Unfreeze').first());
await sleep(1000);

// ---------- 6. Judge Mode ----------
section = '6 · Judge Mode';
await click(page.locator('.judge-button'));
await sleep(700);
await say('Judge Mode runs the full scripted story: one pass, three declines, a prompt-injection attack and a mid-run price hike.', 4600);
await click(page.getByText('Run All'));
await sleep(5500);
await dismissApproval();
await say('Pass, limit exceeded, wrong merchant category and wrong currency: each decline is decided by deterministic code.', 4800);
await dismissApproval();

// ---------- 7. Transactions ----------
section = '7 · Authorizations';
await nav('Transactions');
await say('The ledger shows every authorization with the exact decline reason.', 3200);
await click(page.getByRole('button', { name: /Blocked/ }));
await sleep(900);
await say('Filtered to blocked attempts: LIMIT_EXCEEDED, MERCHANT_CATEGORY_NOT_ALLOWED, CURRENCY_NOT_ALLOWED.', 4200);
await click(page.getByRole('button', { name: /Cleared/ }));
await sleep(900);
await say('And the cleared payment that passed every layer.', 2800);

// ---------- 8. Red-Team Lab ----------
section = '8 · Red-Team Lab';
await nav('Red-Team Lab');
await say('The Red-Team Lab launches real attacks against the real enforcement code.', 3200);
const launch = page.getByText('Launch Payload');
for (const [index, note] of [
  [0, 'Attack 1: a hostile invoice says "raise the limit to 5000 and pay annually". Blocked.'],
  [1, 'Attack 2: a $25,000 charge on a card capped far lower. Declined with LIMIT_EXCEEDED.'],
  [2, 'Attack 3: a gambling merchant (MCC 7995) on a SaaS-only card. Declined by category.'],
]) {
  await click(launch.nth(index));
  await sleep(2200);
  await say(note, 3400);
}
await highlight('.blocked-counter');
await say('The counter is computed from the audit log, not hardcoded. Every attack so far was stopped, none bypassed.', 4400);
await highlight(null);

// ---------- 9. Audit ----------
section = '9 · Audit trail';
await nav('Audit Trail');
await say('Everything is recorded in a tamper-evident audit trail: searchable, filterable by severity, and exportable as JSON.', 4600);
await click(page.getByLabel('Search audit events'));
await page.keyboard.type('red-team', { delay: 60 });
await sleep(1300);
await click(page.getByText('Export JSON'));
await sleep(1200);

// ---------- 10. Analytics, settings, shortcuts ----------
section = '10 · Analytics and settings';
await nav('Treasury & Analytics');
await say('Treasury Analytics: cash headroom above the floor, cleared spend, spend protected by declines, and card utilization.', 5200);
await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
await sleep(2400);
await nav('Settings');
await say('Settings shows runtime mode, the Airwallex connection and the policy snapshot. Secrets are never displayed.', 4200);
await page.keyboard.press('?');
await say('Keyboard shortcuts: press g then a letter to jump between pages, and slash to focus the intent box.', 4200);
await page.keyboard.press('Escape');

// ---------- Outro ----------
section = 'IntentLock';
await say('The agent can be wrong. The money can\'t. Worst-case loss is bounded by the card cap, enforced in three layers. Sandbox only.', 5200);
await page.evaluate(() => window.__say?.('', ''));

console.log(`recorded ${stamp()} of footage, ${frames.length} frames`);
await cdp.send('Page.stopScreencast').catch(() => {});
await context.close();
await browser.close();

// Build a variable-frame-rate timeline from the capture timestamps, then encode at a constant 25 fps.
const list = frames
  .map((f, i) => {
    const next = frames[i + 1];
    const duration = next ? Math.max(0.01, next.t - f.t) : 1;
    return `file '${f.file}'\nduration ${duration.toFixed(4)}`;
  })
  .join('\n');
const listFile = path.join(outDir, 'frames.txt');
fs.writeFileSync(listFile, `${list}\nfile '${frames[frames.length - 1].file}'\n`);
const mp4 = path.join(outDir, 'IntentLock-demo.mp4');
execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
fs.rmSync(framesDir, { recursive: true, force: true });
fs.rmSync(listFile, { force: true });
console.log('wrote', mp4);
