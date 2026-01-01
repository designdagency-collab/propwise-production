// Premium PDF generation using Puppeteer + Chromium on Vercel
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Vercel function configuration
export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { html, filename = 'report.pdf' } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'HTML content is required' });
  }

  let browser = null;

  try {
    console.log('[PDF] Initializing Chromium...');
    
    // Configure chromium for serverless
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;
    
    // Get the bundled executable path
    const executablePath = await chromium.executablePath();
    console.log('[PDF] Chromium executable:', executablePath);

    // Launch browser
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    console.log('[PDF] Browser launched');
    const page = await browser.newPage();

    // Set high-quality viewport
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 2,
    });

    // Set content
    console.log('[PDF] Setting page content...');
    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded', 'networkidle2'],
      timeout: 30000,
    });

    // Wait for images
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = img.onerror = resolve;
          });
        })
      );
    });

    // Wait for fonts
    await page.evaluate(() => document.fonts.ready);

    // Brief rendering delay
    await new Promise(r => setTimeout(r, 500));

    console.log('[PDF] Generating PDF...');
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm', 
        bottom: '12mm',
        left: '12mm',
      },
    });

    console.log('[PDF] Success! Size:', pdfBuffer.length, 'bytes');

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('[PDF] Failed:', error.message);
    console.error('[PDF] Stack:', error.stack);
    
    return res.status(500).json({
      error: 'PDF generation failed',
      details: error.message,
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
      console.log('[PDF] Browser closed');
    }
  }
}
