import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const recordingsDir = path.join(rootDir, 'recordings');

if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function waitForUrl(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404 || res.status === 200 || res.status === 304) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function main() {
  console.log('--- Starting API Server (DEMO_MODE=live) ---');
  const apiProc = spawn('node', ['apps/api/dist/server.js'], {
    cwd: rootDir,
    stdio: 'pipe',
    env: { ...process.env, DEMO_MODE: 'live' }
  });
  apiProc.stdout.on('data', (d) => process.stdout.write(`[API] ${d}`));
  apiProc.stderr.on('data', (d) => process.stderr.write(`[API-ERR] ${d}`));

  console.log('--- Starting Vite Web Client ---');
  const webProc = spawn('npx', ['vite', '--port', '5173'], {
    cwd: path.join(rootDir, 'apps/web'),
    stdio: 'pipe',
    shell: true,
  });
  webProc.stdout.on('data', (d) => process.stdout.write(`[WEB] ${d}`));
  webProc.stderr.on('data', (d) => process.stderr.write(`[WEB-ERR] ${d}`));

  let browser;
  let context;
  try {
    await waitForUrl('http://localhost:4100/health');
    console.log('API Server is ready.');
    await waitForUrl('http://localhost:5173');
    console.log('Web Server is ready.');

    console.log('--- Launching Chrome for Complete Live Demo Walkthrough ---');
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720']
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: recordingsDir,
        size: { width: 1280, height: 720 }
      }
    });

    const page = await context.newPage();

    // 1. LOGIN
    console.log('Step 1: Logging into IntentLock...');
    await page.goto('http://localhost:5173/#/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.fill('admin@intentlock.io');
    await passwordInput.fill('IntentLockAdmin2026!Secure');
    await page.waitForTimeout(600);

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // 2. COMMAND CENTER: SUBMITTING INTENT PROMPTS
    console.log('Step 2: Command Center - Natural Language Intent Submission...');
    try {
      await page.waitForSelector('.hero-intent-card', { timeout: 8000 });
    } catch {
      await page.goto('http://localhost:5173/#/console', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    }

    // Submit Prompt 1
    const intentInput = page.locator('.hero-intent-card input[type="text"]');
    if (await intentInput.isVisible()) {
      console.log('Submitting purchase request: Team plan for design tool...');
      await intentInput.fill('Buy a team plan for our design tool, 10 seats, keep it cost-efficient.');
      await page.waitForTimeout(800);
      const proposeBtn = page.locator('.hero-intent-card button:has-text("Propose")');
      if (await proposeBtn.isVisible()) {
        await proposeBtn.click();
        await page.waitForTimeout(2500);
      }
    }

    // Submit Prompt 2
    if (await intentInput.isVisible()) {
      console.log('Submitting purchase request: Render cluster instances...');
      await intentInput.fill('Render cluster instances, cap $450 for model training');
      await page.waitForTimeout(800);
      const proposeBtn = page.locator('.hero-intent-card button:has-text("Propose")');
      if (await proposeBtn.isVisible()) {
        await proposeBtn.click();
        await page.waitForTimeout(2500);
      }
    }

    // 3. STEPPING THROUGH JUDGE MODE (7 LIVE TRACKS)
    console.log('Step 3: Stepping through Judge Mode Runtime Scenarios...');
    const nextBtn = page.locator('button:has-text("Next Step")');
    for (let s = 1; s <= 7; s++) {
      console.log(`Executing Judge Track ${s}/7...`);
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Scroll Command Center to show Runway Chart & Enforcement Stack
    console.log('Inspecting Runway Chart & 3-Layer Enforcement Stack...');
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    // 4. INTENTS & CONTRACT GOVERNANCE
    console.log('Step 4: Navigating to Cryptographic Purchase Intents...');
    await page.goto('http://localhost:5173/#/intents', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // If any contract has "Approve", click it to demonstrate human-in-the-loop approval
    const approveBtn = page.locator('button:has-text("Approve Contract"), button:has-text("Approve")').first();
    if (await approveBtn.isVisible()) {
      console.log('Approving pending intent contract...');
      await approveBtn.click();
      await page.waitForTimeout(2000);
    }
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    // 5. CARDS MANAGEMENT (ADD, FREEZE, UNFREEZE)
    console.log('Step 5: Navigating to Cards Page - Adding & Freezing Cards...');
    await page.goto('http://localhost:5173/#/cards', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Find Freeze button on first active card
    const freezeBtn = page.locator('button:has-text("Freeze"), button:has-text("Freeze Card")').first();
    if (await freezeBtn.isVisible()) {
      console.log('Toggling card freeze...');
      await freezeBtn.click();
      await page.waitForTimeout(2500);
      console.log('Toggling card unfreeze...');
      const unfreezeBtn = page.locator('button:has-text("Unfreeze"), button:has-text("Unfreeze Card")').first();
      if (await unfreezeBtn.isVisible()) {
        await unfreezeBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // 6. TRANSACTIONS & AIRWALLEX FAILURE REASONS
    console.log('Step 6: Navigating to Transactions Page - Verifying Live Declines & Clearances...');
    await page.goto('http://localhost:5173/#/transactions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(2500);

    // 7. RED-TEAM LAB (ADVERSARIAL ATTACKS)
    console.log('Step 7: Navigating to Red-Team Security Lab...');
    await page.goto('http://localhost:5173/#/redteam', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const attackBtn = page.locator('button:has-text("Run Test"), button:has-text("Simulate Attack")').first();
    if (await attackBtn.isVisible()) {
      console.log('Executing adversarial prompt injection attack...');
      await attackBtn.click();
      await page.waitForTimeout(3000);
    }
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    // 8. CAPITALIO TREASURY INTELLIGENCE
    console.log('Step 8: Navigating to Capitalio Treasury Intelligence...');
    await page.goto('http://localhost:5173/#/analytics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(2500);

    // 9. AUDIT TRAIL
    console.log('Step 9: Navigating to Audit Trail...');
    await page.goto('http://localhost:5173/#/audit', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    console.log('Finalizing video recording...');
    const videoObj = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (videoObj) {
      const videoPath = await videoObj.path();
      const finalVideoPath = path.join(recordingsDir, 'intentlock-live-demo-walkthrough.webm');
      fs.copyFileSync(videoPath, finalVideoPath);
      const stat = fs.statSync(finalVideoPath);
      console.log(`\n======================================================`);
      console.log(`>>> COMPLETE LIVE DEMO WALKTHROUGH RECORDED!`);
      console.log(`>>> FILE PATH: ${finalVideoPath}`);
      console.log(`>>> FILE SIZE: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`======================================================\n`);
    }

  } finally {
    console.log('Stopping background servers...');
    try { apiProc.kill(); } catch {}
    try { webProc.kill(); } catch {}
  }
}

main().catch((err) => {
  console.error('Live demo recording error:', err);
  process.exit(1);
});

