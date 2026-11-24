"""Sign-in / onboarding screen with 1-click Clerk browser handoff & manual fallback."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Callable

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, GLib, Gtk

from .api import ApiError, UnauthorizedError, UnravelApi
from .auth_flow import AuthResult, BrowserAuthFlow
from .config import AppConfig


class ConnectView(Gtk.Box):
    """Serene sign-in view requiring zero DB credentials or Clerk keys."""

    def __init__(
        self,
        config: AppConfig,
        icon_path: Path,
        on_connected: Callable[[str, str, str, str], None],
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self._config = config
        self._on_connected = on_connected
        self._active_flow: BrowserAuthFlow | None = None

        scroll = Gtk.ScrolledWindow()
        scroll.set_vexpand(True)
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

        clamp = Adw.Clamp()
        clamp.set_maximum_size(520)
        clamp.set_margin_top(36)
        clamp.set_margin_bottom(36)
        clamp.set_margin_start(24)
        clamp.set_margin_end(24)

        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18)
        card.add_css_class("unravel-card")
        card.set_valign(Gtk.Align.CENTER)

        # Icon + title
        header = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        header.set_halign(Gtk.Align.CENTER)
        if icon_path.exists():
            icon_img = Gtk.Image.new_from_file(str(icon_path))
            icon_img.set_pixel_size(64)
            icon_img.set_halign(Gtk.Align.CENTER)
            header.append(icon_img)

        title = Gtk.Label(label="Welcome to Unravel")
        title.add_css_class("unravel-welcome-title")
        header.append(title)

        sub = Gtk.Label(
            label="Sign in with your Unravel account in your browser to sync your timer, Today's open list, and statistics."
        )
        sub.set_wrap(True)
        sub.set_justify(Gtk.Justification.CENTER)
        sub.add_css_class("unravel-muted")
        header.append(sub)
        card.append(header)

        # Primary 1-click Clerk browser sign-in button
        self._signin_btn = Gtk.Button(label="Sign in with Unravel")
        self._signin_btn.add_css_class("unravel-primary-btn")
        self._signin_btn.set_size_request(-1, 54)
        self._signin_btn.connect("clicked", self._on_browser_signin)
        card.append(self._signin_btn)

        # Waiting indicator + cancel button (hidden until active)
        self._wait_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        self._wait_box.set_halign(Gtk.Align.CENTER)
        self._wait_box.set_visible(False)
        self._spinner = Gtk.Spinner()
        self._wait_label = Gtk.Label(label="Waiting for browser confirmation…")
        self._wait_label.add_css_class("dim-label")
        cancel_btn = Gtk.Button(label="Cancel")
        cancel_btn.add_css_class("flat")
        cancel_btn.connect("clicked", self._on_cancel_flow)
        self._wait_box.append(self._spinner)
        self._wait_box.append(self._wait_label)
        self._wait_box.append(cancel_btn)
        card.append(self._wait_box)

        # Status / error message
        self._error_label = Gtk.Label()
        self._error_label.set_wrap(True)
        self._error_label.set_justify(Gtk.Justification.CENTER)
        self._error_label.add_css_class("error")
        self._error_label.set_visible(False)
        card.append(self._error_label)

        # Collapsible advanced / manual fallback section
        expander = Gtk.Expander(label="Manual token or custom server")
        adv = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        adv.set_margin_top(12)

        url_lbl = Gtk.Label(label="Unravel server URL", xalign=0)
        url_lbl.add_css_class("caption")
        url_lbl.add_css_class("dim-label")
        self._url_entry = Gtk.Entry()
        self._url_entry.set_text(config.normalized_server_url())
        self._url_entry.set_placeholder_text("https://unravel-chi.vercel.app")
        adv.append(url_lbl)
        adv.append(self._url_entry)

        dev_lbl = Gtk.Label(label="Device name", xalign=0)
        dev_lbl.add_css_class("caption")
        dev_lbl.add_css_class("dim-label")
        self._device_entry = Gtk.Entry()
        self._device_entry.set_text(config.device_label)
        self._device_entry.set_placeholder_text("Ubuntu Laptop")
        adv.append(dev_lbl)
        adv.append(self._device_entry)

        sep = Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL)
        sep.set_margin_top(4)
        sep.set_margin_bottom(4)
        adv.append(sep)

        tok_lbl = Gtk.Label(label="Paste a manual token from Settings → Desktop companion", xalign=0)
        tok_lbl.add_css_class("caption")
        tok_lbl.add_css_class("dim-label")
        self._token_entry = Gtk.PasswordEntry()
        self._token_entry.set_show_peek_icon(True)
        self._token_entry.set_property("placeholder-text", "unr_…")
        self._manual_btn = Gtk.Button(label="Connect with token")
        self._manual_btn.add_css_class("pill")
        self._manual_btn.connect("clicked", self._on_manual_connect)
        adv.append(tok_lbl)
        adv.append(self._token_entry)
        adv.append(self._manual_btn)

        expander.set_child(adv)
        card.append(expander)

        note = Gtk.Label(
            label="No database credentials are stored on this machine. You can revoke access anytime from Unravel Settings."
        )
        note.set_wrap(True)
        note.set_justify(Gtk.Justification.CENTER)
        note.add_css_class("caption")
        note.add_css_class("dim-label")
        card.append(note)

        clamp.set_child(card)
        scroll.set_child(clamp)
        self.append(scroll)

    def show_message(self, message: str) -> None:
        self._error_label.set_text(message)
        self._error_label.set_visible(bool(message))

    def _server_url(self) -> str:
        raw = self._url_entry.get_text().strip().rstrip("/")
        if not raw:
            raw = self._config.normalized_server_url()
        if not raw.startswith(("http://", "https://")):
            raw = "https://" + raw
        return raw

    def _set_busy(self, busy: bool, text: str = "Waiting for browser confirmation…") -> None:
        self._signin_btn.set_sensitive(not busy)
        self._manual_btn.set_sensitive(not busy)
        self._wait_label.set_text(text)
        self._wait_box.set_visible(busy)
        if busy:
            self._spinner.start()
        else:
            self._spinner.stop()

    def _on_browser_signin(self, _btn: Gtk.Button) -> None:
        self.show_message("")
        server_url = self._server_url()
        device = self._device_entry.get_text().strip() or self._config.device_label
        self._config.device_label = device
        flow = BrowserAuthFlow(server_url, device)
        self._active_flow = flow
        self._set_busy(True, "Approve in your browser to finish signing in…")

        def worker() -> None:
            try:
                res: AuthResult = flow.run(timeout_seconds=180.0)
                GLib.idle_add(self._finish_success, server_url, res.token, res.user_name, res.user_email)
            except Exception as exc:
                GLib.idle_add(self._finish_error, str(exc))

        threading.Thread(target=worker, daemon=True).start()

    def _on_cancel_flow(self, _btn: Gtk.Button) -> None:
        if self._active_flow is not None:
            self._active_flow.cancel()
            self._active_flow = None
        self._set_busy(False)

    def _on_manual_connect(self, _btn: Gtk.Button) -> None:
        self.show_message("")
        server_url = self._server_url()
        token = self._token_entry.get_text().strip()
        if not token.startswith("unr_") or len(token) < 24:
            self.show_message("Paste a valid token starting with unr_ from Unravel Settings.")
            return
        self._set_busy(True, "Checking token…")

        def worker() -> None:
            try:
                api = UnravelApi(server_url, token)
                data = api.bootstrap()
                u = data.get("user") or {}
                GLib.idle_add(
                    self._finish_success,
                    server_url,
                    token,
                    u.get("name") or "",
                    u.get("email") or "",
                )
            except (UnauthorizedError, ApiError) as exc:
                GLib.idle_add(self._finish_error, str(exc))

        threading.Thread(target=worker, daemon=True).start()

    def _finish_success(self, server_url: str, token: str, name: str, email: str) -> None:
        self._active_flow = None
        self._set_busy(False)
        self._token_entry.set_text("")
        self._on_connected(server_url, token, name, email)

    def _finish_error(self, message: str) -> None:
        self._active_flow = None
        self._set_busy(False)
        self.show_message(message)
