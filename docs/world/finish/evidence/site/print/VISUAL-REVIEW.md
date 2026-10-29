# Final published Site print check — PASS

Exact normal preview source: `b3727b1d20fff6be3ac448dfe8bf11e9261ad500`, verified by healthcheck for each viewport. No stylesheet or provider response was substituted. This is a functional print check, not a loading-performance measurement.

Both the 1280 × 800 desktop viewport and 390 × 844 touch viewport produced four portrait A4 pages (594.96 × 841.92 pt). Every one of the eight rendered PNG pages was opened and visually inspected. Boundary labels, terrain values, the input table, source tags, unavailable-data notices and the disclaimer are readable. No disclaimer overlaps report content; no visible clipping or missing glyph was found. The ordinary report-ending banner remains in flow on page 4.

The unchanged PDF oracle passes all eight pages. Each has exactly one complete disclaimer in the reserved bottom margin, at y793.50–802.50 pt. The smallest measured gap between report body text and that footer is **17.99 mm** (page 3). The same dark footer pixels occur at raster rows 1323–1336 in all eight 1400px renders, independently confirming the text was painted as well as extractable.

Screen checks pass for both sizes: two ordinary banners, screen styles restored exactly after printing, no horizontal overflow, correct print-button class lifecycle, and inactive page name `auto`. The screenshot files preserve the screen state.

Network results independently pass: zero attempted/blocked network writes, zero provider requests, and zero JavaScript, console or HTTP errors. Hosting requests were not silently excluded from these counts. The full rows remain in `print-check.json`.

Poppler Type 3 glyph and pdfplumber font-bounding-box warnings remain in the raw log/JSON. They did not correspond to visible missing glyphs in these eight pages. Scope is the tested Chromium desktop/touch emulation; this does not establish physical-phone usability or untested browser print compatibility.

Both PDFs are 320,262 bytes. All browser, Python extraction and Poppler rendering subprocesses closed before the lease was released. No source or Git changes were made during the campaign. The earlier failed four-page-per-device export and the fixed-position diagnostic experiment remain preserved in their separate Round 2 directories.
