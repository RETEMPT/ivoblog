import importlib.util
import os
import subprocess
import sys

PYTHON_PACKAGES = {
    "webview": "pywebview",
    "fastapi": "fastapi",
    "uvicorn": "uvicorn",
    "multipart": "python-multipart",
    "requests": "requests",
    "yaml": "PyYAML",
    "markdown": "markdown",
    "markdownify": "markdownify",
    "httpx": "httpx",
}


def npm_cmd() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def check_node_environment():
    print("[check] Node.js dependencies...")
    if not os.path.exists("node_modules"):
        print("[setup] node_modules not found, running npm install...")
        try:
            subprocess.check_call([npm_cmd(), "install"])
        except Exception as exc:
            print(f"[error] npm install failed: {exc}")
            return False
    print("[ok] Node.js dependencies ready.")
    return True


def check_python_environment():
    print("[check] Python dependencies...")
    python_exe = sys.executable
    for import_name, install_name in PYTHON_PACKAGES.items():
        if importlib.util.find_spec(import_name) is None:
            print(f"[setup] installing {install_name}...")
            subprocess.check_call([python_exe, "-m", "pip", "install", install_name])
    print("[ok] Python dependencies ready.")
    return True


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print("==========================================")
    print("  iV0 Blog Manager bootstrap")
    print("==========================================")

    if check_node_environment() and check_python_environment():
        print("[start] launching manager...")
        raise SystemExit(subprocess.call([sys.executable, "launcher.py"]))

    print("[error] Environment check failed.")
    input("Press Enter to exit...")
