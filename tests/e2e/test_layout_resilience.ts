import { webkit } from 'playwright';

const VIEWPORTS = [
  { name: 'Mobile Portrait (375x667)', width: 375, height: 667 },
  { name: 'Mobile Landscape (667x375)', width: 667, height: 375 },
  { name: 'Tablet Portrait (768x1024)', width: 768, height: 1024 },
  { name: 'Tablet Landscape (1024x768)', width: 1024, height: 768 },
  { name: 'Desktop (1280x800)', width: 1280, height: 800 },
];

async function runLayoutTest() {
  console.log('Launching browser for viewport resilience tests...');
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let failed = false;

  for (const vp of VIEWPORTS) {
    console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})`);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // Navigate to local preview server
    await page.goto('http://localhost:4173/appvid/');
    await page.waitForSelector('.import-dropzone');

    // Perform basic checks on landing page
    const landingOverflowH = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    if (landingOverflowH) {
      console.error(`❌ FAIL: Landing page has horizontal overflow at ${vp.name}`);
      failed = true;
    } else {
      console.log(`✅ Landing page fits horizontally.`);
    }

    // Import the test video to test the editor workspace layout
    const videoPath = '/Volumes/Projects/dev/strobopro_dev/strobopro-appvid.mp4';
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.setInputFiles(videoPath);
      await page.waitForSelector('.metadata-panel');
      await page.click('button:has-text("Confirm & Import Video")', { force: true });
      await page.waitForSelector('.editor-workspace');

      // Wait for layout to settle
      await page.waitForTimeout(500);

      // Verify no horizontal overflow in editor workspace
      const workspaceOverflowH = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      // Verify viewport constraints are respected (app-shell max-height should prevent scroll overflow on body)
      const bodyOverflowV = await page.evaluate(() => {
        return document.body.scrollHeight > window.innerHeight;
      });

      if (workspaceOverflowH) {
        console.error(`❌ FAIL: Editor workspace has horizontal overflow at ${vp.name}`);
        failed = true;
      } else {
        console.log(`✅ Editor workspace fits horizontally.`);
      }

      if (bodyOverflowV) {
        console.error(
          `❌ FAIL: Body has vertical scroll overflow (scrollHeight: ${await page.evaluate(() => document.body.scrollHeight)} vs viewport: ${vp.height}) at ${vp.name}`
        );
        failed = true;
      } else {
        console.log(`✅ App shell height respects viewport constraints.`);
      }
    } else {
      console.error('❌ FAIL: File input not found.');
      failed = true;
    }
  }

  await browser.close();

  if (failed) {
    console.error('\n❌ Viewport resilience tests FAILED.');
    process.exit(1);
  } else {
    console.log('\n🎉 PASS: Viewport resilience tests completed successfully with no layout overflow!');
    process.exit(0);
  }
}

runLayoutTest().catch((err) => {
  console.error('Viewport resilience test crashed:', err);
  process.exit(1);
});
