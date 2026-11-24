"""Zero-dependency HTTPS Keep-Alive + Gzip JSON client for Unravel's `/api/desktop/*` API."""

from __future__ import annotations

import gzip
import http.client
import json
import os
import ssl
import threading
import urllib.parse
from pathlib import Path
from typing import Any

from .config import PENDING_PATH


class UnauthorizedError(RuntimeError):
    """Raised when the token is missing, invalid, or revoked (HTTP 401)."""


class ApiError(RuntimeError):
    """Raised on network or non-2xx server errors."""


class UnravelApi:
    """Thread-safe REST client with persistent HTTP/1.1 Keep-Alive, gzip, and offline retry queue."""

    def __init__(self, server_url: str, token: str, pending_path: Path = PENDING_PATH) -> None:
        self.server_url = server_url.rstrip("/")
        self.token = token.strip()
        self._pending_path = pending_path
        self._pending_lock = threading.Lock()
        self._http_lock = threading.Lock()
        self._conn: http.client.HTTPConnection | None = None
        self._parsed = urllib.parse.urlparse(self.server_url)
        self._ssl_ctx = ssl.create_default_context() if self._parsed.scheme == "https" else None

    def _get_connection(self, timeout: float) -> http.client.HTTPConnection:
        if self._conn is not None:
            self._conn.timeout = timeout
            return self._conn
        host = self._parsed.hostname or "localhost"
        port = self._parsed.port
        if self._parsed.scheme == "https":
            conn: http.client.HTTPConnection = http.client.HTTPSConnection(
                host, port or 443, timeout=timeout, context=self._ssl_ctx
            )
        else:
            conn = http.client.HTTPConnection(host, port or 80, timeout=timeout)
        self._conn = conn
        return conn

    def _reset_connection(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None, timeout: float = 15.0) -> Any:
        base_path = self._parsed.path.rstrip("/")
        full_path = f"{base_path}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "Connection": "keep-alive",
            "User-Agent": "UnravelDesktop/1.1 (Ubuntu)",
        }
        if data is not None:
            headers["Content-Type"] = "application/json"

        # Reuse keep-alive socket; automatically retry once if server closed idle socket.
        with self._http_lock:
            last_err: Exception | None = None
            for attempt in range(2):
                try:
                    conn = self._get_connection(timeout)
                    conn.request(method, full_path, body=data, headers=headers)
                    resp = conn.getresponse()
                    raw_bytes = resp.read()
                    status = resp.status
                    encoding = (resp.getheader("Content-Encoding") or "").lower()
                    conn_hdr = (resp.getheader("Connection") or "").lower()
                    if conn_hdr == "close":
                        self._reset_connection()
                    if encoding == "gzip" and raw_bytes:
                        raw_bytes = gzip.decompress(raw_bytes)
                    text = raw_bytes.decode("utf-8", errors="replace")
                    if 200 <= status < 300:
                        return json.loads(text) if text else {}
                    if status == 401:
                        raise UnauthorizedError("Your desktop session was disconnected or revoked.")
                    try:
                        msg = json.loads(text).get("error") or f"Server returned HTTP {status}"
                    except Exception:
                        msg = f"Server returned HTTP {status}"
                    raise ApiError(msg)
                except (UnauthorizedError, ApiError):
                    raise
                except (
                    http.client.RemoteDisconnected,
                    http.client.BadStatusLine,
                    http.client.CannotSendRequest,
                    BrokenPipeError,
                    ConnectionResetError,
                ) as err:
                    self._reset_connection()
                    last_err = err
                    if attempt == 0:
                        continue
                    raise ApiError(f"Connection reset: {err}") from err
                except TimeoutError as err:
                    self._reset_connection()
                    raise ApiError("Request timed out.") from err
                except OSError as err:
                    self._reset_connection()
                    raise ApiError(f"Offline or unreachable: {err}") from err
            raise ApiError(str(last_err or "Request failed"))

    def close(self) -> None:
        with self._http_lock:
            self._reset_connection()

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
        self.close()

    # ---------------------------------------------------------------- offline queue

    def enqueue_pending(self, method: str, path: str, body: dict[str, Any]) -> None:
        """Persist a failed timer mutation so it replays when connectivity returns."""
        with self._pending_lock:
            items = self._read_pending()
            if body.get("action") == "heartbeat":
                items = [
                    i
                    for i in items
                    if not (i.get("path") == path and (i.get("body") or {}).get("action") == "heartbeat")
                ]
            items.append({"method": method, "path": path, "body": body})
            self._write_pending(items[-40:])

    def flush_pending(self) -> int:
        """Replay queued offline mutations in order. Returns number flushed."""
        with self._pending_lock:
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
        with self._pending_lock:
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
