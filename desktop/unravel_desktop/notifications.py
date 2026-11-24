"""Native Ubuntu GNOME notifications (`libnotify`) & Wayland-safe wake-lock."""

from __future__ import annotations

import gi

gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
from gi.repository import Gio, GLib

try:
    gi.require_version("Notify", "0.7")
    from gi.repository import Notify
except Exception:
    Notify = None  # type: ignore[assignment]


class DesktopAlerts:
    """Sends native Ubuntu notifications and manages ScreenSaver sleep inhibit."""

    def __init__(self, app_name: str = "Unravel") -> None:
        self._app_name = app_name
        self._notify_ok = False
        self._inhibit_cookie: int | None = None
        if Notify is not None:
            try:
                Notify.init(app_name)
                self._notify_ok = True
            except Exception:
                self._notify_ok = False

    def send(self, title: str, body: str, urgency: str = "normal") -> None:
        if not self._notify_ok or Notify is None:
            return
        try:
            n = Notify.Notification.new(title, body, "unravel-desktop")
            if urgency == "low":
                n.set_urgency(Notify.Urgency.LOW)
            elif urgency == "critical":
                n.set_urgency(Notify.Urgency.CRITICAL)
            else:
                n.set_urgency(Notify.Urgency.NORMAL)
            n.show()
        except Exception:
            pass

    def set_wake_lock(self, active: bool) -> None:
        """Hold or release org.freedesktop.ScreenSaver inhibit while timer runs."""
        if active and self._inhibit_cookie is not None:
            return
        if not active and self._inhibit_cookie is None:
            return
        try:
            bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
            if active:
                res = bus.call_sync(
                    "org.freedesktop.ScreenSaver",
                    "/org/freedesktop/ScreenSaver",
                    "org.freedesktop.ScreenSaver",
                    "Inhibit",
                    GLib.Variant("(ss)", (self._app_name, "Focus timer is running")),
                    GLib.VariantType("(u)"),
                    Gio.DBusCallFlags.NONE,
                    500,
                    None,
                )
                self._inhibit_cookie = int(res.unpack()[0])
            elif self._inhibit_cookie is not None:
                cookie = self._inhibit_cookie
                self._inhibit_cookie = None
                bus.call_sync(
                    "org.freedesktop.ScreenSaver",
                    "/org/freedesktop/ScreenSaver",
                    "org.freedesktop.ScreenSaver",
                    "UnInhibit",
                    GLib.Variant("(u)", (cookie,)),
                    None,
                    Gio.DBusCallFlags.NONE,
                    500,
                    None,
                )
        except Exception:
            if not active:
                self._inhibit_cookie = None

    def close(self) -> None:
        self.set_wake_lock(False)
        if self._notify_ok and Notify is not None:
            try:
                Notify.uninit()
            except Exception:
                pass
