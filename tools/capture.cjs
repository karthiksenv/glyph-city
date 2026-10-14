'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, launchOptions } = require('./browser.cjs');
(async () => {
  const browser = await chromium.launch(launchOptions);
  const root = path.resolve(__dirname, '..');
  const errors = [];
  const snapshots = {};
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
      await page.waitForFunction(() => window.CityDebug && CityDebug.snapshot().frames > 5, null, { timeout: 45000 });
      if (mobile) await page.locator('#enterButton').tap();
      await page.waitForTimeout(4200);
      const key = mobile ? 'mobile' : 'desktop';
      snapshots[key] = await page.evaluate(() => CityDebug.snapshot());
      assert.equal(snapshots[key].glError, 0);
      await page.screenshot({ path: path.join(root, 'screenshots', 'city-' + key + '.png') });
      if (!mobile) {
        await page.evaluate(() => {
          const w = CityDebug.world;
          Object.assign(w.player, { x: -210, z: -230, y: 110, vx: 0, vy: 0, vz: 0, pitch: -0.40, yaw: 0.40 });
          w.fly = true; w.hour = 13; w.weather = 'clear'; w.timeAuto = false;
        });
        await page.waitForTimeout(600);
        assert.equal(await page.evaluate(() => CityDebug.snapshot().glError), 0);
        await page.screenshot({ path: path.join(root, 'screenshots', 'city-flight.png') });
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ checks: 'Final shader compilation, warmed desktop/mobile render, daytime flight render', snapshots, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
