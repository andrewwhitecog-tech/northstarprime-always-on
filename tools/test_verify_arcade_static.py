"""Synthetic temporary fixtures for reference integrity; no browser/game pass claims."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import build_pages_artifact as builder
import verify_arcade_static as arcade


class ArcadeReferenceTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix="arcade-reference-fixture-")
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.addCleanup(patch.stopall)
        patch.object(arcade, "ROOT", self.root).start()
        patch.object(builder, "ROOT", self.root).start()

    def file(self, relative, content=b"synthetic fixture"):
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return {"relative_path": relative, "bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest()}

    def test_rostered_complete_asset_path_passes_with_actual_bytes(self):
        row = self.file("arcade/custom/shared-assets/skin.png")
        arcade.check_custom_reference("/" + row["relative_path"], set(), {row["relative_path"]: row})

    def test_same_size_mutation_of_rostered_asset_fails(self):
        row = self.file("arcade/custom/shared-assets/skin.png", b"AAAA")
        (self.root / row["relative_path"]).write_bytes(b"BBBB")
        with self.assertRaises(SystemExit):
            arcade.check_custom_reference("/" + row["relative_path"], set(), {row["relative_path"]: row})

    def test_unrostered_existing_file_fails(self):
        row = self.file("arcade/custom/shared-assets/skin.png")
        with self.assertRaises(SystemExit):
            arcade.check_custom_reference("/" + row["relative_path"], set(), {})

    def test_unrostered_folder_and_unknown_route_fail(self):
        (self.root / "arcade/custom/shared-assets").mkdir(parents=True)
        for reference in ("/arcade/custom/shared-assets/", "/arcade/custom/unknown"):
            with self.subTest(reference=reference), self.assertRaises(SystemExit):
                arcade.check_custom_reference(reference, set(), {})

    def test_rostered_folder_is_not_a_file(self):
        relative = "arcade/custom/shared-assets"
        (self.root / relative).mkdir(parents=True)
        with self.assertRaises(SystemExit):
            arcade.check_custom_reference("/" + relative, set(), {relative: {"relative_path": relative}})

    def test_known_mirrored_slug_preserves_existing_route_behavior(self):
        for reference in ("/arcade/custom/known", "/arcade/custom/known/", "/arcade/custom/known/assets/art.png", "/arcade/custom/known.html"):
            with self.subTest(reference=reference):
                arcade.check_custom_reference(reference, {"known"}, {})

    def test_traversal_and_foreign_origin_rejected_before_known_slug(self):
        for reference in ("/arcade/custom/known/../outside.png", "/arcade/custom/known/%2e%2e/outside.png", "/arcade/custom/known/%252e%252e/outside.png", "/arcade/custom/known/..\\outside.png", "https://example.invalid/arcade/custom/known"):
            with self.subTest(reference=reference), self.assertRaises(SystemExit):
                arcade.check_custom_reference(reference, {"known"}, {})

    def test_full_regex_capture_keeps_filename_query_and_fragment(self):
        reference = "/arcade/custom/shared-assets/skin.png?v=1#face"
        match = arcade.LOCAL_CUSTOM.search('<img src="' + reference + '">')
        self.assertEqual(match.group("route"), reference)
        row = self.file("arcade/custom/shared-assets/skin.png")
        arcade.check_custom_reference(reference, set(), {row["relative_path"]: row})

    def artifact_fixture(self):
        relative = "arcade/custom/shared-assets/rig.fbx"
        row = self.file(relative, b"Kaydara FBX synthetic fixture bytes")
        artifact = self.root / "curated"
        (artifact / relative).parent.mkdir(parents=True)
        (artifact / relative).write_bytes((self.root / relative).read_bytes())
        (artifact / "nsp-pages-artifact.json").write_text(json.dumps({"source_commit": "a" * 40, "external_release_media": {"paths": []}}), encoding="utf-8")
        placeholder = {"relative_path": "unused.html"}
        payload = {"assets": [row], "games": [], "landing": placeholder, "workshop": placeholder, "catalog": placeholder,
                   "recovered_game_payload": {"paths": [relative]}}
        return relative, artifact, payload

    def test_actual_fbx_and_loader_dependencies_are_not_externalized(self):
        for relative in ("arcade/custom/crib-recovered-assets/kenney-protagonists/Model/characterMedium.fbx", "static/vendor/three/0.160.0/examples/jsm/loaders/FBXLoader.js", "static/vendor/three/0.160.0/examples/jsm/libs/fflate.module.js"):
            with self.subTest(relative=relative):
                self.assertFalse(builder.external_release_media(Path(relative)))
                self.assertFalse(builder.omit_unlinked_pages_payload(Path(relative)))

    def test_curated_binary_payload_matches_frozen_real_copy(self):
        _, artifact, payload = self.artifact_fixture()
        arcade.check_recovered_artifact(payload, artifact)

    def test_curated_mutation_and_missing_fbx_fail(self):
        relative, artifact, payload = self.artifact_fixture()
        target = artifact / relative
        target.write_bytes(b"mutated")
        with self.assertRaises(SystemExit):
            arcade.check_recovered_artifact(payload, artifact)
        target.unlink()
        with self.assertRaises(SystemExit):
            arcade.check_recovered_artifact(payload, artifact)

    def test_curated_payload_cannot_add_an_unfrozen_file(self):
        _, artifact, payload = self.artifact_fixture()
        payload["recovered_game_payload"]["paths"] = ["unfrozen.fbx"]
        with self.assertRaises(SystemExit):
            arcade.check_recovered_artifact(payload, artifact)


if __name__ == "__main__":
    unittest.main()
