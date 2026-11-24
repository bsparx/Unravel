"""Zero-dependency HTTPS JSON client for Unravel's `/api/desktop/*` API."""

from __future__ import annotations

import json
import os
import threading
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from .config import PENDING_PATH


class UnauthorizedError(RuntimeError):
    """Raised when the token is missing, invalid, or revoked (HTTP 401)."""


class ApiError(RuntimeError):
    """Raised on network or non-2xx server errors."""


class UnravelApi:
    """Thread-safe REST client with a lightweight offline retry buffer."""

    def __init__(self, server_url: str, token: str, pending_path: Path = PENDING_PATH) -> None:
        self.server_url = server_url.rstrip("/")
        self.token = token.strip()
        self._pending_path = pending_path
        self._lock = threading.Lock()

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None, timeout: float = 15.0) -> Any:
        url = f"{self.server_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
            "User-Agent": "UnravelDesktop/1.0 (Ubuntu)",
        }
        if data is not None:
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as err:
            if err.code == 401:
                raise UnauthorizedError("Your desktop session was disconnected or revoked.") from err
            detail = err.read().decode("utf-8", errors="replace")
            try:
                msg = json.loads(detail).get("error") or f"Server returned HTTP {err.code}"
            except Exception:
                msg = f"Server returned HTTP {err.code}"
            raise ApiError(msg) from err
        except urllib.error.URLError as err:
            raise ApiError(f"Offline or unreachable: {err.reason}") from err
        except TimeoutError as err:
            raise ApiError("Request timed out.") from err

    # ---------------------------------------------------------------- endpoints

    def bootstrap(self) -> dict[str, Any]:
        return self._request("GET", "/api/desktop/bootstrap")

    def get_stats(self, end_iso: str | None = None) -> dict[str, Any]:
        qs = f"?{urllib.parse.urlencode({'end': end_iso})}" if end_iso else ""
        return self._request("GET", f"/api/desktop/stats{qs}")

    def get_day(self) -> dict[str, Any]:
        return self._request("GET", "/api/desktop/day")

    def toggle_task(
        self,
        task_id: str,
        done: bool,
        note: str | None = None,
        minutes: int | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"done": done}
        if note is not None:
            body["note"] = note
        if minutes is not None:
            body["minutes"] = minutes
        return self._request("POST", f"/api/desktop/tasks/{urllib.parse.quote(task_id)}/toggle", body)

    def patch_settings(self, patch: dict[str, Any]) -> dict[str, Any]:
        return self._request("PATCH", "/api/desktop/settings", patch)

    def start_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/api/desktop/timer/start", payload)

    def timer_action(self, session_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", f"/api/desktop/timer/{urllib.parse.quote(session_id)}", payload)

    def discard_session(self, session_id: str) -> dict[str, Any]:
        return self._request("DELETE", f"/api/desktop/timer/{urllib.parse.quote(session_id)}")

    def logout(self) -> None:
        try:
            self._request("POST", "/api/desktop/auth/logout", {}, timeout=6.0)
        except Exception:
            pass

    # ---------------------------------------------------------------- offline queue

    def enqueue_pending(self, method: str, path: str, body: dict[str, Any]) -> None:
        """Persist a failed timer mutation so it replays when connectivity returns."""
        with self._lock:
            items = self._read_pending()
            # Keep queue bounded and drop superseded heartbeats for the same path.
            if body.get("action") == "heartbeat":
                items = [i for i in items if not (i.get("path") == path and (i.get("body") or {}).get("action") == "heartbeat")]
            items.append({"method": method, "path": path, "body": body})
            self._write_pending(items[-40:])

    def flush_pending(self) -> int:
        """Replay queued offline mutations in order. Returns number flushed."""
        with self._lock:
            items = self._read_pending()
        if not items:
            return 0
        flushed = 0
        remaining: list[dict[str, Any]] = []
        for idx, item in enumerate(items):
            try:
                self._request(item["method"], item["path"], item.get("body"), timeout=8.0)
                flushed += 1
            except UnauthorizedError:
                raise
            except ApiError:
                remaining = items[idx:]
                break
        with self._lock:
            self._write_pending(remaining)
        return flushed

    def _read_pending(self) -> list[dict[str, Any]]:
        if not self._pending_path.exists():
            return []
        try:
            data = json.loads(self._pending_path.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _write_pending(self, items: list[dict[str, Any]]) -> None:
        if not items:
            try:
                self._pending_path.unlink(missing_ok=True)
            except OSError:
                pass
            return
        self._pending_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._pending_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(items), encoding="utf-8")
        os.chmod(tmp, 0o600)
        tmp.replace(self._pending_path)
        os.chmod(self._pending_path, 0o600)
