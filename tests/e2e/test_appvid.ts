import { webkit } from 'playwright';

async function runTest() {
  // Generate random offsets in seconds
  const offset1 = parseFloat((Math.random() * 5).toFixed(2));
  const offset2 = parseFloat((6 + Math.random() * 14).toFixed(2));
  
  console.log(`Generated random placement offsets:`);
  console.log(`- Segment 1: ${offset1}s`);
  console.log(`- Segment 2: ${offset2}s`);

  console.log('Launching browser...');
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const consoleMessages: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    // Suppress verbose HMR debug logs in output
    if (!text.includes('[vite]')) {
      console.log(`[Browser Console] ${msg.type()}: ${text}`);
    }
    if (msg.type() === 'error') {
      if (
        text.includes('Failed to load resource') ||
        text.includes('403') ||
        text.includes('googlesyndication') ||
        text.includes('pagead')
      ) {
        return;
      }
      consoleErrors.push(text);
    } else {
      consoleMessages.push(text);
    }
  });

  page.on('pageerror', (err) => {
    console.error('[Browser Error]', err.message);
    consoleErrors.push(err.message);
  });

  // Track failed requests
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('googlesyndication.com') || url.includes('pagead')) {
      return;
    }
    const text = `Request failed: ${url} (${request.failure()?.errorText || 'unknown'})`;
    console.error(`[Browser Network] ${text}`);
    consoleErrors.push(text);
  });

  // Track error responses
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('googlesyndication.com') || url.includes('pagead')) {
      return;
    }
    const status = response.status();
    if (status >= 400) {
      const text = `Response error: ${url} (status ${status})`;
      console.error(`[Browser Network] ${text}`);
      consoleErrors.push(text);
    }
  });

  console.log('Navigating to http://localhost:5173/appvid/ ...');
  await page.goto('http://localhost:4173/appvid/');

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

  console.log('Waiting for video metadata analysis...');
  await page.waitForSelector('.metadata-panel');
  console.log('Video metadata panel rendered!');

  // Click Confirm & Import Video
  console.log('Confirming import...');
  await page.click('button:has-text("Confirm & Import Video")', { force: true });

  // Wait for the Editor Workspace to mount
  await page.waitForSelector('.editor-workspace');
  console.log('Editor Workspace mounted!');

  // Now import the audio asset
  const audioPath = '/Volumes/Projects/dev/strobopro_dev/bassline-A0-1200ms-upright-equal.wav';
  console.log(`Importing audio file: ${audioPath}`);
  
  // Find the hidden audio file input in the panel header
  const audioInput = await page.$('.panel-header input[type="file"]');
  if (!audioInput) {
    throw new Error('Audio file input element not found!');
  }
  await audioInput.setInputFiles(audioPath);

  // Wait for the audio card to appear
  console.log('Waiting for audio card to appear...');
  await page.waitForSelector('.asset-card');
  console.log('Audio card loaded!');

  // Seek the video/playhead to offset1
  console.log(`Seeking playhead to first random offset (${offset1}s)...`);
  await page.evaluate((targetTime) => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = targetTime;
      video.dispatchEvent(new Event('timeupdate'));
    }
  }, offset1);
  await page.waitForTimeout(500);

  // Click the place button for the first audio segment
  console.log('Placing first audio segment...');
  await page.click('.asset-card-actions button[title="Place at playhead"]', { force: true });
  await page.waitForTimeout(500);

  // Auto-switch back to Assets tab because React automatically activeTab -> inspector on segment creation
  console.log('Switching back to Assets tab...');
  await page.click('.sidebar-tab:has-text("Assets")', { force: true });
  await page.waitForTimeout(500);

  // Seek the video/playhead to offset2
  console.log(`Seeking playhead to second random offset (${offset2}s)...`);
  await page.evaluate((targetTime) => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = targetTime;
      video.dispatchEvent(new Event('timeupdate'));
    }
  }, offset2);
  await page.waitForTimeout(500);

  // Click the place button again to place the second segment
  console.log('Placing second audio segment...');
  await page.click('.asset-card-actions button[title="Place at playhead"]', { force: true });
  await page.waitForTimeout(500);

  // Verify that two segments are now on the timeline
  console.log('Checking timeline audio segments count...');
  const count = await page.locator('.audio-segment-card').count();
  console.log(`Placed segments count: ${count}`);
  if (count !== 2) {
    throw new Error(`Expected 2 placed segments, but found ${count}`);
  }

  // Click the Export button in the TopBar
  console.log('Clicking Export button...');
  await page.click('button:has-text("Export")', { force: true });

  // Wait for the Export Settings Sheet to open
  await page.waitForSelector('.sheet-container');
  console.log('Export Settings Sheet opened!');

  // Click the Start Export (or Export Anyway) button
  console.log('Starting export...');
  await page.click('.sheet-footer button.btn-primary', { force: true });

  // Wait for the Processing Overlay to mount
  await page.waitForSelector('.processing-card');
  console.log('Export processing started!');

  // Increase Playwright timeout for the long transcode process
  console.log('Waiting for FFmpeg transcode to finish (this might take up to 6 minutes)...');
  await page.waitForSelector('.complete-overlay', { timeout: 360000 });
  console.log('Export Complete panel detected!');

  // Verify the output details
  const title = await page.textContent('.complete-title');
  console.log(`Status title: ${title}`);
  
  const hasOutputVideo = await page.$('.output-preview-video');
  if (hasOutputVideo) {
    console.log('Output preview video element is present!');
    const src = await page.getAttribute('.output-preview-video', 'src');
    console.log(`Output video Blob URL: ${src}`);
  } else {
    throw new Error('Output video element not found in complete overlay!');
  }

  console.log('Closing browser...');
  await browser.close();

  console.log('\n--- E2E Export Test Summary ---');
  if (consoleErrors.length > 0) {
    console.error(`FAIL: Found ${consoleErrors.length} console errors or failed requests during run:`);
    consoleErrors.forEach((err) => console.error(`- ${err}`));
    process.exit(1);
  } else {
    console.log('PASS: Video imported, audio attached twice with random offsets, transcode completed successfully!');
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
