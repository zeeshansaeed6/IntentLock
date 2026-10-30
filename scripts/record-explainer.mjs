import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const recordingsDir = path.join(rootDir, 'recordings');
const presentationHtmlPath = path.join(__dirname, 'presentation.html');

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

    console.log('=== PART 1: EXPLAINER & PITCH PRESENTATION SLIDES ===');
    const presentationUrl = pathToFileURL(presentationHtmlPath).href;
    await page.goto(presentationUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Slide 1: Title & Hook
    console.log('Presenting Slide 1: Vision & Hook...');
    await page.evaluate(() => window.setSlide(0));
    await page.waitForTimeout(4500);

    // Slide 2: The Core Problem
    console.log('Presenting Slide 2: The AI Spend Problem...');
    await page.evaluate(() => window.setSlide(1));
    await page.waitForTimeout(4500);

    // Slide 3: 3-Layer Architecture
    console.log('Presenting Slide 3: 3-Layer Architecture...');
    await page.evaluate(() => window.setSlide(2));
    await page.waitForTimeout(4500);

    // Slide 4: Real Airwallex Live Mode Proof
    console.log('Presenting Slide 4: Live Airwallex Proof Table...');
    await page.evaluate(() => window.setSlide(3));
    await page.waitForTimeout(5000);

    // Slide 5: The 7-Step Judge Suite
    console.log('Presenting Slide 5: 7-Step Judge Mode...');
    await page.evaluate(() => window.setSlide(4));
    await page.waitForTimeout(4500);

    // Slide 6: Capitalio Analytics & Enterprise Security
    console.log('Presenting Slide 6: Capitalio & Enterprise Ready...');
    await page.evaluate(() => window.setSlide(5));
    await page.waitForTimeout(4000);

    console.log('=== PART 2: LIVE PRODUCT DEMO CUTAWAY ===');
    console.log('Navigating to Live App Command Center...');
    await page.goto('http://localhost:5173/#/console', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Step through the Judge Mode live in the UI
    const nextBtn = page.locator('button:has-text("Next Step")');
    for (let s = 1; s <= 7; s++) {
      console.log(`Live Demo: Executing Judge Mode Track ${s}/7...`);
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    console.log('Live Demo: Showcasing Command Center Runway & Telemetry...');
    await page.evaluate(() => window.scrollBy({ top: 320, behavior: 'smooth' }));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    console.log('Live Demo: Inspecting Cards page with real Airwallex card IDs...');
    await page.goto('http://localhost:5173/#/cards', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    console.log('Live Demo: Inspecting Transactions page with genuine failure reasons...');
    await page.goto('http://localhost:5173/#/transactions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    console.log('Live Demo: Capitalio Treasury Analytics...');
    await page.goto('http://localhost:5173/#/analytics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    console.log('Live Demo: Audit Trail...');
    await page.goto('http://localhost:5173/#/audit', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('Finalizing video recording...');
    const videoObj = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (videoObj) {
      const videoPath = await videoObj.path();
      const finalVideoPath = path.join(recordingsDir, 'intentlock-explainer-pitch.webm');
      fs.copyFileSync(videoPath, finalVideoPath);
      const stat = fs.statSync(finalVideoPath);
      console.log(`\n======================================================`);
      console.log(`>>> COMPLETE EXPLAINER & PITCH VIDEO RECORDED!`);
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
  console.error('Explainer recording error:', err);
  process.exit(1);
});

