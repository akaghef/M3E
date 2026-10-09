#!/usr/bin/env python3
"""Validate all registered Agent node icon sources and explicit frame regions."""
import hashlib
import json
import math
from pathlib import Path
import sys
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_atlas(atlas, source, require_review=True):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    image = Image.open(source).convert('RGBA')
    alpha = image.getchannel('A')
    require(atlas.get('version') == 1, 'unsupported manifest version')
    require(atlas.get('sourceSha256') == digest, 'source hash changed; review again')
    require(atlas.get('sheet') == {'width': image.width, 'height': image.height}, 'sheet dimensions mismatch')
    viewport = atlas['viewport']
    require(all(finite(viewport[k]) and viewport[k] > 0 for k in ('width', 'height')), 'invalid viewport')
    animations = atlas['animations']
    require(animations and 'idle' in animations, 'idle animation required')
    if require_review:
        review = atlas.get('review', {})
        require(review.get('sourceSha256') == digest and review.get('date') and review.get('method'), 'matching visual review required')
        require(sorted(review.get('animations', [])) == sorted(animations), 'every animation must be reviewed')
    covered = Image.new('1', image.size)
    rows = set()
    count = 0
    for name, animation in animations.items():
        row = animation['row']
        require(type(row) is int and 0 <= row < len(animations) and row not in rows, 'rows must be unique and contiguous')
        rows.add(row)
        require(finite(animation['fps']) and 0 < animation['fps'] <= 60, 'invalid fps')
        require(isinstance(animation['frames'], list) and animation['frames'], 'explicit frames required')
        for frame in animation['frames']:
            x, y, w, h = (frame[k] for k in ('x', 'y', 'width', 'height'))
            require(all(type(n) is int for n in (x, y, w, h)), 'integer source rectangles required')
            require(x >= 0 and y >= 0 and w > 0 and h > 0 and x+w <= image.width and y+h <= image.height, 'source bounds')
            ox, oy = frame['offsetX'], frame['offsetY']
            require(finite(ox) and finite(oy) and 0 <= ox and 0 <= oy and ox+w <= viewport['width'] and oy+h <= viewport['height'], 'viewport bounds')
            box = (x, y, x+w, y+h)
            require(alpha.crop(box).getextrema()[1] > 16, f'{name}: empty frame')
            edges = [(x,y,x+w,y+1), (x,y+h-1,x+w,y+h), (x,y,x+1,y+h), (x+w-1,y,x+w,y+h)]
            require(all(alpha.crop(edge).getextrema()[1] <= 16 for edge in edges), f'{name}: frame cuts visible pixels')
            require(not covered.crop(box).getbbox(), 'overlapping frame rectangles')
            covered.paste(1, box)
            count += 1
    visible = alpha.point(lambda value: 255 if value > 16 else 0)
    require(not ImageChops.subtract(visible, covered.convert('L')).getbbox(), 'visible source pixels were dropped')
    return count


def check_catalog(directory):
    catalog = json.loads((directory / 'pet_catalog.json').read_text())
    ids = set()
    verified = frames = 0
    for pet in catalog['pets']:
        pet_id = pet['id']
        require(pet_id not in ids and '/' not in pet_id and '..' not in pet_id, 'duplicate or invalid pet id')
        ids.add(pet_id)
        source = directory / 'pets' / pet_id / 'spritesheet.webp'
        require(hashlib.sha256(source.read_bytes()).hexdigest() == pet['sourceSha256'], f'{pet_id}: catalog hash mismatch')
        with Image.open(source) as image:
            require(pet['sheet'] == {'width': image.width, 'height': image.height}, f'{pet_id}: catalog dimensions')
        require(not any(key in pet for key in ('grid', 'gridStatus', 'states')), f'{pet_id}: inferred or duplicate frame metadata prohibited')
        require(pet['status'] in ('verified', 'pending-review'), 'unknown import status')
        manifest = source.with_name('frame-regions.json')
        require(pet['status'] != 'verified' or manifest.is_file(), f'{pet_id}: verified requires manifest')
        if manifest.exists():
            frames += validate_atlas(json.loads(manifest.read_text()), source, pet['status'] == 'verified')
        verified += pet['status'] == 'verified'
    sources = {p.parent.name for p in (directory / 'pets').glob('*/spritesheet.webp')}
    require(sources == ids, 'unregistered or missing source image')
    return f'{verified} verified / {len(ids)-verified} pending; {frames} frame regions checked'


if __name__ == '__main__':
    try:
        print(check_catalog(ROOT / 'beta/src/labs/node'))
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f'Agent node icon import rejected: {error}', file=sys.stderr)
        sys.exit(1)
