import { webkit } from 'playwright';
import { join } from 'path';

async function runTest() {
  console.log('Launching browser...');
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const consoleMessages: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    console.log(`[Browser Console] ${msg.type()}: ${text}`);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    } else {
      consoleMessages.push(text);
    }
  });

  page.on('pageerror', (err) => {
    console.error('[Browser Error]', err.message);
    consoleErrors.push(err.message);
  });

  console.log('Navigating to http://localhost:5173/appvid/ ...');
  await page.goto('http://localhost:5173/appvid/');

  // Wait for the import zone to be visible
  await page.waitForSelector('.import-dropzone');
  console.log('Landing page loaded successfully!');

  const videoPath = '/Volumes/Projects/dev/strobopro_dev/strobopro-appvid.mp4';
  console.log(`Uploading test video file: ${videoPath}`);
  
  // Set the file input
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    throw new Error('File input element not found!');
  }
  await fileInput.setInputFiles(videoPath);

  console.log('Waiting for metadata analysis...');
  // Wait for either the metadata panel or an error warning
  await page.waitForTimeout(5000);

  // Check if warning-item red exists
  const hasErrorCard = await page.$('.warning-item.red');
  if (hasErrorCard) {
    const errorText = await page.textContent('.warning-item.red');
    console.error('Found import error card on page:', errorText);
  }

  // Check if metadata-panel exists
  const hasMetadataPanel = await page.$('.metadata-panel');
  if (hasMetadataPanel) {
    console.log('Metadata panel successfully rendered!');
    const metadataText = await page.textContent('.metadata-panel');
    console.log('Metadata content:\n', metadataText);
  } else {
    console.log('Metadata panel NOT found!');
  }

  console.log('Closing browser...');
  await browser.close();

  console.log('\n--- Test Summary ---');
  if (consoleErrors.length > 0) {
    console.error(`FAIL: Found ${consoleErrors.length} console errors during run:`);
    consoleErrors.forEach((err) => console.error(`- ${err}`));
    process.exit(1);
  } else {
    console.log('PASS: No console errors or CSP violations detected!');
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
