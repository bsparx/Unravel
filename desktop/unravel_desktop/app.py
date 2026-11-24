"""Main GTK4 + Libadwaita application for Unravel Desktop on Ubuntu."""

from __future__ import annotations

import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Any

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
gi.require_version("Gdk", "4.0")
gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
from gi.repository import Adw, Gdk, Gio, GLib, Gtk

from . import APP_ID, APP_NAME
from .api import ApiError, UnauthorizedError, UnravelApi
from .audio import SoundPlayer
from .config import AppConfig, load_config, save_config, sync_autostart
from .notifications import DesktopAlerts
from .timer_engine import (
    INTERVAL_LABELS,
    AttachedTask,
    TimerConfig,
    TimerEngine,
    TimerSettings,
    format_duration,
)
from .tray import GnomeTopBarTray
from .ui_connect import ConnectView
from .ui_settings import SettingsDialog
from .ui_stats import StatsView
from .ui_timer import MiniTimerView, TimerView

PKG_DIR = Path(__file__).resolve().parent
ASSETS_DIR = PKG_DIR.parent / "assets"
ICON_PATH = ASSETS_DIR / "unravel.svg"
CSS_PATH = PKG_DIR / "theme.css"

HEARTBEAT_INTERVAL_SEC = 60.0
STATS_AUTO_REFRESH_SEC = 300.0


class UnravelWindow(Adw.ApplicationWindow):
    """Main Unravel Desktop window supporting Full View, Mini Mode, and Sign-In."""

    def __init__(self, app: UnravelApplication) -> None:
        super().__init__(application=app, title=APP_NAME)
        self._app = app
        self.add_css_class("unravel-window")
        self.set_default_size(640, 740)

        self._toast_overlay = Adw.ToastOverlay()
        self._root_stack = Gtk.Stack()
        self._root_stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)

        # 1. Connect / Sign-In page
        self.connect_view = ConnectView(
            config=app.config,
            icon_path=ICON_PATH,
            on_connected=app.on_connected,
        )
        connect_toolbar = Adw.ToolbarView()
        connect_toolbar.add_top_bar(Adw.HeaderBar())
        connect_toolbar.set_content(self.connect_view)
        self._root_stack.add_named(connect_toolbar, "connect")

        # 2. Full authenticated workspace (Timer + Statistics)
        main_toolbar = Adw.ToolbarView()
        header = Adw.HeaderBar()

        self._view_stack = Adw.ViewStack()
        self.timer_view = TimerView(
            app.engine,
            on_start=app.action_start,
            on_pause=app.action_pause,
            on_resume=app.action_resume,
            on_take_break=app.action_take_break,
            on_skip_interval=app.action_skip_interval,
            on_extend_break=app.action_extend_break,
            on_return_note=app.action_set_return_note,
            on_stop=app.action_stop,
            on_discard=app.action_discard,
            on_adjust_minutes=app.action_adjust_minutes,
            on_reset=app.action_reset,
            on_config_changed=app.refresh_ui,
        )
        self.stats_view = StatsView(
            excluded_ids=set(app.config.excluded_stats_items),
            on_load_window=app.load_stats,
            on_excluded_changed=app.on_stats_filter_changed,
        )

        p1 = self._view_stack.add_titled_with_icon(
            self.timer_view, "timer", "Timer", "alarm-symbolic"
        )
        _ = p1
        p2 = self._view_stack.add_titled_with_icon(
            self.stats_view, "stats", "Statistics", "view-list-symbolic"
        )
        _ = p2
        self._view_stack.connect("notify::visible-child-name", self._on_tab_changed)

        switcher = Adw.ViewSwitcher()
        switcher.set_stack(self._view_stack)
        switcher.set_policy(Adw.ViewSwitcherPolicy.WIDE)
        header.set_title_widget(switcher)

        mini_btn = Gtk.Button.new_from_icon_name("view-restore-symbolic")
        mini_btn.set_tooltip_text("Compact Mini Mode")
        mini_btn.connect("clicked", lambda _b: app.set_mini_mode(True))
        header.pack_end(mini_btn)

        settings_btn = Gtk.Button.new_from_icon_name("emblem-system-symbolic")
        settings_btn.set_tooltip_text("Settings")
        settings_btn.connect("clicked", lambda _b: app.open_settings())
        header.pack_end(settings_btn)

        main_toolbar.add_top_bar(header)
        main_toolbar.set_content(self._view_stack)
        self._root_stack.add_named(main_toolbar, "main")

        # 3. Compact Mini Floating Timer page
        mini_toolbar = Adw.ToolbarView()
        mini_bar = Adw.HeaderBar()
        mini_bar.set_show_end_title_buttons(True)
        mini_bar.set_title_widget(Gtk.Label(label="Unravel"))
        mini_toolbar.add_top_bar(mini_bar)
        self.mini_view = MiniTimerView(
            app.engine,
            on_toggle=app.action_toggle_play_pause,
            on_take_break=app.action_take_break,
            on_skip=app.action_skip_interval,
            on_extend=app.action_extend_break,
            on_stop=lambda: app.action_stop(False),
            on_expand=lambda: app.set_mini_mode(False),
        )
        mini_toolbar.set_content(self.mini_view)
        self._root_stack.add_named(mini_toolbar, "mini")

        self._toast_overlay.set_child(self._root_stack)
        self.set_content(self._toast_overlay)

        # Space key toggles timer when on Timer view (except inside text inputs or break overruns)
        key_ctrl = Gtk.EventControllerKey()
        key_ctrl.connect("key-pressed", self._on_key_pressed)
        self.add_controller(key_ctrl)

        # Focus-triggered soft refresh of stats
        self.connect("notify::is-active", self._on_focus_changed)
        self.connect("close-request", self._on_close_request)

    def toast(self, message: str) -> None:
        self._toast_overlay.add_toast(Adw.Toast.new(message))

    def show_page(self, name: str) -> None:
        self._root_stack.set_visible_child_name(name)
        if name == "mini":
            self.set_default_size(340, 146)
            self.set_size_request(310, 136)
            self._try_x11_pin(True)
        else:
            self.set_size_request(420, 520)
            self.set_default_size(640, 740)
            self._try_x11_pin(False)

    def _try_x11_pin(self, pinned: bool) -> None:
        # On Wayland the compositor governs Always-on-Top; on X11 wmctrl can toggle it.
        if not shutil.which("wmctrl"):
            return
        action = "add,above" if pinned else "remove,above"
        try:
            subprocess.Popen(
                ["wmctrl", "-r", ":ACTIVE:", "-b", action],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except OSError:
            pass

    def _on_tab_changed(self, stack: Adw.ViewStack, _pspec) -> None:
        if stack.get_visible_child_name() == "stats":
            self._app.maybe_refresh_stats(force=False)

    def _on_focus_changed(self, _win, _pspec) -> None:
        if self.is_active() and self._app.api is not None:
            self._app.maybe_refresh_stats(force=False)

    def _on_close_request(self, _win) -> bool:
        # Hide to GNOME top bar tray instead of killing a running timer.
        if self._app.tray_active:
            self.set_visible(False)
            self._app.update_tray()
            return True
        self._app.quit_cleanly()
        return False

    def _on_key_pressed(self, _ctrl, keyval: int, _keycode: int, state: Gdk.ModifierType) -> bool:
        if (state & Gdk.ModifierType.CONTROL_MASK) and keyval in (Gdk.KEY_q, Gdk.KEY_Q):
            self._app.quit_cleanly()
            return True
        if keyval != Gdk.KEY_space:
            return False
        page = self._root_stack.get_visible_child_name()
        if page == "connect":
            return False
        if page == "main" and self._view_stack.get_visible_child_name() != "timer":
            return False
        focus = self.get_focus()
        if isinstance(focus, (Gtk.Entry, Gtk.PasswordEntry, Gtk.SpinButton, Gtk.TextView, Gtk.Button)):
            return False
        if self._app.engine.is_overrunning():
            return False
        self._app.action_toggle_play_pause()
        return True


class UnravelApplication(Adw.Application):
    """Coordinates timer engine, API sync, GNOME top-bar tray, chimes, and alerts."""

    def __init__(self, start_minimized: bool = False) -> None:
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.FLAGS_NONE)
        self._start_minimized = start_minimized
        self.config: AppConfig = load_config()
        self.api: UnravelApi | None = (
            UnravelApi(self.config.normalized_server_url(), self.config.token)
            if self.config.is_connected
            else None
        )
        self.engine = TimerEngine()
        self.sound = SoundPlayer()
        self.alerts = DesktopAlerts(APP_NAME)
        self.win: UnravelWindow | None = None
        self.tray: GnomeTopBarTray | None = None
        self.tray_active = False

        self._last_heartbeat_at = 0.0
        self._last_stats_at = 0.0
        self._stats_end_iso: str | None = None
        self._tick_source: int | None = None
        self._css_loaded = False

    def do_activate(self) -> None:
        self._apply_theme(self.config.theme)
        if not self._css_loaded:
            self._load_css()
            self._css_loaded = True

        if self.win is None:
            self.win = UnravelWindow(self)
            self._start_tray()
            self._tick_source = GLib.timeout_add(1000, self._on_second_tick)

            if self.config.is_connected and self.api is not None:
                self.win.show_page("mini" if self.config.mini_mode else "main")
                self._bootstrap_async()
            else:
                self.win.show_page("connect")

            if not self._start_minimized:
                self.win.present()
            self.update_tray()
        else:
            self.win.set_visible(True)
            self.win.present()
            self.update_tray()

    def _load_css(self) -> None:
        if not CSS_PATH.exists():
            return
        provider = Gtk.CssProvider()
        provider.load_from_path(str(CSS_PATH))
        display = Gdk.Display.get_default()
        if display is not None:
            Gtk.StyleContext.add_provider_for_display(
                display, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            )

    def _apply_theme(self, theme: str) -> None:
        mgr = Adw.StyleManager.get_default()
        if theme == "light":
            mgr.set_color_scheme(Adw.ColorScheme.FORCE_LIGHT)
        elif theme == "dark":
            mgr.set_color_scheme(Adw.ColorScheme.FORCE_DARK)
        else:
            mgr.set_color_scheme(Adw.ColorScheme.DEFAULT)

    def _is_dark(self) -> bool:
        return Adw.StyleManager.get_default().get_dark()

    def _start_tray(self) -> None:
        self.tray = GnomeTopBarTray(
            on_toggle_window=self.toggle_window_visible,
            on_toggle_mini=lambda: self.set_mini_mode(not self.config.mini_mode),
            on_toggle_timer=self.action_toggle_play_pause,
            on_take_break=self.action_take_break,
            on_stop_timer=lambda: self.action_stop(False),
            on_quit=self.quit_cleanly,
            icon_dir=ASSETS_DIR,
        )
        self.tray.start()
        self.tray_active = self.tray._bus is not None

    def toggle_window_visible(self) -> None:
        if self.win is None:
            return
        if self.win.is_visible() and self.win.is_active():
            self.win.set_visible(False)
        else:
            self.win.set_visible(True)
            self.win.present()
        self.update_tray()

    def set_mini_mode(self, enabled: bool) -> None:
        if not self.config.is_connected or self.win is None:
            return
        self.config.mini_mode = enabled
        save_config(self.config)
        self.win.show_page("mini" if enabled else "main")
        self.win.set_visible(True)
        self.win.present()
        self.refresh_ui()

    # ---------------------------------------------------------------- auth & bootstrap

    def on_connected(self, server_url: str, token: str, name: str, email: str) -> None:
        self.config.server_url = server_url
        self.config.token = token
        self.config.user_name = name
        self.config.user_email = email
        save_config(self.config)
        self.api = UnravelApi(server_url, token)
        if self.win:
            self.win.show_page("mini" if self.config.mini_mode else "main")
            self.win.toast("Connected to Unravel")
        self._bootstrap_async()

    def _handle_unauthorized(self, msg: str = "Session disconnected. Please sign in again.") -> None:
        self.config.token = ""
        save_config(self.config)
        self.api = None
        self.engine.reset()
        self.alerts.set_wake_lock(False)
        if self.win:
            self.win.connect_view.show_message(msg)
            self.win.show_page("connect")
            self.win.set_visible(True)
            self.win.present()
        self.update_tray()

    def _bootstrap_async(self) -> None:
        api = self.api
        if api is None:
            return
        if self.win:
            self.win.timer_view.set_sync_status("Syncing with Unravel…")

        def worker() -> None:
            try:
                api.flush_pending()
                data = api.bootstrap()
                GLib.idle_add(self._apply_bootstrap, data)
            except UnauthorizedError as err:
                GLib.idle_add(self._handle_unauthorized, str(err))
            except ApiError as err:
                GLib.idle_add(self._on_sync_error, str(err))

        threading.Thread(target=worker, daemon=True).start()

    def _apply_bootstrap(self, data: dict[str, Any]) -> None:
        user = data.get("user") or {}
        self.config.user_name = user.get("name") or self.config.user_name
        self.config.user_email = user.get("email") or self.config.user_email
        save_config(self.config)

        settings = TimerSettings.from_api(data.get("settings") or {})
        self.engine.settings = settings

        tasks = [
            AttachedTask(
                id=t["id"],
                title=t["title"],
                type=t["type"],
                estimated_seconds=t.get("estimatedSeconds"),
                default_mode=t.get("defaultMode"),
                planned_intervals=t.get("plannedIntervals"),
            )
            for t in (data.get("tasks") or [])
        ]

        active = data.get("activeSession")
        if active and self.engine.phase == "IDLE":
            self.engine.hydrate_from_server(active)
            self._last_heartbeat_at = time.time()
        elif self.engine.phase == "IDLE":
            self.engine.config = TimerConfig.from_settings(settings, self.engine.config.mode)

        if self.win:
            self.win.timer_view.set_tasks(tasks)
            self.win.timer_view.sync_controls_from_engine()
            self.win.timer_view.set_sync_status("Synced")
        self.refresh_ui()
        self.maybe_refresh_stats(force=True)

    def _on_sync_error(self, message: str) -> None:
        if self.win:
            self.win.timer_view.set_sync_status(f"Offline ({message})")

    # ---------------------------------------------------------------- timer actions

    def action_toggle_play_pause(self) -> None:
        if not self.config.is_connected:
            return
        if self.engine.phase == "IDLE":
            self.action_start()
        elif self.engine.phase == "RUNNING":
            self.action_pause()
        elif self.engine.phase == "PAUSED":
            self.action_resume()

    def action_start(self) -> None:
        api = self.api
        if api is None:
            return
        self.engine.start()
        self._last_heartbeat_at = time.time()
        self.alerts.set_wake_lock(True)
        self.refresh_ui()

        cfg = self.engine.config
        payload: dict[str, Any] = {
            "clientKey": self.engine.client_key,
            "mode": cfg.mode,
            "targetSeconds": cfg.target_seconds,
            "intervals": cfg.intervals,
            "shortBreakSeconds": cfg.short_break_seconds,
            "taskId": self.engine.task.id if self.engine.task else None,
        }

        def worker() -> None:
            try:
                res = api.start_session(payload)
                sess = res.get("session") or {}
                sid = sess.get("id")
                if sid:
                    GLib.idle_add(self._attach_session_id, sid)
            except UnauthorizedError as err:
                GLib.idle_add(self._handle_unauthorized, str(err))
            except ApiError as err:
                api.enqueue_pending("POST", "/api/desktop/timer/start", payload)
                GLib.idle_add(self._on_sync_error, str(err))

        threading.Thread(target=worker, daemon=True).start()

    def _attach_session_id(self, session_id: str) -> None:
        self.engine.session_id = session_id
        if self.win:
            self.win.timer_view.set_sync_status("Synced")

    def _send_timer_mutation(self, payload: dict[str, Any], on_done: Any = None) -> None:
        api = self.api
        sid = self.engine.session_id
        if api is None or not sid:
            return
        path = f"/api/desktop/timer/{sid}"

        def worker() -> None:
            try:
                api.flush_pending()
                res = api.timer_action(sid, payload)
                if on_done:
                    GLib.idle_add(on_done, res)
            except UnauthorizedError as err:
                GLib.idle_add(self._handle_unauthorized, str(err))
            except ApiError as err:
                api.enqueue_pending("POST", path, payload)
                GLib.idle_add(self._on_sync_error, str(err))

        threading.Thread(target=worker, daemon=True).start()

    def action_pause(self) -> None:
        if self.engine.phase != "RUNNING":
            return
        self.engine.pause()
        self.alerts.set_wake_lock(False)
        self.refresh_ui()
        self._send_timer_mutation({"action": "pause"})

    def action_resume(self) -> None:
        if self.engine.phase != "PAUSED":
            return
        self.engine.resume()
        self._last_heartbeat_at = time.time()
        self.alerts.set_wake_lock(True)
        self.refresh_ui()
        self._send_timer_mutation({"action": "resume"})

    def action_take_break(self) -> None:
        info = self.engine.next_break_info()
        if not info:
            return
        _kind, _sec, appends = info
        if appends:
            ext = self.engine.append_flow_round_and_advance()
            if ext:
                self.refresh_ui()
                self._send_timer_mutation({"action": "appendFlowRound"})
        else:
            next_idx = self.engine.interval_index + 1
            self.engine.advance_interval(next_idx, resume=True)
            self.refresh_ui()
            self._send_timer_mutation(
                {"action": "advance", "nextIndex": next_idx, "completed": True, "resume": True}
            )

    def action_skip_interval(self) -> None:
        plan = self.engine.plan()
        next_idx = self.engine.interval_index + 1
        if next_idx >= len(plan):
            return
        self.engine.advance_interval(next_idx, resume=True)
        self.refresh_ui()
        self._send_timer_mutation(
            {"action": "advance", "nextIndex": next_idx, "completed": True, "resume": True}
        )

    def action_extend_break(self, seconds: int) -> None:
        self.engine.extend_interval(seconds)
        self.refresh_ui()
        self._send_timer_mutation({"action": "extend", "seconds": seconds})
        if self.win:
            self.win.toast(f"Added {round(seconds / 60)} min to break")

    def action_set_return_note(self, note: str) -> None:
        trimmed = note.strip()[:140]
        self.engine.return_note = trimmed or None
        self._send_timer_mutation({"action": "returnNote", "note": trimmed})
        if self.win:
            self.win.toast("Return note saved" if trimmed else "Return note cleared")

    def action_stop(self, completed_task: bool = False, reason: str = "USER_STOPPED") -> None:
        if self.engine.phase not in ("RUNNING", "PAUSED"):
            return
        self.engine.end()
        self.alerts.set_wake_lock(False)
        self.refresh_ui()

        def after_end(_res: dict) -> None:
            if self.win:
                self.win.timer_view.set_sync_status("Session saved")
            self.maybe_refresh_stats(force=True)

        self._send_timer_mutation(
            {"action": "end", "completedTask": completed_task, "reason": reason},
            on_done=after_end,
        )

    def action_discard(self) -> None:
        api = self.api
        sid = self.engine.session_id
        self.engine.reset(TimerConfig.from_settings(self.engine.settings, self.engine.config.mode), self.engine.task)
        self.alerts.set_wake_lock(False)
        if self.win:
            self.win.timer_view.sync_controls_from_engine()
            self.win.toast("Session discarded")
        self.refresh_ui()

        if api and sid:
            threading.Thread(target=lambda: self._discard_worker(api, sid), daemon=True).start()

    def _discard_worker(self, api: UnravelApi, sid: str) -> None:
        try:
            api.discard_session(sid)
        except Exception:
            pass

    def action_adjust_minutes(self, minutes: int) -> None:
        def after_adj(res: dict) -> None:
            if res.get("ok"):
                if self.win:
                    self.win.toast(f"Updated to {minutes}m")
                self.maybe_refresh_stats(force=True)
            elif self.win:
                self.win.toast(res.get("error") or "Could not update time")

        self._send_timer_mutation({"action": "adjust", "minutes": minutes}, on_done=after_adj)

    def action_reset(self) -> None:
        self.engine.reset(TimerConfig.from_settings(self.engine.settings, self.engine.config.mode), self.engine.task)
        if self.win:
            self.win.timer_view.sync_controls_from_engine()
        self.refresh_ui()

    # ---------------------------------------------------------------- 1s clock tick

    def _on_second_tick(self) -> bool:
        if self.engine.phase == "RUNNING":
            events = self.engine.evaluate_tick()
            for ev in events:
                self._handle_timer_event(ev)

            now = time.time()
            if now - self._last_heartbeat_at >= HEARTBEAT_INTERVAL_SEC:
                self._last_heartbeat_at = now
                self._send_timer_mutation({"action": "heartbeat"})

        self.refresh_ui()
        return True

    def _handle_timer_event(self, event: str) -> None:
        s = self.engine.settings
        if event == "flow_baseline":
            self.sound.play("flow_baseline", s.sound_enabled)
            self.alerts.send(
                "Focus baseline reached",
                "You're in Pomodoro Flow — keep going, or take a break whenever you're ready.",
                urgency="low",
            )
        elif event == "break_overrun":
            self.sound.play("break_overrun", s.sound_enabled)
            if s.return_alerts_enabled:
                note = f"\nWhere you left off: {self.engine.return_note}" if self.engine.return_note else ""
                self.alerts.send(
                    "Break time is up",
                    f"Ready to return to focus? Open Unravel to add +5 min or resume.{note}",
                )
        elif event == "auto_advanced_to_focus":
            self.sound.play("focus_done", s.sound_enabled)
            self.alerts.send("Back to focus", "Break finished — next focus block started.")
            self._send_timer_mutation(
                {
                    "action": "advance",
                    "nextIndex": self.engine.interval_index,
                    "completed": True,
                    "resume": True,
                }
            )
        elif event == "auto_advanced_to_break":
            self.sound.play("focus_done", s.sound_enabled)
            kind = INTERVAL_LABELS.get(self.engine.current_interval().kind, "Break")
            self.alerts.send("Focus block complete", f"{kind} started automatically.")
            self._send_timer_mutation(
                {
                    "action": "advance",
                    "nextIndex": self.engine.interval_index,
                    "completed": True,
                    "resume": True,
                }
            )
        elif event == "paused_for_break":
            self.sound.play("focus_done", s.sound_enabled)
            self.alerts.set_wake_lock(False)
            self.alerts.send("Focus block complete", "Press Resume when you're ready for your break.")
            self._send_timer_mutation(
                {
                    "action": "advance",
                    "nextIndex": self.engine.interval_index,
                    "completed": True,
                    "resume": False,
                }
            )
        elif event == "target_reached_end":
            self.sound.play("focus_done", s.sound_enabled)
            self.alerts.set_wake_lock(False)
            logged = format_duration(self.engine.focus_elapsed_seconds())
            self.alerts.send("Session complete", f"{logged} of focus logged to Unravel.")
            self._send_timer_mutation(
                {"action": "end", "completedTask": False, "reason": "TARGET_REACHED"},
                on_done=lambda _r: self.maybe_refresh_stats(force=True),
            )

    def refresh_ui(self) -> None:
        dark = self._is_dark()
        if self.win and self.config.is_connected:
            self.win.timer_view.refresh_tick(dark)
            self.win.mini_view.refresh_tick(dark)
        self.update_tray()

    def update_tray(self) -> None:
        if self.tray is None:
            return
        eng = self.engine
        if not self.config.is_connected or eng.phase in ("IDLE", "ENDED"):
            label = ""
        elif eng.is_overrunning():
            label = f"⚠ {eng.readout()}"
        elif eng.on_break():
            label = f"☕ {eng.readout()}"
        elif eng.config.mode == "RECOVERY":
            label = f"☾ {eng.readout()}"
        elif eng.is_focus_flowing():
            label = f"🌊 {eng.readout()}"
        elif eng.phase == "PAUSED":
            label = f"⏸ {eng.readout()}"
        else:
            label = f"● {eng.readout()}"

        self.tray.update(
            label=label,
            title=f"Unravel · {label}" if label else "Unravel",
            visible=bool(self.win and self.win.is_visible()),
            mini=self.config.mini_mode,
            phase=eng.phase,
            can_break=eng.next_break_info() is not None,
        )

    # ---------------------------------------------------------------- stats

    def maybe_refresh_stats(self, force: bool = False) -> None:
        if self.api is None:
            return
        if not force and (time.time() - self._last_stats_at) < STATS_AUTO_REFRESH_SEC:
            return
        self.load_stats(self._stats_end_iso)

    def load_stats(self, end_iso: str | None) -> None:
        api = self.api
        if api is None:
            return
        self._stats_end_iso = end_iso
        if self.win:
            self.win.stats_view.set_loading()

        def worker() -> None:
            try:
                data = api.get_stats(end_iso)
                self._last_stats_at = time.time()
                GLib.idle_add(self._apply_stats, data)
            except UnauthorizedError as err:
                GLib.idle_add(self._handle_unauthorized, str(err))
            except ApiError as err:
                GLib.idle_add(self._apply_stats_error, str(err))

        threading.Thread(target=worker, daemon=True).start()

    def _apply_stats(self, data: dict[str, Any]) -> None:
        if self.win:
            self.win.stats_view.set_data(data)

    def _apply_stats_error(self, msg: str) -> None:
        if self.win:
            self.win.stats_view.set_error(f"Could not load statistics: {msg}")

    def on_stats_filter_changed(self, excluded: set[str]) -> None:
        self.config.excluded_stats_items = sorted(excluded)
        save_config(self.config)

    # ---------------------------------------------------------------- settings

    def open_settings(self) -> None:
        if not self.win or not self.config.is_connected:
            return
        dlg = SettingsDialog(
            config=self.config,
            settings=self.engine.settings,
            on_save_timer_settings=self._save_timer_settings,
            on_change_theme=self._change_theme,
            on_toggle_autostart=self._toggle_autostart,
            on_sign_out=self._sign_out,
        )
        dlg.present(self.win)

    def _save_timer_settings(self, patch: dict[str, Any]) -> None:
        api = self.api
        if api is None:
            return

        def worker() -> None:
            try:
                res = api.patch_settings(patch)
                new_s = TimerSettings.from_api(res.get("settings") or {})
                GLib.idle_add(self._apply_new_settings, new_s)
            except UnauthorizedError as err:
                GLib.idle_add(self._handle_unauthorized, str(err))
            except ApiError as err:
                GLib.idle_add(lambda: self.win and self.win.toast(str(err)))

        threading.Thread(target=worker, daemon=True).start()

    def _apply_new_settings(self, settings: TimerSettings) -> None:
        self.engine.settings = settings
        if self.engine.phase == "IDLE":
            self.engine.config = TimerConfig.from_settings(settings, self.engine.config.mode)
            if self.win:
                self.win.timer_view.sync_controls_from_engine()
        if self.win:
            self.win.toast("Timer settings saved to Unravel")
        self.refresh_ui()

    def _change_theme(self, theme: str) -> None:
        self.config.theme = theme
        save_config(self.config)
        self._apply_theme(theme)
        self.refresh_ui()

    def _toggle_autostart(self, enabled: bool) -> None:
        self.config.autostart = enabled
        save_config(self.config)
        sync_autostart(enabled)
        if self.win:
            self.win.toast("Launch on login enabled" if enabled else "Launch on login disabled")

    def _sign_out(self) -> None:
        api = self.api
        if api is not None:
            threading.Thread(target=api.logout, daemon=True).start()
        self._handle_unauthorized("Signed out cleanly.")

    # ---------------------------------------------------------------- quit

    def quit_cleanly(self) -> None:
        # Flush one final synchronous heartbeat if a session is live so zero time is lost.
        if self.api and self.engine.session_id and self.engine.phase == "RUNNING":
            try:
                self.api.timer_action(self.engine.session_id, {"action": "heartbeat"})
            except Exception:
                pass
        if self._tick_source is not None:
            GLib.source_remove(self._tick_source)
            self._tick_source = None
        if self.tray is not None:
            self.tray.close()
        self.alerts.close()
        self.quit()


def main(argv: list[str] | None = None) -> int:
    args = list(argv or [])
    minimized = "--minimized" in args
    clean_args = [a for a in args if a != "--minimized"]
    app = UnravelApplication(start_minimized=minimized)
    return app.run(clean_args)
