import os
import subprocess
from pathlib import Path
import pytest

COSMOS_DIR = Path(r"C:\Users\andre\scripts\the_workshop\projects\northstarprime-always-on\cosmos")

def test_phase10_blocks_in_main_js():
    main_js = COSMOS_DIR / "main.js"
    assert main_js.exists()
    content = main_js.read_text(encoding="utf-8")
    assert "27:{ name: 'SOLAR PRISM'" in content
    assert "28:{ name: 'SOLAR CORE'" in content
    assert "29:{ name: 'HELIOS SHARD'" in content
    assert "27, 28, 29" in content

def test_phase10_gates_in_dimensions_js():
    dim_js = COSMOS_DIR / "dimensions.js"
    assert dim_js.exists()
    content = dim_js.read_text(encoding="utf-8")
    assert "over_solaris:" in content
    assert "solaris_back:" in content
    assert "dim: 'solaris'" in content

def test_phase10_solaris_generation_and_mechanics():
    dim_js = COSMOS_DIR / "dimensions.js"
    content = dim_js.read_text(encoding="utf-8")
    assert "function generateSolaris()" in content
    assert "function spawnPhoenix()" in content
    assert "function updatePhoenix(dt)" in content
    assert "function fireSolarFlarePulse()" in content
    assert "function checkSolarisMechanics(dt)" in content
    assert "THE HELIOS PHOENIX radiates a coronal solar flare" in content
    assert "Solar Core thermal convection — radiant aether leap!" in content
    assert "Helios Shard resonance harvested — +12 SpaceCash Helios Sun-Gems!" in content

def test_node_syntax_validation():
    for f in ["dimensions.js", "main.js"]:
        res = subprocess.run(["node", "-c", str(COSMOS_DIR / f)], capture_output=True, text=True)
        assert res.returncode == 0, f"Syntax error in {f}: {res.stderr}"

def test_launcher_and_downloads_delivery():
    downloads_dir = Path(r"C:\Users\andre\Downloads\CUBIC_COSMOS_PHASE10_SOLARIS")
    launcher_cmd = Path(r"C:\Users\andre\Desktop\NORTHSTAR_COMMAND_CENTER\04_LAUNCH_SCRIPTS\LAUNCH_CUBIC_COSMOS_PHASE10_SOLARIS.cmd")
    assert downloads_dir.exists()
    assert (downloads_dir / "index.html").exists()
    assert launcher_cmd.exists()
    content = launcher_cmd.read_text(encoding="utf-8")
    assert "index.html" in content
