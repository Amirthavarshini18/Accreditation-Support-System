"""Run this script with: python install_deps.py
It uses pip programmatically to install into the correct venv."""
import subprocess
import sys
import os

# Use the venv's Python executable (the one running this script)
pip_args = [
    sys.executable, "-m", "pip", "install",
    "djangorestframework-simplejwt",
    "pyjwt",
    "google-auth",
    "requests",
]
print(f"Installing into: {sys.executable}")
result = subprocess.run(pip_args, capture_output=False)
print("Done. Exit code:", result.returncode)
