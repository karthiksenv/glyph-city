'use strict';
// Run with Node and Playwright. The game is loaded offline; no server is required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, launchOptions } = require('./browser.cjs');
const root = path.resolve(__dirname, '..');
const entry = path.resolve(root, process.argv.find(arg => arg.endsWith('.html')) || 'index.html');
const screenshots = path.join(root, 'screenshots');
const checks = [];
const errors = [];
const network = [];
const snapshots = {};
fs.mkdirSync(screenshots, { recursive: true });
function check(name, assertion) { assertion(); checks.push(name); }
async function hold(page, key, milliseconds) {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}
async function snapshot(page) { return page.evaluate(() => window.CityDebug.snapshot()); }
async function ready(page) {
  await page.waitForFunction(() => window.CityDebug && window.CityDebug.snapshot().frames > 3, null, { timeout: 45000 });
}
async function watch(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
}
(async () => {
  assert.ok(fs.existsSync(entry), 'Build index.html before running browser smoke tests.');
  const args = [...launchOptions.args];
  if (process.argv.includes('--software')) args.push('--use-angle=swiftshader');
  const browser = await chromium.launch({ ...launchOptions, args });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await watch(page);
    await page.goto(pathToFileURL(entry).href, { waitUntil: 'load' });
    await ready(page);
    await page.waitForTimeout(3200);
    snapshots.boot = await snapshot(page);
    check('Offline file boots WebGL renderer without uncaught exceptions', () => {
      assert.equal(errors.length, 0, errors.join('\n'));
      assert.equal(snapshots.boot.glError, 0);
      assert.ok(snapshots.boot.frames > 3);
      assert.ok(snapshots.boot.cols >= 60 && snapshots.boot.rows >= 35);
    });
    const pixelStats = await page.evaluate(() => {
      const gl = CityDebug.renderer.gl;
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let lit = 0, dark = 0;
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 16) {
        const brightness = pixels[i] + pixels[i + 1] + pixels[i + 2];
        if (brightness > 100) lit++;
        if (brightness < 45) dark++;
        colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
      }
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      return { lit, dark, colors: colors.size, renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
    });
    snapshots.pixels = pixelStats;
    check('Scene contains colored glyphs and dark inter-glyph space', () => {
      assert.ok(pixelStats.lit > 100, JSON.stringify(pixelStats));
      assert.ok(pixelStats.dark > 100, JSON.stringify(pixelStats));
      assert.ok(pixelStats.colors > 100, JSON.stringify(pixelStats));
    });
    await page.screenshot({ path: path.join(screenshots, 'city-desktop.png') });
    await page.locator('#enterButton').click();
    await page.waitForTimeout(300);
    const beforeMove = await snapshot(page);
    await hold(page, 'w', 1200);
    const afterMove = await snapshot(page);
    check('Enter and WASD movement work without relying on pointer lock', () => {
      assert.ok(afterMove.started);
      assert.ok(Math.hypot(afterMove.player.x - beforeMove.player.x, afterMove.player.z - beforeMove.player.z) > 0.1);
    });
    await page.keyboard.press('f');
    const beforeFly = await snapshot(page);
    await hold(page, 'Space', 1400);
    snapshots.flight = await snapshot(page);
    check('Flight key toggles flight and Space raises altitude', () => {
      assert.ok(snapshots.flight.flight);
      assert.ok(snapshots.flight.player.y > beforeFly.player.y + 0.1);
    });
    const beforeTurn = await snapshot(page);
    await hold(page, 'ArrowRight', 400);
    const afterTurn = await snapshot(page);
    check('Keyboard look changes camera yaw', () => assert.notEqual(afterTurn.player.yaw, beforeTurn.player.yaw));
    const beforeWeather = await snapshot(page);
    await page.keyboard.press('r');
    await page.keyboard.press('t');
    const afterWeather = await snapshot(page);
    check('Time and weather shortcuts change environment', () => {
      assert.notEqual(beforeWeather.weather, afterWeather.weather);
      assert.ok(Math.abs(beforeWeather.hour - afterWeather.hour) > 0.2);
    });
    await page.keyboard.press('Escape');
    // Synthetic Escape lacks Chrome's native pointer-lock release gesture.
    await page.evaluate(() => document.exitPointerLock?.());
    await page.waitForTimeout(100);
    await page.locator('#settingsButton').click();
    await page.locator('#qualitySelect').selectOption('performance');
    await page.locator('#cycleToggle').uncheck();
    await page.locator('#weatherCycleToggle').uncheck();
    await page.locator('[data-close="settingsPanel"]').click();
    await page.waitForTimeout(200);
    const settings = await page.evaluate(() => ({
      quality: CityDebug.renderer.quality,
      cycle: document.querySelector('#cycleToggle').checked,
      weatherCycle: document.querySelector('#weatherCycleToggle').checked,
      modalHidden: document.querySelector('#settingsPanel').hidden,
      map: !!document.querySelector('#minimap').getContext('2d').getImageData(0, 0, 240, 200).data.some((value, index) => index % 4 !== 3 && value > 0)
    }));
    check('Settings apply character density and cycle preferences; minimap is drawn', () => {
      assert.equal(settings.quality, 'performance');
      assert.equal(settings.cycle, false);
      assert.equal(settings.weatherCycle, false);
      assert.equal(settings.modalHidden, true);
      assert.equal(settings.map, true);
    });
    const pausedHour = (await snapshot(page)).hour;
    await page.waitForTimeout(300);
    const pausedCycles = await snapshot(page);
    check('Disabled environment cycles stay stopped while simulation runs', () => {
      assert.equal(pausedCycles.hour, pausedHour);
      assert.equal(pausedCycles.weatherAuto, false);
    });
    await page.locator('#helpButton').click();
    assert.equal(await page.locator('#helpPanel').isVisible(), true);
    await page.locator('[data-close="helpPanel"]').click();
    check('Help opens and closes', () => {});
    await page.evaluate(() => {
      const w = CityDebug.world;
      Object.assign(w.player, { x: -210, z: -230, y: 110, vx: 0, vy: 0, vz: 0, pitch: -0.40, yaw: 0.40 });
      w.fly = true;
    });
    await page.waitForTimeout(350);
    snapshots.exploration = await snapshot(page);
    await page.screenshot({ path: path.join(screenshots, 'city-flight.png') });
    check('New negative-coordinate neighborhood renders with finite state', () => {
      assert.ok(snapshots.exploration.district.x < 0 && snapshots.exploration.district.z < 0);
      assert.equal(snapshots.exploration.glError, 0);
      for (const value of Object.values(snapshots.exploration.player)) assert.ok(Number.isFinite(value));
    });
    await context.close();
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const mobile = await mobileContext.newPage();
    await watch(mobile);
    await mobile.goto(pathToFileURL(entry).href, { waitUntil: 'load' });
    await ready(mobile);
    await mobile.locator('#enterButton').tap();
    await mobile.waitForTimeout(250);
    snapshots.mobile = await snapshot(mobile);
    const mobileLayout = await mobile.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      touches: getComputedStyle(document.querySelector('#touchControls')).display,
      canvas: document.querySelector('#city').getBoundingClientRect().toJSON(),
      enterHidden: getComputedStyle(document.querySelector('#enterButton')).display === 'none'
    }));
    check('Mobile layout fits viewport and exposes touch controls', () => {
      assert.ok(mobileLayout.scroll <= mobileLayout.width);
      assert.notEqual(mobileLayout.touches, 'none');
      assert.ok(mobileLayout.enterHidden);
      assert.equal(snapshots.mobile.glError, 0);
    });
    const touchSession = await mobileContext.newCDPSession(mobile);
    const forwardBox = await mobile.locator('[data-touch="forward"]').boundingBox();
    const beforeTouch = await snapshot(mobile);
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: forwardBox.x + forwardBox.width / 2, y: forwardBox.y + forwardBox.height / 2 }] });
    await mobile.waitForTimeout(600);
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const afterTouch = await snapshot(mobile);
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 450 }] });
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 245, y: 460 }] });
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const afterSwipe = await snapshot(mobile);
    check('Native mobile touch pad movement and swipe-look operate', () => {
      assert.ok(Math.hypot(afterTouch.player.x - beforeTouch.player.x, afterTouch.player.z - beforeTouch.player.z) > 0.1);
      assert.notEqual(afterSwipe.player.yaw, afterTouch.player.yaw);
    });
    await mobile.screenshot({ path: path.join(screenshots, 'city-mobile.png') });
    await mobileContext.close();
    check('All browser interactions remain offline and error-free', () => {
      assert.deepEqual(network, []);
      assert.deepEqual(errors, []);
    });
    const report = { passed: checks.length, checks, snapshots, externalRequests: network, errors };
    fs.writeFileSync(path.join(screenshots, 'smoke-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); console.error(JSON.stringify({ checks, snapshots, errors, network }, null, 2)); process.exitCode = 1; });
