import hashlib
import io
import unittest
from email.message import Message
from unittest.mock import patch

import verify_video_storage as video


class Response(io.BytesIO):
    def __init__(self, data, status=206, mime='video/mp4', byte_range=None):
        super().__init__(data)
        self.status = status
        self.headers = Message()
        self.headers['Content-Type'] = mime
        if byte_range:
            self.headers['Content-Range'] = byte_range


class VideoStorageTests(unittest.TestCase):
    def setUp(self):
        self.item = {'file': 'movie.mp4', 'bytes': 4, 'sha256': hashlib.sha256(b'abcd').hexdigest()}

    def check(self, response, full=False):
        with patch.object(video.urllib.request, 'urlopen', return_value=response):
            return video.public_check(self.item, 'https://assets.northstarprime.net/', full)

    def test_range_proves_length_and_mime(self):
        self.assertTrue(self.check(Response(b'abcd', byte_range='bytes 0-3/4'))['ok'])

    def test_html_or_wrong_range_never_passes(self):
        self.assertFalse(self.check(Response(b'abcd', mime='text/html', byte_range='bytes 0-3/4'))['ok'])
        self.assertFalse(self.check(Response(b'abcd', byte_range='bytes 0-3/999'))['ok'])
        self.assertFalse(self.check(Response(b'abcd', status=200))['ok'])

    def test_same_length_different_bytes_fails_full_hash(self):
        self.assertFalse(self.check(Response(b'efgh', status=200), full=True)['ok'])
        self.assertTrue(self.check(Response(b'abcd', status=200), full=True)['ok'])

    def test_http_failure_preserves_failed_state(self):
        with patch.object(video.urllib.request, 'urlopen', side_effect=video.urllib.error.HTTPError('url', 404, 'missing', {}, None)):
            result = video.public_check(self.item, 'https://assets.northstarprime.net/', False)
        self.assertFalse(result['ok'])
        self.assertEqual(result['http_status'], 404)


if __name__ == '__main__':
    unittest.main()
