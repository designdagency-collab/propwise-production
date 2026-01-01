// Vercel serverless function for premium PDF generation using Puppeteer
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const config = {
  maxDuration: 60, // Allow up to 60 seconds for PDF generation
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
    
    // Launch browser with Vercel-optimized settings
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    console.log('[PDF] Browser launched, creating page...');
    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 2, // High DPI for crisp text
    });

    // Set the HTML content
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000,
    });

    // Wait for any images/maps to load
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => {
            img.onload = img.onerror = resolve;
          }))
      );
    });

    // Add a small delay for any final rendering
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('[PDF] Generating PDF...');
    
    // Generate PDF with premium settings
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm',
      },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    });

    console.log('[PDF] PDF generated successfully, size:', pdf.length);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);

    return res.send(pdf);

  } catch (error) {
    console.error('[PDF] Error generating PDF:', error);
    return res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message 
    });
  } finally {
    if (browser) {
      await browser.close();
      console.log('[PDF] Browser closed');
    }
  }
}

