"""Check the exact public video objects before switching player links.

Default: local source hashes. --network: public byte ranges and lengths.
--full: download every object and compare SHA-256 without saving duplicates.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def public_check(item: dict, base: str, full: bool) -> dict:
    url = base + item['file']
    headers = {'User-Agent': 'NorthStar-VideoContinuity/1'}
    if not full:
        headers['Range'] = 'bytes=0-1023'
    try:
        request = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(request, timeout=30) as response:
            mime = response.headers.get_content_type()
            if full:
                digest, size = hashlib.sha256(), 0
                for chunk in iter(lambda: response.read(1024 * 1024), b''):
                    size += len(chunk)
                    digest.update(chunk)
                ok = size == item['bytes'] and digest.hexdigest() == item['sha256']
                proof = {'sha256': digest.hexdigest(), 'bytes': size}
            else:
                expected = min(1024, item['bytes'])
                body = response.read(expected + 1)
                actual_range = response.headers.get('Content-Range')
                ok = response.status == 206 and actual_range == f"bytes 0-{expected-1}/{item['bytes']}" and len(body) == expected
                proof = {'content_range': actual_range, 'sample_bytes': len(body)}
            expected_mime = 'video/mp4' if item['file'].endswith('.mp4') else 'application/json'
            ok = ok and mime == expected_mime
            return {'file': item['file'], 'url': url, 'ok': ok, 'http_status': response.status, 'mime': mime, **proof}
    except Exception as exc:
        return {'file': item['file'], 'url': url, 'ok': False, 'error_type': type(exc).__name__, 'http_status': getattr(exc, 'code', None)}


def verify(manifest: dict, *, network: bool = False, full: bool = False) -> dict:
    files, base = manifest['files'], manifest['base_url']
    if base != 'https://assets.northstarprime.net/idc-continuity-v1-20260906/':
        raise ValueError('Unexpected media destination')
    if len(files) != 26 or len({x['file'] for x in files}) != 26 or any(Path(x['file']).name != x['file'] or '\\' in x['file'] for x in files):
        raise ValueError('Expected 25 videos and their public YouTube mapping with unique flat filenames')
    local = []
    for item in files:
        path = ROOT / 'static' / 'idc_video' / item['file']
        ok = path.is_file() and path.stat().st_size == item['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']
        local.append({'file': item['file'], 'ok': ok})
    remote = []
    if network or full:
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            remote = list(pool.map(lambda item: public_check(item, base, full), files))
    return {'checked_utc': datetime.now(timezone.utc).isoformat(), 'status': 'PASS' if all(x['ok'] for x in local + remote) else 'FAIL', 'local': local, 'public': remote, 'public_hashes_verified': bool(full and remote and all(x['ok'] for x in remote))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--network', action='store_true')
    parser.add_argument('--full', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = verify(json.loads((ROOT / 'IDC_MEDIA_MANIFEST.json').read_text(encoding='utf-8')), network=args.network, full=args.full)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    return int(result['status'] != 'PASS')


if __name__ == '__main__':
    raise SystemExit(main())
