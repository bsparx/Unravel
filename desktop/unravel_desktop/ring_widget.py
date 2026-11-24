"""Serene Cairo Time-Timer ring widget matching Unravel's focus/flow/rest aesthetic."""

from __future__ import annotations

import math

import gi

gi.require_version("Gtk", "4.0")
from gi.repository import Gtk


# Soft RGBA palettes for light and dark themes.
PALETTES = {
    "light": {
        "track": (0.06, 0.09, 0.16, 0.09),
        "well": (1.0, 1.0, 1.0, 0.72),
        "focus": (0.06, 0.46, 0.43, 1.0),       # deep teal
        "flow": (0.05, 0.58, 0.45, 1.0),        # vibrant emerald flow
        "rest": (0.38, 0.36, 0.76, 1.0),        # serene indigo rest
        "overrun": (0.86, 0.25, 0.28, 1.0),     # calm coral overrun
        "ink": (0.09, 0.11, 0.16, 1.0),
        "muted": (0.39, 0.45, 0.54, 1.0),
    },
    "dark": {
        "track": (1.0, 1.0, 1.0, 0.11),
        "well": (0.12, 0.14, 0.20, 0.72),
        "focus": (0.20, 0.80, 0.74, 1.0),
        "flow": (0.24, 0.85, 0.62, 1.0),
        "rest": (0.58, 0.56, 0.94, 1.0),
        "overrun": (0.96, 0.44, 0.44, 1.0),
        "ink": (0.95, 0.96, 0.99, 1.0),
        "muted": (0.63, 0.69, 0.78, 1.0),
    },
}


class TimerRingWidget(Gtk.DrawingArea):
    """Draining Time-Timer arc with centered digits, eyebrow, and optional subline."""

    def __init__(self, size: int = 248, compact: bool = False) -> None:
        super().__init__()
        self._compact = compact
        self.set_content_width(size)
        self.set_content_height(size)
        self.set_halign(Gtk.Align.CENTER)
        self.set_valign(Gtk.Align.CENTER)

        self._progress = 1.0
        self._tone = "focus"  # focus | flow | rest | overrun
        self._readout = "25:00"
        self._eyebrow = ""
        self._subline = ""
        self._dark = False
        self._pulse = False

        self.set_draw_func(self._draw)

    def set_state(
        self,
        *,
        progress: float,
        tone: str,
        readout: str,
        eyebrow: str = "",
        subline: str = "",
        dark: bool = False,
        pulse: bool = False,
    ) -> None:
        self._progress = max(0.0, min(1.0, progress))
        self._tone = tone if tone in ("focus", "flow", "rest", "overrun") else "focus"
        self._readout = readout
        self._eyebrow = eyebrow
        self._subline = subline
        self._dark = dark
        self._pulse = pulse
        self.queue_draw()

    def _draw(self, _area: Gtk.DrawingArea, cr, width: int, height: int) -> None:
        pal = PALETTES["dark" if self._dark else "light"]
        cx = width / 2.0
        cy = height / 2.0
        size = min(width, height)
        stroke = max(5.0, size * (0.075 if self._compact else 0.055))
        radius = (size / 2.0) - stroke - 4.0

        # Soft frosted inner well
        cr.arc(cx, cy, radius - stroke * 0.55, 0, 2 * math.pi)
        cr.set_source_rgba(*pal["well"])
        cr.fill()

        # Background track circle
        cr.set_line_width(stroke)
        cr.arc(cx, cy, radius, 0, 2 * math.pi)
        cr.set_source_rgba(*pal["track"])
        cr.stroke()

        # Subtle soft halo during Pomodoro Flow / Recovery
        accent = pal[self._tone]
        if self._pulse and not self._compact:
            cr.set_line_width(stroke * 1.9)
            cr.arc(cx, cy, radius, 0, 2 * math.pi)
            cr.set_source_rgba(accent[0], accent[1], accent[2], 0.11)
            cr.stroke()

        # Active arc (12 o'clock clockwise)
        if self._progress > 0.002:
            start_angle = -math.pi / 2.0
            end_angle = start_angle + 2.0 * math.pi * self._progress
            cr.set_line_width(stroke)
            cr.set_line_cap(1)  # CAIRO_LINE_CAP_ROUND
            cr.arc(cx, cy, radius, start_angle, end_angle)
            cr.set_source_rgba(*accent)
            cr.stroke()

        if self._compact:
            return

        # Centered readout digits
        cr.select_font_face("Sans", 0, 1)  # normal slant, bold weight
        digit_scale = 0.20 if len(self._readout) <= 5 else 0.165 if len(self._readout) <= 7 else 0.14
        cr.set_font_size(size * digit_scale)
        ext = cr.text_extents(self._readout)
        cr.set_source_rgba(*pal["ink"])
        cr.move_to(cx - ext.width / 2.0 - ext.x_bearing, cy + ext.height / 2.0 - 2.0)
        cr.show_text(self._readout)

        # Eyebrow above readout
        if self._eyebrow:
            cr.select_font_face("Sans", 0, 0)
            cr.set_font_size(max(10.0, size * 0.052))
            e_ext = cr.text_extents(self._eyebrow)
            if self._tone in ("flow", "overrun"):
                cr.set_source_rgba(*accent)
            else:
                cr.set_source_rgba(*pal["muted"])
            cr.move_to(cx - e_ext.width / 2.0 - e_ext.x_bearing, cy - size * 0.145)
            cr.show_text(self._eyebrow)

        # Subline beneath readout
        if self._subline:
            cr.select_font_face("Sans", 0, 0)
            cr.set_font_size(max(10.0, size * 0.052))
            s_ext = cr.text_extents(self._subline)
            cr.set_source_rgba(*pal["muted"])
            cr.move_to(cx - s_ext.width / 2.0 - s_ext.x_bearing, cy + size * 0.19)
            cr.show_text(self._subline)
