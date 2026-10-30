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

    console.log('--- Launching Browser with Video Recording ---');
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

    console.log('1. Navigating to Login page...');
    await page.goto('http://localhost:5173/#/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('2. Logging in as Admin...');
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.fill('admin@intentlock.io');
    await passwordInput.fill('IntentLockAdmin2026!Secure');
    await page.waitForTimeout(600);
    
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await page.waitForTimeout(2500);

    console.log('3. At Command Center: stepping through Judge Mode...');
    try {
      await page.waitForSelector('.judge-bar', { timeout: 8000 });
    } catch {
      console.log('Direct navigation to console hash...');
      await page.goto('http://localhost:5173/#/console', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
    }

    // Step sequentially through Judge Mode scenarios 1 through 7
    const nextBtn = page.locator('button:has-text("Next Step")');
    for (let step = 1; step <= 7; step++) {
      console.log(`Running Judge Step ${step}/7...`);
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(2500);
      }
    }

    console.log('Judge steps completed. Showcasing Command Center...');
    await page.evaluate(() => window.scrollBy({ top: 320, behavior: 'smooth' }));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1200);

    console.log('4. Navigating to Cards Page to inspect real Airwallex card IDs...');
    await page.goto('http://localhost:5173/#/cards', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    console.log('5. Navigating to Transactions Page to verify Airwallex failure reasons...');
    await page.goto('http://localhost:5173/#/transactions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(2500);

    console.log('6. Navigating to Capitalio Treasury Analytics...');
    await page.goto('http://localhost:5173/#/analytics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    console.log('7. Navigating to Audit Trail...');
    await page.goto('http://localhost:5173/#/audit', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    console.log('Finalizing recording...');
    const videoObj = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (videoObj) {
      const videoPath = await videoObj.path();
      const finalVideoPath = path.join(recordingsDir, 'intentlock-live-judge-run.webm');
      fs.copyFileSync(videoPath, finalVideoPath);
      const stat = fs.statSync(finalVideoPath);
      console.log(`\n======================================================`);
      console.log(`>>> VIDEO RECORDING COMPLETE: ${finalVideoPath}`);
      console.log(`>>> FILE SIZE: ${(stat.size / 1024).toFixed(1)} KB`);
      console.log(`======================================================\n`);
    }

  } finally {
    console.log('Terminating background servers...');
    try { apiProc.kill(); } catch {}
    try { webProc.kill(); } catch {}
  }
}

main().catch((err) => {
  console.error('Recording script error:', err);
  process.exit(1);
});
