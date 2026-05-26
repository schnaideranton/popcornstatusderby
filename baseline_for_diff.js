#!/usr/bin/env node
// Anton 2026-05-26: produce baseline designs for the new garage cars so we
// can diff "what the algorithm would have made for this seed" vs "what Anton
// hand-saved". Output goes to baseline_designs.json keyed by seed.

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');

const NEW_FILES_DIR = path.join(__dirname, 'Best Body Config Anton', 'untitled folder');
const PAGE_URL = 'http://localhost:3459/index.v3.html';
const OUT_FILE = path.join(__dirname, 'baseline_designs.json');

(async () => {
  // Collect (seed, level, type, name, savedDesign) from every JSON in untitled folder
  const saved = [];
  for (const fn of fs.readdirSync(NEW_FILES_DIR)) {
    if (!fn.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(NEW_FILES_DIR, fn), 'utf8'));
    saved.push({
      file: fn,
      seed: d.seed,
      level: d.level,
      type: d.type,
      name: d.name,
      savedDesign: d.design,
    });
  }
  console.log(`Loading ${saved.length} saved cars from untitled folder`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl'],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });
  await page.goto(PAGE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(
    () => window._PSD && window._PSD.getPlayer() && window._PSD.getPlayer().design,
    { timeout: 20000 }
  );

  const out = [];
  for (const s of saved) {
    const baseline = await page.evaluate(({ seed, level }) => {
      const api = window._PSD;
      const player = api.getPlayer();
      api.applyTier(player, level, seed);
      // Return a deep clone of design so it's serialisable
      return { design: JSON.parse(JSON.stringify(player.design)), type: player.bodyType };
    }, { seed: s.seed, level: s.level });
    out.push({
      file: s.file,
      seed: s.seed,
      level: s.level,
      savedType: s.type,
      baselineType: baseline.type,
      baselineDesign: baseline.design,
      savedDesign: s.savedDesign,
    });
    process.stdout.write(`  ${s.file}  baseline=${baseline.type}  saved=${s.type}\n`);
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${out.length} baseline+saved pairs → ${OUT_FILE}`);
  await browser.close();
})().catch(e => {
  console.error('Failed:', e.message);
  process.exit(1);
});
