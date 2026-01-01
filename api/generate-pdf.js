// Premium PDF generation using Puppeteer + Chromium on Vercel
// Uses @sparticuz/chromium-min for optimized serverless deployment
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

// Vercel function configuration
export const config = {
  maxDuration: 60,
};

// Remote Chromium executable URL (required for chromium-min)
const CHROMIUM_EXECUTABLE = 
  'https://github.com/nicholaschiang/chromium/releases/download/v132.0.0/chromium-v132.0.0-pack.tar';

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
    
    // Get executable path - downloads Chromium binary if needed
    const executablePath = await chromium.executablePath(CHROMIUM_EXECUTABLE);
    console.log('[PDF] Chromium path:', executablePath);

    // Launch browser with optimized settings for Vercel
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: {
        width: 1200,
        height: 800,
        deviceScaleFactor: 2, // Retina quality
      },
    });

    console.log('[PDF] Browser launched');
    const page = await browser.newPage();

    // Set content with reasonable timeout
    console.log('[PDF] Setting page content...');
    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded', 'networkidle2'],
      timeout: 30000,
    });

    // Wait for all images to load
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

    // Brief pause for final rendering
    await new Promise(r => setTimeout(r, 500));

    console.log('[PDF] Generating PDF...');
    
    // Generate premium quality PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm', 
        bottom: '12mm',
        left: '12mm',
      },
      preferCSSPageSize: false,
    });

    console.log('[PDF] Generated successfully, size:', pdfBuffer.length, 'bytes');

    // Send PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('[PDF] Generation failed:', error.message);
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
