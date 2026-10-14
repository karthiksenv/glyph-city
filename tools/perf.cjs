'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, launchOptions } = require('./browser.cjs');
(async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    page.on('pageerror', error => console.error(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
    await page.waitForFunction(() => window.CityDebug && CityDebug.snapshot().frames > 3, null, { timeout: 45000 });
    console.log(JSON.stringify(await page.evaluate(() => {
      const gl = CityDebug.renderer.gl, extension = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: extension && gl.getParameter(extension.UNMASKED_RENDERER_WEBGL), userAgent: navigator.userAgent };
    })));
    await page.waitForTimeout(3000);
    const begin = await page.evaluate(() => ({ now: performance.now(), ...CityDebug.snapshot() }));
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000);
      console.log(JSON.stringify(await page.evaluate(() => ({ now: performance.now(), ...CityDebug.snapshot(), autoScale: CityDebug.renderer.autoScale }))));
    }
    const end = await page.evaluate(() => ({ now: performance.now(), ...CityDebug.snapshot() }));
    console.log(JSON.stringify({ averagedFps: (end.frames - begin.frames) / ((end.now - begin.now) / 1000), seconds: (end.now - begin.now) / 1000, frames: end.frames - begin.frames }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
