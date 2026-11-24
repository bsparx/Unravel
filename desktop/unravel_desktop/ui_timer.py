"""Serene Timer Sanctuary & Compact Mini Mode paired with Today's `/day` list."""

from __future__ import annotations

from typing import Callable

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gtk, Pango

from .ring_widget import TimerRingWidget
from .timer_engine import (
    BASIC_MINUTE_PRESETS,
    CADENCE_PRESETS,
    INTERVAL_LABELS,
    MODE_DESCRIPTIONS,
    MODE_LABELS,
    TimerEngine,
    TimerMode,
    arc_progress,
    clamp_break,
    clamp_intervals,
    clamp_target,
    format_duration,
    has_intervals,
    overtime_progress,
    per_focus_seconds,
    suggest_intervals,
)


class TimerView(Gtk.Box):
    """Calm, glassmorphic Unravel Timer sanctuary with full mode & cadence parity."""

    def __init__(
        self,
        engine: TimerEngine,
        *,
        on_start: Callable[[], None],
        on_pause: Callable[[], None],
        on_resume: Callable[[], None],
        on_take_break: Callable[[], None],
        on_skip_interval: Callable[[], None],
        on_extend_break: Callable[[int], None],
        on_return_note: Callable[[str], None],
        on_stop: Callable[[bool], None],
        on_discard: Callable[[], None],
        on_adjust_minutes: Callable[[int], None],
        on_reset: Callable[[], None],
        on_clear_task: Callable[[], None],
        on_check_selected_task: Callable[[], None],
        on_open_today: Callable[[], None],
        on_config_changed: Callable[[], None],
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self._engine = engine
        self._cb = {
            "start": on_start,
            "pause": on_pause,
            "resume": on_resume,
            "take_break": on_take_break,
            "skip": on_skip_interval,
            "extend": on_extend_break,
            "note": on_return_note,
            "stop": on_stop,
            "discard": on_discard,
            "adjust": on_adjust_minutes,
            "reset": on_reset,
            "clear_task": on_clear_task,
            "check_task": on_check_selected_task,
            "open_today": on_open_today,
            "config": on_config_changed,
        }
        self._updating_controls = False
        self._last_work_mode: TimerMode = "FLOW"
        self._last_work_target = engine.config.target_seconds
        self._last_work_intervals = engine.config.intervals
        self._last_chip: tuple[str, str] | None = None
        self._last_ui_sig: tuple | None = None

        scroll = Gtk.ScrolledWindow()
        scroll.set_vexpand(True)
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

        clamp = Adw.Clamp()
        clamp.set_maximum_size(500)
        clamp.set_margin_top(16)
        clamp.set_margin_bottom(22)
        clamp.set_margin_start(22)
        clamp.set_margin_end(22)

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=11)
        root.set_valign(Gtk.Align.CENTER)

        # ---- Main frosted glass timer sanctuary card
        card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=13)
        card.add_css_class("unravel-card")

        # Quiet header strip inside card: sync status + semantic cadence pill
        top_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        self._sync_label = Gtk.Label(label="", xalign=0)
        self._sync_label.add_css_class("caption")
        self._sync_label.add_css_class("unravel-muted")
        self._sync_label.set_hexpand(True)
        top_row.append(self._sync_label)

        self._cadence_chip = Gtk.Label(label="Pomodoro Flow · 25/5")
        self._cadence_chip.add_css_class("unravel-pill-chip")
        self._cadence_chip.add_css_class("unravel-flow-chip")
        top_row.append(self._cadence_chip)
        card.append(top_row)

        # ---- Active / Idle stack inside card
        self._main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)

        # Mode switcher pills (idle only)
        self._mode_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=7)
        mode_bar = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=3)
        mode_bar.add_css_class("unravel-mode-bar")
        mode_bar.set_halign(Gtk.Align.CENTER)
        self._mode_buttons: dict[str, Gtk.ToggleButton] = {}
        group_first: Gtk.ToggleButton | None = None
        short_labels = {
            "POMODORO": "Pomodoro",
            "FLOW": "Flow",
            "BASIC": "Timer",
            "RECOVERY": "Recovery",
        }
        for mode_id in ("POMODORO", "FLOW", "BASIC", "RECOVERY"):
            btn = Gtk.ToggleButton(label=short_labels[mode_id])
            btn.add_css_class("flat")
            btn.add_css_class("unravel-mode-btn")
            if mode_id == "FLOW":
                btn.add_css_class("unravel-mode-flow")
            elif mode_id == "BASIC":
                btn.add_css_class("unravel-mode-basic")
            elif mode_id == "RECOVERY":
                btn.add_css_class("unravel-mode-rest")
            if group_first is None:
                group_first = btn
            else:
                btn.set_group(group_first)
            btn.connect("toggled", self._on_mode_toggled, mode_id)
            mode_bar.append(btn)
            self._mode_buttons[mode_id] = btn
        self._mode_box.append(mode_bar)

        self._mode_desc = Gtk.Label(label=MODE_DESCRIPTIONS[engine.config.mode])
        self._mode_desc.set_wrap(True)
        self._mode_desc.set_justify(Gtk.Justification.CENTER)
        self._mode_desc.add_css_class("caption")
        self._mode_desc.add_css_class("unravel-muted")
        self._mode_box.append(self._mode_desc)
        self._main_box.append(self._mode_box)

        # Watchmaker Cairo ring
        self._ring = TimerRingWidget(size=254, compact=False)
        self._main_box.append(self._ring)

        # Selected `/day` task card right under the ring
        self._task_pill = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        self._task_pill.add_css_class("unravel-active-task-pill")
        self._task_pill.set_visible(False)

        self._task_kind_badge = Gtk.Label(label="Quest")
        self._task_kind_badge.add_css_class("unravel-badge")
        self._task_kind_badge.add_css_class("unravel-badge-selected")
        self._task_pill.append(self._task_kind_badge)

        self._task_title_lbl = Gtk.Label(label="", xalign=0)
        self._task_title_lbl.add_css_class("unravel-row-title")
        self._task_title_lbl.set_hexpand(True)
        self._task_title_lbl.set_ellipsize(Pango.EllipsizeMode.END)
        self._task_pill.append(self._task_title_lbl)

        self._task_check_btn = Gtk.Button(label="✓")
        self._task_check_btn.add_css_class("flat")
        self._task_check_btn.add_css_class("unravel-check-btn")
        self._task_check_btn.set_tooltip_text("Cross off this item")
        self._task_check_btn.connect("clicked", lambda _b: self._cb["check_task"]())
        self._task_pill.append(self._task_check_btn)

        self._task_clear_btn = Gtk.Button.new_from_icon_name("window-close-symbolic")
        self._task_clear_btn.add_css_class("flat")
        self._task_clear_btn.add_css_class("circular")
        self._task_clear_btn.set_tooltip_text("Clear selection (Free focus)")
        self._task_clear_btn.connect("clicked", lambda _b: self._cb["clear_task"]())
        self._task_pill.append(self._task_clear_btn)
        self._main_box.append(self._task_pill)

        self._free_hint_lbl = Gtk.Button(label="Free focus · pick from Today →")
        self._free_hint_lbl.add_css_class("flat")
        self._free_hint_lbl.add_css_class("unravel-link-pill")
        self._free_hint_lbl.set_halign(Gtk.Align.CENTER)
        self._free_hint_lbl.connect("clicked", lambda _b: self._cb["open_today"]())
        self._main_box.append(self._free_hint_lbl)

        # Break overrun banner
        self._overrun_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self._overrun_box.add_css_class("unravel-overrun-banner")
        self._overrun_box.set_visible(False)
        overrun_title = Gtk.Label(label="Break ran past its mark")
        overrun_title.add_css_class("heading")
        self._overrun_note_preview = Gtk.Label()
        self._overrun_note_preview.set_wrap(True)
        self._overrun_note_preview.add_css_class("caption")
        self._overrun_note_preview.add_css_class("unravel-muted")
        self._overrun_note_preview.set_visible(False)
        overrun_btns = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        overrun_btns.set_halign(Gtk.Align.CENTER)
        ext_btn = Gtk.Button(label="+5 more")
        ext_btn.add_css_class("flat")
        ext_btn.add_css_class("unravel-ghost-pill")
        ext_btn.connect("clicked", lambda _b: self._cb["extend"](300))
        back_btn = Gtk.Button(label="Back to focus")
        back_btn.add_css_class("unravel-primary-btn")
        back_btn.set_size_request(138, 38)
        back_btn.connect("clicked", lambda _b: self._cb["skip"]())
        overrun_btns.append(ext_btn)
        overrun_btns.append(back_btn)
        self._overrun_box.append(overrun_title)
        self._overrun_box.append(self._overrun_note_preview)
        self._overrun_box.append(overrun_btns)
        self._main_box.append(self._overrun_box)

        # Break return note card
        self._note_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=7)
        self._note_box.add_css_class("unravel-soft-card")
        self._note_box.set_visible(False)
        note_lbl = Gtk.Label(label="Where were you? (return cue for after this break)", xalign=0)
        note_lbl.add_css_class("caption")
        note_lbl.add_css_class("unravel-muted")
        note_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        self._note_entry = Gtk.Entry()
        self._note_entry.set_hexpand(True)
        self._note_entry.set_max_length(140)
        self._note_entry.set_placeholder_text("Jot your return cue…")
        self._note_entry.connect("activate", self._submit_note)
        note_save = Gtk.Button(label="Keep")
        note_save.add_css_class("flat")
        note_save.add_css_class("unravel-ghost-pill")
        note_save.connect("clicked", self._submit_note)
        note_row.append(self._note_entry)
        note_row.append(note_save)
        self._note_box.append(note_lbl)
        self._note_box.append(note_row)
        self._main_box.append(self._note_box)

        # Primary live action controls
        ctrl_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        ctrl_row.set_halign(Gtk.Align.CENTER)

        self._primary_btn = Gtk.Button(label="Start focus")
        self._primary_btn.add_css_class("unravel-primary-btn")
        self._primary_btn.set_size_request(164, 46)
        self._primary_btn.connect("clicked", self._on_primary_clicked)
        ctrl_row.append(self._primary_btn)

        self._break_btn = Gtk.Button(label="Take break")
        self._break_btn.add_css_class("flat")
        self._break_btn.add_css_class("unravel-ghost-pill")
        self._break_btn.set_size_request(-1, 46)
        self._break_btn.set_visible(False)
        self._break_btn.connect("clicked", lambda _b: self._cb["take_break"]())
        ctrl_row.append(self._break_btn)

        self._skip_btn = Gtk.Button(label="Skip break")
        self._skip_btn.add_css_class("flat")
        self._skip_btn.add_css_class("unravel-ghost-pill")
        self._skip_btn.set_size_request(-1, 46)
        self._skip_btn.set_visible(False)
        self._skip_btn.connect("clicked", lambda _b: self._cb["skip"]())
        ctrl_row.append(self._skip_btn)

        self._stop_btn = Gtk.Button(label="Stop")
        self._stop_btn.add_css_class("flat")
        self._stop_btn.add_css_class("unravel-ghost-pill")
        self._stop_btn.set_size_request(-1, 46)
        self._stop_btn.set_visible(False)
        self._stop_btn.connect("clicked", lambda _b: self._cb["stop"](False))
        ctrl_row.append(self._stop_btn)
        self._main_box.append(ctrl_row)

        # Secondary quiet links (Stop & cross off, +5m break, Discard)
        sec_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        sec_row.set_halign(Gtk.Align.CENTER)

        self._complete_task_btn = Gtk.Button(label="✓ Stop & cross off")
        self._complete_task_btn.add_css_class("flat")
        self._complete_task_btn.set_visible(False)
        self._complete_task_btn.connect("clicked", lambda _b: self._cb["stop"](True))
        sec_row.append(self._complete_task_btn)

        self._plus5_btn = Gtk.Button(label="+5m break")
        self._plus5_btn.add_css_class("flat")
        self._plus5_btn.set_visible(False)
        self._plus5_btn.connect("clicked", lambda _b: self._cb["extend"](300))
        sec_row.append(self._plus5_btn)

        self._discard_btn = Gtk.Button(label="Discard")
        self._discard_btn.add_css_class("flat")
        self._discard_btn.set_visible(False)
        self._discard_btn.connect("clicked", lambda _b: self._cb["discard"]())
        sec_row.append(self._discard_btn)
        self._main_box.append(sec_row)

        card.append(self._main_box)

        # ---- Post-session summary inside card
        self._summary_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14)
        self._summary_box.set_visible(False)

        sum_head = Gtk.Label(label="Session logged")
        sum_head.add_css_class("unravel-today-heading")
        self._summary_detail = Gtk.Label()
        self._summary_detail.set_wrap(True)
        self._summary_detail.set_justify(Gtk.Justification.CENTER)
        self._summary_detail.add_css_class("unravel-muted")

        adj_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        adj_row.set_halign(Gtk.Align.CENTER)
        adj_lbl = Gtk.Label(label="Adjust minutes:")
        adj_lbl.add_css_class("caption")
        self._adjust_spin = Gtk.SpinButton.new_with_range(1, 720, 1)
        adj_btn = Gtk.Button(label="Update")
        adj_btn.add_css_class("flat")
        adj_btn.add_css_class("unravel-ghost-pill")
        adj_btn.connect("clicked", lambda _b: self._cb["adjust"](int(self._adjust_spin.get_value())))
        adj_row.append(adj_lbl)
        adj_row.append(self._adjust_spin)
        adj_row.append(adj_btn)

        again_btn = Gtk.Button(label="Start another")
        again_btn.add_css_class("unravel-primary-btn")
        again_btn.set_halign(Gtk.Align.CENTER)
        again_btn.set_size_request(184, 44)
        again_btn.connect("clicked", lambda _b: self._cb["reset"]())

        self._summary_box.append(sum_head)
        self._summary_box.append(self._summary_detail)
        self._summary_box.append(adj_row)
        self._summary_box.append(again_btn)
        card.append(self._summary_box)

        root.append(card)

        # ---- Quiet cadence preset card below (idle only)
        self._setup_card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self._setup_card.add_css_class("unravel-soft-card")

        self._preset_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        self._preset_row.set_halign(Gtk.Align.CENTER)
        self._setup_card.append(self._preset_row)

        self._custom_expander = Gtk.Expander(label="Custom focus, break & rounds")
        custom_grid = Gtk.Grid(column_spacing=12, row_spacing=8)
        custom_grid.set_margin_top(10)
        custom_grid.set_halign(Gtk.Align.CENTER)

        self._focus_spin = Gtk.SpinButton.new_with_range(1, 480, 1)
        self._focus_spin.connect("value-changed", self._on_custom_changed)
        self._break_spin = Gtk.SpinButton.new_with_range(1, 60, 1)
        self._break_spin.connect("value-changed", self._on_custom_changed)
        self._rounds_spin = Gtk.SpinButton.new_with_range(1, 12, 1)
        self._rounds_spin.connect("value-changed", self._on_custom_changed)

        self._focus_lbl = Gtk.Label(label="Focus (min)", xalign=0)
        self._focus_lbl.add_css_class("caption")
        self._break_lbl = Gtk.Label(label="Short break (min)", xalign=0)
        self._break_lbl.add_css_class("caption")
        self._rounds_lbl = Gtk.Label(label="Rounds", xalign=0)
        self._rounds_lbl.add_css_class("caption")

        custom_grid.attach(self._focus_lbl, 0, 0, 1, 1)
        custom_grid.attach(self._focus_spin, 1, 0, 1, 1)
        custom_grid.attach(self._break_lbl, 0, 1, 1, 1)
        custom_grid.attach(self._break_spin, 1, 1, 1, 1)
        custom_grid.attach(self._rounds_lbl, 0, 2, 1, 1)
        custom_grid.attach(self._rounds_spin, 1, 2, 1, 1)
        self._custom_expander.set_child(custom_grid)
        self._setup_card.append(self._custom_expander)

        root.append(self._setup_card)

        clamp.set_child(root)
        scroll.set_child(clamp)
        self.append(scroll)

        self.sync_controls_from_engine()

    def set_sync_status(self, text: str) -> None:
        self._sync_label.set_text(text)

    def sync_controls_from_engine(self) -> None:
        self._updating_controls = True
        cfg = self._engine.config
        btn = self._mode_buttons.get(cfg.mode)
        if btn and not btn.get_active():
            btn.set_active(True)
        self._mode_desc.set_text(MODE_DESCRIPTIONS[cfg.mode])

        while (child := self._preset_row.get_first_child()) is not None:
            self._preset_row.remove(child)

        if has_intervals(cfg.mode):
            for f_min, b_min, label, _hint in CADENCE_PRESETS:
                p_btn = Gtk.Button(label=label)
                p_btn.add_css_class("flat")
                p_btn.add_css_class("unravel-preset-btn")
                if round(per_focus_seconds(cfg) / 60) == f_min and round(cfg.short_break_seconds / 60) == b_min:
                    p_btn.add_css_class("unravel-preset-active")
                p_btn.connect("clicked", self._apply_cadence_preset, f_min, b_min)
                self._preset_row.append(p_btn)
            self._setup_card.set_visible(self._engine.phase == "IDLE")
            self._preset_row.set_visible(True)
            self._custom_expander.set_visible(True)
            self._break_lbl.set_visible(True)
            self._break_spin.set_visible(True)
            self._rounds_lbl.set_visible(True)
            self._rounds_spin.set_visible(True)
            self._focus_spin.set_value(max(1, round(per_focus_seconds(cfg) / 60)))
            self._break_spin.set_value(max(1, round(cfg.short_break_seconds / 60)))
            self._rounds_spin.set_value(cfg.intervals)
        elif cfg.mode == "BASIC":
            for mins in BASIC_MINUTE_PRESETS:
                p_btn = Gtk.Button(label=f"{mins}m")
                p_btn.add_css_class("flat")
                p_btn.add_css_class("unravel-preset-btn")
                if round(cfg.target_seconds / 60) == mins:
                    p_btn.add_css_class("unravel-preset-active")
                p_btn.connect("clicked", self._apply_basic_preset, mins)
                self._preset_row.append(p_btn)
            self._setup_card.set_visible(self._engine.phase == "IDLE")
            self._preset_row.set_visible(True)
            self._custom_expander.set_visible(True)
            self._break_lbl.set_visible(False)
            self._break_spin.set_visible(False)
            self._rounds_lbl.set_visible(False)
            self._rounds_spin.set_visible(False)
            self._focus_spin.set_value(max(1, round(cfg.target_seconds / 60)))
        else:
            self._setup_card.set_visible(False)

        self._updating_controls = False

    def refresh_tick(self, dark: bool) -> None:
        eng = self._engine
        cfg = eng.config
        phase = eng.phase
        plan = eng.plan()
        cur = eng.current_interval()
        on_break = eng.on_break()
        flowing = eng.is_focus_flowing()
        overrunning = eng.is_overrunning()
        recovery = cfg.mode == "RECOVERY"
        interval_mode = has_intervals(cfg.mode)
        focus_blocks = [i for i in plan if i.kind == "FOCUS"]
        focus_idx = sum(1 for i in plan[: eng.interval_index + 1] if i.kind == "FOCUS")

        # Cadence chip with Unravel semantic colors (diffed to avoid GTK style thrash)
        if recovery:
            chip_text, chip_css = "Recovery", "unravel-rest-chip"
        elif interval_mode:
            chip_text = f"{MODE_LABELS[cfg.mode]} · {round(per_focus_seconds(cfg) / 60)}/{round(cfg.short_break_seconds / 60)}"
            if overrunning:
                chip_css = "unravel-overrun-chip"
            elif on_break:
                chip_css = "unravel-rest-chip"
            elif cfg.mode == "FLOW":
                chip_css = "unravel-flow-chip"
            else:
                chip_css = "unravel-focus-chip"
        else:
            chip_text, chip_css = f"{MODE_LABELS[cfg.mode]} · {format_duration(cfg.target_seconds)}", "unravel-focus-chip"

        if self._last_chip != (chip_text, chip_css):
            self._last_chip = (chip_text, chip_css)
            for css in ("unravel-focus-chip", "unravel-flow-chip", "unravel-rest-chip", "unravel-overrun-chip"):
                self._cadence_chip.remove_css_class(css)
            self._cadence_chip.add_css_class(chip_css)
            self._cadence_chip.set_text(chip_text)

        if phase == "ENDED":
            self._main_box.set_visible(False)
            self._setup_card.set_visible(False)
            self._summary_box.set_visible(True)
            logged = eng.focus_elapsed_seconds()
            flow_s = eng.total_flow_seconds()
            parts = [f"{format_duration(logged)} logged"]
            if flow_s > 0:
                parts.append(f"+{format_duration(flow_s)} in flow")
            if eng.task:
                parts.append(eng.task.title)
            self._summary_detail.set_text(" · ".join(parts))
            if not self._adjust_spin.has_focus():
                self._adjust_spin.set_value(max(1, round(logged / 60)))
            self._last_ui_sig = ("ENDED",)
            return

        # Watchmaker ring state + subtle round notch ticks (self-diffed inside TimerRingWidget)
        target = eng.current_target_seconds()
        i_elapsed = eng.interval_elapsed_seconds()
        ticks: list[float] = []
        if interval_mode and len(focus_blocks) > 1 and not on_break and not overrunning:
            ticks = [i / len(focus_blocks) for i in range(1, len(focus_blocks))]

        if recovery:
            tone = "rest"
            prog = 0.0
            eyebrow = "Recovery" if phase != "IDLE" else "Open-ended rest"
            subline = "Paused" if phase == "PAUSED" else "Stop whenever restored"
        elif overrunning:
            tone = "overrun"
            prog = overtime_progress(eng.overrun_seconds(), target)
            eyebrow = f"{INTERVAL_LABELS[cur.kind]} overrun"
            subline = "Choose below"
        elif on_break:
            tone = "rest"
            prog = arc_progress(i_elapsed, target)
            eyebrow = INTERVAL_LABELS[cur.kind]
            subline = "Paused" if phase == "PAUSED" else f"Round {focus_idx} of {len(focus_blocks)}"
        elif flowing:
            tone = "flow"
            prog = 1.0
            eyebrow = "Flowing · baseline met"
            subline = f"+{format_duration(eng.focus_flow_seconds())} past {format_duration(target)}"
        else:
            tone = "flow" if cfg.mode == "FLOW" else "focus"
            prog = 1.0 if phase == "IDLE" else arc_progress(i_elapsed, target)
            if phase == "IDLE":
                eyebrow = f"{format_duration(per_focus_seconds(cfg))} baseline" if cfg.mode == "FLOW" else MODE_LABELS[cfg.mode]
                subline = f"{cfg.intervals} rounds" if interval_mode and cfg.intervals > 1 else ""
            else:
                eyebrow = f"Round {focus_idx} of {len(focus_blocks)}" if len(focus_blocks) > 1 else INTERVAL_LABELS[cur.kind]
                subline = "Paused" if phase == "PAUSED" else ""

        self._ring.set_state(
            progress=prog,
            tone=tone,
            readout=eng.readout(),
            eyebrow=eyebrow,
            subline=subline,
            dark=dark,
            pulse=(flowing or recovery) and phase == "RUNNING",
            tick_fractions=ticks,
        )

        # Skip all surrounding GTK visibility/label mutations unless structural UI state changed
        can_break = eng.next_break_info() is not None
        ui_sig = (
            phase,
            recovery,
            on_break,
            overrunning,
            can_break,
            eng.task.id if eng.task else None,
            eng.task.title if eng.task else None,
            eng.task.type if eng.task else None,
            eng.return_note,
        )
        if ui_sig == self._last_ui_sig:
            return
        self._last_ui_sig = ui_sig

        self._main_box.set_visible(True)
        self._summary_box.set_visible(False)
        self._mode_box.set_visible(phase == "IDLE")
        self._setup_card.set_visible(phase == "IDLE" and not recovery)

        if eng.task and not recovery:
            self._task_pill.set_visible(True)
            self._free_hint_lbl.set_visible(False)
            self._task_kind_badge.set_text("Daily" if eng.task.type == "HABIT" else "Quest")
            self._task_title_lbl.set_text(eng.task.title)
            self._task_clear_btn.set_visible(phase == "IDLE")
            self._task_check_btn.set_visible(phase == "IDLE")
        else:
            self._task_pill.set_visible(False)
            self._free_hint_lbl.set_visible(phase == "IDLE" and not recovery)

        self._overrun_box.set_visible(overrunning)
        if overrunning and eng.return_note:
            self._overrun_note_preview.set_text(f"Note: {eng.return_note}")
            self._overrun_note_preview.set_visible(True)
        else:
            self._overrun_note_preview.set_visible(False)

        self._note_box.set_visible(on_break and not overrunning)
        if on_break and eng.return_note and not self._note_entry.has_focus() and not self._note_entry.get_text():
            self._note_entry.set_text(eng.return_note)
        elif not on_break and self._note_entry.get_text():
            self._note_entry.set_text("")

        if phase == "IDLE":
            self._primary_btn.set_label("Start rest" if recovery else "Start focus")
            self._primary_btn.set_visible(True)
            self._break_btn.set_visible(False)
            self._skip_btn.set_visible(False)
            self._stop_btn.set_visible(False)
            self._complete_task_btn.set_visible(False)
            self._plus5_btn.set_visible(False)
            self._discard_btn.set_visible(False)
        else:
            self._primary_btn.set_visible(not overrunning)
            self._primary_btn.set_label("Pause" if phase == "RUNNING" else "Resume")
            self._break_btn.set_visible(can_break)
            self._skip_btn.set_visible(on_break and not overrunning)
            self._stop_btn.set_visible(True)
            self._complete_task_btn.set_visible(eng.task is not None and not recovery)
            self._plus5_btn.set_visible(on_break and not overrunning)
            self._discard_btn.set_visible(True)

    # ---------------------------------------------------------------- handlers

    def _on_primary_clicked(self, _btn: Gtk.Button) -> None:
        if self._engine.phase == "IDLE":
            self._cb["start"]()
        elif self._engine.phase == "RUNNING":
            self._cb["pause"]()
        elif self._engine.phase == "PAUSED":
            self._cb["resume"]()

    def _on_mode_toggled(self, btn: Gtk.ToggleButton, mode_id: TimerMode) -> None:
        if self._updating_controls or not btn.get_active():
            return
        cfg = self._engine.config
        if mode_id == "RECOVERY":
            if cfg.mode != "RECOVERY":
                self._last_work_mode = cfg.mode
                self._last_work_target = cfg.target_seconds
                self._last_work_intervals = cfg.intervals
            self._engine.configure(mode="RECOVERY", target_seconds=0, intervals=1)
        else:
            from_rec = cfg.mode == "RECOVERY"
            target = self._last_work_target if from_rec else cfg.target_seconds
            if not has_intervals(mode_id):
                intervals = 1
            elif from_rec:
                intervals = self._last_work_intervals
            elif has_intervals(cfg.mode):
                intervals = cfg.intervals
            else:
                intervals = suggest_intervals(target, cfg.focus_seconds)
            self._engine.configure(mode=mode_id, target_seconds=clamp_target(target), intervals=intervals)
        self.sync_controls_from_engine()
        self._cb["config"]()

    def _apply_cadence_preset(self, _btn: Gtk.Button, focus_min: int, break_min: int) -> None:
        rounds = self._engine.config.intervals
        self._engine.configure(
            focus_seconds=focus_min * 60,
            target_seconds=clamp_target(focus_min * 60 * rounds),
            short_break_seconds=clamp_break(break_min * 60),
        )
        self.sync_controls_from_engine()
        self._cb["config"]()

    def _apply_basic_preset(self, _btn: Gtk.Button, mins: int) -> None:
        self._engine.configure(target_seconds=clamp_target(mins * 60), intervals=1)
        self.sync_controls_from_engine()
        self._cb["config"]()

    def _on_custom_changed(self, _spin: Gtk.SpinButton) -> None:
        if self._updating_controls:
            return
        cfg = self._engine.config
        focus_s = clamp_target(int(self._focus_spin.get_value()) * 60)
        if has_intervals(cfg.mode):
            break_s = clamp_break(int(self._break_spin.get_value()) * 60)
            rounds = clamp_intervals(int(self._rounds_spin.get_value()))
            self._engine.configure(
                focus_seconds=focus_s,
                short_break_seconds=break_s,
                intervals=rounds,
                target_seconds=clamp_target(focus_s * rounds),
            )
        elif cfg.mode == "BASIC":
            self._engine.configure(target_seconds=focus_s, intervals=1)
        self.sync_controls_from_engine()
        self._cb["config"]()

    def _submit_note(self, _widget) -> None:
        self._cb["note"](self._note_entry.get_text())


class MiniTimerView(Gtk.Box):
    """Sleek frosted ~380×142 floating timer pill over Unravel's living backdrop."""

    def __init__(
        self,
        engine: TimerEngine,
        *,
        on_toggle: Callable[[], None],
        on_take_break: Callable[[], None],
        on_skip: Callable[[], None],
        on_extend: Callable[[int], None],
        on_stop: Callable[[bool], None],
        on_expand: Callable[[], None],
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        self._engine = engine
        self._last_mini_sig: tuple | None = None
        self.set_margin_top(8)
        self.set_margin_bottom(10)
        self.set_margin_start(14)
        self.set_margin_end(14)

        card = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        card.add_css_class("unravel-hero-card")
        card.set_valign(Gtk.Align.CENTER)

        self._ring = TimerRingWidget(size=52, compact=True)
        card.append(self._ring)

        info = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        info.set_hexpand(True)
        self._clock_lbl = Gtk.Label(label="25:00", xalign=0)
        self._clock_lbl.add_css_class("unravel-mini-clock")
        self._sub_lbl = Gtk.Label(label="Pomodoro Flow", xalign=0)
        self._sub_lbl.add_css_class("caption")
        self._sub_lbl.add_css_class("unravel-muted")
        self._sub_lbl.set_ellipsize(Pango.EllipsizeMode.END)
        info.append(self._clock_lbl)
        info.append(self._sub_lbl)
        card.append(info)

        btns = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)
        self._play_btn = Gtk.Button.new_from_icon_name("media-playback-start-symbolic")
        self._play_btn.add_css_class("circular")
        self._play_btn.add_css_class("unravel-primary-btn")
        self._play_btn.set_tooltip_text("Start / Pause / Resume")
        self._play_btn.connect("clicked", lambda _b: on_toggle())
        btns.append(self._play_btn)

        self._break_btn = Gtk.Button.new_from_icon_name("media-skip-forward-symbolic")
        self._break_btn.add_css_class("flat")
        self._break_btn.add_css_class("unravel-header-btn")
        self._break_btn.set_tooltip_text("Take break / Next")
        self._break_btn.connect(
            "clicked",
            lambda _b: on_skip() if self._engine.on_break() else on_take_break(),
        )
        btns.append(self._break_btn)

        self._plus5_btn = Gtk.Button(label="+5m")
        self._plus5_btn.add_css_class("flat")
        self._plus5_btn.add_css_class("unravel-ghost-pill")
        self._plus5_btn.set_visible(False)
        self._plus5_btn.connect("clicked", lambda _b: on_extend(300))
        btns.append(self._plus5_btn)

        self._done_btn = Gtk.Button(label="✓")
        self._done_btn.add_css_class("flat")
        self._done_btn.add_css_class("unravel-header-btn")
        self._done_btn.set_tooltip_text("Stop & cross off task")
        self._done_btn.set_visible(False)
        self._done_btn.connect("clicked", lambda _b: on_stop(True))
        btns.append(self._done_btn)

        self._stop_btn = Gtk.Button.new_from_icon_name("media-playback-stop-symbolic")
        self._stop_btn.add_css_class("flat")
        self._stop_btn.add_css_class("unravel-header-btn")
        self._stop_btn.set_tooltip_text("Stop & log session")
        self._stop_btn.connect("clicked", lambda _b: on_stop(False))
        btns.append(self._stop_btn)

        expand_btn = Gtk.Button.new_from_icon_name("view-fullscreen-symbolic")
        expand_btn.add_css_class("flat")
        expand_btn.add_css_class("unravel-header-btn")
        expand_btn.set_tooltip_text("Expand to full studio")
        expand_btn.connect("clicked", lambda _b: on_expand())
        btns.append(expand_btn)

        card.append(btns)
        self.append(card)

        hint = Gtk.Label(label="Tip: Alt+Space → Always on Top pins this above other windows")
        hint.add_css_class("caption")
        hint.add_css_class("unravel-muted")
        hint.set_xalign(0)
        self.append(hint)

    def refresh_tick(self, dark: bool) -> None:
        eng = self._engine
        phase = eng.phase
        on_break = eng.on_break()
        flowing = eng.is_focus_flowing()
        overrunning = eng.is_overrunning()
        target = eng.current_target_seconds()
        i_elapsed = eng.interval_elapsed_seconds()

        readout = eng.readout()
        if overrunning:
            tone, prog, sub = "overrun", overtime_progress(eng.overrun_seconds(), target), "Break overrun"
        elif on_break:
            tone, prog, sub = "rest", arc_progress(i_elapsed, target), INTERVAL_LABELS[eng.current_interval().kind]
        elif eng.config.mode == "RECOVERY":
            tone, prog, sub = "rest", 0.0, "Recovery"
        elif flowing:
            tone, prog, sub = "flow", 1.0, f"Flowing · {eng.task.title if eng.task else '+' + format_duration(eng.focus_flow_seconds())}"
        else:
            tone = "flow" if eng.config.mode == "FLOW" else "focus"
            prog = 1.0 if phase == "IDLE" else arc_progress(i_elapsed, target)
            sub = eng.task.title if eng.task else MODE_LABELS[eng.config.mode]
            if phase == "PAUSED":
                sub = f"Paused · {sub}"

        self._ring.set_state(progress=prog, tone=tone, readout="", dark=dark)

        can_break = on_break or eng.next_break_info() is not None
        sig = (readout, sub, phase, overrunning, can_break, eng.task is not None, eng.config.mode == "RECOVERY")
        if sig == self._last_mini_sig:
            return
        self._last_mini_sig = sig

        self._clock_lbl.set_text(readout)
        self._sub_lbl.set_text(sub)
        self._play_btn.set_visible(not overrunning)
        self._play_btn.set_icon_name(
            "media-playback-pause-symbolic" if phase == "RUNNING" else "media-playback-start-symbolic"
        )
        self._break_btn.set_visible(can_break)
        self._plus5_btn.set_visible(overrunning)
        self._done_btn.set_visible(phase in ("RUNNING", "PAUSED") and eng.task is not None and eng.config.mode != "RECOVERY")
        self._stop_btn.set_visible(phase in ("RUNNING", "PAUSED"))
