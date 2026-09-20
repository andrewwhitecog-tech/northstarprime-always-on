"""Regression checks for lost catalog entries and competing player regressions."""
import copy
import json
from pathlib import Path
import unittest

from verify_idr_static import inspect


class RadioFreezeTests(unittest.TestCase):
    root = Path(__file__).resolve().parents[1]
    path = root / "idr/index.html"
    source = path.read_text(encoding="utf-8")
    manifest = json.loads((root / "IDR_FREEZE_MANIFEST.json").read_text(encoding="utf-8"))

    def checks(self, source=None, manifest=None):
        return inspect(source or self.source, manifest or self.manifest, self.root, self.path)

    def test_complete_candidate_passes(self):
        checks = self.checks()
        self.assertEqual([key for key, ok in checks.items() if not ok], [])

    def test_substituted_track_fails_even_when_manifest_agrees(self):
        manifest = copy.deepcopy(self.manifest)
        old = manifest["tracks"][0]["src"]
        new = "https://assets.northstarprime.net/idr_audio/substitute.mp3"
        manifest["tracks"][0]["src"] = new
        checks = self.checks(self.source.replace(old, new), manifest)
        self.assertTrue(checks["manifest_catalog_matches_html"])
        self.assertFalse(checks["all_50_original_urls"])

    def test_extra_audio_owner_fails(self):
        self.assertFalse(self.checks(self.source + "<audio controls></audio>")["one_audio_owner"])

    def test_autoplay_regression_fails(self):
        self.assertFalse(self.checks(self.source.replace("<audio ", "<audio autoplay "))["no_autoplay_or_initial_media_fetch"])

    def test_station_ident_cannot_silently_become_a_song(self):
        checks = self.checks(self.source.replace('data-kind="ident"', 'data-kind="song"', 1))
        self.assertFalse(checks["39_songs_11_station_sounds"])
        self.assertFalse(checks["track_metadata_matches_html"])


if __name__ == "__main__":
    unittest.main()
