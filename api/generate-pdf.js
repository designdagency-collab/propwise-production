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

    // FIXED: Use wider viewport to avoid mobile breakpoints
    // This ensures desktop layout renders consistently
    await page.setViewport({
      width: 1240,  // Wide enough to avoid md: breakpoints
      height: 1754, // A4 height at 150 DPI
      deviceScaleFactor: 2,
    });

    // FIXED: Emulate print media type for proper print CSS
    await page.emulateMediaType('print');

    // Set content
    console.log('[PDF] Setting page content...');
    console.log('[PDF] HTML length:', html.length, 'bytes');
    
    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
      timeout: 30000,
    });

    // Wait for all images to load and log their status
    const imageStatus = await page.evaluate(async () => {
      const images = Array.from(document.images);
      const results = [];
      
      await Promise.all(
        images.map((img, idx) => {
          return new Promise(resolve => {
            const srcPreview = img.src ? img.src.substring(0, 50) + '...' : 'NO SRC';
            
            if (img.complete && img.naturalWidth > 0) {
              results.push({ idx, status: 'loaded', width: img.naturalWidth, height: img.naturalHeight, src: srcPreview });
              resolve();
            } else if (img.complete) {
              results.push({ idx, status: 'failed', src: srcPreview });
              resolve();
            } else {
              img.onload = () => {
                results.push({ idx, status: 'loaded', width: img.naturalWidth, height: img.naturalHeight, src: srcPreview });
                resolve();
              };
              img.onerror = () => {
                results.push({ idx, status: 'error', src: srcPreview });
                resolve();
              };
            }
          });
        })
      );
      
      return { total: images.length, results };
    });
    
    console.log('[PDF] Images found:', imageStatus.total);
    if (imageStatus.results.length > 0) {
      imageStatus.results.forEach(r => {
        console.log(`[PDF] Image ${r.idx}: ${r.status}`, r.width ? `(${r.width}x${r.height})` : '', r.src);
      });
    }

    // Wait for fonts to be ready
    await page.evaluateHandle('document.fonts.ready');

    // FIXED: Wait for layout to fully settle (double rAF)
    await page.evaluate(() => new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    }));

    // Additional stabilization delay
    await new Promise(r => setTimeout(r, 300));

    console.log('[PDF] Generating PDF...');
    
    // Generate PDF with stable settings
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '8mm',
        right: '8mm', 
        bottom: '8mm',
        left: '8mm',
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
