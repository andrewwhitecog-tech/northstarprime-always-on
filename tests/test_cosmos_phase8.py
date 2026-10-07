import os
import subprocess
from pathlib import Path
import pytest

COSMOS_DIR = Path(r"C:\Users\andre\scripts\the_workshop\projects\northstarprime-always-on\cosmos")

def test_phase8_blocks_in_main_js():
    main_js = COSMOS_DIR / "main.js"
    assert main_js.exists()
    content = main_js.read_text(encoding="utf-8")
    assert "21:{ name: 'VOID TESSERACT'" in content
    assert "22:{ name: 'CHRONO QUARTZ'" in content
    assert "23:{ name: 'SINGULARITY EYE'" in content

def test_phase8_gates_in_dimensions_js():
    dim_js = COSMOS_DIR / "dimensions.js"
    assert dim_js.exists()
    content = dim_js.read_text(encoding="utf-8")
    assert "over_singularity:" in content
    assert "singularity_back:" in content
    assert "dim: 'singularity'" in content

def test_phase8_singularity_generation_and_mechanics():
    dim_js = COSMOS_DIR / "dimensions.js"
    content = dim_js.read_text(encoding="utf-8")
    assert "function generateSingularity()" in content
    assert "function spawnSphinx()" in content
    assert "function updateSphinx(dt)" in content
    assert "function fireChronoPulse()" in content
    assert "function checkSingularityMechanics(dt)" in content
    assert "THE CHRONO-SPHINX dilates the temporal flow" in content
    assert "Chrono Quartz temporal resonance harvested" in content
    assert "Singularity Eye wormhole traversed" in content

def test_node_syntax_validation():
    for f in ["dimensions.js", "main.js"]:
        res = subprocess.run(["node", "-c", str(COSMOS_DIR / f)], capture_output=True, text=True)
        assert res.returncode == 0, f"Syntax error in {f}: {res.stderr}"

def test_launcher_and_downloads_delivery():
    downloads_dir = Path(r"C:\Users\andre\Downloads\CUBIC_COSMOS_PHASE8_SINGULARITY")
    launcher_cmd = Path(r"C:\Users\andre\Desktop\NORTHSTAR_COMMAND_CENTER\04_LAUNCH_SCRIPTS\LAUNCH_CUBIC_COSMOS_PHASE8_SINGULARITY.cmd")
    assert downloads_dir.exists()
    assert (downloads_dir / "index.html").exists()
    assert launcher_cmd.exists()
    content = launcher_cmd.read_text(encoding="utf-8")
    assert "index.html" in content
