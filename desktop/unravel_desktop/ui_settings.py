"""Settings dialog syncing all Unravel timer settings + local Ubuntu preferences."""

from __future__ import annotations

from typing import Callable

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gtk

from .config import AppConfig
from .timer_engine import TimerSettings


class SettingsDialog(Adw.PreferencesDialog):
    """Synced Unravel timer defaults, Ubuntu desktop behavior, and account sign-out."""

    def __init__(
        self,
        *,
        config: AppConfig,
        settings: TimerSettings,
        on_save_timer_settings: Callable[[dict], None],
        on_change_theme: Callable[[str], None],
        on_toggle_autostart: Callable[[bool], None],
        on_sign_out: Callable[[], None],
    ) -> None:
        super().__init__()
        self.set_title("Settings")
        self.set_content_width(480)
        self.set_content_height(600)

        self._on_save_timer = on_save_timer_settings
        self._on_change_theme = on_change_theme
        self._on_toggle_autostart = on_toggle_autostart
        self._on_sign_out = on_sign_out

        page = Adw.PreferencesPage()
        self.add(page)

        # ---- Timer defaults (synced with Unravel Settings)
        timer_group = Adw.PreferencesGroup(
            title="Timer defaults",
            description="Synced directly with your Unravel account settings.",
        )

        self._pomo_row = Adw.SpinRow.new_with_range(5, 120, 1)
        self._pomo_row.set_title("Pomodoro focus")
        self._pomo_row.set_subtitle("Minutes per focus block")
        self._pomo_row.set_value(max(5, round(settings.focus_seconds / 60)))
        timer_group.add(self._pomo_row)

        self._short_row = Adw.SpinRow.new_with_range(1, 60, 1)
        self._short_row.set_title("Short break")
        self._short_row.set_subtitle("Minutes")
        self._short_row.set_value(max(1, round(settings.short_break_seconds / 60)))
        timer_group.add(self._short_row)

        self._long_row = Adw.SpinRow.new_with_range(1, 90, 1)
        self._long_row.set_title("Long break")
        self._long_row.set_subtitle("Minutes (at least as long as short break)")
        self._long_row.set_value(max(1, round(settings.long_break_seconds / 60)))
        timer_group.add(self._long_row)

        self._every_row = Adw.SpinRow.new_with_range(2, 12, 1)
        self._every_row.set_title("Long break cadence")
        self._every_row.set_subtitle("Take a long break every N focus blocks")
        self._every_row.set_value(max(2, settings.long_break_every))
        timer_group.add(self._every_row)

        self._auto_break_row = Adw.SwitchRow(
            title="Auto-start breaks",
            subtitle="Start the break automatically when a Pomodoro block finishes",
        )
        self._auto_break_row.set_active(settings.auto_start_breaks)
        timer_group.add(self._auto_break_row)

        self._auto_focus_row = Adw.SwitchRow(
            title="Auto-start next focus",
            subtitle="Roll straight into the next focus block when a break ends",
        )
        self._auto_focus_row.set_active(settings.auto_start_next_focus)
        timer_group.add(self._auto_focus_row)

        self._sound_row = Adw.SwitchRow(
            title="Sound chimes",
            subtitle="Play a soft chime at interval boundaries and Flow baselines",
        )
        self._sound_row.set_active(settings.sound_enabled)
        timer_group.add(self._sound_row)

        self._alerts_row = Adw.SwitchRow(
            title="Break overrun notifications",
            subtitle="Send an Ubuntu desktop alert when a break runs past its target",
        )
        self._alerts_row.set_active(settings.return_alerts_enabled)
        timer_group.add(self._alerts_row)

        self._error_lbl = Gtk.Label()
        self._error_lbl.add_css_class("error")
        self._error_lbl.set_visible(False)

        save_row = Adw.ActionRow(title="Sync timer settings")
        save_btn = Gtk.Button(label="Save to Unravel")
        save_btn.add_css_class("suggested-action")
        save_btn.add_css_class("pill")
        save_btn.set_valign(Gtk.Align.CENTER)
        save_btn.connect("clicked", self._on_save_clicked)
        save_row.add_suffix(save_btn)
        timer_group.add(save_row)

        page.add(timer_group)

        # ---- Ubuntu Desktop preferences
        desk_group = Adw.PreferencesGroup(title="Ubuntu desktop")

        theme_row = Adw.ComboRow(title="Appearance")
        theme_model = Gtk.StringList.new(["Follow system", "Light (Cotton candy)", "Dark (The night)"])
        theme_row.set_model(theme_model)
        theme_idx = {"system": 0, "light": 1, "dark": 2}.get(config.theme, 0)
        theme_row.set_selected(theme_idx)
        theme_row.connect("notify::selected", self._on_theme_changed)
        desk_group.add(theme_row)

        auto_row = Adw.SwitchRow(
            title="Launch on login",
            subtitle="Start quietly in the GNOME top bar when you log into Ubuntu",
        )
        auto_row.set_active(config.autostart)
        auto_row.connect("notify::active", lambda row, _p: self._on_toggle_autostart(row.get_active()))
        desk_group.add(auto_row)

        page.add(desk_group)

        # ---- Connected account
        acct_group = Adw.PreferencesGroup(title="Connected account")
        acct_title = config.user_name or config.user_email or "Signed in"
        acct_sub = f"{config.user_email} · {config.normalized_server_url()}" if config.user_email else config.normalized_server_url()
        acct_row = Adw.ActionRow(title=acct_title, subtitle=acct_sub)
        signout_btn = Gtk.Button(label="Sign out")
        signout_btn.add_css_class("destructive-action")
        signout_btn.add_css_class("pill")
        signout_btn.set_valign(Gtk.Align.CENTER)
        signout_btn.connect("clicked", self._on_signout_clicked)
        acct_row.add_suffix(signout_btn)
        acct_group.add(acct_row)

        page.add(acct_group)

    def _on_theme_changed(self, row: Adw.ComboRow, _pspec) -> None:
        idx = row.get_selected()
        key = {0: "system", 1: "light", 2: "dark"}.get(idx, "system")
        self._on_change_theme(key)

    def _on_save_clicked(self, _btn: Gtk.Button) -> None:
        pomo = int(self._pomo_row.get_value())
        short_b = int(self._short_row.get_value())
        long_b = max(short_b, int(self._long_row.get_value()))
        self._long_row.set_value(long_b)
        every = int(self._every_row.get_value())
        patch = {
            "pomodoroMinutes": pomo,
            "shortBreakMinutes": short_b,
            "longBreakMinutes": long_b,
            "longBreakEvery": every,
            "autoStartBreaks": self._auto_break_row.get_active(),
            "autoStartNextFocus": self._auto_focus_row.get_active(),
            "soundEnabled": self._sound_row.get_active(),
            "returnAlertsEnabled": self._alerts_row.get_active(),
        }
        self._on_save_timer(patch)
        self.close()

    def _on_signout_clicked(self, _btn: Gtk.Button) -> None:
        self.close()
        self._on_sign_out()
