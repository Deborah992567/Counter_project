const puppeteer = require('puppeteer-core');
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const root = __dirname.replace(/test$/, '');
  await page.goto('file://' + root + 'index.html');
  await new Promise((r) => setTimeout(r, 400));

  const display = await page.$('#counter-display');
  const get = () => display.evaluate((el) => el.textContent);
  const results = [];

  const initial = await get();
  results.push(['initial is 0', initial === '0', initial]);

  await page.click('#increase');
  await new Promise((r) => setTimeout(r, 120));
  const afterInc = await get();
  results.push(['increment to 1', afterInc === '1', afterInc]);

  await page.click('#decrease');
  await new Promise((r) => setTimeout(r, 120));
  const afterDec = await get();
  results.push(['decrement to 0', afterDec === '0', afterDec]);

  await page.click('#undo-btn');
  await new Promise((r) => setTimeout(r, 120));
  const afterUndo = await get();
  results.push(['undo restores 1', afterUndo === '1', afterUndo]);

  await page.click('[data-mult="5"]');
  for (let i = 0; i < 3; i++) { await page.click('#increase'); }
  await new Promise((r) => setTimeout(r, 120));
  const afterPreset = await get();
  results.push(['stepx5 increments to 16', afterPreset === '16', afterPreset]);

  await page.keyboard.press('0');
  await new Promise((r) => setTimeout(r, 120));
  const afterResetKey = await get();
  results.push(['0 key resets to 0', afterResetKey === '0', afterResetKey]);

  const ml = await page.$eval('#milestone-label', (el) => el.textContent);
  results.push(['milestone next 100', ml === 'Next: 100', ml]);

  const total = await page.$eval('#stat-total', (el) => el.textContent);
  results.push(['stat total is 6', total === '6', total]);

  let fail = 0;
  for (const [name, ok, got] of results) {
    console.log((ok ? 'PASS' : 'FAIL') + ': ' + name + (ok ? '' : ' (got ' + got + ')'));
    if (!ok) fail++;
  }
  if (errors.length) {
    fail += errors.length;
    console.log('RUNTIME ERRORS:');
    errors.forEach((e) => console.log('  ' + e));
  }
  console.log(errors.length ? '' : 'RUNTIME ERRORS: none');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();

