"""One-click Clerk browser sign-in via localhost loopback + PKCE (S256).

Zero secrets or database credentials live inside the desktop app. The browser
signs in via Clerk on Unravel's server, receives a 60s single-use code on
`127.0.0.1`, and this module exchanges it over HTTPS for a per-user `unr_...`
personal token.
"""

from __future__ import annotations

import base64
import hashlib
import http.server
import json
import secrets
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from dataclasses import dataclass


SUCCESS_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Connected to Unravel</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #fce7f3 0%, #eff6ff 55%, #ecfdf5 100%);
      color: #0f172a;
    }
    .card {
      background: rgba(255,255,255,0.86); backdrop-filter: blur(14px);
      border: 1px solid rgba(15,23,42,0.08); border-radius: 24px;
      padding: 36px 40px; max-width: 420px; text-align: center;
      box-shadow: 0 20px 50px -24px rgba(15,23,42,0.22);
    }
    h1 { margin: 0 0 8px; font-size: 24px; font-weight: 600; }
    p { margin: 0; color: #475569; line-height: 1.5; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connected to Unravel</h1>
    <p>Your Ubuntu desktop app is now signed in. You can safely close this browser tab.</p>
  </div>
</body>
</html>
"""

ERROR_HTML = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Unravel Sign-In</title></head>
<body style="font-family:system-ui,sans-serif;padding:48px;text-align:center;color:#0f172a;">
  <h1>Sign-in could not be completed</h1>
  <p>Please return to the Unravel desktop app and try again.</p>
</body>
</html>
"""


def generate_pkce_pair() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) per RFC 7636 S256."""
    verifier = secrets.token_urlsafe(48)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


@dataclass
class AuthResult:
    token: str
    prefix: str
    label: str
    user_name: str
    user_email: str


class BrowserAuthFlow:
    """Cancellable one-shot localhost callback + PKCE code exchange."""

    def __init__(self, server_url: str, device_label: str) -> None:
        self.server_url = server_url.rstrip("/")
        self.device_label = device_label
        self._cancel = threading.Event()
        self._httpd: http.server.HTTPServer | None = None

    def cancel(self) -> None:
        self._cancel.set()
        if self._httpd is not None:
            try:
                self._httpd.shutdown()
            except Exception:
                pass

    def run(self, timeout_seconds: float = 180.0) -> AuthResult:
        verifier, challenge = generate_pkce_pair()
        state = secrets.token_urlsafe(24)
        received: dict[str, str] = {}
        done = threading.Event()

        class CallbackHandler(http.server.BaseHTTPRequestHandler):
            def log_message(self, format: str, *args) -> None:
                return

            def do_GET(self) -> None:
                parsed = urllib.parse.urlparse(self.path)
                if parsed.path != "/callback":
                    self.send_response(404)
                    self.end_headers()
                    return
                qs = urllib.parse.parse_qs(parsed.query)
                got_code = (qs.get("code") or [""])[0]
                got_state = (qs.get("state") or [""])[0]
                if not got_code or not secrets.compare_digest(got_state, state):
                    body = ERROR_HTML.encode("utf-8")
                    self.send_response(400)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return

                received["code"] = got_code
                body = SUCCESS_HTML.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                done.set()

        httpd = http.server.HTTPServer(("127.0.0.1", 0), CallbackHandler)
        httpd.timeout = 0.5
        self._httpd = httpd
        port = httpd.server_address[1]

        params = urllib.parse.urlencode(
            {
                "port": str(port),
                "state": state,
                "challenge": challenge,
                "device": self.device_label,
            }
        )
        connect_url = f"{self.server_url}/desktop/connect?{params}"
        webbrowser.open(connect_url)

        try:
            deadline = threading.Event()
            elapsed = 0.0
            while not done.is_set() and not self._cancel.is_set() and elapsed < timeout_seconds:
                httpd.handle_request()
                elapsed += httpd.timeout
            _ = deadline
        finally:
            try:
                httpd.server_close()
            except Exception:
                pass
            self._httpd = None

        if self._cancel.is_set():
            raise RuntimeError("Sign-in cancelled.")
        if "code" not in received:
            raise TimeoutError("Timed out waiting for browser sign-in.")

        return exchange_auth_code(self.server_url, received["code"], verifier)


def exchange_auth_code(server_url: str, code: str, code_verifier: str) -> AuthResult:
    url = f"{server_url.rstrip('/')}/api/desktop/auth/exchange"
    payload = json.dumps({"code": code, "codeVerifier": code_verifier}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "UnravelDesktop/1.0 (Ubuntu)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        try:
            msg = json.loads(detail).get("error") or f"HTTP {err.code}"
        except Exception:
            msg = f"HTTP {err.code}"
        raise RuntimeError(f"Could not finish sign-in: {msg}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"Could not reach {server_url}: {err.reason}") from err

    user = data.get("user") or {}
    return AuthResult(
        token=data["token"],
        prefix=data.get("prefix", ""),
        label=data.get("label", ""),
        user_name=user.get("name") or "",
        user_email=user.get("email") or "",
    )
