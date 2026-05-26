#!/usr/bin/env node
/**
 * Popcorn Status Derby — Car PNG Batch Generator (studio mode)
 * ─────────────────────────────────────────────────────────────
 * Renders each car on a clean neutral background (no road, no HUD, no AI),
 * using a constructor-style 3/4 telephoto view. Filename includes the seed
 * so any image can be replayed by running this script with that seed.
 *
 *   PopcornStatusDerby_{type}_{seed}.png
 *
 * Usage:
 *   node generate_cars.js [count] [level] [startSeed]
 *
 *   node generate_cars.js                # 50 cars, level 50, random seeds
 *   node generate_cars.js 1000           # 1000 cars
 *   node generate_cars.js 1000 50        # 1000 cars at level 50
 *   node generate_cars.js 1 50 42938471  # replay one specific seed exactly
 *
 * Requires the local server running on port 3459:
 *   python3 -m http.server 3459 --directory /path/to/PopcornStatusDerby
 */

const puppeteer = require('puppeteer');
const path      = require('path');
const fs        = require('fs');

const COUNT      = parseInt(process.argv[2] || '50',  10);
const LEVEL      = parseInt(process.argv[3] || '50',  10);
const START_SEED = process.argv[4] ? parseInt(process.argv[4], 10) : null;

// Output dimensions (studio canvas, in PIXELS). 1280×1024 is a good balance of
// detail vs file size. PNG goes through canvas.toDataURL → fs.writeFileSync.
const OUT_W = 1280;
const OUT_H = 1024;
const BG_HEX = 0xeeeeee;   // neutral light grey background

const OUT_DIR  = path.join(__dirname, 'generated-cars');
const PAGE_URL = 'http://localhost:3459/index.v3.html';

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\nPopcorn Status Derby — Car Generator (studio)`);
  console.log(`  count=${COUNT}  level=${LEVEL}  ${START_SEED !== null ? 'seed=' + START_SEED : 'seeds=random'}`);
  console.log(`  size=${OUT_W}x${OUT_H}  bg=#${BG_HEX.toString(16).padStart(6, '0')}`);
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
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  console.log(`Loading ${PAGE_URL} …`);
  await page.goto(PAGE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(
    () => window._PSD && window._PSD.getPlayer() && window._PSD.getPlayer().design,
    { timeout: 20000 }
  );
  console.log('Game ready ✓');

  // Studio mode hides everything except the car + its lights, swaps the
  // background to neutral, drops fog. We stay in this mode for the whole loop.
  await page.evaluate((bg) => window._PSD.enterStudioMode(bg), BG_HEX);
  // Let the layout settle before the first shot
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  console.log('Studio mode ✓\n');

  const generated = [];
  const t0 = Date.now();

  // strip the "data:image/png;base64," prefix
  const stripDataURL = (s) => s.replace(/^data:image\/png;base64,/, '');

  for (let i = 0; i < COUNT; i++) {
    const seed = START_SEED !== null
      ? START_SEED + i
      : (Math.floor(Math.random() * 0xFFFFFFFE) + 1);

    // 1) Re-roll the car with this seed and rebuild the visual.
    const info = await page.evaluate(({ seed, level }) => {
      const api    = window._PSD;
      const player = api.getPlayer();
      api.applyTier(player, level, seed);
      api.rebuildConstructorPreview();
      return { seed: player.designSeed, type: player.bodyType || 'car' };
    }, { seed, level: LEVEL });

    // 2) Wait two animation frames so Three.js mesh rebuild + wheel pin take effect.
    await page.evaluate(() =>
      new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    );

    // 3) Render to an off-screen-sized framebuffer and grab the PNG dataURL.
    const dataURL = await page.evaluate(({ w, h }) => window._PSD.renderStudio(w, h), { w: OUT_W, h: OUT_H });

    // 4) Save PNG. dataURL is base64 PNG.
    const filename = `PopcornStatusDerby_${info.type}_${info.seed}.png`;
    const outPath  = path.join(OUT_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(stripDataURL(dataURL), 'base64'));

    generated.push({ filename, seed: info.seed, type: info.type });

    const pct  = Math.round((i + 1) / COUNT * 100);
    const rate = ((i + 1) / ((Date.now() - t0) / 1000)).toFixed(1);
    process.stdout.write(`\r  [${String(i + 1).padStart(String(COUNT).length)}/${COUNT}] ${pct}%  ${rate} cars/s   `);
  }

  // Clean up: exit studio mode so the page returns to normal (not strictly
  // needed since we're about to close the browser, but tidy).
  await page.evaluate(() => window._PSD.exitStudioMode());
  await browser.close();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n\nDone! ${generated.length} PNGs in ${elapsed}s`);
  console.log(`  → ${OUT_DIR}/\n`);
  if (generated.length > 0) {
    const ex = generated[0];
    console.log(`Replay a specific car:`);
    console.log(`  node generate_cars.js 1 ${LEVEL} ${ex.seed}\n`);
  }
})().catch(err => {
  console.error('\n\nFailed:', err.message);
  process.exit(1);
});
