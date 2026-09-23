import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from grok_agent import GrokAgent, PERSONAS, RECEIPT_SCHEMA


class TestGrokAgent(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.agent = GrokAgent(log_dir=Path(self.temp_dir.name))

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_persona_formatting(self):
        for persona in PERSONAS.keys():
            prompt = self.agent.format_prompt(persona, "Test task content")
            self.assertIn("Test task content", prompt)
            self.assertIn(PERSONAS[persona]["name"], prompt)

    def test_dry_run_execution_and_receipt(self):
        res = self.agent.run_inference(
            prompt="Analyze coastal conversion flow",
            persona="adversarial_critic",
            dry_run=True,
        )
        self.assertEqual(res["schema"], RECEIPT_SCHEMA)
        self.assertEqual(res["status"], "dry_run_success")
        self.assertEqual(res["persona"], "adversarial_critic")
        self.assertIn("receipt_sha256", res)
        self.assertEqual(len(res["receipt_sha256"]), 64)
        self.assertTrue(Path(res["receipt_path"]).exists())

        with open(res["receipt_path"], "r", encoding="utf-8") as f:
            saved = json.load(f)
        self.assertEqual(saved["schema"], RECEIPT_SCHEMA)
        self.assertEqual(saved["receipt_sha256"], res["receipt_sha256"])


if __name__ == "__main__":
    unittest.main()
