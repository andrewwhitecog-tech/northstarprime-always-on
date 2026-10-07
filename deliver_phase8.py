import os
import shutil
from pathlib import Path

SRC_DIR = Path(r"C:\Users\andre\scripts\the_workshop\projects\northstarprime-always-on\cosmos")
DOWNLOADS_DIR = Path(r"C:\Users\andre\Downloads\CUBIC_COSMOS_PHASE8_SINGULARITY")
LAUNCHERS_DIR = Path(r"C:\Users\andre\Desktop\NORTHSTAR_COMMAND_CENTER\04_LAUNCH_SCRIPTS")

def deliver():
    print("=== Delivering Cubic Cosmos Phase 8 Deliverables ===")
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    LAUNCHERS_DIR.mkdir(parents=True, exist_ok=True)

    # Copy cosmos tree to Downloads bundle
    for item in SRC_DIR.rglob("*"):
        if item.is_file():
            rel = item.relative_to(SRC_DIR)
            target = DOWNLOADS_DIR / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)

    print(f"Staged cosmos bundle to {DOWNLOADS_DIR}")

    # Create turnkey launcher
    html_target = SRC_DIR / "index.html"
    launcher_file = LAUNCHERS_DIR / "LAUNCH_CUBIC_COSMOS_PHASE8_SINGULARITY.cmd"
    cmd_content = f"@echo off\r\nstart \"\" \"{html_target}\"\r\nexit\r\n"
    launcher_file.write_text(cmd_content, encoding="utf-8")
    print(f"Launcher created at {launcher_file}")
    print("=== Phase 8 Delivery Complete ===")

if __name__ == "__main__":
    deliver()
