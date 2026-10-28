# Site G print check — Round 1

Preview code: `7ed40b6bff89067623a4939f251be1ed5cd6e870`, verified by healthcheck. Seven browser cases passed at 1280 × 800 and 390 × 844, with zero JavaScript, console or HTTP errors and zero attempted/transmitted network writes.

**Print gate remains open:** the exact disclaimer is present on pages 1 and 3 but absent from page 2 of both A4 exports. This was confirmed by page text extraction and visual inspection of all six rendered pages. The existing report has ordinary paragraphs at its beginning and end; neither repeats when a page breaks. See `pdf-review.json`, both `report-*-a4.pdf` files and `rendered/*-2.png`.

All six pages are readable, with no visible clipping, overlap or missing glyphs. Both files have three A4 pages (594.96 × 841.92 pt) and are 318,522 bytes. Poppler emitted repeated `Bad bounding box in Type 3 glyph` warnings, retained as a renderer caveat; visual inspection found no corresponding missing glyph.

Round 2 proposal: reuse the existing final disclaimer paragraph as a print-only fixed footer, reserve a larger bottom page margin for it, and leave screen styling unchanged. Verify exact disclaimer text and footer/body separation on **every** generated page, then render and inspect every page at both viewport sizes. Preserve these failed Round 1 exports; write new evidence under a separate Round 2 directory.
