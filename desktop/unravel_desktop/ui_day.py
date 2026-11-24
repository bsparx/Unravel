"""Dedicated Today (/day) view — open tasks, remaining habits, and web-only Practices."""

from __future__ import annotations

import copy
import re
from typing import Any, Callable

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, GLib, Gtk, Pango

from .ring_widget import DayProgressRing
from .timer_engine import AttachedTask, format_duration

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _format_anchor(minutes: int) -> str:
    h, m = divmod(max(0, int(minutes)), 60)
    return f"{h:02d}:{m:02d}"


def _safe_hex(value: str | None) -> str:
    s = (value or "").strip()
    return s if _HEX_RE.match(s) else "#8aa2f0"


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
        self.set_content_width(420)
        self._on_submit = on_submit

        view = Adw.ToolbarView()
        view.add_top_bar(Adw.HeaderBar())

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14)
        box.set_margin_top(14)
        box.set_margin_bottom(22)
        box.set_margin_start(20)
        box.set_margin_end(20)

        heading = Gtk.Label(label=title, xalign=0)
        heading.add_css_class("title-3")
        heading.set_wrap(True)
        box.append(heading)

        sub = Gtk.Label(
            label=prompt or "Write a quick line about how it went before checking this off.",
            xalign=0,
        )
        sub.add_css_class("unravel-muted")
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
    """Dedicated Today workspace showing open tasks, remaining habits & selected web Practices."""

    def __init__(
        self,
        *,
        on_select_item: Callable[[dict[str, Any]], None],
        on_start_timer_for_item: Callable[[dict[str, Any]], None],
        on_toggle_item: Callable[[dict[str, Any], bool, str | None], None],
        on_open_web_path: Callable[[str], None],
        on_refresh: Callable[[], None],
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self._on_select = on_select_item
        self._on_start = on_start_timer_for_item
        self._on_toggle = on_toggle_item
        self._on_open_web = on_open_web_path
        self._on_refresh = on_refresh

        self._day: dict[str, Any] | None = None
        self._selected_id: str | None = None
        self._pending_ids: set[str] = set()
        self._done_expanded = False
        self._filter = "all"  # all | tasks | habits | practices
        self._dark = False
        self._updating_filters = False
        self._row_refs: dict[str, tuple[Gtk.Box, Gtk.Button, Gtk.Label | None, Gtk.Box | None]] = {}

        scroll = Gtk.ScrolledWindow()
        scroll.set_vexpand(True)
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

        clamp = Adw.Clamp()
        clamp.set_maximum_size(680)
        clamp.set_margin_top(18)
        clamp.set_margin_bottom(28)
        clamp.set_margin_start(22)
        clamp.set_margin_end(22)

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)

        # ---- Top Today Hero Glass Card
        hero = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=14)
        hero.add_css_class("unravel-hero-card")
        hero.set_valign(Gtk.Align.CENTER)

        title_col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
        title_col.set_hexpand(True)
        self._date_lbl = Gtk.Label(label="TODAY", xalign=0)
        self._date_lbl.add_css_class("unravel-section-kicker")
        self._heading_lbl = Gtk.Label(label="Your day", xalign=0)
        self._heading_lbl.add_css_class("unravel-today-heading")
        self._summary_lbl = Gtk.Label(label="Syncing your open list…", xalign=0)
        self._summary_lbl.add_css_class("caption")
        self._summary_lbl.add_css_class("unravel-muted")
        title_col.append(self._date_lbl)
        title_col.append(self._heading_lbl)
        title_col.append(self._summary_lbl)
        hero.append(title_col)

        self._progress_ring = DayProgressRing(size=54)
        hero.append(self._progress_ring)

        refresh_btn = Gtk.Button.new_from_icon_name("view-refresh-symbolic")
        refresh_btn.add_css_class("flat")
        refresh_btn.add_css_class("unravel-header-btn")
        refresh_btn.set_valign(Gtk.Align.CENTER)
        refresh_btn.set_tooltip_text("Refresh Today")
        refresh_btn.connect("clicked", lambda _b: self._on_refresh())
        hero.append(refresh_btn)

        root.append(hero)

        # ---- Quick filter pills: All · Tasks · Habits · Practices
        self._filter_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        self._filter_btns: dict[str, Gtk.ToggleButton] = {}
        first_f: Gtk.ToggleButton | None = None
        for key, label in (
            ("all", "All"),
            ("tasks", "Tasks"),
            ("habits", "Habits"),
            ("practices", "Practices"),
        ):
            btn = Gtk.ToggleButton(label=label)
            btn.add_css_class("flat")
            btn.add_css_class("unravel-filter-pill")
            if first_f is None:
                first_f = btn
                btn.set_active(True)
            else:
                btn.set_group(first_f)
            btn.connect("toggled", self._on_filter_toggled, key)
            self._filter_row.append(btn)
            self._filter_btns[key] = btn
        self._filter_row.set_visible(False)
        root.append(self._filter_row)

        # ---- Dynamic list container
        self._body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        root.append(self._body)

        clamp.set_child(root)
        scroll.set_child(clamp)
        self.append(scroll)

    def set_dark(self, dark: bool) -> None:
        if self._dark != dark:
            self._dark = dark
            self._update_progress_ring()

    def set_selected_id(self, task_id: str | None) -> None:
        """Toggle selection highlight IN-PLACE without rebuilding the widget tree."""
        if self._selected_id == task_id:
            return
        old_id = self._selected_id
        self._selected_id = task_id

        if old_id and old_id in self._row_refs:
            row, _chk, badge, meta = self._row_refs[old_id]
            row.remove_css_class("unravel-day-row-selected")
            if badge is not None:
                badge.set_visible(False)
            if meta is not None:
                self._sync_meta_visibility(meta)

        if task_id and task_id in self._row_refs:
            row, _chk, badge, meta = self._row_refs[task_id]
            row.add_css_class("unravel-day-row-selected")
            if badge is not None:
                badge.set_visible(True)
            if meta is not None:
                meta.set_visible(True)

    def set_pending(self, task_id: str, pending: bool) -> None:
        if pending:
            self._pending_ids.add(task_id)
        else:
            self._pending_ids.discard(task_id)
        ref = self._row_refs.get(task_id)
        if ref is not None:
            ref[1].set_sensitive(not pending)

    def apply_optimistic_toggle(self, item_id: str, done: bool) -> dict[str, Any] | None:
        """Instantly move item between open/done locally; returns deep copy for rollback."""
        if self._day is None:
            return None
        snapshot = copy.deepcopy(self._day)
        open_buckets = ("overdue", "dueToday", "habits", "undated")
        moved: dict[str, Any] | None = None

        if done:
            for b in open_buckets:
                items = self._day.get(b) or []
                for idx, it in enumerate(items):
                    if str(it.get("id")) == item_id:
                        moved = items.pop(idx)
                        break
                if moved is not None:
                    break
            if moved is not None:
                moved["done"] = True
                self._day.setdefault("completedToday", []).insert(0, moved)
        else:
            completed = self._day.get("completedToday") or []
            for idx, it in enumerate(completed):
                if str(it.get("id")) == item_id:
                    moved = completed.pop(idx)
                    break
            if moved is not None:
                moved["done"] = False
                target = "habits" if moved.get("type") == "HABIT" else "dueToday"
                self._day.setdefault(target, []).insert(0, moved)

        if moved is not None:
            done_p = len(self._day.get("completedPractices") or [])
            self._day["completedCount"] = len(self._day.get("completedToday") or []) + done_p
            self._render()
        return snapshot

    def set_day(self, day: dict[str, Any]) -> None:
        self._day = day
        self._pending_ids.clear()
        self._render()

    def set_error(self, message: str) -> None:
        self._summary_lbl.set_text(message)

    def _sync_meta_visibility(self, meta: Gtk.Box) -> None:
        child = meta.get_first_child()
        any_vis = False
        while child is not None:
            if child.get_visible():
                any_vis = True
                break
            child = child.get_next_sibling()
        meta.set_visible(any_vis)

    def _on_filter_toggled(self, btn: Gtk.ToggleButton, key: str) -> None:
        if self._updating_filters or not btn.get_active():
            return
        self._filter = key
        self._render()

    def _update_progress_ring(self) -> None:
        if not self._day:
            self._progress_ring.set_progress(0, 0, self._dark)
            return
        open_c = (
            len(self._day.get("overdue") or [])
            + len(self._day.get("dueToday") or [])
            + len(self._day.get("habits") or [])
            + len(self._day.get("undated") or [])
            + len(self._day.get("practices") or [])
        )
        done_c = len(self._day.get("completedToday") or []) + len(self._day.get("completedPractices") or [])
        self._progress_ring.set_progress(done_c, open_c + done_c, self._dark)

    def _clear_body(self) -> None:
        self._row_refs.clear()
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
        practices = day.get("practices") or []
        completed = day.get("completedToday") or []
        completed_practices = day.get("completedPractices") or []

        task_count = len(overdue) + len(due_today) + len(undated)
        habit_count = len(habits)
        practice_count = len(practices)
        open_total = task_count + habit_count + practice_count
        done_total = len(completed) + len(completed_practices)
        logged_s = int(day.get("loggedSeconds") or 0)

        self._update_progress_ring()

        parts: list[str] = []
        if task_count + habit_count > 0:
            parts.append(f"{task_count + habit_count} open")
        if practice_count > 0:
            parts.append(f"{practice_count} {'practice' if practice_count == 1 else 'practices'} left")
        if not parts:
            parts.append("All clear")
        if done_total > 0:
            parts.append(f"{done_total} done")
        if logged_s > 0:
            parts.append(f"{format_duration(logged_s)} focused")
        self._summary_lbl.set_text(" · ".join(parts))

        # Show filter bar when 2+ open categories have items
        non_empty_cats = sum(1 for c in (task_count, habit_count, practice_count) if c > 0)
        self._updating_filters = True
        self._filter_btns["all"].set_label(f"All · {open_total}")
        self._filter_btns["tasks"].set_label(f"Tasks · {task_count}")
        self._filter_btns["tasks"].set_visible(task_count > 0)
        self._filter_btns["habits"].set_label(f"Habits · {habit_count}")
        self._filter_btns["habits"].set_visible(habit_count > 0)
        self._filter_btns["practices"].set_label(f"Practices · {practice_count}")
        self._filter_btns["practices"].set_visible(practice_count > 0)
        self._filter_row.set_visible(non_empty_cats >= 2)
        if (
            non_empty_cats < 2
            or (self._filter == "tasks" and task_count == 0)
            or (self._filter == "habits" and habit_count == 0)
            or (self._filter == "practices" and practice_count == 0)
        ):
            self._filter = "all"
            self._filter_btns["all"].set_active(True)
        self._updating_filters = False

        sections = [
            ("OVERDUE", overdue, "overdue", "tasks"),
            ("TODAY", due_today, "today", "tasks"),
            ("HABITS", habits, "habit", "habits"),
            ("SIDE QUESTS", undated, "side", "tasks"),
        ]

        any_open = False
        for sec_label, items, kind, group in sections:
            if not items:
                continue
            if self._filter != "all" and self._filter != group:
                continue
            any_open = True
            sec_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
            kicker = Gtk.Label(label=f"{sec_label} · {len(items)}", xalign=0)
            kicker.add_css_class("unravel-section-kicker")
            sec_box.append(kicker)
            for item in items:
                sec_box.append(self._build_item_row(item, kind=kind, done=False))
            self._body.append(sec_box)

        # ---- Remaining selected Practices (completed on Unravel web, read-only here)
        if practices and self._filter in ("all", "practices"):
            any_open = True
            p_sec = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
            p_hdr = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
            kicker = Gtk.Label(label=f"PRACTICES REMAINING · {len(practices)}", xalign=0)
            kicker.add_css_class("unravel-section-kicker")
            kicker.set_hexpand(True)
            note = Gtk.Label(label="Done on Unravel web", xalign=1)
            note.add_css_class("caption")
            note.add_css_class("unravel-muted")
            p_hdr.append(kicker)
            p_hdr.append(note)
            p_sec.append(p_hdr)
            for prac in practices:
                p_sec.append(self._build_practice_row(prac, done=False))
            self._body.append(p_sec)

        if not any_open:
            empty = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
            empty.add_css_class("unravel-empty-card")
            t = Gtk.Label(
                label="Everything on Today is complete" if done_total > 0 else "Your day is open & clear",
            )
            t.add_css_class("unravel-display")
            t.add_css_class("title-3")
            sub = Gtk.Label(
                label="Switch to Focus for an open session, or enjoy the stillness."
            )
            sub.set_wrap(True)
            sub.set_justify(Gtk.Justification.CENTER)
            sub.add_css_class("caption")
            sub.add_css_class("unravel-muted")
            empty.append(t)
            empty.append(sub)
            self._body.append(empty)

        if completed or completed_practices:
            exp = Gtk.Expander(label=f"Done today · {done_total}")
            exp.set_expanded(self._done_expanded)
            exp.connect("notify::expanded", lambda e, _p: setattr(self, "_done_expanded", e.get_expanded()))
            done_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=7)
            done_box.set_margin_top(10)
            for item in completed:
                done_box.append(self._build_item_row(item, kind="done", done=True))
            for prac in completed_practices:
                done_box.append(self._build_practice_row(prac, done=True))
            exp.set_child(done_box)
            self._body.append(exp)

    def _build_practice_row(self, prac: dict[str, Any], *, done: bool) -> Gtk.Box:
        """Calm, clearly read-only row for selected Mind/Heart practices done on Unravel web."""
        group = str(prac.get("group") or "mind")
        glyph_char = "✓" if done else ("♡" if group == "heart" else ("☾" if group == "close" else "✦"))
        glyph_css = "unravel-glyph-heart" if group == "heart" else ("unravel-glyph-close" if group == "close" else "unravel-glyph-mind")
        badge_css = "unravel-badge-heart" if group == "heart" else ("unravel-badge-selected" if group == "close" else "unravel-badge-mind")

        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        row.add_css_class("unravel-practice-row")
        row.set_valign(Gtk.Align.CENTER)

        glyph = Gtk.Label(label=glyph_char)
        glyph.add_css_class("unravel-practice-glyph")
        glyph.add_css_class(glyph_css)
        glyph.set_valign(Gtk.Align.CENTER)
        glyph.set_halign(Gtk.Align.CENTER)
        row.append(glyph)

        col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        col.set_hexpand(True)

        title = Gtk.Label(label=str(prac.get("title") or ""), xalign=0)
        title.add_css_class("unravel-row-title")
        title.set_wrap(True)
        title.set_wrap_mode(Pango.WrapMode.WORD_CHAR)
        if done:
            title.add_css_class("unravel-done-title")
        col.append(title)

        meta = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        g_lbl = Gtk.Label(label=str(prac.get("scheduleLabel") or group.capitalize()))
        g_lbl.add_css_class("unravel-badge")
        g_lbl.add_css_class(badge_css)
        meta.append(g_lbl)

        if done:
            if prac.get("detail"):
                d_lbl = Gtk.Label(label=str(prac["detail"]))
                d_lbl.add_css_class("unravel-badge")
                d_lbl.add_css_class("unravel-badge-meta")
                meta.append(d_lbl)
            if prac.get("completedTime"):
                t_lbl = Gtk.Label(label=str(prac["completedTime"]))
                t_lbl.add_css_class("unravel-badge")
                t_lbl.add_css_class("unravel-badge-meta")
                meta.append(t_lbl)
        else:
            if prac.get("timeHint"):
                h_lbl = Gtk.Label(label=str(prac["timeHint"]))
                h_lbl.add_css_class("unravel-badge")
                h_lbl.add_css_class("unravel-badge-meta")
                meta.append(h_lbl)
            web_lbl = Gtk.Label(label="Web only")
            web_lbl.add_css_class("unravel-badge")
            web_lbl.add_css_class("unravel-badge-meta")
            meta.append(web_lbl)

        col.append(meta)
        row.append(col)

        if not done and prac.get("href"):
            open_btn = Gtk.Button.new_from_icon_name("adw-external-link-symbolic")
            open_btn.add_css_class("flat")
            open_btn.add_css_class("unravel-header-btn")
            open_btn.set_valign(Gtk.Align.CENTER)
            open_btn.set_tooltip_text(f"Open {prac.get('title', 'Practice')} in Unravel web")
            href = str(prac["href"])
            open_btn.connect("clicked", lambda _b, path=href: self._on_open_web(path))
            row.append(open_btn)

        return row

    def _build_item_row(self, item: dict[str, Any], *, kind: str, done: bool) -> Gtk.Box:
        item_id = str(item["id"])
        selected = not done and self._selected_id == item_id
        busy = item_id in self._pending_ids

        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=11)
        row.add_css_class("unravel-day-row")
        if selected:
            row.add_css_class("unravel-day-row-selected")
        row.set_valign(Gtk.Align.CENTER)

        # 1. Tactile circular check-off button
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

        # 2. Clickable item content (selects & opens Focus)
        select_btn = Gtk.Button()
        select_btn.add_css_class("flat")
        select_btn.set_hexpand(True)
        select_btn.set_sensitive(not done)
        select_btn.set_tooltip_text("Select for Focus timer" if not done else "")
        select_btn.connect("clicked", lambda _b, it=item: self._on_select(it))

        col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        col.set_halign(Gtk.Align.FILL)

        title_lbl = Gtk.Label(label=str(item.get("title") or ""), xalign=0)
        title_lbl.add_css_class("unravel-row-title")
        title_lbl.set_wrap(True)
        title_lbl.set_wrap_mode(Pango.WrapMode.WORD_CHAR)
        if done:
            title_lbl.add_css_class("unravel-done-title")
        col.append(title_lbl)

        meta = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)
        on_timer_badge: Gtk.Label | None = None
        has_other_meta = False

        if not done:
            on_timer_badge = Gtk.Label(label="On timer")
            on_timer_badge.add_css_class("unravel-badge")
            on_timer_badge.add_css_class("unravel-badge-selected")
            on_timer_badge.set_visible(selected)
            meta.append(on_timer_badge)

        if kind == "overdue" and isinstance(item.get("daysUntilDue"), int) and item["daysUntilDue"] < 0:
            days_late = abs(int(item["daysUntilDue"]))
            b = Gtk.Label(label=f"{days_late}d late")
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-overdue")
            meta.append(b)
            has_other_meta = True

        prio = item.get("priority")
        if not done and prio in ("P1", "P2"):
            b = Gtk.Label(label=prio)
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-p1" if prio == "P1" else "unravel-badge-p2")
            meta.append(b)
            has_other_meta = True

        if item.get("type") == "HABIT":
            anchor = item.get("timeAnchorMinutes")
            lbl = _format_anchor(anchor) if isinstance(anchor, int) else "Habit"
            b = Gtk.Label(label=lbl)
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-habit")
            meta.append(b)
            has_other_meta = True

        proj = item.get("project")
        if isinstance(proj, dict) and proj.get("name"):
            color_hex = _safe_hex(proj.get("color"))
            escaped_name = GLib.markup_escape_text(str(proj["name"]))
            p_lbl = Gtk.Label()
            p_lbl.set_markup(f'<span foreground="{color_hex}">●</span> {escaped_name}')
            p_lbl.set_max_width_chars(18)
            p_lbl.set_ellipsize(Pango.EllipsizeMode.END)
            p_lbl.add_css_class("unravel-badge")
            p_lbl.add_css_class("unravel-badge-meta")
            meta.append(p_lbl)
            has_other_meta = True

        est = item.get("estimatedSeconds")
        logged = item.get("loggedSeconds")
        if isinstance(est, int) and est > 0 and isinstance(logged, int) and logged > 0:
            b = Gtk.Label(label=f"{format_duration(logged)} / {format_duration(est)}")
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-meta")
            meta.append(b)
            has_other_meta = True
        elif isinstance(est, int) and est > 0:
            b = Gtk.Label(label=format_duration(est))
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-meta")
            meta.append(b)
            has_other_meta = True
        elif isinstance(logged, int) and logged > 0:
            b = Gtk.Label(label=f"{format_duration(logged)} done")
            b.add_css_class("unravel-badge")
            b.add_css_class("unravel-badge-meta")
            meta.append(b)
            has_other_meta = True

        meta.set_visible(selected or has_other_meta)
        col.append(meta)

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
                h_lbl.add_css_class("unravel-muted")
                h_lbl.set_ellipsize(Pango.EllipsizeMode.END)
                col.append(h_lbl)

        select_btn.set_child(col)
        row.append(select_btn)

        # 3. One-click Start Timer button
        if not done:
            play_btn = Gtk.Button.new_from_icon_name("media-playback-start-symbolic")
            play_btn.add_css_class("flat")
            play_btn.add_css_class("unravel-row-play")
            play_btn.set_valign(Gtk.Align.CENTER)
            play_btn.set_tooltip_text("Focus on this now")
            play_btn.connect("clicked", lambda _b, it=item: self._on_start(it))
            row.append(play_btn)

        self._row_refs[item_id] = (row, check_btn, on_timer_badge, meta)
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
