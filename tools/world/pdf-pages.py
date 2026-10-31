"""Render every page of the Site report PDFs to PNG and check each page.

Usage: python tools/world/pdf-pages.py <pdf> [<pdf> ...] --out <folder> [--banner "<exact footer text>"]
For every page: a PNG at 96 dpi, whether the footer banner (the lowest block whose
text is exactly the banner) is present, the vertical gap in mm between the
lowest body text above it and the footer, whether any body block overlaps the
footer and whether any text block leaves the page. The PDFs are read only.
Needs PyMuPDF (fitz).
"""
import json
import sys
from pathlib import Path

import fitz  # PyMuPDF

DEFAULT_BANNER = 'Estimates from public data for planning a conversation, not a survey and not an approval.'
args = sys.argv[1:]
out = Path(args[args.index('--out') + 1]) if '--out' in args else Path('.')
banner = args[args.index('--banner') + 1] if '--banner' in args else DEFAULT_BANNER
pdfs = [a for i, a in enumerate(args) if a.lower().endswith('.pdf') and (i == 0 or args[i - 1] not in ('--out', '--banner'))]
out.mkdir(parents=True, exist_ok=True)
normalise = lambda text: ' '.join(text.split())
result = {'banner': banner, 'files': []}
for pdf in pdfs:
    doc = fitz.open(pdf)
    entry = {'file': pdf, 'pages': []}
    for index, page in enumerate(doc):
        pix = page.get_pixmap(dpi=96)
        name = f"{Path(pdf).stem}-page-{index + 1}.png"
        pix.save(str(out / name))
        blocks = [b for b in page.get_text('blocks') if b[6] == 0 and b[4].strip()]
        banner_blocks = [b for b in blocks if normalise(b[4]) == normalise(banner)]
        footer = max(banner_blocks, key=lambda b: b[3]) if banner_blocks else None
        body = [b for b in blocks if b is not footer]
        gap_mm = None
        overlap = False
        if footer is not None:
            above = [b for b in body if b[3] <= footer[1] + 0.5]
            if above:
                gap_mm = round((footer[1] - max(b[3] for b in above)) * 25.4 / 72, 2)
            overlap = any(b[1] < footer[3] and b[3] > footer[1] for b in body)
        clipped = any(b[0] < -0.5 or b[2] > page.rect.width + 0.5 or b[1] < -0.5 or b[3] > page.rect.height + 0.5 for b in blocks)
        entry['pages'].append({'page': index + 1, 'image': name, 'widthMm': round(page.rect.width * 25.4 / 72, 1), 'heightMm': round(page.rect.height * 25.4 / 72, 1),
                               'footerBannerPresent': footer is not None, 'bodyFooterGapMm': gap_mm, 'bodyFooterOverlap': overlap, 'textOutsidePage': clipped,
                               'blocks': len(blocks), 'characters': len(page.get_text())})
    entry['pageCount'] = len(entry['pages'])
    entry['everyPageHasFooter'] = all(p['footerBannerPresent'] for p in entry['pages'])
    entry['anyOverlapOrClip'] = any(p['bodyFooterOverlap'] or p['textOutsidePage'] for p in entry['pages'])
    gaps = [p['bodyFooterGapMm'] for p in entry['pages'] if p['bodyFooterGapMm'] is not None]
    entry['minBodyFooterGapMm'] = min(gaps) if gaps else None
    result['files'].append(entry)
(out / 'pdf-pages.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps([{'file': Path(f['file']).name, 'pages': f['pageCount'], 'footerEveryPage': f['everyPageHasFooter'], 'overlapOrClip': f['anyOverlapOrClip'], 'minGapMm': f['minBodyFooterGapMm'], 'gaps': [p['bodyFooterGapMm'] for p in f['pages']]} for f in result['files']]))
