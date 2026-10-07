import os
import subprocess
from pathlib import Path
import pytest

COSMOS_DIR = Path(r"C:\Users\andre\scripts\the_workshop\projects\northstarprime-always-on\cosmos")

def test_phase7_blocks_in_main_js():
    main_js = COSMOS_DIR / "main.js"
    assert main_js.exists()
    content = main_js.read_text(encoding="utf-8")
    assert "18:{ name: 'ABYSSAL PRISM'" in content
    assert "19:{ name: 'HADAL SILT'" in content
    assert "20:{ name: 'HYDROTHERMAL SPIRE'" in content

def test_phase7_gates_in_dimensions_js():
    dim_js = COSMOS_DIR / "dimensions.js"
    assert dim_js.exists()
    content = dim_js.read_text(encoding="utf-8")
    assert "over_abyss:" in content
    assert "abyss_back:" in content
    assert "dim: 'abyss'" in content

def test_phase7_abyss_generation_and_mechanics():
    dim_js = COSMOS_DIR / "dimensions.js"
    content = dim_js.read_text(encoding="utf-8")
    assert "function generateAbyss()" in content
    assert "function spawnSiren()" in content
    assert "function updateSiren(dt)" in content
    assert "function fireSirenVortex()" in content
    assert "function checkAbyssMechanics(dt)" in content
    assert "Hydrothermal Spire thermal plume" in content
    assert "Abyssal Prism resonance tapped" in content
    assert "THE ABYSSAL SIREN sings" in content

def test_node_syntax_validation():
    for f in ["dimensions.js", "main.js"]:
        res = subprocess.run(["node", "-c", str(COSMOS_DIR / f)], capture_output=True, text=True)
        assert res.returncode == 0, f"Syntax error in {f}: {res.stderr}"

def test_launcher_and_downloads_delivery():
    downloads_dir = Path(r"C:\Users\andre\Downloads\CUBIC_COSMOS_PHASE7_ABYSS")
    launcher_cmd = Path(r"C:\Users\andre\Desktop\NORTHSTAR_COMMAND_CENTER\04_LAUNCH_SCRIPTS\LAUNCH_CUBIC_COSMOS_PHASE7_ABYSS.cmd")
    assert downloads_dir.exists()
    assert (downloads_dir / "index.html").exists()
    assert launcher_cmd.exists()
    content = launcher_cmd.read_text(encoding="utf-8")
    assert "index.html" in content
