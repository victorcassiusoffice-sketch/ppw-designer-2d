"""Reproducible same-camera screenshot readout, no image editing."""
import json
from pathlib import Path
from PIL import Image, ImageStat

folder = Path('docs/qa-sims-fix-round-2-2026-10-25/matched-camera')
regions = {'canvas': None, 'backdrop': (40, 30, 200, 90), 'house': (300, 160, 880, 460)}
result = {'method': 'Mean Rec.709-weighted encoded sRGB values (0–255), descriptive screenshot comparison, not physical luminance. Identical pixel regions and actual render camera; scene includes minor existing product-detail differences between old and production.', 'regions': regions, 'images': {}}
for name in ['old-auto', 'production-auto', 'production-high', 'branch-auto', 'branch-high']:
    image = Image.open(folder / f'{name}-canvas.png').convert('RGB')
    result['images'][name] = {}
    for region, box in regions.items():
        r, g, b = ImageStat.Stat(image.crop(box) if box else image).mean
        value = .2126*r + .7152*g + .0722*b
        old = result['images']['old-auto'].get(region, {}).get('mean', value)
        result['images'][name][region] = {'mean': value, 'relativeToOldPercent': (value/old-1)*100}
(folder / 'brightness.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))
