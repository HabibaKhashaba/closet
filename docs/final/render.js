const { chromium } = require('playwright');
(async () => {
  const [,, html, pdf, title] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + html, { waitUntil: 'networkidle' });
  const st = 'font-family:"Times New Roman","Liberation Serif",serif;font-size:8.5pt;color:#555;width:100%;margin:0 20mm 0 22mm;display:flex;justify-content:space-between;';
  await p.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false,
    headerTemplate: `<div style='${st}'><span>${title}</span><span>Team Closet · CSCE 3701</span></div>`,
    footerTemplate: `<div style='${st}justify-content:center'>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>` });
  await b.close();
})();
