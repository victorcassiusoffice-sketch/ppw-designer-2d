"""Offline-only generator: pip install fonttools brotli, then run from repo root.

Keeps the existing Inter 4.1 variable font and OpenType features for Latin UI.
Other characters fall back to the original font via CSS unicode-range.
Source and output are licensed under public/fonts/OFL-inter.txt.
This tool is not part of the application build or runtime.
"""
from fontTools import subset

subset.main([
    'public/fonts/inter-variable.woff2',
    '--output-file=public/fonts/inter-ui-latin.woff2', '--flavor=woff2',
    '--unicodes=U+0000-024F,U+0300-036F,U+1E00-1EFF,U+2000-2BFF',
    '--layout-features=*', '--name-IDs=*', '--name-legacy',
    '--name-languages=*', '--notdef-glyph', '--notdef-outline',
    '--recommended-glyphs',
])
