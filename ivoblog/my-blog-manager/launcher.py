import json
import os
import socket
import subprocess
import sys
import threading
import time
import traceback

import uvicorn
import webview

from cms_core.main import app

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXE_DIR = BASE_DIR
FRONTEND_PORT = 3001
BACKEND_PORT = 52560
FRONTEND_CLEANUP_PORTS = (FRONTEND_PORT, FRONTEND_PORT + 1, FRONTEND_PORT + 2)
WINDOW_CONFIG_FILE = os.path.join(EXE_DIR, "window_config.json")

frontend_process = None


def npm_cmd() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def release_port(port: int) -> list[str]:
    killed_pids: list[str] = []
    try:
        result = subprocess.check_output(["netstat", "-ano"], text=True, encoding="utf-8", errors="ignore")
        for line in result.strip().splitlines():
            parts = line.strip().split()
            if len(parts) >= 5 and parts[1].endswith(f":{port}") and "LISTENING" in parts:
                pid = parts[-1]
                subprocess.run(
                    ["taskkill", "/PID", pid, "/F", "/T"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                killed_pids.append(pid)
                time.sleep(0.4)
    except Exception:
        pass
    return killed_pids


def release_manager_frontend_ports():
    for port in FRONTEND_CLEANUP_PORTS:
        killed = release_port(port)
        if killed:
            print(f"[cleanup] released frontend port {port}: PID {', '.join(killed)}")


def load_window_size():
    try:
        if os.path.exists(WINDOW_CONFIG_FILE):
            with open(WINDOW_CONFIG_FILE, "r", encoding="utf-8") as file:
                return json.load(file)
    except Exception:
        pass
    return {"width": 1440, "height": 900}


def save_window_size(width, height):
    try:
        with open(WINDOW_CONFIG_FILE, "w", encoding="utf-8") as file:
            json.dump({"width": int(width), "height": int(height)}, file)
    except Exception:
        pass


def write_port_config(port: int):
    public_dir = os.path.join(BASE_DIR, "public")
    os.makedirs(public_dir, exist_ok=True)
    config = {"api_port": port, "api_base": f"http://127.0.0.1:{port}"}

    with open(os.path.join(public_dir, "backend_config.json"), "w", encoding="utf-8") as file:
        json.dump(config, file)

    standalone_public = os.path.join(BASE_DIR, ".next", "standalone", "public")
    if os.path.exists(os.path.join(BASE_DIR, ".next", "standalone")):
        os.makedirs(standalone_public, exist_ok=True)
        with open(os.path.join(standalone_public, "backend_config.json"), "w", encoding="utf-8") as file:
            json.dump(config, file)


def wait_for_port(port: int, timeout=60):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.5)
    return False


class WindowAPI:
    def resize_window(self, width, height):
        save_window_size(width, height)
        webview.windows[0].resize(int(width), int(height))
        return True

    def minimize_window(self):
        webview.windows[0].minimize()

    def maximize_window(self):
        webview.windows[0].toggle_fullscreen()

    def close_window(self):
        on_closed()


def run_api(port: int):
    os.chdir(EXE_DIR)
    print(f"[backend] working directory: {EXE_DIR}")
    try:
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
    except Exception:
        print("[backend] crashed:")
        traceback.print_exc()


def start_frontend():
    global frontend_process

    env_vars = os.environ.copy()
    env_vars["PORT"] = str(FRONTEND_PORT)
    env_vars["HOSTNAME"] = "127.0.0.1"

    standalone_dir = os.path.join(BASE_DIR, ".next", "standalone")
    server_js = os.path.join(standalone_dir, "server.js")

    if os.path.exists(server_js):
        print(f"[frontend] production mode: http://127.0.0.1:{FRONTEND_PORT}/settings")
        frontend_process = subprocess.Popen(["node", "server.js"], cwd=standalone_dir, env=env_vars)
    else:
        print(f"[frontend] dev mode: http://127.0.0.1:{FRONTEND_PORT}/settings")
        frontend_process = subprocess.Popen(
            [npm_cmd(), "run", "dev", "--", "--hostname", "127.0.0.1", "--port", str(FRONTEND_PORT)],
            cwd=BASE_DIR,
            env=env_vars,
        )


def on_closed():
    if frontend_process:
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(frontend_process.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    release_manager_frontend_ports()
    release_port(BACKEND_PORT)
    os._exit(0)


def on_shown():
    win_size = load_window_size()
    webview.windows[0].resize(int(win_size["width"]), int(win_size["height"]))


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    print("==========================================")
    print("  iV0 Blog Manager")
    print(f"  Frontend: http://127.0.0.1:{FRONTEND_PORT}/settings")
    print(f"  Backend : http://127.0.0.1:{BACKEND_PORT}/api/status")
    print("  Close this window to stop")
    print("==========================================")

    release_manager_frontend_ports()
    release_port(BACKEND_PORT)
    write_port_config(BACKEND_PORT)

    threading.Thread(target=run_api, args=(BACKEND_PORT,), daemon=True).start()
    start_frontend()

    if not wait_for_port(BACKEND_PORT) or not wait_for_port(FRONTEND_PORT):
        print("Failed to start frontend or backend.")
        on_closed()
        sys.exit(1)

    time.sleep(1.0)

    window = webview.create_window(
        title="iV0 Blog Manager",
        url=f"http://127.0.0.1:{FRONTEND_PORT}/settings",
        width=1440,
        height=900,
        min_size=(1024, 768),
        background_color="#0f172a",
        resizable=True,
        frameless=True,
        easy_drag=False,
        js_api=WindowAPI(),
    )
    window.events.shown += on_shown
    window.events.closed += on_closed

    try:
        webview.start(debug=False)
    except KeyboardInterrupt:
        on_closed()
