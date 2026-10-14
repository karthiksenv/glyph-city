'use strict';
// Browser tests are optional; the game itself has no dependencies.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const launchOptions = {
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
};
module.exports = { chromium, launchOptions };
