const { chromium } = require('playwright');

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[BROWSER UNCAUGHT EXCEPTION]: ${err.stack || err.message}`);
  });

  console.log('Navigating to http://localhost:3000/ ...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  // Wait a second for animations
  await page.waitForTimeout(1000);

  console.log('Extracting hero section HTML...');
  const heroHtml = await page.$eval('section.relative', el => el.outerHTML);
  console.log('--- HERO SECTION HTML ---');
  console.log(heroHtml);
  console.log('-------------------------');

  console.log('Closing browser...');
  await browser.close();
}

main().catch(err => {
  console.error('Error in script:', err);
});
