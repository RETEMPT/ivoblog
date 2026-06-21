import json
import os
import signal
import socket
import subprocess
import sys
import threading
import time
import traceback
import urllib.request

import uvicorn
import webview

from cms_core.main import app

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXE_DIR = BASE_DIR
DEFAULT_FRONTEND_PORT = 3001
DEFAULT_BACKEND_PORT = 52560
PORT_SEARCH_LIMIT = 20
WINDOW_CONFIG_FILE = os.path.join(EXE_DIR, "window_config.json")
RUNTIME_STATE_FILE = os.path.join(EXE_DIR, "manager_runtime.json")

frontend_process = None
frontend_port = DEFAULT_FRONTEND_PORT
backend_port = DEFAULT_BACKEND_PORT
is_closing = False


def npm_cmd() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def is_port_available(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(("127.0.0.1", port))
            return True
    except OSError:
        return False


def choose_available_port(preferred_port: int, label: str) -> int:
    for port in range(preferred_port, preferred_port + PORT_SEARCH_LIMIT):
        if is_port_available(port):
            if port != preferred_port:
                print(f"[ports] {label} port {preferred_port} is busy; using {port}.")
            return port
    raise RuntimeError(
        f"No available {label} port in {preferred_port}-{preferred_port + PORT_SEARCH_LIMIT - 1}."
    )


def is_manager_backend_online(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/status", timeout=1.0) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload.get("status") == "online" and "CMS backend" in payload.get("message", "")
    except Exception:
        return False


def exit_if_existing_manager_is_running():
    if is_manager_backend_online(DEFAULT_BACKEND_PORT):
        print(
            f"[startup] Manager backend is already online at "
            f"http://127.0.0.1:{DEFAULT_BACKEND_PORT}/api/status"
        )
        print("[startup] Close the existing manager before starting another instance.")
        sys.exit(0)

    try:
        if not os.path.exists(RUNTIME_STATE_FILE):
            return
        with open(RUNTIME_STATE_FILE, "r", encoding="utf-8") as file:
            state = json.load(file)
        recorded_backend_port = int(state.get("backend_port", DEFAULT_BACKEND_PORT))
        if is_manager_backend_online(recorded_backend_port):
            print(
                f"[startup] Manager backend is already online at "
                f"http://127.0.0.1:{recorded_backend_port}/api/status"
            )
            print("[startup] Close the existing manager before starting another instance.")
            sys.exit(0)
    except Exception:
        pass


def write_runtime_state():
    state = {
        "manager_pid": os.getpid(),
        "frontend_pid": frontend_process.pid if frontend_process else None,
        "frontend_port": frontend_port,
        "backend_port": backend_port,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    try:
        with open(RUNTIME_STATE_FILE, "w", encoding="utf-8") as file:
            json.dump(state, file, indent=2)
    except Exception:
        pass


def clear_runtime_state():
    try:
        if os.path.exists(RUNTIME_STATE_FILE):
            os.remove(RUNTIME_STATE_FILE)
    except Exception:
        pass


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


def start_frontend(port: int):
    global frontend_process

    env_vars = os.environ.copy()
    env_vars["PORT"] = str(port)
    env_vars["HOSTNAME"] = "127.0.0.1"

    standalone_dir = os.path.join(BASE_DIR, ".next", "standalone")
    server_js = os.path.join(standalone_dir, "server.js")

    popen_kwargs = {"env": env_vars}
    if os.name != "nt":
        popen_kwargs["start_new_session"] = True

    if os.path.exists(server_js):
        print(f"[frontend] production mode: http://127.0.0.1:{port}/settings")
        frontend_process = subprocess.Popen(["node", "server.js"], cwd=standalone_dir, **popen_kwargs)
    else:
        print(f"[frontend] dev mode: http://127.0.0.1:{port}/settings")
        frontend_process = subprocess.Popen(
            [npm_cmd(), "run", "dev", "--", "--hostname", "127.0.0.1", "--port", str(port)],
            cwd=BASE_DIR,
            **popen_kwargs,
        )


def stop_frontend_process():
    if not frontend_process or frontend_process.poll() is not None:
        return

    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(frontend_process.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return

    try:
        os.killpg(frontend_process.pid, signal.SIGTERM)
        frontend_process.wait(timeout=5)
    except Exception:
        try:
            os.killpg(frontend_process.pid, signal.SIGKILL)
        except Exception:
            pass


def on_closed():
    global is_closing
    if is_closing:
        return
    is_closing = True
    stop_frontend_process()
    clear_runtime_state()
    os._exit(0)


def on_shown():
    win_size = load_window_size()
    webview.windows[0].resize(int(win_size["width"]), int(win_size["height"]))


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    exit_if_existing_manager_is_running()
    frontend_port = choose_available_port(DEFAULT_FRONTEND_PORT, "frontend")
    backend_port = choose_available_port(DEFAULT_BACKEND_PORT, "backend")

    print("==========================================")
    print("  iV0 Blog Manager")
    print(f"  Frontend: http://127.0.0.1:{frontend_port}/settings")
    print(f"  Backend : http://127.0.0.1:{backend_port}/api/status")
    print("  Close this window to stop")
    print("==========================================")

    write_port_config(backend_port)

    threading.Thread(target=run_api, args=(backend_port,), daemon=True).start()
    start_frontend(frontend_port)
    write_runtime_state()

    if not wait_for_port(backend_port) or not wait_for_port(frontend_port):
        print("Failed to start frontend or backend.")
        on_closed()
        sys.exit(1)

    time.sleep(1.0)

    window = webview.create_window(
        title="iV0 Blog Manager",
        url=f"http://127.0.0.1:{frontend_port}/settings",
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
