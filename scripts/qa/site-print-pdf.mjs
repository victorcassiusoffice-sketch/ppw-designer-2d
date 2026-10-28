/** Check exported pages, not report DOM. Uses the existing PDF QA runtime. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const pointsPerMm = 72 / 25.4;
const normalise = text => text.normalize('NFKC').replace(/\s+/g, ' ').trim();

export function inspectPageWords(extractedPages, banner) {
  const expected = normalise(banner).split(' ');
  const pages = extractedPages.map((page, index) => {
    const widthPt = page.width;
    const heightPt = page.height;
    const words = page.words.map(word => ({
      text: normalise(word.text),
      top: word.top,
      bottom: word.bottom,
      left: word.x0,
      right: word.x1,
    }));
    const bodyBottomPt = heightPt - 30 * pointsPerMm;
    const matches = [];
    for (let i = 0; i <= words.length - expected.length; i++) {
      if (expected.every((word, j) => word === words[i + j].text)) {
        const matched = words.slice(i, i + expected.length);
        matches.push({ start: i, end: i + expected.length,
          top: Math.min(...matched.map(word => word.top)),
          bottom: Math.max(...matched.map(word => word.bottom)) });
      }
    }
    const footers = matches.filter(match => match.top > bodyBottomPt);
    const bodyWords = words.filter((_, i) => !footers.some(match => i >= match.start && i < match.end));
    const bodyTextBottomPt = Math.max(0, ...bodyWords.map(word => word.bottom));
    const footerTopPt = footers.length === 1 ? footers[0].top : null;
    const footerBottomPt = footers.length === 1 ? footers[0].bottom : null;
    const errors = [];
    if (Math.abs(widthPt - 210 * pointsPerMm) > 1 || Math.abs(heightPt - 297 * pointsPerMm) > 1) errors.push('Page is not portrait A4.');
    if (!words.length) errors.push('Page has no extractable text.');
    if (footers.length !== 1) errors.push(`Expected one complete disclaimer in the reserved footer; found ${footers.length}.`);
    if (bodyTextBottomPt > bodyBottomPt + 1) errors.push('Body text enters the reserved footer margin.');
    if (footerTopPt !== null && footerTopPt - bodyTextBottomPt < 3 * pointsPerMm) errors.push('Less than 3mm separates body text and disclaimer.');
    if (footerBottomPt !== null && footerBottomPt > heightPt - 8 * pointsPerMm) errors.push('Disclaimer is within 8mm of the paper edge.');
    if (words.some(word => !Number.isFinite(word.top) || !Number.isFinite(word.bottom) || word.top < 0 || word.bottom > heightPt || word.left < 0 || word.right > widthPt)) errors.push('Text bounds fall outside the page.');
    return { page: index + 1, widthPt, heightPt, completeBannerCount: matches.length,
      footerCount: footers.length, bodyBottomPt, bodyTextBottomPt, footerTopPt, footerBottomPt,
      gapMm: footerTopPt === null ? null : (footerTopPt - bodyTextBottomPt) / pointsPerMm,
      errors, passed: errors.length === 0 };
  });
  return { pages, passed: pages.length > 0 && pages.every(page => page.passed) };
}

export async function inspectSiteReportPdf(file, banner, python = 'python') {
  const script = `import json, sys, pdfplumber
with pdfplumber.open(sys.argv[1]) as pdf:
    pages = [{"width": page.width, "height": page.height, "words": page.extract_words(use_text_flow=True)} for page in pdf.pages]
print(json.dumps(pages))`;
  const { stdout, stderr } = await run(python, ['-c', script, file], { maxBuffer: 8 * 1024 * 1024 });
  return { file, ...inspectPageWords(JSON.parse(stdout), banner), extractionWarnings: stderr.trim() };
}
