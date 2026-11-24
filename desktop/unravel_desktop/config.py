"""Persistent local configuration for Unravel Desktop (~/.config/unravel-desktop/)."""

from __future__ import annotations

import json
import os
import socket
from dataclasses import asdict, dataclass, field
from pathlib import Path

from . import DEFAULT_SERVER_URL

CONFIG_DIR = Path.home() / ".config" / "unravel-desktop"
CONFIG_PATH = CONFIG_DIR / "config.json"
PENDING_PATH = CONFIG_DIR / "pending.json"
CACHE_DIR = Path.home() / ".cache" / "unravel-desktop"
CACHE_PATH = CACHE_DIR / "cache.json"
AUTOSTART_PATH = Path.home() / ".config" / "autostart" / "unravel-desktop.desktop"


def default_device_label() -> str:
    host = socket.gethostname().strip()
    return f"Ubuntu ({host})" if host else "Ubuntu Desktop"


@dataclass
class AppConfig:
    server_url: str = DEFAULT_SERVER_URL
    token: str = ""
    user_name: str = ""
    user_email: str = ""
    device_label: str = field(default_factory=default_device_label)
    theme: str = "system"  # "system" | "light" | "dark"
    autostart: bool = False
    mini_mode: bool = False
    excluded_stats_items: list[str] = field(default_factory=list)

    @property
    def is_connected(self) -> bool:
        return bool(self.token.strip() and self.server_url.strip())

    def normalized_server_url(self) -> str:
        url = (self.server_url or DEFAULT_SERVER_URL).strip().rstrip("/")
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        return url


def load_config(path: Path = CONFIG_PATH) -> AppConfig:
    if not path.exists():
        return AppConfig()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            return AppConfig()
        valid = {k: raw[k] for k in AppConfig.__dataclass_fields__ if k in raw}
        cfg = AppConfig(**valid)
        if not cfg.server_url:
            cfg.server_url = DEFAULT_SERVER_URL
        if cfg.theme not in ("system", "light", "dark"):
            cfg.theme = "system"
        if not isinstance(cfg.excluded_stats_items, list):
            cfg.excluded_stats_items = []
        return cfg
    except Exception:
        return AppConfig()


def save_config(cfg: AppConfig, path: Path = CONFIG_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(asdict(cfg), indent=2), encoding="utf-8")
    os.chmod(tmp, 0o600)
    tmp.replace(path)
    os.chmod(path, 0o600)


def load_cache(path: Path = CACHE_PATH) -> dict:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_cache(data: dict, path: Path = CACHE_PATH) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        os.chmod(tmp, 0o600)
        tmp.replace(path)
        os.chmod(path, 0o600)
    except OSError:
        pass


def sync_autostart(enabled: bool, exec_path: str | None = None) -> None:
    """Create or remove the XDG autostart desktop entry for GNOME login."""
    if not enabled:
        try:
            AUTOSTART_PATH.unlink(missing_ok=True)
        except OSError:
            pass
        return

    AUTOSTART_PATH.parent.mkdir(parents=True, exist_ok=True)
    cmd = exec_path or str(Path.home() / ".local" / "bin" / "unravel-desktop")
    entry = (
        "[Desktop Entry]\n"
        "Type=Application\n"
        "Name=Unravel\n"
        "Comment=Unravel Pomodoro timer and statistics companion\n"
        f"Exec={cmd} --minimized\n"
        "Icon=unravel-desktop\n"
        "Terminal=false\n"
        "X-GNOME-Autostart-enabled=true\n"
    )
    AUTOSTART_PATH.write_text(entry, encoding="utf-8")
