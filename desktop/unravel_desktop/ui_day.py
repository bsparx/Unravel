"""Today (/day) open quests & habits panel — select, cross off, or launch timer in 1 click."""

from __future__ import annotations

from typing import Any, Callable

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gtk, Pango

from .timer_engine import AttachedTask, format_duration


def _format_anchor(minutes: int) -> str:
    h, m = divmod(max(0, int(minutes)), 60)
    return f"{h:02d}:{m:02d}"


def day_item_to_attached(item: dict[str, Any]) -> AttachedTask:
    return AttachedTask(
        id=str(item["id"]),
        title=str(item["title"]),
        type="HABIT" if item.get("type") == "HABIT" else "TODO",
        estimated_seconds=item.get("estimatedSeconds"),
        default_mode=item.get("defaultMode"),
        planned_intervals=item.get("plannedIntervals"),
    )


class FeedbackNoteDialog(Adw.Dialog):
    """Lightweight 1-field reflection prompt when crossing off a feedback-gated habit."""

    def __init__(
        self,
        title: str,
        prompt: str | None,
        on_submit: Callable[[str], None],
    ) -> None:
        super().__init__()
        self.set_title("Quick reflection")
        self.set_content_width(400)
        self._on_submit = on_submit

        view = Adw.ToolbarView()
        view.add_top_bar(Adw.HeaderBar())

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        box.set_margin_top(12)
        box.set_margin_bottom(20)
        box.set_margin_start(18)
        box.set_margin_end(18)

        heading = Gtk.Label(label=title, xalign=0)
        heading.add_css_class("heading")
        heading.set_wrap(True)
        box.append(heading)

        sub = Gtk.Label(
            label=prompt or "Write a quick line about how it went before checking this off.",
            xalign=0,
        )
        sub.add_css_class("dim-label")
        sub.add_css_class("caption")
        sub.set_wrap(True)
        box.append(sub)

        self._entry = Gtk.Entry()
        self._entry.set_placeholder_text("A brief note…")
        self._entry.set_max_length(400)
        self._entry.connect("activate", self._submit)
        box.append(self._entry)

        btns = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        btns.set_halign(Gtk.Align.END)
        cancel = Gtk.Button(label="Cancel")
        cancel.add_css_class("pill")
        cancel.connect("clicked", lambda _b: self.close())
        save = Gtk.Button(label="Check off")
        save.add_css_class("suggested-action")
        save.add_css_class("pill")
        save.connect("clicked", self._submit)
        btns.append(cancel)
        btns.append(save)
        box.append(btns)

        view.set_content(box)
        self.set_child(view)

    def _submit(self, _widget) -> None:
        text = self._entry.get_text().strip()
        if not text:
            self._entry.grab_focus()
            return
        self.close()
        self._on_submit(text)


class DayListView(Gtk.Box):
    """Displays every unfinished item from `/day`, ready to select, cross off, or time."""

    def __init__(
        self,
        *,
        on_select_item: Callable[[dict[str, Any]], None],
        on_start_timer_for_item: Callable[[dict[str, Any]], None],
        on_toggle_item: Callable[[dict[str, Any], bool, str | None], None],
        on_refresh: Callable[[], None],
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self._on_select = on_select_item
        self._on_start = on_start_timer_for_item
        self._on_toggle = on_toggle_item
        self._on_refresh = on_refresh

        self._day: dict[str, Any] | None = None
        self._selected_id: str | None = None
        self._pending_ids: set[str] = set()
        self._done_expanded = False

        # Header card
        header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        header.set_margin_top(16)
        header.set_margin_bottom(10)
        header.set_margin_start(18)
        header.set_margin_end(18)

        title_col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        title_col.set_hexpand(True)
        self._date_lbl = Gtk.Label(label="TODAY", xalign=0)
        self._date_lbl.add_css_class("unravel-section-kicker")
        self._heading_lbl = Gtk.Label(label="Your day", xalign=0)
        self._heading_lbl.add_css_class("title-2")
        self._summary_lbl = Gtk.Label(label="Loading your open list…", xalign=0)
        self._summary_lbl.add_css_class("caption")
        self._summary_lbl.add_css_class("dim-label")
        title_col.append(self._date_lbl)
        title_col.append(self._heading_lbl)
        title_col.append(self._summary_lbl)
        header.append(title_col)

        refresh_btn = Gtk.Button.new_from_icon_name("view-refresh-symbolic")
        refresh_btn.add_css_class("circular")
        refresh_btn.add_css_class("flat")
        refresh_btn.set_valign(Gtk.Align.START)
        refresh_btn.set_tooltip_text("Refresh Today's list")
        refresh_btn.connect("clicked", lambda _b: self._on_refresh())
        header.append(refresh_btn)
        self.append(header)

        # Scrollable list body
        scroll = Gtk.ScrolledWindow()
        scroll.set_vexpand(True)
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

        self._body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        self._body.set_margin_top(4)
        self._body.set_margin_bottom(24)
        self._body.set_margin_start(18)
        self._body.set_margin_end(18)

        scroll.set_child(self._body)
        self.append(scroll)

    def set_selected_id(self, task_id: str | None) -> None:
        if self._selected_id == task_id:
            return
        self._selected_id = task_id
        self._render()

    def set_pending(self, task_id: str, pending: bool) -> None:
        if pending:
            self._pending_ids.add(task_id)
        else:
            self._pending_ids.discard(task_id)
        self._render()

    def set_day(self, day: dict[str, Any]) -> None:
        self._day = day
        self._pending_ids.clear()
        self._render()

    def set_error(self, message: str) -> None:
        self._summary_lbl.set_text(message)

    def _clear_body(self) -> None:
        while (child := self._body.get_first_child()) is not None:
            self._body.remove(child)

    def _render(self) -> None:
        self._clear_body()
        day = self._day
        if day is None:
            return

        date_label = day.get("dateLabel") or "Today"
        self._date_lbl.set_text(str(date_label).upper())

        overdue = day.get("overdue") or []
        due_today = day.get("dueToday") or []
        habits = day.get("habits") or []
        undated = day.get("undated") or []
        completed = day.get("completedToday") or []

        open_count = len(overdue) + len(due_today) + len(habits) + len(undated)
        done_count = len(completed)
        logged_s = int(day.get("loggedSeconds") or 0)

        parts = [f"{open_count} open"]
        if done_count > 0:
            parts.append(f"{done_count} done today")
        if logged_s > 0:
            parts.append(f"{format_duration(logged_s)} on the clock")
        self._summary_lbl.set_text(" · ".join(parts))

        sections = [
            ("OVERDUE", overdue, "overdue"),
            ("TODAY", due_today, "today"),
            ("DAILIES", habits, "habit"),
            ("SIDE QUESTS", undated, "side"),
        ]

        any_open = False
        for sec_label, items, kind in sections:
            if not items:
                continue
            any_open = True
            sec_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=7)
            kicker = Gtk.Label(label=f"{sec_label} · {len(items)}", xalign=0)
            kicker.add_css_class("unravel-section-kicker")
            sec_box.append(kicker)
            for item in items:
                sec_box.append(self._build_item_row(item, kind=kind, done=False))
            self._body.append(sec_box)

        if not any_open:
            empty = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            empty.add_css_class("unravel-empty-card")
            t = Gtk.Label(
                label="Everything on Today is done" if done_count > 0 else "Your day is clear",
            )
            t.add_css_class("heading")
            sub = Gtk.Label(
                label="Start a free focus session on the left, or take a calm Recovery break."
            )
            sub.set_wrap(True)
            sub.set_justify(Gtk.Justification.CENTER)
            sub.add_css_class("caption")
            sub.add_css_class("dim-label")
            empty.append(t)
            empty.append(sub)
            self._body.append(empty)

        # Collapsible completed-today section for quiet reinforcement & accidental undo
        if completed:
            exp = Gtk.Expander(label=f"Done today · {len(completed)}")
            exp.set_expanded(self._done_expanded)
            exp.connect("notify::expanded", lambda e, _p: setattr(self, "_done_expanded", e.get_expanded()))
            done_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            done_box.set_margin_top(8)
            for item in completed:
                done_box.append(self._build_item_row(item, kind="done", done=True))
            exp.set_child(done_box)
            self._body.append(exp)

    def _build_item_row(self, item: dict[str, Any], *, kind: str, done: bool) -> Gtk.Box:
        item_id = str(item["id"])
        selected = not done and self._selected_id == item_id
        busy = item_id in self._pending_ids

        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        row.add_css_class("unravel-day-row")
        if selected:
            row.add_css_class("unravel-day-row-selected")
        row.set_valign(Gtk.Align.CENTER)

        # 1. Check-off circle button
        check_btn = Gtk.Button(label="✓" if done else "")
        check_btn.add_css_class("flat")
        check_btn.add_css_class("unravel-check-btn")
        if done:
            check_btn.add_css_class("unravel-check-btn-done")
        check_btn.set_valign(Gtk.Align.CENTER)
        check_btn.set_sensitive(not busy)
        check_btn.set_tooltip_text("Mark not done" if done else "Cross off")
        check_btn.connect("clicked", self._on_check_clicked, item, done)
        row.append(check_btn)

        # 2. Clickable item content (selects for timer)
        select_btn = Gtk.Button()
        select_btn.add_css_class("flat")
        select_btn.set_hexpand(True)
        select_btn.set_sensitive(not done)
        select_btn.set_tooltip_text("Select for timer" if not done else "")
        select_btn.connect("clicked", lambda _b, it=item: self._on_select(it))

        col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
        col.set_halign(Gtk.Align.FILL)

        title_lbl = Gtk.Label(label=str(item.get("title") or ""), xalign=0)
        title_lbl.set_wrap(True)
        title_lbl.set_wrap_mode(Pango.WrapMode.WORD_CHAR)
        if done:
            title_lbl.add_css_class("unravel-done-title")
        col.append(title_lbl)

        # Subtle metadata pills
        meta = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)
        has_meta = False

        if selected:
            b = Gtk.Label(label="On timer")
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-selected")
            meta.append(b)
            has_meta = True

        if kind == "overdue" and isinstance(item.get("daysUntilDue"), int) and item["daysUntilDue"] < 0:
            days_late = abs(int(item["daysUntilDue"]))
            b = Gtk.Label(label=f"{days_late}d late")
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-overdue")
            meta.append(b)
            has_meta = True

        prio = item.get("priority")
        if not done and prio in ("P1", "P2"):
            b = Gtk.Label(label=prio)
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-p1" if prio == "P1" else "unravel-badge-p2")
            meta.append(b)
            has_meta = True

        if item.get("type") == "HABIT":
            anchor = item.get("timeAnchorMinutes")
            lbl = _format_anchor(anchor) if isinstance(anchor, int) else "Daily"
            b = Gtk.Label(label=lbl)
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-habit")
            meta.append(b)
            has_meta = True

        proj = item.get("project")
        if isinstance(proj, dict) and proj.get("name"):
            b = Gtk.Label(label=str(proj["name"]))
            b.set_max_width_chars(14)
            b.set_ellipsize(Pango.EllipsizeMode.END)
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-meta")
            meta.append(b)
            has_meta = True

        est = item.get("estimatedSeconds")
        if isinstance(est, int) and est > 0:
            b = Gtk.Label(label=format_duration(est))
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-meta")
            meta.append(b)
            has_meta = True

        logged = item.get("loggedSeconds")
        if isinstance(logged, int) and logged > 0:
            b = Gtk.Label(label=f"{format_duration(logged)} done")
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-meta")
            meta.append(b)
            has_meta = True

        if has_meta:
            col.append(meta)

        # Next step or minimal promise line (if present and open)
        if not done:
            hint_text = None
            if item.get("nextStepTitle"):
                done_s = int(item.get("stepsDone") or 0)
                tot_s = int(item.get("stepsTotal") or 0)
                hint_text = f"Next ({done_s}/{tot_s}): {item['nextStepTitle']}"
            elif item.get("minimalTask"):
                hint_text = f"Minimum: {item['minimalTask']}"
            if hint_text:
                h_lbl = Gtk.Label(label=hint_text, xalign=0)
                h_lbl.add_css_class("caption")
                h_lbl.add_css_class("dim-label")
                h_lbl.set_ellipsize(Pango.EllipsizeMode.END)
                col.append(h_lbl)

        select_btn.set_child(col)
        row.append(select_btn)

        # 3. One-click Start Timer button on open items
        if not done:
            play_btn = Gtk.Button.new_from_icon_name("media-playback-start-symbolic")
            play_btn.add_css_class("flat")
            play_btn.add_css_class("unravel-row-play")
            play_btn.set_valign(Gtk.Align.CENTER)
            play_btn.set_tooltip_text("Start timer on this item")
            play_btn.connect("clicked", lambda _b, it=item: self._on_start(it))
            row.append(play_btn)

        return row

    def _on_check_clicked(self, _btn: Gtk.Button, item: dict[str, Any], currently_done: bool) -> None:
        next_done = not currently_done
        if next_done and item.get("type") == "HABIT" and item.get("requiresFeedback"):
            dlg = FeedbackNoteDialog(
                title=str(item.get("title") or "Habit"),
                prompt=item.get("feedbackPrompt"),
                on_submit=lambda note, it=item: self._on_toggle(it, True, note),
            )
            dlg.present(self.get_root())
            return
        self._on_toggle(item, next_done, None)
