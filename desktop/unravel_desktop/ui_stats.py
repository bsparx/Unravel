"""Read-only 2-week Statistics view with Cairo 14-day Rhythm Chart & Day Detail dialog."""

from __future__ import annotations

import math
from typing import Any, Callable

import cairo
import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gtk

from .timer_engine import format_duration


STATUS_ICON = {
    "done": "✓",
    "bonus": "★",
    "skipped": "–",
    "open": "○",
    "missed": "✕",
    "inactive": "·",
}


def compute_day_summary(day: dict[str, Any], selected_ids: set[str]) -> dict[str, Any]:
    """Mirror `lib/stats-summary.ts` active-day completion & productive time math."""
    done = 0
    total = 0
    practice_seconds = 0
    earliest_ms: int | None = None
    earliest_time: str | None = None

    items_map: dict[str, dict[str, Any]] = day.get("items") or {}
    for item_id in selected_ids:
        entry = items_map.get(item_id)
        if not entry:
            continue
        status = entry.get("status")
        if status == "inactive":
            continue
        if status in ("done", "bonus"):
            done += 1
            total += 1
        elif status in ("missed", "open"):
            total += 1

        if status in ("done", "bonus"):
            practice_seconds += int(entry.get("practiceSeconds") or 0)
            ms = entry.get("completedAtMs")
            tm = entry.get("completedTime")
            if isinstance(ms, (int, float)) and tm:
                if earliest_ms is None or ms < earliest_ms:
                    earliest_ms = int(ms)
                    earliest_time = str(tm)

    pct = round((done / total) * 100) if total > 0 else None
    total_prod = int(day.get("productiveSeconds") or 0) + practice_seconds
    return {
        "done": done,
        "total": total,
        "pct": pct,
        "practice_seconds": practice_seconds,
        "total_productive_seconds": total_prod,
        "first_habit_time": earliest_time,
    }


def _rounded_rect(cr: cairo.Context, x: float, y: float, w: float, h: float, r: float) -> None:
    r = min(r, w / 2.0, h / 2.0)
    cr.new_sub_path()
    cr.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    cr.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    cr.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    cr.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    cr.close_path()


class StatsRhythmChart(Gtk.DrawingArea):
    """Calm 14-day Cairo completion bar chart — click any bar to inspect that day."""

    def __init__(self, on_click_day: Callable[[int], None]) -> None:
        super().__init__()
        self._on_click_day = on_click_day
        self._bars: list[dict[str, Any]] = []
        self._dark = False
        self.set_content_height(136)
        self.set_hexpand(True)
        self.set_draw_func(self._draw)

        click = Gtk.GestureClick()
        click.connect("released", self._on_released)
        self.add_controller(click)

    def set_bars(self, bars: list[dict[str, Any]], dark: bool) -> None:
        self._bars = bars
        self._dark = dark
        self.queue_draw()

    def _on_released(self, _gesture, _n_press: int, x: float, _y: float) -> None:
        if not self._bars:
            return
        w = max(1, self.get_width())
        pad_x = 12.0
        usable = max(1.0, w - pad_x * 2)
        idx = int(((x - pad_x) / usable) * len(self._bars))
        if 0 <= idx < len(self._bars):
            self._on_click_day(idx)

    def _draw(self, _area: Gtk.DrawingArea, cr: cairo.Context, width: int, height: int) -> None:
        if not self._bars:
            return
        n = len(self._bars)
        pad_x = 12.0
        top_pad = 12.0
        bottom_pad = 24.0
        chart_h = max(20.0, height - top_pad - bottom_pad)
        slot_w = (width - pad_x * 2) / n
        bar_w = max(8.0, min(26.0, slot_w * 0.56))

        track_col = (1.0, 1.0, 1.0, 0.08) if self._dark else (0.06, 0.09, 0.16, 0.07)
        muted_col = (0.64, 0.70, 0.79, 0.9) if self._dark else (0.39, 0.45, 0.54, 0.9)
        today_col = (0.20, 0.86, 0.62, 1.0) if self._dark else (0.05, 0.58, 0.52, 1.0)
        fill_top = (0.20, 0.83, 0.76, 0.95) if self._dark else (0.06, 0.60, 0.54, 0.95)
        fill_bot = (0.14, 0.58, 0.66, 0.78) if self._dark else (0.07, 0.44, 0.47, 0.78)

        cr.select_font_face("Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
        cr.set_font_size(10.5)

        for idx, b in enumerate(self._bars):
            cx = pad_x + slot_w * idx + slot_w / 2.0
            bx = cx - bar_w / 2.0

            # Full-height soft track
            _rounded_rect(cr, bx, top_pad, bar_w, chart_h, bar_w / 2.0)
            cr.set_source_rgba(*track_col)
            cr.fill()

            # Completion fill
            pct = b.get("pct")
            if isinstance(pct, (int, float)) and pct > 0:
                fh = max(bar_w * 0.6, chart_h * min(1.0, pct / 100.0))
                fy = top_pad + chart_h - fh
                _rounded_rect(cr, bx, fy, bar_w, fh, bar_w / 2.0)
                grad = cairo.LinearGradient(bx, fy, bx, top_pad + chart_h)
                grad.add_color_stop_rgba(0.0, *(today_col if b.get("is_today") else fill_top))
                grad.add_color_stop_rgba(1.0, *fill_bot)
                cr.set_source(grad)
                cr.fill()

            # Subtle dot if today
            if b.get("is_today"):
                cr.arc(cx, top_pad - 5.5, 2.5, 0, 2 * math.pi)
                cr.set_source_rgba(*today_col)
                cr.fill()

            # Day number label beneath
            lbl = str(b.get("day_num", ""))
            ext = cr.text_extents(lbl)
            cr.set_source_rgba(*(today_col if b.get("is_today") else muted_col))
            cr.move_to(cx - ext.width / 2.0 - ext.x_bearing, height - 6.0)
            cr.show_text(lbl)


class DayDetailDialog(Adw.Dialog):
    """Spacious read-only breakdown for a clicked day (timestamps, sessions, summary)."""

    def __init__(
        self,
        day: dict[str, Any],
        catalog: list[dict[str, Any]],
        selected_ids: set[str],
    ) -> None:
        super().__init__()
        self.set_title(day.get("fullLabel") or day.get("shortLabel") or "Day details")
        self.set_content_width(480)
        self.set_content_height(600)

        summary = compute_day_summary(day, selected_ids)

        view = Adw.ToolbarView()
        view.add_top_bar(Adw.HeaderBar())

        scroll = Gtk.ScrolledWindow()
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        body.set_margin_top(14)
        body.set_margin_bottom(24)
        body.set_margin_start(18)
        body.set_margin_end(18)

        head_card = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=16)
        head_card.add_css_class("unravel-card")
        head_card.set_homogeneous(True)

        pct_str = f"{summary['pct']}%" if summary["pct"] is not None else "—"
        head_card.append(_mini_metric("Completion", pct_str, f"{summary['done']}/{summary['total']} active"))
        head_card.append(
            _mini_metric(
                "Productive",
                format_duration(summary["total_productive_seconds"]) if summary["total_productive_seconds"] > 0 else "0m",
                f"First check-off: {summary['first_habit_time'] or '—'}",
            )
        )
        body.append(head_card)

        items_map: dict[str, dict[str, Any]] = day.get("items") or {}
        sec_title = Gtk.Label(label="HABITS & PRACTICES", xalign=0)
        sec_title.add_css_class("unravel-section-kicker")
        body.append(sec_title)

        list_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        shown = 0
        for item in catalog:
            iid = item["id"]
            if iid not in selected_ids:
                continue
            entry = items_map.get(iid)
            if not entry or entry.get("status") == "inactive":
                continue
            shown += 1
            status = entry.get("status", "open")
            row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
            row.add_css_class("unravel-soft-card")

            icon = Gtk.Label(label=STATUS_ICON.get(status, "·"))
            icon.set_width_chars(2)
            row.append(icon)

            col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
            col.set_hexpand(True)
            title = Gtk.Label(label=item["title"], xalign=0)
            title.set_wrap(True)
            col.append(title)
            sub_parts = [item.get("scheduleLabel", "")]
            if entry.get("detail"):
                sub_parts.append(str(entry["detail"]))
            if entry.get("practiceSeconds"):
                p_lbl = format_duration(int(entry["practiceSeconds"]))
                if entry.get("practiceTimeAssumed"):
                    p_lbl += " assumed"
                sub_parts.append(p_lbl)
            sub = Gtk.Label(label=" · ".join(p for p in sub_parts if p), xalign=0)
            sub.add_css_class("caption")
            sub.add_css_class("dim-label")
            col.append(sub)
            row.append(col)

            time_str = entry.get("completedTime") or status.capitalize()
            t_lbl = Gtk.Label(label=str(time_str))
            t_lbl.add_css_class("caption")
            t_lbl.add_css_class("unravel-mono")
            t_lbl.add_css_class("dim-label")
            row.append(t_lbl)
            list_box.append(row)

        if shown == 0:
            empty = Gtk.Label(label="No active selected items on this day.", xalign=0)
            empty.add_css_class("dim-label")
            list_box.append(empty)
        body.append(list_box)

        sessions: list[dict[str, Any]] = day.get("sessions") or []
        recovery_s = int(day.get("recoverySeconds") or 0)
        if sessions or recovery_s > 0:
            s_head = Gtk.Label(label="TIME LOGGED", xalign=0)
            s_head.add_css_class("unravel-section-kicker")
            body.append(s_head)

            s_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            for s in sessions:
                row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
                row.add_css_class("unravel-soft-card")
                left = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=1)
                left.set_hexpand(True)
                left.append(Gtk.Label(label=s.get("title") or "Focus session", xalign=0))
                meta = f"{s.get('mode', 'FOCUS')}"
                if s.get("timeLabel"):
                    meta += f" · {s['timeLabel']}"
                m_lbl = Gtk.Label(label=meta, xalign=0)
                m_lbl.add_css_class("caption")
                m_lbl.add_css_class("dim-label")
                left.append(m_lbl)
                row.append(left)

                dur = Gtk.Label(label=format_duration(int(s.get("seconds") or 0)))
                dur.add_css_class("unravel-mono")
                row.append(dur)
                s_box.append(row)

            if recovery_s > 0:
                rec_lbl = Gtk.Label(label=f"Recovery rest: {format_duration(recovery_s)}", xalign=0)
                rec_lbl.add_css_class("caption")
                rec_lbl.add_css_class("dim-label")
                s_box.append(rec_lbl)
            body.append(s_box)

        es = day.get("endingSummary")
        if isinstance(es, dict):
            es_head = Gtk.Label(label="ENDING SUMMARY", xalign=0)
            es_head.add_css_class("unravel-section-kicker")
            body.append(es_head)

            es_card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
            es_card.add_css_class("unravel-card")
            for heading, val in (
                ("Remember & focus on again", es.get("keepDoing")),
                ("Try tomorrow", es.get("tryTomorrow")),
                ("Avoid", es.get("avoid")),
            ):
                if val:
                    h = Gtk.Label(label=heading, xalign=0)
                    h.add_css_class("caption")
                    h.add_css_class("dim-label")
                    t = Gtk.Label(label=str(val), xalign=0)
                    t.set_wrap(True)
                    es_card.append(h)
                    es_card.append(t)
            for missed in es.get("missedNotes") or []:
                m_title = missed.get("title", "")
                m_reason = missed.get("reason", "")
                if m_title and m_reason:
                    t = Gtk.Label(label=f"Missed {m_title}: {m_reason}", xalign=0)
                    t.set_wrap(True)
                    t.add_css_class("caption")
                    es_card.append(t)
            body.append(es_card)

        scroll.set_child(body)
        view.set_content(scroll)
        self.set_child(view)


def _mini_metric(label: str, value: str, sub: str) -> Gtk.Box:
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
    l1 = Gtk.Label(label=label, xalign=0)
    l1.add_css_class("caption")
    l1.add_css_class("dim-label")
    l2 = Gtk.Label(label=value, xalign=0)
    l2.add_css_class("unravel-stat-num")
    l3 = Gtk.Label(label=sub, xalign=0)
    l3.add_css_class("caption")
    l3.add_css_class("dim-label")
    box.append(l1)
    box.append(l2)
    box.append(l3)
    return box


class StatsView(Gtk.Box):
    """Read-only 2-week Statistics dashboard with 14-day Rhythm Chart & Day Details."""

    def __init__(
        self,
        *,
        excluded_ids: set[str],
        on_load_window: Callable[[str | None], None],
        on_excluded_changed: Callable[[set[str]], None],
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self._excluded = set(excluded_ids)
        self._on_load_window = on_load_window
        self._on_excluded_changed = on_excluded_changed
        self._data: dict[str, Any] | None = None
        self._dark = False
        self._rendered_days: list[dict[str, Any]] = []

        scroll = Gtk.ScrolledWindow()
        scroll.set_vexpand(True)
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

        clamp = Adw.Clamp()
        clamp.set_maximum_size(760)
        clamp.set_margin_top(16)
        clamp.set_margin_bottom(24)
        clamp.set_margin_start(18)
        clamp.set_margin_end(18)

        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)

        # Navigation & filter strip
        nav = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        self._prev_btn = Gtk.Button.new_from_icon_name("go-previous-symbolic")
        self._prev_btn.add_css_class("circular")
        self._prev_btn.set_tooltip_text("Previous 2 weeks")
        self._prev_btn.connect("clicked", self._go_prev)

        self._range_lbl = Gtk.Label(label="Last 2 weeks")
        self._range_lbl.add_css_class("title-3")
        self._range_lbl.set_hexpand(True)

        self._next_btn = Gtk.Button.new_from_icon_name("go-next-symbolic")
        self._next_btn.add_css_class("circular")
        self._next_btn.set_tooltip_text("Next 2 weeks")
        self._next_btn.connect("clicked", self._go_next)

        self._filter_btn = Gtk.MenuButton(label="Filter")
        self._filter_btn.add_css_class("pill")
        self._filter_pop = Gtk.Popover()
        self._filter_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self._filter_box.set_margin_top(10)
        self._filter_box.set_margin_bottom(10)
        self._filter_box.set_margin_start(12)
        self._filter_box.set_margin_end(12)
        pop_scroll = Gtk.ScrolledWindow()
        pop_scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        pop_scroll.set_max_content_height(320)
        pop_scroll.set_propagate_natural_height(True)
        pop_scroll.set_child(self._filter_box)
        self._filter_pop.set_child(pop_scroll)
        self._filter_btn.set_popover(self._filter_pop)

        refresh_btn = Gtk.Button.new_from_icon_name("view-refresh-symbolic")
        refresh_btn.add_css_class("circular")
        refresh_btn.set_tooltip_text("Refresh statistics")
        refresh_btn.connect("clicked", lambda _b: self._on_load_window(self._current_end()))

        nav.append(self._prev_btn)
        nav.append(self._range_lbl)
        nav.append(self._next_btn)
        nav.append(self._filter_btn)
        nav.append(refresh_btn)
        root.append(nav)

        self._status_lbl = Gtk.Label(label="Loading statistics…")
        self._status_lbl.add_css_class("dim-label")
        root.append(self._status_lbl)

        # 4 summary KPI cards (responsive 2x2 or 4-across)
        self._cards_grid = Gtk.Grid(column_spacing=10, row_spacing=10)
        self._cards_grid.set_column_homogeneous(True)
        root.append(self._cards_grid)

        # 14-day Cairo Rhythm Chart card
        chart_card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        chart_card.add_css_class("unravel-card")
        chart_hdr = Gtk.Label(label="14-DAY RHYTHM · CLICK ANY BAR FOR DETAILS", xalign=0)
        chart_hdr.add_css_class("unravel-section-kicker")
        self._chart = StatsRhythmChart(on_click_day=self._on_chart_day_clicked)
        chart_card.append(chart_hdr)
        chart_card.append(self._chart)
        root.append(chart_card)

        days_head = Gtk.Label(label="DAILY BREAKDOWN", xalign=0)
        days_head.add_css_class("unravel-section-kicker")
        root.append(days_head)

        self._days_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        root.append(self._days_box)

        clamp.set_child(root)
        scroll.set_child(clamp)
        self.append(scroll)

    def set_dark(self, dark: bool) -> None:
        if self._dark != dark:
            self._dark = dark
            self._render()

    def set_loading(self, text: str = "Refreshing statistics…") -> None:
        self._status_lbl.set_text(text)
        self._status_lbl.set_visible(True)

    def set_error(self, message: str) -> None:
        self._status_lbl.set_text(message)
        self._status_lbl.set_visible(True)

    def set_data(self, data: dict[str, Any]) -> None:
        self._data = data
        self._status_lbl.set_visible(False)
        self._rebuild_filter_popover()
        self._render()

    def _current_end(self) -> str | None:
        if not self._data or self._data.get("isLatest"):
            return None
        return self._data.get("endISO")

    def _go_prev(self, _btn: Gtk.Button) -> None:
        if self._data and self._data.get("prevEndISO"):
            self._on_load_window(self._data["prevEndISO"])

    def _go_next(self, _btn: Gtk.Button) -> None:
        if not self._data:
            return
        nxt = self._data.get("nextEndISO")
        if nxt == "latest":
            self._on_load_window(None)
        elif nxt:
            self._on_load_window(nxt)

    def _selected_ids(self) -> set[str]:
        if not self._data:
            return set()
        return {item["id"] for item in self._data.get("items") or [] if item["id"] not in self._excluded}

    def _rebuild_filter_popover(self) -> None:
        while (child := self._filter_box.get_first_child()) is not None:
            self._filter_box.remove(child)
        if not self._data:
            return
        for item in self._data.get("items") or []:
            iid = item["id"]
            cb = Gtk.CheckButton(label=f"{item['title']} ({item.get('scheduleLabel', '')})")
            cb.set_active(iid not in self._excluded)
            cb.connect("toggled", self._on_filter_toggled, iid)
            self._filter_box.append(cb)

    def _on_filter_toggled(self, cb: Gtk.CheckButton, item_id: str) -> None:
        if cb.get_active():
            self._excluded.discard(item_id)
        else:
            self._excluded.add(item_id)
        self._on_excluded_changed(set(self._excluded))
        self._render()

    def _on_chart_day_clicked(self, idx: int) -> None:
        if not self._data or idx < 0 or idx >= len(self._rendered_days):
            return
        day = self._rendered_days[idx]
        self._open_day_detail(None, day, self._data.get("items") or [], self._selected_ids())

    def _render(self) -> None:
        if not self._data:
            return
        data = self._data
        self._range_lbl.set_text(data.get("rangeLabel") or "Last 2 weeks")
        self._next_btn.set_sensitive(not data.get("isLatest"))

        catalog = data.get("items") or []
        days = data.get("days") or []
        self._rendered_days = days
        selected = self._selected_ids()

        win_done = 0
        win_total = 0
        win_prod = 0
        active_days = 0
        today_day: dict[str, Any] | None = None
        today_sum: dict[str, Any] | None = None

        day_summaries: list[tuple[dict[str, Any], dict[str, Any]]] = []
        chart_bars: list[dict[str, Any]] = []
        for day in days:
            s = compute_day_summary(day, selected)
            day_summaries.append((day, s))
            chart_bars.append(
                {
                    "pct": s["pct"],
                    "is_today": bool(day.get("isToday")),
                    "day_num": day.get("dayNumber", ""),
                }
            )
            win_done += s["done"]
            win_total += s["total"]
            win_prod += s["total_productive_seconds"]
            if s["done"] > 0 or s["total_productive_seconds"] > 0:
                active_days += 1
            if day.get("isToday"):
                today_day = day
                today_sum = s

        self._chart.set_bars(chart_bars, self._dark)

        while (child := self._cards_grid.get_first_child()) is not None:
            self._cards_grid.remove(child)

        win_pct = f"{round((win_done / win_total) * 100)}%" if win_total > 0 else "—"
        avg_prod = round(win_prod / active_days) if active_days > 0 else 0

        c1 = _mini_metric("2-week completion", win_pct, f"{win_done} / {win_total} active")
        c1.add_css_class("unravel-card")
        c2 = _mini_metric(
            "Productive time",
            format_duration(win_prod) if win_prod > 0 else "0m",
            f"Avg {format_duration(avg_prod)} / active day" if avg_prod > 0 else "No time logged yet",
        )
        c2.add_css_class("unravel-card")
        c3 = _mini_metric(
            "Today",
            f"{today_sum['done']}/{today_sum['total']}" if today_sum else "—",
            format_duration(today_sum["total_productive_seconds"]) if today_sum and today_sum["total_productive_seconds"] > 0 else "0m logged today",
        )
        c3.add_css_class("unravel-card")
        c4 = _mini_metric(
            "First habit today",
            (today_sum["first_habit_time"] or "—") if today_sum else "—",
            "Earliest check-off" if today_day else "Latest window",
        )
        c4.add_css_class("unravel-card")

        self._cards_grid.attach(c1, 0, 0, 1, 1)
        self._cards_grid.attach(c2, 1, 0, 1, 1)
        self._cards_grid.attach(c3, 2, 0, 1, 1)
        self._cards_grid.attach(c4, 3, 0, 1, 1)

        while (child := self._days_box.get_first_child()) is not None:
            self._days_box.remove(child)

        for day, s in reversed(day_summaries):
            btn = Gtk.Button()
            btn.add_css_class("flat")
            btn.add_css_class("unravel-soft-card")
            btn.add_css_class("unravel-day-btn")
            if day.get("isToday"):
                btn.add_css_class("unravel-day-today")
            btn.connect("clicked", self._open_day_detail, day, catalog, selected)

            row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
            date_lbl = Gtk.Label(
                label=f"{day.get('shortLabel', '')}{' · Today' if day.get('isToday') else ''}",
                xalign=0,
            )
            date_lbl.set_width_chars(16)
            row.append(date_lbl)

            bar = Gtk.ProgressBar()
            bar.set_fraction((s["pct"] / 100.0) if s["pct"] is not None else 0.0)
            bar.set_valign(Gtk.Align.CENTER)
            bar.set_hexpand(True)
            row.append(bar)

            ratio = f"{s['done']}/{s['total']}" if s["total"] > 0 else "—"
            ratio_lbl = Gtk.Label(label=ratio)
            ratio_lbl.add_css_class("unravel-mono")
            ratio_lbl.add_css_class("caption")
            ratio_lbl.set_width_chars(5)
            row.append(ratio_lbl)

            dur_str = format_duration(s["total_productive_seconds"]) if s["total_productive_seconds"] > 0 else "—"
            dur_lbl = Gtk.Label(label=dur_str, xalign=1)
            dur_lbl.add_css_class("unravel-mono")
            dur_lbl.add_css_class("caption")
            dur_lbl.add_css_class("dim-label")
            dur_lbl.set_width_chars(7)
            row.append(dur_lbl)

            first_lbl = Gtk.Label(label=s["first_habit_time"] or "", xalign=1)
            first_lbl.add_css_class("unravel-mono")
            first_lbl.add_css_class("caption")
            first_lbl.add_css_class("dim-label")
            first_lbl.set_width_chars(5)
            row.append(first_lbl)

            btn.set_child(row)
            self._days_box.append(btn)

    def _open_day_detail(
        self,
        _btn: Gtk.Button | None,
        day: dict[str, Any],
        catalog: list[dict[str, Any]],
        selected: set[str],
    ) -> None:
        dlg = DayDetailDialog(day, catalog, selected)
        dlg.present(self.get_root())
