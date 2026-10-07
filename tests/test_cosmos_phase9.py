import os
import subprocess
from pathlib import Path
import pytest

COSMOS_DIR = Path(r"C:\Users\andre\scripts\the_workshop\projects\northstarprime-always-on\cosmos")

def test_phase9_blocks_in_main_js():
    main_js = COSMOS_DIR / "main.js"
    assert main_js.exists()
    content = main_js.read_text(encoding="utf-8")
    assert "24:{ name: 'FROST OBSIDIAN'" in content
    assert "25:{ name: 'GLACIAL CORE'" in content
    assert "26:{ name: 'CRYO SHARD'" in content
    assert "24, 25, 26" in content

def test_phase9_gates_in_dimensions_js():
    dim_js = COSMOS_DIR / "dimensions.js"
    assert dim_js.exists()
    content = dim_js.read_text(encoding="utf-8")
    assert "over_frost:" in content
    assert "frost_back:" in content
    assert "dim: 'frost'" in content

def test_phase9_frost_generation_and_mechanics():
    dim_js = COSMOS_DIR / "dimensions.js"
    content = dim_js.read_text(encoding="utf-8")
    assert "function generateFrost()" in content
    assert "function spawnColossus()" in content
    assert "function updateColossus(dt)" in content
    assert "function fireBlizzardPulse()" in content
    assert "function checkFrostMechanics(dt)" in content
    assert "THE CRYO-COLOSSUS unleashes an arctic flash freeze" in content
    assert "Glacial Core kinetic launch — cryogenic vault leap!" in content
    assert "Cryo-Shard resonance harvested — +10 SpaceCash Hyperborean Gems!" in content

def test_node_syntax_validation():
    for f in ["dimensions.js", "main.js"]:
        res = subprocess.run(["node", "-c", str(COSMOS_DIR / f)], capture_output=True, text=True)
        assert res.returncode == 0, f"Syntax error in {f}: {res.stderr}"

def test_launcher_and_downloads_delivery():
    downloads_dir = Path(r"C:\Users\andre\Downloads\CUBIC_COSMOS_PHASE9_FROST")
    launcher_cmd = Path(r"C:\Users\andre\Desktop\NORTHSTAR_COMMAND_CENTER\04_LAUNCH_SCRIPTS\LAUNCH_CUBIC_COSMOS_PHASE9_FROST.cmd")
    assert downloads_dir.exists()
    assert (downloads_dir / "index.html").exists()
    assert launcher_cmd.exists()
    content = launcher_cmd.read_text(encoding="utf-8")
    assert "index.html" in content
