"""Verify cookbook media bytes and reader references before Pages publication."""
import argparse
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REL = Path('static/cookbook_v10/fantasy_table')
RAW = 'https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/main/'


class Images(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.images = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            self.images.append(dict(attrs))


def verify_record(asset, source):
    errors = []
    recipe_id = asset.get('id', '')
    digest = asset.get('webp_sha256', '')
    if not re.fullmatch(r'FT-\d{4}', recipe_id) or not re.fullmatch(r'[0-9a-f]{64}', digest):
        return ['Invalid recipe ID or image digest']
    name = recipe_id.lower() + '-' + digest[:16] + '.webp'
    relative = 'cookbook-media/' + name
    if asset.get('path') != relative or asset.get('delivery_filename') != name:
        errors.append(f'Image path does not match content name: {recipe_id}')
    if asset.get('src') != RAW + relative:
        errors.append(f'Image URL does not address verified source: {recipe_id}')
    # Read only the constructed allowed path, never a manifest-supplied path.
    path = source / relative
    if not path.is_file():
        errors.append(f'Missing cookbook image: {relative}')
    else:
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            errors.append(f'Cookbook image bytes changed: {relative}')
        if len(data) != asset.get('web_bytes') or not (data[:4] == b'RIFF' and data[8:12] == b'WEBP'):
            errors.append(f'Cookbook image format or byte count differs: {relative}')
    return errors


def verify(artifact, source):
    failures, used, count = [], set(), 0
    manifests = sorted((artifact / REL).glob('media-wave[0-9][0-9][0-9].json'))
    if not manifests:
        failures.append('No cookbook delivery manifests found')
    if artifact != source and (artifact / 'cookbook-media').exists():
        failures.append('Separately delivered cookbook images leaked into Pages artifact')
    for manifest_path in manifests:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        wave = manifest['wave']
        if not re.fullmatch(r'\d{3}', wave):
            failures.append('Invalid wave number')
            continue
        assets = manifest['assets']
        recipes = json.loads((artifact / REL / f'wave{wave}.json').read_text(encoding='utf-8'))['recipes']
        text = (artifact / REL / f'wave{wave}.html').read_text(encoding='utf-8')
        images = Images(text).images
        if len(assets) != 10 or len(recipes) != 10 or len(images) != 10:
            failures.append(f'Incomplete cookbook wave: {wave}')
        if len({a['id'] for a in assets}) != len(assets):
            failures.append(f'Duplicate recipe media IDs: {wave}')
        for asset, recipe, image in zip(assets, recipes, images):
            failures.extend(verify_record(asset, source))
            used.add(asset['path'])
            if recipe['id'] != asset['id'] or recipe.get('image_url') != asset['src'] or recipe['image_filename'] != asset['delivery_filename']:
                failures.append(f'Recipe media binding differs: {recipe["id"]}')
            if image.get('src') != asset['src'] or not image.get('alt') or image.get('width') != '1448' or image.get('height') != '1086':
                failures.append(f'Reader image binding or attributes differ: {recipe["id"]}')
            if len(recipe['instructions']) != 10 or recipe.get('medical_review_status') != 'not clinically reviewed' or recipe.get('culinary_test_status') != 'not kitchen-tested':
                failures.append(f'Recipe completeness or review status differs: {recipe["id"]}')
            count += 1
        if f'https://northstarprime.net/static/cookbook_v10/fantasy_table/wave{wave}.html' not in text:
            failures.append(f'Missing canonical: {wave}')
        if f'/static/cookbook_v10/fantasy_table/wave{wave}.html' not in (artifact / 'ckd-kitchen/index.html').read_text(encoding='utf-8'):
            failures.append(f'Missing cookbook discovery link: {wave}')
    actual = {p.relative_to(source).as_posix() for p in (source / 'cookbook-media').rglob('*') if p.is_file()}
    if actual != used:
        failures.append('Cookbook source media and manifest inventories differ')
    return {'status': 'FAIL' if failures else 'PASS', 'waves': len(manifests), 'verified_media': count, 'delivery': RAW + 'cookbook-media/', 'failures': failures}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--artifact', type=Path, default=ROOT)
    parser.add_argument('--source', type=Path, default=ROOT)
    args = parser.parse_args()
    result = verify(args.artifact.resolve(), args.source.resolve())
    print(json.dumps(result, indent=2))
    raise SystemExit(result['status'] != 'PASS')
