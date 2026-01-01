// Vercel serverless function for premium PDF generation using Puppeteer
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const config = {
  maxDuration: 60, // Allow up to 60 seconds for PDF generation
  memory: 1024, // Increase memory for Chromium
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { html, filename = 'report.pdf' } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'HTML content is required' });
  }

  let browser = null;

  try {
    console.log('[PDF] Starting Puppeteer...');
    
    // Ensure chromium binary is available (downloads if needed on Vercel)
    const executablePath = await chromium.executablePath();
    console.log('[PDF] Chromium path:', executablePath);
    
    // Launch browser with Vercel-optimized settings
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
      defaultViewport: {
        width: 1200,
        height: 800,
        deviceScaleFactor: 2,
      },
      executablePath,
      headless: 'new', // Use new headless mode
    });

    console.log('[PDF] Browser launched, creating page...');
    const page = await browser.newPage();

    // Set the HTML content with increased timeout
    console.log('[PDF] Setting page content...');
    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 45000,
    });

    // Wait for fonts and images to load
    await page.evaluate(() => {
      return Promise.all([
        // Wait for fonts
        document.fonts.ready,
        // Wait for images
        ...Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.onload = img.onerror = resolve;
          }))
      ]);
    });

    // Small delay for final rendering
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('[PDF] Generating PDF...');
    
    // Generate PDF with premium settings
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm',
      },
      displayHeaderFooter: false,
      preferCSSPageSize: false,
    });

    console.log('[PDF] PDF generated successfully, size:', pdf.length, 'bytes');

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);

    return res.send(Buffer.from(pdf));

  } catch (error) {
    console.error('[PDF] Error generating PDF:', error);
    return res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('[PDF] Browser closed');
      } catch (closeError) {
        console.error('[PDF] Error closing browser:', closeError);
      }
    }
  }
}
