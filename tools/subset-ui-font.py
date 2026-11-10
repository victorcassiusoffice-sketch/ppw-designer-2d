"""Offline-only generator: pip install fonttools brotli, then run from repo root.

Keeps the existing Inter 4.1 variable font and OpenType features for the frequently used Western European UI glyphs.
Other characters fall back to the original font via CSS unicode-range.
Source and output are licensed under public/fonts/OFL-inter.txt.
This tool is not part of the application build or runtime.
"""
from fontTools import subset

subset.main([
    'public/fonts/inter-variable.woff2',
    '--output-file=public/fonts/inter-ui-core.woff2', '--flavor=woff2',
    '--unicodes=U+0000-00FF,U+0131,U+0152-0153,U+0178,U+0300-0308,U+0327,U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2300-23FF,U+2500-27BF',
    '--layout-features=*', '--name-IDs=*', '--name-legacy',
    '--name-languages=*', '--notdef-glyph', '--notdef-outline',
    '--recommended-glyphs',
])
