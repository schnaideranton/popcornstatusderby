#!/usr/bin/env node
/**
 * Popcorn Status Derby — Car PNG Batch Generator
 * ─────────────────────────────────────────────
 * Generates car card PNGs to ./generated-cars/
 * Filename: PopcornStatusDerby_{type}_{seed}.png
 *
 * Usage:
 *   node generate_cars.js [count] [level] [startSeed]
 *
 * Examples:
 *   node generate_cars.js          # 50 cars, level 50, random seeds
 *   node generate_cars.js 200      # 200 cars
 *   node generate_cars.js 200 80   # 200 cars, level 80 (more accessories)
 *   node generate_cars.js 1 50 42938471   # replay specific seed exactly
 *
 * Seed → deterministic car: same seed + same level = identical car, always.
 * The derby server must be running on port 3459:
 *   python3 -m http.server 3459 --directory /path/to/PopcornStatusDerby
 */

const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');

const COUNT      = parseInt(process.argv[2] || '50',  10);
const LEVEL      = parseInt(process.argv[3] || '50',  10);
const START_SEED = process.argv[4] ? parseInt(process.argv[4], 10) : null;

const OUT_DIR  = path.join(__dirname, 'generated-cars');
const PAGE_URL = 'http://localhost:3459/index.v3.html';

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\nPopcorn Status Derby — Car Generator`);
  console.log(`  count=${COUNT}  level=${LEVEL}  ${START_SEED !== null ? 'seed=' + START_SEED : 'seeds=random'}`);
  console.log(`  output → ${OUT_DIR}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--use-gl=angle',
      '--ignore-gpu-blocklist',
    ],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });

  const page = await browser.newPage();
  // 2× DPR so PNGs are crisp on Retina
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

  console.log(`Loading ${PAGE_URL} …`);
  await page.goto(PAGE_URL, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait until the game's batch API is ready (set at end of module script)
  await page.waitForFunction(
    () => window._PSD && window._PSD.getPlayer() && window._PSD.getPlayer().design,
    { timeout: 20000 }
  );
  console.log('Game ready ✓\n');

  const cardHandle = await page.$('#card');
  if (!cardHandle) throw new Error('#card element not found — is the game loaded?');

  // Pause physics, hide clutter, snap to clean 3/4 camera — do this once.
  await page.evaluate(() => window._PSD.enterBatchMode());
  // Let the frame settle after hiding all the clutter
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

  const generated = [];
  const t0 = Date.now();

  for (let i = 0; i < COUNT; i++) {
    // Pick seed: startSeed + offset, or fresh random per iteration
    const seed = START_SEED !== null
      ? START_SEED + i
      : (Math.floor(Math.random() * 0xFFFFFFFE) + 1);

    // Generate car + rebuild 3D + update card stats
    const info = await page.evaluate(({ seed, level }) => {
      const api    = window._PSD;
      const player = api.getPlayer();
      api.applyTier(player, level, seed);
      api.rebuildConstructorPreview();
      api.updateCardBottom();
      return {
        seed: player.designSeed,
        type: player.bodyType || 'car',
      };
    }, { seed, level: LEVEL });

    // Two animation frames — Three.js renders on the next tick
    await page.evaluate(() =>
      new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    );

    const filename = `PopcornStatusDerby_${info.type}_${info.seed}.png`;
    const outPath  = path.join(OUT_DIR, filename);

    await cardHandle.screenshot({ path: outPath });
    generated.push({ filename, seed: info.seed, type: info.type });

    const pct  = Math.round((i + 1) / COUNT * 100);
    const rate = ((i + 1) / ((Date.now() - t0) / 1000)).toFixed(1);
    process.stdout.write(`\r  [${String(i + 1).padStart(String(COUNT).length)}/${COUNT}] ${pct}%  ${rate} cars/s   `);
  }

  await browser.close();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n\nDone! ${generated.length} PNGs in ${elapsed}s`);
  console.log(`  → ${OUT_DIR}/\n`);
  console.log('Replay a specific car:');
  if (generated.length > 0) {
    const ex = generated[0];
    console.log(`  node generate_cars.js 1 ${LEVEL} ${ex.seed}  # reproduces ${ex.filename}\n`);
  }
})().catch(err => {
  console.error('\n\nFailed:', err.message);
  process.exit(1);
});
